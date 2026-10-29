-- ENSAIO de supabase/migrations/20261030090000_lista_de_aprovados_substituir_preserva_o_estado.sql: roda o corpo e desfaz (rollback).
-- Com duas listas vigentes reais (E1: a XLSX com mais status; E2: a XLSX com mais status entre as que têm sub judice),
-- como um administrador global: a prévia (pedir_casamento_da_lista) da "mesma planilha" (no E1 sem 5 pessoas com status)
-- fica PENDENTE esperando o job; o plano — o do job Python quando o roteiro o põe em t_plano_python, senão por construção —
-- é gravado como o job grava (gravar_casamento_da_lista); aplicar sem motivo é recusado; com motivo, cada casada leva
-- status, matrícula, processo, DT_CONVOCACAO e sub judice; quem ficou fora com status vira pendência; os sub judice sem
-- par continuam; o histórico ganha a publicação com motivo; os contratados batem com a lista nova; inativar recalcula;
-- remover zera. Nada sai do banco: o pedido do job fica sem chave (agsus.segredo_disparo_robos). O resultado (json)
-- traz só números e verdadeiro/falso.
begin;

set local agsus.segredo_disparo_robos = 'ensaio-sem-chave';

-- ═══ CORPO DA MIGRATION (início) ═══

set local lock_timeout = '5s';

-- 0. Pré-requisitos -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb)') is null
     or to_regprocedure('public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean, text)') is null
     or to_regprocedure('private."FC_RECOLOCAR_NA_CLASSIFICACAO"(uuid, text)') is null then
    raise exception 'Aplique antes 20261006070000_integridade_das_listas_e_kpis.sql.';
  end if;
  if to_regprocedure('private."FC_ADMIN_GLOBAL_ATIVO"(uuid)') is null then
    raise exception 'Aplique antes 20261022210000_reinicio_das_fichas_com_dois_administradores.sql.';
  end if;
  if to_regprocedure('private."FC_EM_OUTRA_LISTA"(uuid)') is null then
    raise exception 'Aplique antes 20261024120000_contratado_em_outra_lista.sql.';
  end if;
  if to_regprocedure('private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(boolean)') is null
     or position('pacotes-dos-paineis.yml' in (select prosrc from pg_proc
                   where oid = 'private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text)'::regprocedure)) = 0 then
    raise exception 'Aplique antes 20261029170000 e 20261029180000.';
  end if;
end;
$$;

-- 1. A lista nova e os vínculos, em tabelas temporárias da transação ----------------------------
create or replace function private."FC_PREPARAR_NOVA_VERSAO_DA_LISTA"()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  create temporary table if not exists tmp_lista_nova (
    chave text not null, analise_id uuid, nome text, cargo text, codigo_vaga text,
    posicao integer, nota numeric, situacao text, modalidade text, ordem bigint
  ) on commit drop;
  create temporary table if not exists tmp_lista_vinculo (
    candidato_id uuid, chave text, forma text
  ) on commit drop;
  create index if not exists tmp_lista_nova_chave on pg_temp.tmp_lista_nova (chave);
  create index if not exists tmp_lista_vinculo_chave on pg_temp.tmp_lista_vinculo (chave);
  create index if not exists tmp_lista_vinculo_candidato on pg_temp.tmp_lista_vinculo (candidato_id);
  truncate pg_temp.tmp_lista_nova;
  truncate pg_temp.tmp_lista_vinculo;
end;
$function$;
comment on function private."FC_PREPARAR_NOVA_VERSAO_DA_LISTA"() is
  'Cria (ou esvazia) pg_temp.tmp_lista_nova (quem entra, uma linha por chave) e pg_temp.tmp_lista_vinculo (quem da lista vigente é quem entra: o plano do job). 20261030090000.';
revoke all on function private."FC_PREPARAR_NOVA_VERSAO_DA_LISTA"() from public, anon, authenticated;

-- 2. A assinatura da lista vigente (mudou entre a prévia e o aplicar?) ------------------------
create or replace function private."FC_BASE_DA_LISTA"(p_lista uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select md5(coalesce(string_agg(concat_ws('|', c.id, c.nome, c.codigo_vaga, c.classificacao, c.status,
                                            c.matricula, c.processo_sei, c.sub_judice, c.alterado_judicialmente,
                                            c."CO_ANALISE_CURRICULAR"), ',' order by c.id), ''))
    from public."TB_CANDIDATO_APROVADO" c
   where p_lista is not null and c.lista_id = p_lista and c.removido_em is null;
$function$;
comment on function private."FC_BASE_DA_LISTA"(uuid) is
  'Assinatura (md5) do que o casamento lê da lista vigente: pessoas, posição, vaga, status, matrícula, processo, sub judice e análise. O plano só vale se ela não mudou. 20261030090000.';
revoke all on function private."FC_BASE_DA_LISTA"(uuid) from public, anon, authenticated;

-- 3. Quem pode publicar uma nova versão (o mesmo nos dois caminhos, pela matriz de Acessos) -----
create or replace function private."FC_PODE_SUBSTITUIR_LISTA"()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private."FC_ADMIN_GLOBAL_ATIVO"((select auth.uid())) or private.pode_recurso('importacao', 3);
$function$;
comment on function private."FC_PODE_SUBSTITUIR_LISTA"() is
  'Quem substitui, publica de novo ou remove a lista de aprovados de um edital: o administrador global, ou quem tem Importação nível 3 na matriz de Acessos (grupo ou permissão individual). 20261030090000.';
revoke all on function private."FC_PODE_SUBSTITUIR_LISTA"() from public, anon, authenticated;

create or replace function private."FC_EXIGE_MOTIVO_PARA_SUBSTITUIR"(p_anterior uuid, p_origem_nova text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select p_anterior is not null and (
    (p_origem_nova = 'XLSX'
     and (select l."TP_ORIGEM" from public."TB_LISTA_APROVADO" l where l.id = p_anterior) = 'CLASSIFICACAO')
    or exists (
      select 1 from public."TB_CANDIDATO_APROVADO" c
       where c.lista_id = p_anterior and c.removido_em is null
         and (c.status is not null or c.sub_judice or c.alterado_judicialmente
              or nullif(btrim(coalesce(c.matricula, '')), '') is not null
              or nullif(btrim(coalesce(c.processo_sei, '')), '') is not null)));
$function$;
comment on function private."FC_EXIGE_MOTIVO_PARA_SUBSTITUIR"(uuid, text) is
  'Substituir a lista vigente exige motivo: alguém nela tem status, matrícula, processo, sub judice ou alteração judicial — ou ela foi publicada da Classificação e a nova vem da planilha. 20261030090000.';
revoke all on function private."FC_EXIGE_MOTIVO_PARA_SUBSTITUIR"(uuid, text) from public, anon, authenticated;

create or replace function private."FC_EXIGIR_PODE_SUBSTITUIR_LISTA"(
  p_edital text, p_anterior uuid, p_origem_nova text, p_motivo text, p_conferir_motivo boolean
)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if v_motivo is not null and length(v_motivo) not between 3 and 500 then
    raise exception 'O motivo deve ter entre 3 e 500 caracteres.' using errcode = '22023';
  end if;
  if exists (select 1 from public."TB_LISTA_APROVADO" l where l.edital_id = p_edital)
     and not private."FC_PODE_SUBSTITUIR_LISTA"() then
    raise exception 'Sem permissão para substituir ou publicar de novo uma lista já cadastrada (Importação nível administrador).' using errcode = '42501';
  end if;
  if p_conferir_motivo and v_motivo is null
     and private."FC_EXIGE_MOTIVO_PARA_SUBSTITUIR"(p_anterior, p_origem_nova) then
    raise exception 'A lista vigente tem status, matrícula ou sub judice (ou foi publicada da Classificação). Para substituí-la, informe o motivo.' using errcode = '22023';
  end if;
end;
$function$;
comment on function private."FC_EXIGIR_PODE_SUBSTITUIR_LISTA"(text, uuid, text, text, boolean) is
  'A mesma regra para o XLSX e a Classificação: edital que já teve lista só quem pode substituir (FC_PODE_SUBSTITUIR_LISTA: admin global ou Importação nível 3) publica de novo; com p_conferir_motivo, exige o motivo de 3 a 500 caracteres quando FC_EXIGE_MOTIVO_PARA_SUBSTITUIR. 20261030090000.';
revoke all on function private."FC_EXIGIR_PODE_SUBSTITUIR_LISTA"(text, uuid, text, text, boolean) from public, anon, authenticated;

create or replace function private."FC_EXIGIR_PEDIR_NOVA_VERSAO"(p_edital uuid, p_origem text)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Usuario nao autenticado' using errcode = '42501';
  end if;
  if p_origem not in ('XLSX', 'CLASSIFICACAO') then
    raise exception 'Origem inválida.' using errcode = '22023';
  end if;
  -- O administrador global passa; os outros, pela matriz de Acessos e pela área do edital.
  if private."FC_ADMIN_GLOBAL_ATIVO"((select auth.uid())) then
    return;
  end if;
  if p_origem = 'XLSX' then
    perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
    if not private.pode_recurso('importacao', 2) then
      raise exception 'Sem permissão para este recurso' using errcode = '42501';
    end if;
  else
    perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  end if;
end;
$function$;
comment on function private."FC_EXIGIR_PEDIR_NOVA_VERSAO"(uuid, text) is
  'Quem pede e aplica uma nova versão da lista: o administrador global; pela planilha, Importação nível 2 na área do edital; pela Classificação, Classificação nível 2 no edital (matriz de Acessos). 20261030090000.';
revoke all on function private."FC_EXIGIR_PEDIR_NOVA_VERSAO"(uuid, text) from public, anon, authenticated;

-- 4. Contratados ---------------------------------------------------------------------------------
/*
  A linha nova ainda sem decisão do job "Contratado em outra lista" segue a da linha anterior
  (CO_CANDIDATO_ANTERIOR), a mesma herança que o job grava (TP_MOTIVO HERDADA). Sem isto, entre a
  nova versão da lista e a volta do job, os contratados contariam de novo quem está em outra lista
  (no ensaio, um edital iria de 457 a 504).
*/
create or replace function private."FC_EM_OUTRA_LISTA"(p_candidato uuid)
returns boolean
language sql
stable
set search_path to ''
as $function$
  select coalesce(
    (select x."TP_SITUACAO" = 'OUTRA_LISTA' from public."TB_CONTRATACAO_APROVADO" x
      where x."CO_CANDIDATO_APROVADO" = p_candidato),
    -- Duas buscas pela chave (a linha, depois a anterior): sem junção, o plano não varre as tabelas.
    exists (select 1 from public."TB_CONTRATACAO_APROVADO" x
             where x."CO_CANDIDATO_APROVADO" = (select c."CO_CANDIDATO_ANTERIOR" from public."TB_CANDIDATO_APROVADO" c
                                                  where c.id = p_candidato)
               and x."TP_SITUACAO" = 'OUTRA_LISTA'));
$function$;
comment on function private."FC_EM_OUTRA_LISTA"(uuid) is
  'A linha Contratado está "em outra lista" pelo instantâneo do job (TB_CONTRATACAO_APROVADO): não conta nos contratados. Linha sem decisão segue a da linha anterior (CO_CANDIDATO_ANTERIOR) até o job voltar. 20261024120000, 20261030090000.';
revoke all on function private."FC_EM_OUTRA_LISTA"(uuid) from public, anon, authenticated;

-- Sem lista vigente, zera (se o edital já teve lista).
CREATE OR REPLACE FUNCTION private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(p_edital uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_qt integer;
begin
  if p_edital is null
     or not exists (select 1 from public."TB_LISTA_APROVADO" l where l.edital_id = p_edital::text) then
    return 0;
  end if;
  update public."TB_MONITORAMENTO_INDIGENA" m
     set contratados = n.qt, updated_at = now()
    from (select coalesce((count(c.id) filter (where c.status in ('Contratado', 'Migração') and not private."FC_EM_OUTRA_LISTA"(c.id)))::integer, 0) qt
            from public."TB_LISTA_APROVADO" l
            left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
           where l.edital_id = p_edital::text and l.vigente is true) n
   where m.id = p_edital and m.ativo and m.contratados is distinct from n.qt;
  get diagnostics v_qt = row_count;
  return v_qt;
end;
$function$;
comment on function private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(uuid) is
  'Atualiza TB_MONITORAMENTO_INDIGENA.contratados de um edital ativo pela lista de aprovados vigente (Contratado ou Migração, menos os em outra lista); sem lista vigente, zera — só quando o edital já teve lista (20261030090000). Só grava se mudou.';
revoke all on function private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(uuid) from public, anon, authenticated;

-- 5. A nova versão da lista: a gravação comum aos dois caminhos ---------------------------------
create or replace function private."FC_GRAVAR_NOVA_VERSAO_DA_LISTA"(
  p_edital uuid,
  p_anterior uuid,
  p_origem text,
  p_ativo boolean,
  p_arquivo_nome text,
  p_arquivo_path text,
  p_lista_classificacao uuid,
  p_regra uuid,
  p_versao_regra integer,
  p_hash text,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_autor record;
  v_nova uuid;
  v_publicacao uuid;
  v_qt integer;
  v_entra integer;
  v_sai integer;
  v_muda integer;
  v_preservado integer;
  v_mantido integer;
  v_pendencias jsonb;
  v_aplicados jsonb;
  v_c record;
begin
  if p_origem not in ('XLSX', 'CLASSIFICACAO') then
    raise exception 'Origem inválida.' using errcode = '22023';
  end if;

  -- Os vínculos, conferidos.
  if exists (select 1 from pg_temp.tmp_lista_vinculo k
              where k.candidato_id is null or k.chave is null
                 or k.forma not in ('ANALISE', 'NOME', 'NOME_VAGA', 'MANUAL')) then
    raise exception 'Vínculo inválido.' using errcode = '22023';
  end if;
  if (select count(*) <> count(distinct k.candidato_id) or count(*) <> count(distinct k.chave)
        from pg_temp.tmp_lista_vinculo k) then
    raise exception 'Cada pessoa só pode ser vinculada uma vez.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.tmp_lista_vinculo k
              where not exists (select 1 from public."TB_CANDIDATO_APROVADO" o
                                 where o.id = k.candidato_id and o.lista_id = p_anterior and o.removido_em is null)) then
    raise exception 'Vínculo com candidato que não está na lista vigente.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.tmp_lista_vinculo k
              where not exists (select 1 from pg_temp.tmp_lista_nova n where n.chave = k.chave)) then
    raise exception 'Vínculo com candidato que não está na lista nova.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.tmp_lista_vinculo k
               join public."TB_CANDIDATO_APROVADO" o on o.id = k.candidato_id
               join pg_temp.tmp_lista_nova n on n.chave = k.chave
              where k.forma = 'ANALISE' and (n.analise_id is null or o."CO_ANALISE_CURRICULAR" is distinct from n.analise_id)) then
    raise exception 'Vínculo pela análise com análise diferente.' using errcode = '22023';
  end if;

  -- O resumo, contra a lista vigente (a mesma conta de resumoDaPublicacao).
  select count(*) filter (where k.chave is null) into v_entra
    from pg_temp.tmp_lista_nova n
    left join pg_temp.tmp_lista_vinculo k on k.chave = n.chave;
  select count(*) filter (where not o.sub_judice),
         count(*) filter (where o.sub_judice),
         coalesce(jsonb_agg(jsonb_build_object(
           'candidato_id', o.id, 'nome', o.nome, 'cargo', o.cargo, 'codigo_vaga', o.codigo_vaga,
           'classificacao', o.classificacao, 'status', o.status, 'matricula', o.matricula,
           'processo_sei', o.processo_sei) order by o.cargo, o.classificacao nulls last, o.nome)
           filter (where not o.sub_judice
                     and (o.status is not null or nullif(btrim(coalesce(o.matricula, '')), '') is not null
                          or nullif(btrim(coalesce(o.processo_sei, '')), '') is not null)), '[]'::jsonb)
    into v_sai, v_mantido, v_pendencias
    from public."TB_CANDIDATO_APROVADO" o
   where o.lista_id = p_anterior and o.removido_em is null
     and not exists (select 1 from pg_temp.tmp_lista_vinculo k where k.candidato_id = o.id);
  select count(*) filter (where o.classificacao is distinct from n.posicao
                             or (nullif(btrim(coalesce(o.codigo_vaga, '')), '') is not null
                                 and lower(btrim(o.codigo_vaga)) <> lower(btrim(coalesce(n.codigo_vaga, ''))))),
         count(*) filter (where o.status is not null or o.sub_judice or o.alterado_judicialmente
                             or nullif(btrim(coalesce(o.matricula, '')), '') is not null
                             or nullif(btrim(coalesce(o.processo_sei, '')), '') is not null),
         coalesce(jsonb_agg(jsonb_build_object('anterior', o.id, 'chave', k.chave, 'analise_id', n.analise_id,
                                               'forma', k.forma) order by o.nome), '[]'::jsonb)
    into v_muda, v_preservado, v_aplicados
    from pg_temp.tmp_lista_vinculo k
    join public."TB_CANDIDATO_APROVADO" o on o.id = k.candidato_id
    join pg_temp.tmp_lista_nova n on n.chave = k.chave;

  -- A lista anterior sai de vigor (fica no histórico, inativa).
  select * into v_autor from private.autor_da_sessao();
  if p_anterior is not null then
    update public."TB_LISTA_APROVADO"
       set vigente = false, ativo = false, substituido_por = v_uid, substituido_em = now(), updated_at = now(),
           "DS_EMAIL_SUBSTITUICAO" = v_autor.email, "NO_USUARIO_SUBSTITUICAO" = v_autor.nome
     where id = p_anterior;
  end if;

  insert into public."TB_LISTA_APROVADO" (
    edital_id, ativo, vigente, arquivo_nome, arquivo_path, importado_por,
    "DS_EMAIL_IMPORTACAO", "NO_USUARIO_IMPORTACAO", "TP_ORIGEM", "CO_LISTA_CLASSIFICACAO"
  ) values (
    p_edital::text, coalesce(p_ativo, true), true, p_arquivo_nome, coalesce(p_arquivo_path, ''),
    v_uid, v_autor.email, v_autor.nome, p_origem, p_lista_classificacao
  ) returning id into v_nova;

  -- Quem entra, com o que é da lista de aprovados de quem casou.
  insert into public."TB_CANDIDATO_APROVADO" (
    lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade,
    status, processo_sei, matricula, "DT_CONVOCACAO", sub_judice, alterado_judicialmente,
    nota_original, modalidade_original, classificacao_original, sub_judice_original,
    "CO_ANALISE_CURRICULAR", "TP_SITUACAO_CLASSIFICACAO", "CO_CANDIDATO_ANTERIOR",
    created_by, updated_by
  )
  select v_nova, n.codigo_vaga, n.cargo, n.posicao,
         case when o.alterado_judicialmente then o.nota else n.nota end,
         n.nome,
         case when o.alterado_judicialmente then coalesce(o.modalidade, n.modalidade) else n.modalidade end,
         o.status, o.processo_sei, o.matricula, o."DT_CONVOCACAO",
         coalesce(o.sub_judice, false), coalesce(o.alterado_judicialmente, false),
         case when o.alterado_judicialmente then n.nota end,
         case when o.alterado_judicialmente then n.modalidade end,
         case when o.alterado_judicialmente then n.posicao end,
         case when o.alterado_judicialmente then false end,
         coalesce(n.analise_id, o."CO_ANALISE_CURRICULAR"), n.situacao, o.id, v_uid, v_uid
    from pg_temp.tmp_lista_nova n
    left join pg_temp.tmp_lista_vinculo k on k.chave = n.chave
    left join public."TB_CANDIDATO_APROVADO" o on o.id = k.candidato_id
   order by n.ordem, n.posicao nulls last, n.nome;

  -- Incluídos por decisão judicial que não estão na lista nova: continuam sub judice.
  insert into public."TB_CANDIDATO_APROVADO" (
    lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade,
    status, processo_sei, matricula, "DT_CONVOCACAO", sub_judice, alterado_judicialmente,
    nota_original, modalidade_original, classificacao_original, sub_judice_original,
    "CO_ANALISE_CURRICULAR", "CO_CANDIDATO_ANTERIOR", created_by, updated_by
  )
  select v_nova, o.codigo_vaga, o.cargo, null, o.nota, o.nome, o.modalidade,
         o.status, o.processo_sei, o.matricula, o."DT_CONVOCACAO", true, o.alterado_judicialmente,
         o.nota_original, o.modalidade_original, o.classificacao_original, o.sub_judice_original,
         o."CO_ANALISE_CURRICULAR", o.id, v_uid, v_uid
    from public."TB_CANDIDATO_APROVADO" o
   where o.lista_id = p_anterior and o.removido_em is null and o.sub_judice
     and not exists (select 1 from pg_temp.tmp_lista_vinculo k where k.candidato_id = o.id);

  -- Os anexos vão junto (cópia; os da lista anterior ficam onde estão).
  insert into public."TB_ANEXO_CANDIDATO_APROVADO" (
    "CO_CANDIDATO", "NO_ARQUIVO", "QT_TAMANHO_BYTES", "IM_ARQUIVO", "CO_USUARIO_INCLUSAO", "DT_INCLUSAO"
  )
  select c.id, x."NO_ARQUIVO", x."QT_TAMANHO_BYTES", x."IM_ARQUIVO", x."CO_USUARIO_INCLUSAO", x."DT_INCLUSAO"
    from public."TB_CANDIDATO_APROVADO" c
    join public."TB_ANEXO_CANDIDATO_APROVADO" x on x."CO_CANDIDATO" = c."CO_CANDIDATO_ANTERIOR"
   where c.lista_id = v_nova;

  -- Sub judice com nota da decisão ou incluído: recoloca pela nota, como a lista faz.
  for v_c in
    select c.id, coalesce(c.modalidade_original, c.modalidade) as modalidade_antes
      from public."TB_CANDIDATO_APROVADO" c
     where c.lista_id = v_nova
       and (c.alterado_judicialmente
            or (c."CO_CANDIDATO_ANTERIOR" is not null
                and not exists (select 1 from pg_temp.tmp_lista_vinculo k
                                 where k.candidato_id = c."CO_CANDIDATO_ANTERIOR")))
     order by c.nota desc, c.nome
  loop
    perform private."FC_RECOLOCAR_NA_CLASSIFICACAO"(v_c.id, v_c.modalidade_antes);
  end loop;

  select count(*) into v_qt from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_nova;

  insert into public."TH_PUBLICACAO_APROVADO" (
    "CO_MONITORAMENTO", "CO_LISTA_APROVADO", "CO_LISTA_APROVADO_ANTERIOR", "TP_ORIGEM",
    "CO_LISTA_CLASSIFICACAO", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA", "DS_HASH_CLASSIFICACAO",
    "QT_CANDIDATO", "QT_ENTRA", "QT_SAI", "QT_MUDA_POSICAO", "QT_PRESERVADO", "QT_SUB_JUDICE_MANTIDO",
    "DS_VINCULO", "DS_PENDENCIA", "DS_MOTIVO", "CO_USUARIO", "DS_EMAIL_USUARIO", "NO_USUARIO"
  ) values (
    p_edital, v_nova, p_anterior, p_origem,
    p_lista_classificacao, p_regra, p_versao_regra, p_hash,
    v_qt, coalesce(v_entra, 0), coalesce(v_sai, 0), coalesce(v_muda, 0), coalesce(v_preservado, 0),
    coalesce(v_mantido, 0),
    (select coalesce(jsonb_agg(a.valor || jsonb_build_object('novo', c.id)), '[]'::jsonb)
       from jsonb_array_elements(v_aplicados) a(valor)
       join public."TB_CANDIDATO_APROVADO" c
         on c.lista_id = v_nova and c."CO_CANDIDATO_ANTERIOR" = (a.valor ->> 'anterior')::uuid),
    v_pendencias, nullif(btrim(coalesce(p_motivo, '')), ''), v_uid, v_autor.email, v_autor.nome
  ) returning "CO_PUBLICACAO" into v_publicacao;

  -- O KPI de contratados do edital já com a lista nova.
  perform private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(p_edital);

  return jsonb_build_object(
    'ok', true, 'lista_id', v_nova, 'publicacao_id', v_publicacao, 'lista_anterior', p_anterior,
    'candidatos', v_qt, 'entram', coalesce(v_entra, 0), 'saem', coalesce(v_sai, 0),
    'mudam', coalesce(v_muda, 0), 'preservados', coalesce(v_preservado, 0),
    'sub_judice_mantidos', coalesce(v_mantido, 0),
    'casados', (select count(*) from pg_temp.tmp_lista_vinculo),
    'pendencias', v_pendencias,
    'importado_por_email', v_autor.email, 'importado_por_nome', v_autor.nome
  );
end;
$function$;
comment on function private."FC_GRAVAR_NOVA_VERSAO_DA_LISTA"(uuid, uuid, text, boolean, text, text, uuid, uuid, integer, text, text) is
  'A nova versão da lista de aprovados (XLSX ou Classificação), a partir de pg_temp.tmp_lista_nova e tmp_lista_vinculo: confere os vínculos, tira a anterior de vigor, leva o estado de quem casou (status, processo SEI, matrícula, DT_CONVOCACAO, sub judice, alteração judicial, análise, CO_CANDIDATO_ANTERIOR, anexos), mantém os sub judice sem par, grava TH_PUBLICACAO_APROVADO e recalcula os contratados. 20261030090000.';
revoke all on function private."FC_GRAVAR_NOVA_VERSAO_DA_LISTA"(uuid, uuid, text, boolean, text, text, uuid, uuid, integer, text, text) from public, anon, authenticated;

-- 6. Remover e ativar/inativar recalculam os contratados ----------------------------------------
create or replace function public.remover_lista_aprovados(p_lista_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_edital_id text;
  v_autor record;
begin
  -- Quem substitui remove (admin global ou Importação nível 3 na matriz de Acessos).
  if not private."FC_PODE_SUBSTITUIR_LISTA"() then
    raise exception 'Sem permissão para remover a lista de aprovados (Importação nível administrador).' using errcode = '42501';
  end if;
  if not private."FC_ADMIN_GLOBAL_ATIVO"((select auth.uid())) then
    perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_LISTA_APROVADO" l where l.id = p_lista_id));
  end if;
  select * into v_autor from private.autor_da_sessao();
  update public."TB_LISTA_APROVADO"
  set vigente = false, ativo = false, substituido_por = (select auth.uid()),
      substituido_em = now(), updated_at = now(),
      "DS_EMAIL_SUBSTITUICAO" = v_autor.email,
      "NO_USUARIO_SUBSTITUICAO" = v_autor.nome
  where id = p_lista_id and vigente is true
  returning edital_id into v_edital_id;
  if not found then raise exception 'Lista vigente nao encontrada'; end if;
  -- Sem lista vigente, os contratados do edital voltam a zero.
  perform private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(v_edital_id::uuid);
  return jsonb_build_object('ok', true, 'lista_id', p_lista_id, 'edital_id', v_edital_id);
end;
$function$;

create or replace function public.definir_lista_aprovados_ativa(p_lista_id uuid, p_ativo boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_edital_id text;
  v_vencimento date;
begin
  -- Admin global passa; os outros, pela matriz de Acessos (Importação nível 2) e pela área.
  if not private."FC_ADMIN_GLOBAL_ATIVO"((select auth.uid())) then
    perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_LISTA_APROVADO" l where l.id = p_lista_id));
    if not private.pode_recurso('importacao', 2) then
      raise exception 'Sem permissão para este recurso' using errcode = '42501';
    end if;
  end if;

  if coalesce(p_ativo, false) then
    select private."FC_VENCIMENTO_DO_EDITAL"(m.data_fim::date, m."NU_ANOS_VALIDADE",
                                             m."NU_MESES_VALIDADE", m."ST_PRORROGADO")
      into v_vencimento
      from public."TB_LISTA_APROVADO" l
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
     where l.id = p_lista_id;
    if v_vencimento < (now() at time zone 'America/Sao_Paulo')::date then
      raise exception 'O prazo de validade do processo seletivo venceu em %. Prorrogue o edital para reativar a lista.',
        to_char(v_vencimento, 'DD/MM/YYYY') using errcode = '22023';
    end if;
  end if;

  update public."TB_LISTA_APROVADO"
  set ativo = coalesce(p_ativo, false), updated_at = now()
  where id = p_lista_id and vigente is true
  returning edital_id into v_edital_id;
  if not found then raise exception 'Lista vigente nao encontrada'; end if;
  perform private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(v_edital_id::uuid);
  return jsonb_build_object('ok', true, 'lista_id', p_lista_id, 'edital_id', v_edital_id, 'ativo', coalesce(p_ativo, false));
end;
$function$;

-- 7. O pedido do casamento: o instantâneo do job Python -----------------------------------------
create table public."TB_PEDIDO_CASAMENTO_LISTA" (
  "CO_PEDIDO" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "CO_LISTA_APROVADO_ANTERIOR" uuid,
  "TP_ORIGEM" varchar(13) not null,
  "CO_LISTA_CLASSIFICACAO" uuid,
  "DS_NOVOS" jsonb not null,
  "DS_MANUAIS" jsonb not null default '{}'::jsonb,
  "NO_ARQUIVO" text,
  "DS_BASE" text not null,
  "TP_SITUACAO" varchar(10) not null default 'PENDENTE',
  "DS_PLANO" jsonb,
  "DS_ERRO" text,
  "CO_EXECUCAO" text,
  "CO_DISPARO" bigint,
  "CO_LISTA_APROVADO" uuid,
  "CO_USUARIO" uuid not null,
  "DT_PEDIDO" timestamptz not null default now(),
  "DT_CALCULO" timestamptz,
  "DT_APLICACAO" timestamptz,
  constraint "PK_PEDIDO_CASAMENTO_LISTA" primary key ("CO_PEDIDO"),
  constraint "FK_MONITORAMENTO_PEDCASAMENTO" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "FK_LISTAANTERIOR_PEDCASAMENTO" foreign key ("CO_LISTA_APROVADO_ANTERIOR")
    references public."TB_LISTA_APROVADO" (id) on delete cascade,
  constraint "FK_LISTACLASSIF_PEDCASAMENTO" foreign key ("CO_LISTA_CLASSIFICACAO")
    references public."TB_LISTA_CLASSIFICACAO" ("CO_LISTA_CLASSIFICACAO") on delete cascade,
  constraint "FK_LISTANOVA_PEDCASAMENTO" foreign key ("CO_LISTA_APROVADO")
    references public."TB_LISTA_APROVADO" (id) on delete set null,
  constraint "CK_PEDCASAMENTO_TPORIGEM" check ("TP_ORIGEM" in ('XLSX', 'CLASSIFICACAO')),
  constraint "CK_PEDCASAMENTO_ORIGEM" check (("TP_ORIGEM" = 'CLASSIFICACAO') = ("CO_LISTA_CLASSIFICACAO" is not null)),
  constraint "CK_PEDCASAMENTO_TPSITUACAO" check ("TP_SITUACAO" in ('PENDENTE', 'CALCULADO', 'ERRO', 'APLICADO', 'DESCARTADO')),
  constraint "CK_PEDCASAMENTO_JSON" check (jsonb_typeof("DS_NOVOS") = 'array' and jsonb_typeof("DS_MANUAIS") = 'object'
                                            and ("DS_PLANO" is null or jsonb_typeof("DS_PLANO") = 'object')),
  constraint "CK_PEDCASAMENTO_PLANO" check (("TP_SITUACAO" in ('CALCULADO', 'APLICADO')) = ("DS_PLANO" is not null)),
  constraint "CK_PEDCASAMENTO_DSERRO" check ("DS_ERRO" is null or length("DS_ERRO") between 1 and 300),
  constraint "CK_PEDCASAMENTO_COEXECUCAO" check ("CO_EXECUCAO" is null or "CO_EXECUCAO" ~ '^(casam-[0-9]{8}T[0-9]{6}-[0-9a-f]{8}|banco)$')
);
comment on table public."TB_PEDIDO_CASAMENTO_LISTA" is
  'Instantâneo do casamento da lista de aprovados (20261030090000): o pedido da prévia de uma nova versão (XLSX ou Classificação) — quem entra, a lista vigente de referência e a assinatura dela — e o plano que o job Python (scripts/aprovados/casamento_da_lista.py) grava: quem da lista vigente é quem entra, o resumo e as pendências. aplicar_casamento_da_lista confere e aplica. Pedidos de mais de 2 dias saem no próximo pedido. Só pelas RPCs.';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."CO_PEDIDO" is 'O pedido.';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."CO_MONITORAMENTO" is 'O edital (TB_MONITORAMENTO_INDIGENA).';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."CO_LISTA_APROVADO_ANTERIOR" is 'A lista vigente quando a prévia foi pedida (nula: o edital não tinha lista).';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."TP_ORIGEM" is 'XLSX ou CLASSIFICACAO.';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."CO_LISTA_CLASSIFICACAO" is 'O resultado final da Classificação (só na origem CLASSIFICACAO).';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."DS_NOVOS" is 'Quem entra: [{chave, analise_id, nome, cargo, codigo_vaga, posicao, nota, situacao, modalidade, ordem}]; chave = a linha da planilha ou a análise.';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."DS_MANUAIS" is 'A revisão à mão: {candidato_id: chave | ""} ("" = não está na lista nova).';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."NO_ARQUIVO" is 'O nome do XLSX (origem XLSX).';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."DS_BASE" is 'FC_BASE_DA_LISTA da lista vigente no pedido: mudou, o plano não vale.';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."TP_SITUACAO" is 'PENDENTE (esperando o job), CALCULADO, ERRO, APLICADO ou DESCARTADO.';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."DS_PLANO" is 'O plano do job: {versao, vinculos [{candidato_id, chave, forma}], resumo, pendencias, mudam, revisar}.';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."DS_ERRO" is 'Por que o plano não saiu (sem nome nem matrícula).';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."CO_EXECUCAO" is 'Execução do job que gravou (casam-…) ou "banco" (sem lista vigente).';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."CO_DISPARO" is 'O pedido do job ao GitHub (TL_DISPARO_ROBO).';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."CO_LISTA_APROVADO" is 'A lista criada ao aplicar.';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."CO_USUARIO" is 'Quem pediu (só ele aplica, ou o administrador global).';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."DT_PEDIDO" is 'Quando foi pedido.';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."DT_CALCULO" is 'Quando o plano foi gravado.';
comment on column public."TB_PEDIDO_CASAMENTO_LISTA"."DT_APLICACAO" is 'Quando foi aplicado.';
comment on constraint "PK_PEDIDO_CASAMENTO_LISTA" on public."TB_PEDIDO_CASAMENTO_LISTA" is 'Um pedido por id.';
comment on constraint "FK_MONITORAMENTO_PEDCASAMENTO" on public."TB_PEDIDO_CASAMENTO_LISTA" is 'O edital.';
comment on constraint "FK_LISTAANTERIOR_PEDCASAMENTO" on public."TB_PEDIDO_CASAMENTO_LISTA" is 'A lista vigente de referência.';
comment on constraint "FK_LISTACLASSIF_PEDCASAMENTO" on public."TB_PEDIDO_CASAMENTO_LISTA" is 'O resultado final da Classificação.';
comment on constraint "FK_LISTANOVA_PEDCASAMENTO" on public."TB_PEDIDO_CASAMENTO_LISTA" is 'A lista criada ao aplicar.';
comment on constraint "CK_PEDCASAMENTO_TPORIGEM" on public."TB_PEDIDO_CASAMENTO_LISTA" is 'Origens válidas.';
comment on constraint "CK_PEDCASAMENTO_ORIGEM" on public."TB_PEDIDO_CASAMENTO_LISTA" is 'Classificação tem o resultado final; planilha não.';
comment on constraint "CK_PEDCASAMENTO_TPSITUACAO" on public."TB_PEDIDO_CASAMENTO_LISTA" is 'Situações válidas.';
comment on constraint "CK_PEDCASAMENTO_JSON" on public."TB_PEDIDO_CASAMENTO_LISTA" is 'Formas do json.';
comment on constraint "CK_PEDCASAMENTO_PLANO" on public."TB_PEDIDO_CASAMENTO_LISTA" is 'Plano só calculado ou aplicado.';
comment on constraint "CK_PEDCASAMENTO_DSERRO" on public."TB_PEDIDO_CASAMENTO_LISTA" is 'Erro de 1 a 300 caracteres.';
comment on constraint "CK_PEDCASAMENTO_COEXECUCAO" on public."TB_PEDIDO_CASAMENTO_LISTA" is 'Identificador da execução do job, ou banco.';
create index "IN_PEDCASAMENTO_SITUACAO" on public."TB_PEDIDO_CASAMENTO_LISTA" ("TP_SITUACAO", "DT_PEDIDO");
comment on index public."IN_PEDCASAMENTO_SITUACAO" is 'Os pendentes que o job lê e a limpeza dos antigos.';
create index "IN_PEDCASAMENTO_EDITAL" on public."TB_PEDIDO_CASAMENTO_LISTA" ("CO_MONITORAMENTO", "CO_USUARIO");
comment on index public."IN_PEDCASAMENTO_EDITAL" is 'Os pedidos abertos da pessoa no edital (um novo descarta os outros).';
create index "IN_PEDCASAMENTO_FKS" on public."TB_PEDIDO_CASAMENTO_LISTA" ("CO_LISTA_APROVADO_ANTERIOR");
comment on index public."IN_PEDCASAMENTO_FKS" is 'A chave estrangeira da lista de referência.';
alter table public."TB_PEDIDO_CASAMENTO_LISTA" enable row level security;
revoke all on public."TB_PEDIDO_CASAMENTO_LISTA" from public, anon, authenticated, service_role;

-- 8. Quem entra pela Classificação: o retrato gravado do resultado final ------------------------
create or replace function private."FC_NOVOS_DA_CLASSIFICACAO"(p_lista_classificacao uuid, p_lista_vigente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_l public."TB_LISTA_CLASSIFICACAO";
  v_novos jsonb;
begin
  select * into v_l from public."TB_LISTA_CLASSIFICACAO" where "CO_LISTA_CLASSIFICACAO" = p_lista_classificacao;
  if v_l."CO_LISTA_CLASSIFICACAO" is null then
    raise exception 'Lista de classificação não encontrada' using errcode = '22023';
  end if;
  if v_l."TP_LISTA" <> 'FINAL' then
    raise exception 'Só o resultado final vira lista de aprovados.' using errcode = '22023';
  end if;
  if v_l."QT_PENDENCIA" > 0 then
    raise exception 'A lista tem empate pendente de sorteio ou decisão; resolva e gere de novo.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public."TB_LISTA_CLASSIFICACAO" o
     where o."CO_MONITORAMENTO" = v_l."CO_MONITORAMENTO" and o."TP_LISTA" = 'FINAL'
       and o."DT_GERACAO" > v_l."DT_GERACAO"
  ) then
    raise exception 'Há um resultado final gerado depois deste; publique o mais recente.' using errcode = '22023';
  end if;
  if exists (select 1 from public."TB_LISTA_APROVADO" a
              where a.id = p_lista_vigente and a."CO_LISTA_CLASSIFICACAO" = p_lista_classificacao) then
    raise exception 'Este resultado final já é a lista de aprovados vigente.' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(v_l."CO_MONITORAMENTO", v_l."DS_RESULTADO");

  -- Um por análise (a posição da geral; quem só está na lista da modalidade, a dela; a
  -- primeira vaga em que aparece) — a mesma montagem de antes (20261005160000).
  select coalesce(jsonb_agg(jsonb_build_object(
           'chave', y.analise_id::text, 'analise_id', y.analise_id, 'nome', y.nome, 'cargo', y.cargo,
           'codigo_vaga', y.codigo_vaga, 'posicao', y.posicao, 'nota', y.nota, 'situacao', y.situacao,
           'modalidade', y.modalidade, 'ordem', y.ordem) order by y.ordem), '[]'::jsonb)
    into v_novos
    from (
      select z.*, row_number() over (order by z.vaga_ordem, z.posicao, z.nome) as ordem
        from (
          select distinct on (x.analise_id)
                 x.analise_id, x.nome,
                 coalesce(x.cargo_vaga, nullif(btrim(a.nome_vaga), ''), 'Sem cargo') as cargo,
                 coalesce(x.codigo_vaga, nullif(btrim(a.codigo_vaga), ''), x.chave) as codigo_vaga,
                 x.posicao, x.nota, x.situacao,
                 coalesce(nullif(btrim(a.modalidade_concorrencia), ''), x.modalidades, 'Ampla Concorrência') as modalidade,
                 x.vaga_ordem
            from (
              select (f.linha ->> 'analise_id')::uuid as analise_id,
                     btrim(f.linha ->> 'nome') as nome,
                     nullif(btrim(v.vaga ->> 'cargo'), '') as cargo_vaga,
                     nullif(btrim(v.vaga ->> 'codigo'), '') as codigo_vaga,
                     v.vaga ->> 'chave' as chave,
                     case when jsonb_typeof(f.linha -> 'posicao') = 'number' then (f.linha ->> 'posicao')::numeric::integer end as posicao,
                     case when jsonb_typeof(f.linha -> 'nota') = 'number' then (f.linha ->> 'nota')::numeric end as nota,
                     case when f.linha ->> 'situacao' in ('VAGA', 'CR') then f.linha ->> 'situacao' end as situacao,
                     (select string_agg(coalesce(md.valor ->> 'nome', c.codigo), '; ' order by c.ordem)
                        from jsonb_array_elements_text(
                               case when jsonb_typeof(f.linha -> 'modalidades') = 'array' then f.linha -> 'modalidades' else '[]'::jsonb end
                             ) with ordinality c(codigo, ordem)
                        left join jsonb_array_elements(coalesce(v_l."DS_RESULTADO" -> 'modalidades', '[]'::jsonb)) md(valor)
                          on md.valor ->> 'codigo' = c.codigo
                       where c.codigo <> 'AC') as modalidades,
                     v.ordem as vaga_ordem,
                     f.fonte
                from jsonb_array_elements(v_l."DS_RESULTADO" -> 'vagas') with ordinality v(vaga, ordem)
                cross join lateral (
                  select 0 as fonte, g.linha
                    from jsonb_array_elements(coalesce(v.vaga -> 'geral', '[]'::jsonb)) g(linha)
                  union all
                  select 1, m.linha
                    from jsonb_each(coalesce(v.vaga -> 'listas', '{}'::jsonb)) e(codigo, linhas)
                    cross join lateral jsonb_array_elements(e.linhas) m(linha)
                ) f
               where f.linha ->> 'analise_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            ) x
            left join public."TB_ANALISE_CURRICULAR" a on a.id = x.analise_id
           order by x.analise_id, x.vaga_ordem, x.fonte, x.posicao nulls last
        ) z
    ) y;

  if jsonb_array_length(v_novos) = 0 then
    raise exception 'O resultado final não tem candidatos para publicar.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_novos) n(v)
              where (n.v ->> 'posicao') is null or (n.v ->> 'posicao')::integer < 1
                 or (n.v ->> 'nota') is null or (n.v ->> 'nota')::numeric < 0
                 or nullif(n.v ->> 'nome', '') is null) then
    raise exception 'O resultado final tem candidato sem posição, nota ou nome; gere de novo.' using errcode = '22023';
  end if;
  return v_novos;
end;
$function$;
comment on function private."FC_NOVOS_DA_CLASSIFICACAO"(uuid, uuid) is
  'Quem entra pela Classificação, montado do retrato gravado do resultado final (um por análise), com as conferências de antes: só o FINAL mais recente, sem empate pendente, candidatos do edital, nem a lista que já é a vigente. 20261030090000.';
revoke all on function private."FC_NOVOS_DA_CLASSIFICACAO"(uuid, uuid) from public, anon, authenticated;

-- 9. O job do casamento na lista fixa dos robôs --------------------------------------------------
alter table public."TL_DISPARO_ROBO" drop constraint "CK_DISPROBO_NOWORKFLOW";
alter table public."TL_DISPARO_ROBO" add constraint "CK_DISPROBO_NOWORKFLOW" check ("NO_WORKFLOW" = any (array[
  'sincronizar-entrevistas.yml', 'sincronizar-selecao.yml', 'conferencias.yml', 'expurgo-anexos-chat.yml',
  'robo-empregare.yml', 'pre-classificacao.yml', 'leitura-de-arquivos.yml', 'classificacao.yml',
  'contratacao-dos-aprovados.yml', 'pacotes-dos-paineis.yml', 'casamento-da-lista.yml']));
comment on constraint "CK_DISPROBO_NOWORKFLOW" on public."TL_DISPARO_ROBO" is
  'Workflows que o banco pede (lista fixa de FC_DISPARAR_ROBO) ou registra; pacotes-dos-paineis.yml desde 20261029180000; casamento-da-lista.yml desde 20261030090000.';

CREATE OR REPLACE FUNCTION private."FC_DISPARAR_ROBO"(p_workflow text, p_inputs jsonb DEFAULT '{}'::jsonb, p_usuario uuid DEFAULT NULL::uuid, p_origem text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  -- Lista fixa: workflow → inputs que ele aceita (além de disparado_por).
  c_aceitos constant jsonb := jsonb_build_object(
    'sincronizar-entrevistas.yml', jsonb_build_array('modo'),
    'sincronizar-selecao.yml', jsonb_build_array('modo'),
    'conferencias.yml', jsonb_build_array('modo'),
    'robo-empregare.yml', jsonb_build_array('modo', 'editais', 'vagas', 'limite', 'anexos', 'candidatos', 'seco', 'forcar_congelado'),
    'pre-classificacao.yml', jsonb_build_array('modo', 'editais', 'forcar_congelado'),
    'classificacao.yml', jsonb_build_array('modo', 'listas'),
    'contratacao-dos-aprovados.yml', jsonb_build_array('modo'),
    -- Pacotes dos painéis (20261029180000): pedido pela rodada do pg_cron dos pacotes.
    'pacotes-dos-paineis.yml', jsonb_build_array('modo'),
    -- Casamento da lista de aprovados (20261030090000): pedido a cada prévia, com o id do pedido.
    'casamento-da-lista.yml', jsonb_build_array('modo', 'pedido'));
  v_inputs jsonb := coalesce(p_inputs, '{}'::jsonb);
  -- AGENDA só do pg_cron: as tarefas passam p_origem = 'AGENDA' (e a sessão do pg_cron
  -- se chama pg_cron); MONITORA com o usuário da tela; MANUAL = SQL direto, sem usuário.
  v_origem constant text := case
    when p_usuario is not null then 'MONITORA'
    when p_origem = 'AGENDA' or current_setting('application_name', true) = 'pg_cron' then 'AGENDA'
    else 'MANUAL' end;
  v_disparado_por constant text := case v_origem
    when 'MONITORA' then p_usuario::text
    when 'AGENDA' then 'AGENDA'
    else 'manual' end;
  v_chave text;
  v_pedido bigint;
  v_disparo bigint;
begin
  if p_workflow is null or not (c_aceitos ? p_workflow) then
    raise exception 'Workflow fora da lista fixa dos robôs' using errcode = '22023';
  end if;
  if p_origem is not null and p_origem <> 'AGENDA' then
    raise exception 'Origem inválida (só AGENDA, nas tarefas do pg_cron)' using errcode = '22023';
  end if;
  if jsonb_typeof(v_inputs) <> 'object'
     or exists (
       select 1 from jsonb_each(v_inputs) i
        where not ((c_aceitos -> p_workflow) ? i.key)
           or jsonb_typeof(i.value) <> 'string'
           or length(i.value #>> '{}') > 20000) then
    raise exception 'Inputs inválidos para %', p_workflow using errcode = '22023';
  end if;

  -- [chaves-da-automacao] Chave desligada (20261022190000): a agenda não pede nada.
  -- O Rodar agora (MONITORA) e o SQL direto (MANUAL) seguem.
  if v_origem = 'AGENDA'
     and not private."FC_AUTOMACAO_LIGADA"(private."FC_CHAVE_DO_WORKFLOW"(p_workflow)) then
    return null;
  end if;

  -- O nome do segredo é sempre github_disparo_robos; a configuração da sessão
  -- agsus.segredo_disparo_robos só existe para o ensaio simular a chave ausente
  -- (set local) sem tocar no Vault nem ler o valor.
  select nullif(btrim(s.decrypted_secret), '')
    into v_chave
    from vault.decrypted_secrets s
   where s.name = coalesce(nullif(current_setting('agsus.segredo_disparo_robos', true), ''), 'github_disparo_robos')
   order by s.updated_at desc nulls last
   limit 1;

  if v_chave is null then
    insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "DS_MENSAGEM")
    values (p_workflow, v_origem, p_usuario, 'SEM_TOKEN', 'Sem a chave github_disparo_robos no Vault.')
    returning "CO_DISPARO" into v_disparo;
    return v_disparo;
  end if;

  begin
    v_pedido := net.http_post(
      url := 'https://api.github.com/repos/AgSUS-COGIP/agsus-monitora/actions/workflows/' || p_workflow || '/dispatches',
      body := jsonb_build_object(
        'ref', 'main',
        'inputs', v_inputs || jsonb_build_object('disparado_por', v_disparado_por)),
      headers := jsonb_build_object(
        'Accept', 'application/vnd.github+json',
        'Authorization', 'Bearer ' || v_chave,
        'X-GitHub-Api-Version', '2022-11-28',
        'User-Agent', 'agsus-monitora-agenda',
        'Content-Type', 'application/json'),
      timeout_milliseconds := 10000);
  exception when others then
    -- Só o código do erro: a mensagem poderia citar o pedido.
    v_chave := null;
    insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "DT_RESPOSTA", "DS_MENSAGEM")
    values (p_workflow, v_origem, p_usuario, 'FALHOU', now(), 'O pg_net recusou o pedido (' || sqlstate || ').')
    returning "CO_DISPARO" into v_disparo;
    return v_disparo;
  end;
  v_chave := null;

  insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "CO_PEDIDO_HTTP", "TP_SITUACAO")
  values (p_workflow, v_origem, p_usuario, v_pedido, 'PEDIDO')
  returning "CO_DISPARO" into v_disparo;
  return v_disparo;
end;
$function$;

-- 10. As RPCs do casamento ------------------------------------------------------------------------
create function public.pedir_casamento_da_lista(
  p_edital uuid,
  p_origem text,
  p_candidatos jsonb default null,
  p_lista_classificacao uuid default null,
  p_lista_vigente uuid default null,
  p_arquivo_nome text default null,
  p_manuais jsonb default '{}'::jsonb
)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_anterior uuid;
  v_novos jsonb;
  v_manuais jsonb := coalesce(p_manuais, '{}'::jsonb);
  v_pedido uuid;
  v_disparo bigint;
  v_situacao text;
begin
  perform private."FC_EXIGIR_PEDIR_NOVA_VERSAO"(p_edital, p_origem);
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital) then
    raise exception 'Edital nao encontrado' using errcode = '22023';
  end if;
  if jsonb_typeof(v_manuais) <> 'object'
     or exists (select 1 from jsonb_each(v_manuais) e
                 where e.key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    or jsonb_typeof(e.value) <> 'string') then
    raise exception 'Revisão inválida.' using errcode = '22023';
  end if;

  select l.id into v_anterior from public."TB_LISTA_APROVADO" l
   where l.edital_id = p_edital::text and l.vigente is true;
  if p_origem = 'CLASSIFICACAO' and v_anterior is distinct from p_lista_vigente then
    raise exception 'A lista de aprovados do edital mudou desde a prévia; abra a publicação de novo.' using errcode = 'PT409';
  end if;
  -- A mesma regra nos dois caminhos (o motivo é pedido ao aplicar).
  perform private."FC_EXIGIR_PODE_SUBSTITUIR_LISTA"(p_edital::text, v_anterior, p_origem, null, false);

  if p_origem = 'XLSX' then
    if p_lista_classificacao is not null then
      raise exception 'A planilha não traz resultado da Classificação.' using errcode = '22023';
    end if;
    if nullif(btrim(coalesce(p_arquivo_nome, '')), '') is null then
      raise exception 'Arquivo XLSX nao informado' using errcode = '22023';
    end if;
    if jsonb_typeof(p_candidatos) is distinct from 'array' or jsonb_array_length(p_candidatos) = 0 then
      raise exception 'A lista precisa conter pelo menos um candidato' using errcode = '22023';
    end if;
    if jsonb_array_length(p_candidatos) > 20000 then
      raise exception 'A planilha passa de 20.000 linhas.' using errcode = '22023';
    end if;
    select jsonb_agg(jsonb_build_object(
             'chave', x.linha::text, 'analise_id', null,
             'nome', nullif(btrim(x.valor ->> 'nome'), ''), 'cargo', nullif(btrim(x.valor ->> 'cargo'), ''),
             'codigo_vaga', nullif(btrim(x.valor ->> 'codigo_vaga'), ''),
             'posicao', (x.valor ->> 'classificacao')::integer, 'nota', (x.valor ->> 'nota')::numeric,
             'situacao', null, 'modalidade', nullif(btrim(x.valor ->> 'modalidade'), ''), 'ordem', x.linha)
           order by x.linha)
      into v_novos
      from jsonb_array_elements(p_candidatos) with ordinality x(valor, linha);
  else
    if p_lista_classificacao is null or p_candidatos is not null then
      raise exception 'Informe só o resultado final da Classificação.' using errcode = '22023';
    end if;
    if not exists (select 1 from public."TB_LISTA_CLASSIFICACAO" c
                    where c."CO_LISTA_CLASSIFICACAO" = p_lista_classificacao and c."CO_MONITORAMENTO" = p_edital) then
      raise exception 'Lista de classificação de outro edital.' using errcode = '22023';
    end if;
    v_novos := private."FC_NOVOS_DA_CLASSIFICACAO"(p_lista_classificacao, v_anterior);
  end if;

  -- Os pedidos velhos saem; os abertos da pessoa neste edital ficam para trás.
  delete from public."TB_PEDIDO_CASAMENTO_LISTA" p where p."DT_PEDIDO" < now() - interval '2 days';
  update public."TB_PEDIDO_CASAMENTO_LISTA" p set "TP_SITUACAO" = 'DESCARTADO', "DS_PLANO" = null
   where p."CO_MONITORAMENTO" = p_edital and p."CO_USUARIO" = v_uid
     and p."TP_SITUACAO" in ('PENDENTE', 'CALCULADO', 'ERRO');

  -- Sem lista vigente não há o que casar: o plano sai na hora.
  v_situacao := case when v_anterior is null then 'CALCULADO' else 'PENDENTE' end;
  insert into public."TB_PEDIDO_CASAMENTO_LISTA" (
    "CO_MONITORAMENTO", "CO_LISTA_APROVADO_ANTERIOR", "TP_ORIGEM", "CO_LISTA_CLASSIFICACAO", "DS_NOVOS",
    "DS_MANUAIS", "NO_ARQUIVO", "DS_BASE", "TP_SITUACAO", "DS_PLANO", "CO_EXECUCAO", "DT_CALCULO", "CO_USUARIO"
  ) values (
    p_edital, v_anterior, p_origem, p_lista_classificacao, v_novos, v_manuais,
    nullif(btrim(coalesce(p_arquivo_nome, '')), ''), private."FC_BASE_DA_LISTA"(v_anterior), v_situacao,
    case when v_anterior is null then jsonb_build_object(
      'versao', 1, 'vinculos', '[]'::jsonb, 'pendencias', '[]'::jsonb, 'mudam', '[]'::jsonb, 'revisar', '[]'::jsonb,
      'resumo', jsonb_build_object('casados', 0, 'entram', jsonb_array_length(v_novos), 'sem_par', 0, 'sem_dono', 0,
                                   'preservados', 0, 'mudam', 0, 'sub_judice_mantidos', 0, 'ambiguos', 0)) end,
    case when v_anterior is null then 'banco' end,
    case when v_anterior is null then now() end,
    v_uid
  ) returning "CO_PEDIDO" into v_pedido;

  if v_anterior is not null then
    v_disparo := private."FC_DISPARAR_ROBO"('casamento-da-lista.yml',
                   jsonb_build_object('modo', 'normal', 'pedido', v_pedido::text), v_uid);
    update public."TB_PEDIDO_CASAMENTO_LISTA" set "CO_DISPARO" = v_disparo where "CO_PEDIDO" = v_pedido;
  end if;

  return json_build_object('pedido_id', v_pedido, 'situacao', v_situacao,
                           'candidatos', jsonb_array_length(v_novos), 'lista_vigente', v_anterior);
end;
$function$;
comment on function public.pedir_casamento_da_lista(uuid, text, jsonb, uuid, uuid, text, jsonb) is
  'A prévia de uma nova versão da lista de aprovados (XLSX: p_candidatos e p_arquivo_nome; Classificação: p_lista_classificacao e p_lista_vigente), com a revisão à mão (p_manuais). Guarda o pedido e pede o job Python do casamento; sem lista vigente, o plano sai na hora. Mesma permissão nos dois caminhos (FC_EXIGIR_PEDIR_NOVA_VERSAO, FC_EXIGIR_PODE_SUBSTITUIR_LISTA). 20261030090000.';
revoke all on function public.pedir_casamento_da_lista(uuid, text, jsonb, uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.pedir_casamento_da_lista(uuid, text, jsonb, uuid, uuid, text, jsonb) to authenticated;

create function public.casamento_ler_pedidos(p_pedido uuid default null)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object('schema_version', 1, 'pedidos', coalesce(json_agg(json_build_object(
           'pedido', p."CO_PEDIDO",
           'novos', p."DS_NOVOS",
           'manuais', p."DS_MANUAIS",
           'anteriores', (select coalesce(json_agg(json_build_object(
                             'id', c.id, 'analise_id', c."CO_ANALISE_CURRICULAR", 'nome', c.nome, 'cargo', c.cargo,
                             'codigo_vaga', c.codigo_vaga, 'classificacao', c.classificacao, 'status', c.status,
                             'matricula', c.matricula, 'processo_sei', c.processo_sei, 'sub_judice', c.sub_judice,
                             'alterado_judicialmente', c.alterado_judicialmente)
                           order by c.cargo, c.classificacao nulls last, c.nome, c.id), '[]'::json)
                            from public."TB_CANDIDATO_APROVADO" c
                           where c.lista_id = p."CO_LISTA_APROVADO_ANTERIOR" and c.removido_em is null))
         order by p."DT_PEDIDO"), '[]'::json))
    from (select * from public."TB_PEDIDO_CASAMENTO_LISTA" x
           where x."TP_SITUACAO" = 'PENDENTE' and x."CO_LISTA_APROVADO_ANTERIOR" is not null
             and (p_pedido is null or x."CO_PEDIDO" = p_pedido)
           order by x."DT_PEDIDO" limit 20) p;
$function$;
comment on function public.casamento_ler_pedidos(uuid) is
  'Job do casamento (Python, só service_role): os pedidos pendentes (ou o p_pedido), com quem entra, a revisão à mão e a lista vigente (na ordem da tela). 20261030090000.';
revoke all on function public.casamento_ler_pedidos(uuid) from public, anon, authenticated;
grant execute on function public.casamento_ler_pedidos(uuid) to service_role;

create function public.gravar_casamento_da_lista(p_execucao text, p_pedido uuid, p_plano jsonb, p_erro text default null)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_p public."TB_PEDIDO_CASAMENTO_LISTA";
  v_vinculos jsonb;
  v_falha text;
begin
  if p_execucao is null or p_execucao !~ '^casam-[0-9]{8}T[0-9]{6}-[0-9a-f]{8}$' then
    raise exception 'Execução inválida.' using errcode = '22023';
  end if;
  select * into v_p from public."TB_PEDIDO_CASAMENTO_LISTA" where "CO_PEDIDO" = p_pedido for update;
  if v_p."CO_PEDIDO" is null then
    raise exception 'Pedido não encontrado.' using errcode = '22023';
  end if;
  -- Já respondido (ou descartado): não muda nada.
  if v_p."TP_SITUACAO" <> 'PENDENTE' then
    return json_build_object('ok', false, 'situacao', v_p."TP_SITUACAO");
  end if;

  if nullif(btrim(coalesce(p_erro, '')), '') is not null then
    v_falha := left(btrim(p_erro), 300);
  elsif private."FC_BASE_DA_LISTA"(v_p."CO_LISTA_APROVADO_ANTERIOR") is distinct from v_p."DS_BASE"
        or not exists (select 1 from public."TB_LISTA_APROVADO" l
                        where l.id = v_p."CO_LISTA_APROVADO_ANTERIOR" and l.vigente is true) then
    v_falha := 'A lista vigente mudou desde o pedido; peça a prévia de novo.';
  elsif jsonb_typeof(p_plano) is distinct from 'object' or (p_plano ->> 'versao') is distinct from '1'
        or jsonb_typeof(p_plano -> 'vinculos') is distinct from 'array'
        or jsonb_typeof(p_plano -> 'resumo') is distinct from 'object'
        or jsonb_typeof(p_plano -> 'pendencias') is distinct from 'array'
        or jsonb_typeof(p_plano -> 'mudam') is distinct from 'array'
        or jsonb_typeof(p_plano -> 'revisar') is distinct from 'array'
        or exists (select 1 from jsonb_each(p_plano -> 'resumo') r
                    where r.key not in ('casados', 'entram', 'sem_par', 'sem_dono', 'preservados', 'mudam',
                                        'sub_judice_mantidos', 'ambiguos')
                       or jsonb_typeof(r.value) <> 'number' or (r.value)::text::numeric < 0) then
    raise exception 'Plano em formato desconhecido.' using errcode = '22023';
  end if;

  if v_falha is not null then
    update public."TB_PEDIDO_CASAMENTO_LISTA"
       set "TP_SITUACAO" = 'ERRO', "DS_ERRO" = v_falha, "CO_EXECUCAO" = p_execucao, "DT_CALCULO" = now()
     where "CO_PEDIDO" = p_pedido;
    return json_build_object('ok', false, 'situacao', 'ERRO');
  end if;

  -- Os vínculos, conferidos: cada um da lista vigente e de quem entra, uma vez, na forma certa,
  -- e a revisão à mão respeitada.
  v_vinculos := p_plano -> 'vinculos';
  if exists (select 1 from jsonb_array_elements(v_vinculos) v(x)
              where jsonb_typeof(v.x) <> 'object'
                 or (v.x ->> 'candidato_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 or nullif(v.x ->> 'chave', '') is null
                 or (v.x ->> 'forma') not in ('ANALISE', 'NOME', 'NOME_VAGA', 'MANUAL')) then
    raise exception 'Vínculo inválido.' using errcode = '22023';
  end if;
  if (select count(*) <> count(distinct v.x ->> 'candidato_id') or count(*) <> count(distinct v.x ->> 'chave')
        from jsonb_array_elements(v_vinculos) v(x)) then
    raise exception 'Cada pessoa só pode ser vinculada uma vez.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_vinculos) v(x)
              where not exists (select 1 from public."TB_CANDIDATO_APROVADO" c
                                 where c.id = (v.x ->> 'candidato_id')::uuid
                                   and c.lista_id = v_p."CO_LISTA_APROVADO_ANTERIOR" and c.removido_em is null)) then
    raise exception 'Vínculo com candidato que não está na lista vigente.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_vinculos) v(x)
              where not exists (select 1 from jsonb_array_elements(v_p."DS_NOVOS") n(y)
                                 where n.y ->> 'chave' = v.x ->> 'chave')) then
    raise exception 'Vínculo com candidato que não está na lista nova.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_vinculos) v(x)
               join public."TB_CANDIDATO_APROVADO" c on c.id = (v.x ->> 'candidato_id')::uuid
              where v.x ->> 'forma' = 'ANALISE'
                and c."CO_ANALISE_CURRICULAR"::text is distinct from (
                      select n.y ->> 'analise_id' from jsonb_array_elements(v_p."DS_NOVOS") n(y)
                       where n.y ->> 'chave' = v.x ->> 'chave' limit 1)) then
    raise exception 'Vínculo pela análise com análise diferente.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each_text(v_p."DS_MANUAIS") m
              where (m.value = '' and exists (select 1 from jsonb_array_elements(v_vinculos) v(x)
                                                where v.x ->> 'candidato_id' = m.key))
                 or (m.value <> '' and exists (select 1 from jsonb_array_elements(v_p."DS_NOVOS") n(y)
                                                 where n.y ->> 'chave' = m.value)
                     and not exists (select 1 from jsonb_array_elements(v_vinculos) v(x)
                                      where v.x ->> 'candidato_id' = m.key and v.x ->> 'chave' = m.value
                                        and v.x ->> 'forma' = 'MANUAL'))) then
    raise exception 'O plano não respeita a revisão à mão.' using errcode = '22023';
  end if;
  if ((p_plano -> 'resumo' ->> 'casados')::integer) <> jsonb_array_length(v_vinculos) then
    raise exception 'O resumo não bate com os vínculos.' using errcode = '22023';
  end if;

  update public."TB_PEDIDO_CASAMENTO_LISTA"
     set "TP_SITUACAO" = 'CALCULADO', "DS_PLANO" = p_plano, "CO_EXECUCAO" = p_execucao, "DT_CALCULO" = now()
   where "CO_PEDIDO" = p_pedido;
  return json_build_object('ok', true, 'situacao', 'CALCULADO', 'casados', jsonb_array_length(v_vinculos));
end;
$function$;
comment on function public.gravar_casamento_da_lista(text, uuid, jsonb, text) is
  'Job do casamento (Python, só service_role): grava o plano do pedido pendente — ou o erro. Só valida (formato, cada vínculo da lista vigente e de quem entra, uma vez, análise igual na forma ANALISE, revisão à mão respeitada, lista vigente igual à do pedido) e guarda. 20261030090000.';
revoke all on function public.gravar_casamento_da_lista(text, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.gravar_casamento_da_lista(text, uuid, jsonb, text) to service_role;

create function public.obter_casamento_da_lista(p_pedido uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_p public."TB_PEDIDO_CASAMENTO_LISTA";
  v_revisar jsonb;
begin
  select * into v_p from public."TB_PEDIDO_CASAMENTO_LISTA" where "CO_PEDIDO" = p_pedido;
  if v_p."CO_PEDIDO" is null
     or (v_p."CO_USUARIO" is distinct from (select auth.uid())
         and not private."FC_ADMIN_GLOBAL_ATIVO"((select auth.uid()))) then
    raise exception 'Pedido não encontrado.' using errcode = '22023';
  end if;
  v_revisar := coalesce(v_p."DS_PLANO" -> 'revisar', '[]'::jsonb);
  return json_build_object(
    'pedido_id', v_p."CO_PEDIDO",
    'edital_id', v_p."CO_MONITORAMENTO",
    'origem', v_p."TP_ORIGEM",
    'situacao', v_p."TP_SITUACAO",
    'erro', v_p."DS_ERRO",
    'disparo', (select d."TP_SITUACAO" from public."TL_DISPARO_ROBO" d where d."CO_DISPARO" = v_p."CO_DISPARO"),
    'pedido_em', v_p."DT_PEDIDO",
    'lista_vigente', v_p."CO_LISTA_APROVADO_ANTERIOR",
    'anteriores', (select count(*) from public."TB_CANDIDATO_APROVADO" c
                    where c.lista_id = v_p."CO_LISTA_APROVADO_ANTERIOR" and c.removido_em is null),
    'novos_total', jsonb_array_length(v_p."DS_NOVOS"),
    'exige_motivo', private."FC_EXIGE_MOTIVO_PARA_SUBSTITUIR"(v_p."CO_LISTA_APROVADO_ANTERIOR", v_p."TP_ORIGEM"),
    'pode_substituir', v_p."CO_LISTA_APROVADO_ANTERIOR" is null or private."FC_PODE_SUBSTITUIR_LISTA"(),
    'manuais', v_p."DS_MANUAIS",
    'plano', v_p."DS_PLANO",
    -- Para a revisão da Classificação: quem entra (nome, vaga, posição) e quem revisar.
    'novos', case when v_p."TP_ORIGEM" = 'CLASSIFICACAO' and v_p."DS_PLANO" is not null then (
               select coalesce(jsonb_agg(jsonb_build_object('chave', n.y ->> 'chave', 'nome', n.y ->> 'nome',
                                 'cargo', n.y ->> 'cargo', 'codigo_vaga', n.y ->> 'codigo_vaga',
                                 'posicao', n.y -> 'posicao', 'nota', n.y -> 'nota') order by (n.y ->> 'ordem')::bigint),
                               '[]'::jsonb)
                 from jsonb_array_elements(v_p."DS_NOVOS") n(y)) end,
    'revisar', (select coalesce(jsonb_agg(jsonb_build_object(
                  'candidato_id', c.id, 'nome', c.nome, 'cargo', c.cargo, 'codigo_vaga', c.codigo_vaga,
                  'classificacao', c.classificacao, 'status', c.status, 'matricula', c.matricula)
                  order by c.nome), '[]'::jsonb)
                  from public."TB_CANDIDATO_APROVADO" c
                 where c.id in (select (r.v #>> '{}')::uuid from jsonb_array_elements(v_revisar) r(v))
                   and c.lista_id = v_p."CO_LISTA_APROVADO_ANTERIOR")
  );
end;
$function$;
comment on function public.obter_casamento_da_lista(uuid) is
  'A prévia de uma nova versão da lista de aprovados: a situação do pedido (e do pedido ao GitHub), o plano do job Python (casados, entram, sem par, status sem dono, quem muda, pendências), se exige motivo e se a pessoa pode substituir; na Classificação, quem entra e quem revisar. Só quem pediu, ou o administrador global. 20261030090000.';
revoke all on function public.obter_casamento_da_lista(uuid) from public, anon;
grant execute on function public.obter_casamento_da_lista(uuid) to authenticated;

create function public.aplicar_casamento_da_lista(
  p_pedido uuid,
  p_motivo text default null,
  p_ativo boolean default true,
  p_arquivo_path text default null
)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_p public."TB_PEDIDO_CASAMENTO_LISTA";
  v_l public."TB_LISTA_CLASSIFICACAO";
  v_vigente uuid;
  v_resultado jsonb;
begin
  select * into v_p from public."TB_PEDIDO_CASAMENTO_LISTA" where "CO_PEDIDO" = p_pedido for update;
  if v_p."CO_PEDIDO" is null
     or (v_p."CO_USUARIO" is distinct from (select auth.uid())
         and not private."FC_ADMIN_GLOBAL_ATIVO"((select auth.uid()))) then
    raise exception 'Pedido não encontrado.' using errcode = '22023';
  end if;
  if v_p."TP_SITUACAO" <> 'CALCULADO' then
    raise exception 'A prévia não está pronta (situação %).', v_p."TP_SITUACAO" using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_PEDIR_NOVA_VERSAO"(v_p."CO_MONITORAMENTO", v_p."TP_ORIGEM");

  select l.id into v_vigente from public."TB_LISTA_APROVADO" l
   where l.edital_id = v_p."CO_MONITORAMENTO"::text and l.vigente is true for update;
  if v_vigente is distinct from v_p."CO_LISTA_APROVADO_ANTERIOR"
     or private."FC_BASE_DA_LISTA"(v_vigente) is distinct from v_p."DS_BASE" then
    raise exception 'A lista de aprovados do edital mudou desde a prévia; peça a prévia de novo.' using errcode = 'PT409';
  end if;
  perform private."FC_EXIGIR_PODE_SUBSTITUIR_LISTA"(v_p."CO_MONITORAMENTO"::text, v_vigente, v_p."TP_ORIGEM", p_motivo, true);

  if v_p."TP_ORIGEM" = 'XLSX' then
    if nullif(btrim(coalesce(p_arquivo_path, '')), '') is null then
      raise exception 'Arquivo XLSX nao informado' using errcode = '22023';
    end if;
  else
    -- O resultado final ainda é o mais recente e não virou lista por outro caminho.
    perform private."FC_NOVOS_DA_CLASSIFICACAO"(v_p."CO_LISTA_CLASSIFICACAO", v_vigente);
    select * into v_l from public."TB_LISTA_CLASSIFICACAO" where "CO_LISTA_CLASSIFICACAO" = v_p."CO_LISTA_CLASSIFICACAO";
  end if;

  perform private."FC_PREPARAR_NOVA_VERSAO_DA_LISTA"();
  insert into pg_temp.tmp_lista_nova (chave, analise_id, nome, cargo, codigo_vaga, posicao, nota, situacao, modalidade, ordem)
  select n.y ->> 'chave', (n.y ->> 'analise_id')::uuid, n.y ->> 'nome', n.y ->> 'cargo', n.y ->> 'codigo_vaga',
         (n.y ->> 'posicao')::integer, (n.y ->> 'nota')::numeric, n.y ->> 'situacao', n.y ->> 'modalidade',
         (n.y ->> 'ordem')::bigint
    from jsonb_array_elements(v_p."DS_NOVOS") n(y);
  insert into pg_temp.tmp_lista_vinculo (candidato_id, chave, forma)
  select (v.x ->> 'candidato_id')::uuid, v.x ->> 'chave', v.x ->> 'forma'
    from jsonb_array_elements(v_p."DS_PLANO" -> 'vinculos') v(x);
  -- Tabelas temporárias sem estatística levam o planejador a laços aninhados (milhares × milhares).
  analyze pg_temp.tmp_lista_nova;
  analyze pg_temp.tmp_lista_vinculo;

  v_resultado := private."FC_GRAVAR_NOVA_VERSAO_DA_LISTA"(
    v_p."CO_MONITORAMENTO", v_vigente, v_p."TP_ORIGEM",
    case when v_p."TP_ORIGEM" = 'XLSX' then coalesce(p_ativo, true) else true end,
    case when v_p."TP_ORIGEM" = 'XLSX' then v_p."NO_ARQUIVO"
         else 'Classificação — resultado final (regra v' || v_l."NU_VERSAO_REGRA" || ')' end,
    case when v_p."TP_ORIGEM" = 'XLSX' then btrim(p_arquivo_path) else '' end,
    v_p."CO_LISTA_CLASSIFICACAO", v_l."CO_REGRA_CLASSIFICACAO", v_l."NU_VERSAO_REGRA", v_l."DS_HASH", p_motivo);

  update public."TB_PEDIDO_CASAMENTO_LISTA"
     set "TP_SITUACAO" = 'APLICADO', "CO_LISTA_APROVADO" = (v_resultado ->> 'lista_id')::uuid, "DT_APLICACAO" = now()
   where "CO_PEDIDO" = p_pedido;
  return (v_resultado || jsonb_build_object('pedido_id', p_pedido, 'edital_id', v_p."CO_MONITORAMENTO"))::json;
end;
$function$;
comment on function public.aplicar_casamento_da_lista(uuid, text, boolean, text) is
  'Aplica a prévia calculada: confere de novo a permissão (a mesma nos dois caminhos), a lista vigente e a assinatura dela (PT409 se mudaram), o motivo (com estado na lista) e, na Classificação, o resultado final; grava a nova versão pela função comum (FC_GRAVAR_NOVA_VERSAO_DA_LISTA) com os vínculos do plano do job. XLSX: p_ativo e p_arquivo_path. 20261030090000.';
revoke all on function public.aplicar_casamento_da_lista(uuid, text, boolean, text) from public, anon;
grant execute on function public.aplicar_casamento_da_lista(uuid, text, boolean, text) to authenticated;

-- 11. Os caminhos antigos saem (a tela usa as RPCs acima) ------------------------------------------
drop function public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean, text);
drop function public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb);

-- 12. A prévia diz se a pessoa pode substituir --------------------------------------------------
CREATE OR REPLACE FUNCTION public.obter_publicacao_lista_aprovados(p_edital uuid, p_com_candidatos boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_global boolean := private."FC_ADMIN_GLOBAL_ATIVO"((select auth.uid()));
  v_pode_substituir boolean;
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  if v_m.id is null then raise exception 'Edital não encontrado' using errcode = '22023'; end if;
  if not v_global then
    if not (private.pode_recurso('classificacao', 1) or private.pode_recurso('aprovados', 1)
            or private.pode_recurso('importacao', 2)) then
      raise exception 'Sem permissão para a lista de aprovados' using errcode = '42501';
    end if;
    if not private."FC_PODE_AREA"(v_m."CO_AREA") then
      raise exception 'Sem acesso a esta área' using errcode = '42501';
    end if;
    perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
  end if;
  -- A mesma regra de FC_EXIGIR_PODE_SUBSTITUIR_LISTA.
  v_pode_substituir := private."FC_PODE_SUBSTITUIR_LISTA"()
    or not exists (select 1 from public."TB_LISTA_APROVADO" l where l.edital_id = p_edital::text);

  return json_build_object(
    'edital_id', v_m.id,
    'pode_publicar', (v_global or private.pode_recurso('classificacao', 2)) and v_pode_substituir,
    'pode_substituir', v_pode_substituir,
    'tem_analises', exists (
      select 1 from public."TB_ANALISE_CURRICULAR" a
       where a."CO_AREA" = v_m."CO_AREA" and a.ativo
         and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)),
    'resultado_final', (
      select json_build_object('id', l."CO_LISTA_CLASSIFICACAO", 'gerada_em', l."DT_GERACAO",
               'versao_regra', l."NU_VERSAO_REGRA", 'pendencias', l."QT_PENDENCIA",
               'elegiveis', l."QT_ELEGIVEL", 'publicada', l."ST_PUBLICADA" = 'S')
        from public."TB_LISTA_CLASSIFICACAO" l
       where l."CO_MONITORAMENTO" = p_edital and l."TP_LISTA" = 'FINAL'
       order by l."DT_GERACAO" desc limit 1),
    'vigente', (
      select json_build_object(
               'lista_id', l.id, 'origem', l."TP_ORIGEM", 'lista_classificacao_id', l."CO_LISTA_CLASSIFICACAO",
               'importado_em', l.importado_em, 'por', l."NO_USUARIO_IMPORTACAO", 'ativo', l.ativo,
               'arquivo_nome', l.arquivo_nome,
               'candidatos', case when p_com_candidatos then (
                 select coalesce(json_agg(json_build_object(
                          'candidato_id', c.id, 'analise_id', c."CO_ANALISE_CURRICULAR", 'nome', c.nome,
                          'cargo', c.cargo, 'codigo_vaga', c.codigo_vaga, 'classificacao', c.classificacao,
                          'nota', c.nota, 'modalidade', c.modalidade, 'status', c.status,
                          'processo_sei', c.processo_sei, 'matricula', c.matricula, 'sub_judice', c.sub_judice,
                          'alterado_judicialmente', c.alterado_judicialmente)
                        order by c.cargo, c.classificacao nulls last, c.nome), '[]'::json)
                   from public."TB_CANDIDATO_APROVADO" c
                  where c.lista_id = l.id and c.removido_em is null) end)
        from public."TB_LISTA_APROVADO" l
       where l.edital_id = p_edital::text and l.vigente is true),
    'publicacoes', (
      select coalesce(json_agg(json_build_object(
               'id', h."CO_PUBLICACAO", 'origem', h."TP_ORIGEM", 'em', h."DT_PUBLICACAO",
               'por', coalesce(h."NO_USUARIO", h."DS_EMAIL_USUARIO"), 'lista_classificacao_id', h."CO_LISTA_CLASSIFICACAO",
               'versao_regra', h."NU_VERSAO_REGRA", 'candidatos', h."QT_CANDIDATO", 'entram', h."QT_ENTRA",
               'saem', h."QT_SAI", 'mudam', h."QT_MUDA_POSICAO", 'preservados', h."QT_PRESERVADO",
               'sub_judice_mantidos', h."QT_SUB_JUDICE_MANTIDO", 'pendencias', h."DS_PENDENCIA",
               'motivo', h."DS_MOTIVO") order by h."DT_PUBLICACAO" desc), '[]'::json)
        from (select * from public."TH_PUBLICACAO_APROVADO" x
               where x."CO_MONITORAMENTO" = p_edital
               order by x."DT_PUBLICACAO" desc limit 20) h)
  );
end;
$function$;

-- 13. As leituras por versão (20261029170000) ---------------------------------------------------
-- FC_EM_OUTRA_LISTA está no fecho das leituras (Visão geral, Seleção): recalcula as fontes delas.
select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();

-- ═══ CORPO DA MIGRATION (fim) ═══

-- A sessão do ensaio: um administrador global ativo (o banco escolhe; o id não sai no resultado).
select set_config('request.jwt.claims',
  json_build_object('sub', (select p.user_id from public."TB_PERFIL_USUARIO" p
                             join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = p.perfil
                             where p.ativo and g."ST_ADMIN_GLOBAL" and p.user_id is not null
                             order by p.updated_at limit 1)::text,
                    'role', 'authenticated')::text, true);

create temporary table t_ensaio (chave text primary key, valor jsonb) on commit drop;

/*
  Os editais do ensaio: E1 = a lista vigente XLSX com mais status (hoje ~3.150 linhas, 700 status,
  DT_CONVOCACAO); E2 = a lista vigente XLSX com mais status entre as que têm sub judice.
*/
create temporary table t_editais on commit drop as
with listas as (
  select l.id, l.edital_id,
         count(c.id) filter (where c.status is not null) qt_status,
         count(c.id) filter (where c.sub_judice) qt_sub_judice
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id and m.ativo
    join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
   where l.vigente and l."TP_ORIGEM" = 'XLSX'
   group by 1, 2
)
select 'E1' as nome, x.* from (select * from listas order by qt_status desc limit 1) x
union all
select 'E2', y.* from (select * from listas where qt_sub_judice > 0 order by qt_status desc limit 1) y;

-- O estado de cada lista vigente antes, por pessoa.
create temporary table t_estado_antes on commit drop as
select e.nome as edital, c.id, c.status, c.matricula, c.processo_sei, c."DT_CONVOCACAO", c.sub_judice
  from t_editais e
  join public."TB_CANDIDATO_APROVADO" c on c.lista_id = e.id and c.removido_em is null;

-- A planilha de cada edital: as linhas não sub judice da lista vigente; no E1, sem 5 pessoas com status.
create temporary table t_fora on commit drop as
select c.id from t_editais e
  join public."TB_CANDIDATO_APROVADO" c on c.lista_id = e.id and c.removido_em is null
 where e.nome = 'E1' and c.status is not null and not c.sub_judice
 order by c.nome, c.id limit 5;

create temporary table t_planilha on commit drop as
select e.nome as edital, c.id as candidato_id,
       row_number() over (partition by e.nome order by c.cargo, c.classificacao, c.nome, c.id) as linha,
       jsonb_build_object('codigo_vaga', c.codigo_vaga, 'cargo', c.cargo, 'classificacao', c.classificacao,
                          'nota', c.nota, 'nome', c.nome, 'modalidade', c.modalidade) as valor
  from t_editais e
  join public."TB_CANDIDATO_APROVADO" c on c.lista_id = e.id and c.removido_em is null
 where not c.sub_judice and c.id not in (select id from t_fora);

/*
  O plano do casamento é do job Python (casamento-da-lista.yml). No ensaio, sem o GitHub, ele é
  escrito por construção — a planilha saiu da própria lista, então cada linha é a pessoa de onde
  veio — ou, quando t_plano_python tem o plano que o Python calculou para o edital (o roteiro do
  ensaio roda o job local e o põe aqui), é esse o gravado.
*/
create temporary table t_plano_python (edital text primary key, plano jsonb) on commit drop;
-- [plano do Python]

do $$
declare
  v_e record;
  v_r jsonb;
  v_ini timestamptz;
  v_contr_antes integer;
  v_nova uuid;
  v_hist_antes integer;
  v_pedido uuid;
  v_plano jsonb;
  v_gravado jsonb;
begin
  for v_e in select * from t_editais order by nome loop
    select m.contratados into v_contr_antes from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_e.edital_id::uuid;
    select count(*) into v_hist_antes from public."TH_PUBLICACAO_APROVADO" h where h."CO_MONITORAMENTO" = v_e.edital_id::uuid;

    -- 1. A prévia: o pedido espera o job (há lista vigente).
    v_pedido := (public.pedir_casamento_da_lista(v_e.edital_id::uuid, 'XLSX',
                   (select jsonb_agg(p.valor order by p.linha) from t_planilha p where p.edital = v_e.nome),
                   null, null, 'ensaio.xlsx') ->> 'pedido_id')::uuid;
    insert into t_ensaio values (v_e.nome || '_pedido_pendente',
      to_jsonb((public.obter_casamento_da_lista(v_pedido) ->> 'situacao') = 'PENDENTE'));

    -- 2. O plano (do Python, ou por construção) gravado como o job grava.
    v_plano := coalesce((select t.plano from t_plano_python t where t.edital = v_e.nome), jsonb_build_object(
      'versao', 1, 'pendencias', '[]'::jsonb, 'mudam', '[]'::jsonb, 'revisar', '[]'::jsonb,
      'vinculos', (select coalesce(jsonb_agg(jsonb_build_object('candidato_id', p.candidato_id, 'chave', p.linha::text,
                                                               'forma', 'NOME') order by p.linha), '[]'::jsonb)
                     from t_planilha p where p.edital = v_e.nome),
      'resumo', jsonb_build_object('casados', (select count(*) from t_planilha p where p.edital = v_e.nome),
                                   'entram', 0, 'sem_par', 0, 'sem_dono', 0, 'preservados', 0, 'mudam', 0,
                                   'sub_judice_mantidos', 0, 'ambiguos', 0)));
    v_gravado := public.gravar_casamento_da_lista('casam-20261026T150000-0000e5a1', v_pedido, v_plano, null)::jsonb;
    insert into t_ensaio values (v_e.nome || '_plano', jsonb_build_object(
      'origem', case when exists (select 1 from t_plano_python t where t.edital = v_e.nome) then 'python' else 'construcao' end,
      'aceito', v_gravado -> 'ok', 'resumo', v_plano -> 'resumo'));

    -- 3. Sem motivo, a lista com status não é substituída.
    begin
      perform public.aplicar_casamento_da_lista(v_pedido, null, true, 'ensaio/ensaio.xlsx');
      insert into t_ensaio values (v_e.nome || '_sem_motivo_recusado', 'false');
    exception when others then
      insert into t_ensaio values (v_e.nome || '_sem_motivo_recusado', to_jsonb(sqlerrm like '%informe o motivo%'));
    end;

    -- 4. Com motivo: aplica.
    v_ini := clock_timestamp();
    v_r := public.aplicar_casamento_da_lista(v_pedido, 'Ensaio da migration 20261030090000', true, 'ensaio/ensaio.xlsx');
    v_nova := (v_r ->> 'lista_id')::uuid;

    insert into t_ensaio values (v_e.nome, jsonb_build_object(
      'linhas_antes', (select count(*) from t_estado_antes a where a.edital = v_e.nome),
      'linhas_planilha', (select count(*) from t_planilha p where p.edital = v_e.nome),
      'linhas_depois', v_r -> 'candidatos',
      'ms_aplicar', round(extract(epoch from clock_timestamp() - v_ini) * 1000),
      'casados', v_r -> 'casados', 'entram', v_r -> 'entram', 'saem', v_r -> 'saem',
      'status_sem_dono', jsonb_array_length(v_r -> 'pendencias'),
      'sub_judice_mantidos', v_r -> 'sub_judice_mantidos',
      'status_antes', (select count(*) from t_estado_antes a where a.edital = v_e.nome and a.status is not null),
      'status_depois', (select count(*) from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_nova and c.status is not null),
      'matricula_antes', (select count(*) from t_estado_antes a where a.edital = v_e.nome and a.matricula is not null),
      'matricula_depois', (select count(*) from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_nova and c.matricula is not null),
      'convocacao_antes', (select count(*) from t_estado_antes a where a.edital = v_e.nome and a."DT_CONVOCACAO" is not null),
      'convocacao_depois', (select count(*) from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_nova and c."DT_CONVOCACAO" is not null),
      'sub_judice_antes', (select count(*) from t_estado_antes a where a.edital = v_e.nome and a.sub_judice),
      'sub_judice_depois', (select count(*) from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_nova and c.sub_judice),
      'com_anterior', (select count(*) from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_nova and c."CO_CANDIDATO_ANTERIOR" is not null),
      -- Cada pessoa casada leva exatamente o estado que tinha.
      'estado_igual_ao_anterior', (select bool_and(c.status is not distinct from a.status
                                                   and c.matricula is not distinct from a.matricula
                                                   and c.processo_sei is not distinct from a.processo_sei
                                                   and c."DT_CONVOCACAO" is not distinct from a."DT_CONVOCACAO"
                                                   and c.sub_judice = a.sub_judice)
                                     from public."TB_CANDIDATO_APROVADO" c
                                     join t_estado_antes a on a.id = c."CO_CANDIDATO_ANTERIOR"
                                    where c.lista_id = v_nova),
      'fora_viraram_pendencia', (select count(*) from jsonb_array_elements(v_r -> 'pendencias') x(v)
                                  where (x.v ->> 'candidato_id')::uuid in (select id from t_fora)),
      'historico_novo', (select count(*) from public."TH_PUBLICACAO_APROVADO" h
                          where h."CO_MONITORAMENTO" = v_e.edital_id::uuid) - v_hist_antes,
      'historico_com_motivo', exists (select 1 from public."TH_PUBLICACAO_APROVADO" h
                                       where h."CO_LISTA_APROVADO" = v_nova and h."DS_MOTIVO" is not null
                                         and h."TP_ORIGEM" = 'XLSX'),
      'pedido_aplicado', (select "TP_SITUACAO" = 'APLICADO' from public."TB_PEDIDO_CASAMENTO_LISTA" where "CO_PEDIDO" = v_pedido),
      'contratados_antes', v_contr_antes,
      'contratados_depois', (select m.contratados from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_e.edital_id::uuid),
      'contratados_esperado', (select count(*) from public."TB_CANDIDATO_APROVADO" c
                                where c.lista_id = v_nova and c.status in ('Contratado', 'Migração')
                                  and not private."FC_EM_OUTRA_LISTA"(c.id))));

    -- 5. Ativar/inativar recalcula (o número não muda: contratado continua contratado).
    perform public.definir_lista_aprovados_ativa(v_nova, false);
    insert into t_ensaio values (v_e.nome || '_inativar_contratados',
      (select to_jsonb(m.contratados) from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_e.edital_id::uuid));

    -- 6. Remover a lista vigente zera os contratados.
    perform public.remover_lista_aprovados(v_nova);
    insert into t_ensaio values (v_e.nome || '_remover_contratados',
      (select to_jsonb(m.contratados) from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_e.edital_id::uuid));
  end loop;
end;
$$;

-- O que muda só no ensaio: o resultado. Tudo acima é desfeito pelo rollback.
select json_object_agg(chave, valor order by chave) as ensaio from t_ensaio;

rollback;
