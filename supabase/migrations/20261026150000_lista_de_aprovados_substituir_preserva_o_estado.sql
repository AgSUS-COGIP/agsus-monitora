/*
  LISTA DE APROVADOS: SUBSTITUIR PRESERVA O ESTADO E ATUALIZA OS CONTRATADOS

  Achados do diagnóstico da jornada da contratação (26/10/2026):

  1. importar_lista_aprovados (substituir a lista pelo XLSX) gravava só vaga,
     cargo, classificação, nota, nome e modalidade, com sub_judice = false:
     perdia status, matrícula, processo SEI, DT_CONVOCACAO, sub judice, a
     alteração judicial, os anexos e o vínculo CO_CANDIDATO_ANTERIOR — e não
     recalculava os contratados. publicar_lista_aprovados_da_classificacao já
     preservava tudo pelo casamento das pessoas.
     Agora os DOIS caminhos gravam a nova versão pela mesma função,
     private."FC_GRAVAR_NOVA_VERSAO_DA_LISTA": confere os vínculos, tira a lista
     anterior de vigor, grava a nova levando o estado de quem casou (status,
     processo SEI, matrícula, DT_CONVOCACAO, sub judice, alteração judicial,
     análise e CO_CANDIDATO_ANTERIOR), mantém os sub judice sem par, copia os
     anexos, recoloca quem tem nota da decisão, grava TH_PUBLICACAO_APROVADO
     (com entram/saem/mudam/preservados e as pendências) e recalcula os
     contratados do edital.
     O casamento vem da tela (p_vinculos, a mesma conta de
     src/lib/publicacao-de-aprovados.ts, revista pela pessoa). Sem p_vinculos
     (nulo), o banco casa sozinho com as mesmas regras
     (private."FC_CASAR_NOVA_VERSAO_DA_LISTA": a mesma análise; o nome
     normalizado único dos dois lados; homônimo desempata pela vaga). É
     set-based (janelas e junções por hash sobre o nome normalizado): para as
     listas de hoje (até ~3.500 linhas) roda em milissegundos; não precisa de
     job em Python.

  2. CONTRATADOS
     importar, remover e ativar/inativar passam a chamar
     private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL". Sem lista vigente, a função
     agora ZERA os contratados do edital que já teve lista (antes devolvia 0 sem
     gravar, e o recálculo em lote mantinha o número antigo pelo coalesce).
     Edital que nunca teve lista não é tocado.

  3. PERMISSÕES IGUAIS NOS DOIS CAMINHOS
     private."FC_EXIGIR_PODE_SUBSTITUIR_LISTA": edital que já teve lista só o
     admin da Importação (papel_recurso('importacao') = 'admin') publica de novo,
     pelo XLSX ou pela Classificação; sobrescrever lista com estado (status,
     matrícula, processo SEI, sub judice ou alteração judicial) exige motivo
     (3 a 500 caracteres), como já exigia trocar pela planilha uma lista
     publicada da Classificação. publicar_lista_aprovados_da_classificacao ganha
     p_motivo; obter_publicacao_lista_aprovados diz pode_substituir.

  Assinaturas que mudam (src/lib/rpc-contrato.js):
    importar_lista_aprovados(..., p_motivo, p_vinculos jsonb default null)
    publicar_lista_aprovados_da_classificacao(..., p_vinculos, p_motivo text default null)

  Ensaio:   supabase/ensaios/20261026150000_lista_de_aprovados_substituir_preserva_o_estado.sql
  Rollback: supabase/rollback/20261026150000_lista_de_aprovados_substituir_preserva_o_estado.sql
*/
begin;

set local lock_timeout = '5s';

-- 0. Pré-requisitos -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb)') is null
     or to_regprocedure('public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean, text)') is null
     or to_regprocedure('private."FC_RECOLOCAR_NA_CLASSIFICACAO"(uuid, text)') is null then
    raise exception 'Aplique antes 20261006070000_integridade_das_listas_e_kpis.sql.';
  end if;
  if to_regprocedure('private."FC_EM_OUTRA_LISTA"(uuid)') is null then
    raise exception 'Aplique antes 20261024120000_contratado_em_outra_lista.sql.';
  end if;
end;
$$;

-- 1. O nome como a tela o compara ---------------------------------------------------------------
create or replace function private."FC_NOME_DO_CASAMENTO"(p_nome text)
returns text
language sql
immutable parallel safe
set search_path to ''
as $function$
  select nullif(btrim(regexp_replace(
    translate(lower(coalesce(p_nome, '')),
              'áàâãäåçéèêëíìîïñóòôõöúùûüýÿ',
              'aaaaaaceeeeiiiinooooouuuuyy'),
    '[^a-z0-9]+', ' ', 'g')), '');
$function$;
comment on function private."FC_NOME_DO_CASAMENTO"(text) is
  'O nome sem acento, em minúsculas, só letras e números separados por um espaço: o mesmo de normalizarNome (src/lib/publicacao-de-aprovados.ts). 20261026150000.';
revoke all on function private."FC_NOME_DO_CASAMENTO"(text) from public, anon, authenticated;

-- 2. A lista nova e os vínculos, em tabelas temporárias da transação ----------------------------
create or replace function private."FC_PREPARAR_NOVA_VERSAO_DA_LISTA"()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  create temporary table if not exists tmp_lista_nova (
    chave text not null, analise_id uuid, nome text, nome_normalizado text, cargo text,
    codigo_vaga text, posicao integer, nota numeric, situacao text, modalidade text, ordem bigint
  ) on commit drop;
  create temporary table if not exists tmp_lista_vinculo (
    candidato_id uuid, chave text, forma text
  ) on commit drop;
  truncate pg_temp.tmp_lista_nova;
  truncate pg_temp.tmp_lista_vinculo;
end;
$function$;
comment on function private."FC_PREPARAR_NOVA_VERSAO_DA_LISTA"() is
  'Cria (ou esvazia) pg_temp.tmp_lista_nova (quem entra, uma linha por chave) e pg_temp.tmp_lista_vinculo (quem da lista vigente é quem entra). 20261026150000.';
revoke all on function private."FC_PREPARAR_NOVA_VERSAO_DA_LISTA"() from public, anon, authenticated;

-- 3. O casamento automático (sem p_vinculos), com as regras de casarCandidatos -----------------
create or replace function private."FC_CASAR_NOVA_VERSAO_DA_LISTA"(p_anterior uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_qt integer := 0;
  v_parcial integer;
begin
  if p_anterior is null then return 0; end if;

  -- 1. A mesma análise (lista publicada da Classificação).
  insert into pg_temp.tmp_lista_vinculo (candidato_id, chave, forma)
  select distinct on (n.chave) o.id, n.chave, 'ANALISE'
    from pg_temp.tmp_lista_nova n
    join public."TB_CANDIDATO_APROVADO" o
      on o.lista_id = p_anterior and o.removido_em is null and o."CO_ANALISE_CURRICULAR" = n.analise_id
   where n.analise_id is not null
   order by n.chave, o.cargo, o.classificacao nulls last, o.nome, o.id;
  get diagnostics v_parcial = row_count;
  v_qt := v_qt + v_parcial;

  -- 2. O nome normalizado, único dos dois lados; 3. homônimo desempata pela vaga.
  with antes as (
    select a.id, a.nome, a.vaga,
           count(*) over (partition by a.nome) as qt_nome,
           count(*) over (partition by a.nome, a.vaga) as qt_vaga
      from (select o.id, private."FC_NOME_DO_CASAMENTO"(o.nome) as nome,
                   lower(btrim(coalesce(o.codigo_vaga, ''))) as vaga
              from public."TB_CANDIDATO_APROVADO" o
             where o.lista_id = p_anterior and o.removido_em is null
               and not exists (select 1 from pg_temp.tmp_lista_vinculo k where k.candidato_id = o.id)) a
     where a.nome is not null
  ),
  depois as (
    select d.chave, d.nome, d.vaga,
           count(*) over (partition by d.nome) as qt_nome,
           count(*) over (partition by d.nome, d.vaga) as qt_vaga
      from (select n.chave, n.nome_normalizado as nome, lower(btrim(coalesce(n.codigo_vaga, ''))) as vaga
              from pg_temp.tmp_lista_nova n
             where not exists (select 1 from pg_temp.tmp_lista_vinculo k where k.chave = n.chave)) d
     where d.nome is not null
  )
  insert into pg_temp.tmp_lista_vinculo (candidato_id, chave, forma)
  select a.id, d.chave, 'NOME'
    from antes a join depois d on d.nome = a.nome
   where a.qt_nome = 1 and d.qt_nome = 1
  union all
  select a.id, d.chave, 'NOME_VAGA'
    from antes a join depois d on d.nome = a.nome and d.vaga = a.vaga
   where not (a.qt_nome = 1 and d.qt_nome = 1)
     and a.vaga <> '' and a.qt_vaga = 1 and d.qt_vaga = 1;
  get diagnostics v_parcial = row_count;
  return v_qt + v_parcial;
end;
$function$;
comment on function private."FC_CASAR_NOVA_VERSAO_DA_LISTA"(uuid) is
  'Casa quem da lista vigente é quem entra (pg_temp.tmp_lista_nova → tmp_lista_vinculo), com as regras de casarCandidatos: a mesma análise; o nome normalizado único dos dois lados; homônimo pela vaga. Set-based. 20261026150000.';
revoke all on function private."FC_CASAR_NOVA_VERSAO_DA_LISTA"(uuid) from public, anon, authenticated;

-- 4. Quem pode publicar uma nova versão (o mesmo nos dois caminhos) -----------------------------
create or replace function private."FC_EXIGIR_PODE_SUBSTITUIR_LISTA"(
  p_edital text, p_anterior uuid, p_origem_nova text, p_motivo text
)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_origem_anterior text;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if v_motivo is not null and length(v_motivo) not between 3 and 500 then
    raise exception 'O motivo deve ter entre 3 e 500 caracteres.' using errcode = '22023';
  end if;
  if exists (select 1 from public."TB_LISTA_APROVADO" l where l.edital_id = p_edital)
     and private.papel_recurso('importacao') <> 'admin' then
    raise exception 'Somente admin pode substituir ou publicar de novo uma lista ja cadastrada' using errcode = '42501';
  end if;
  if p_anterior is null then return; end if;
  select l."TP_ORIGEM" into v_origem_anterior from public."TB_LISTA_APROVADO" l where l.id = p_anterior;
  if v_motivo is null and v_origem_anterior = 'CLASSIFICACAO' and p_origem_nova = 'XLSX' then
    raise exception 'A lista vigente foi publicada da Classificação. Para trocá-la pela planilha, informe o motivo.' using errcode = '22023';
  end if;
  if v_motivo is null and exists (
    select 1 from public."TB_CANDIDATO_APROVADO" c
     where c.lista_id = p_anterior and c.removido_em is null
       and (c.status is not null or c.sub_judice or c.alterado_judicialmente
            or nullif(btrim(coalesce(c.matricula, '')), '') is not null
            or nullif(btrim(coalesce(c.processo_sei, '')), '') is not null)
  ) then
    raise exception 'A lista vigente tem status, matrícula ou sub judice. Para substituí-la, informe o motivo.' using errcode = '22023';
  end if;
end;
$function$;
comment on function private."FC_EXIGIR_PODE_SUBSTITUIR_LISTA"(text, uuid, text, text) is
  'A mesma regra para o XLSX e a Classificação: edital que já teve lista só o admin da Importação publica de novo; sobrescrever lista com estado (ou trocar pela planilha a publicada da Classificação) exige motivo de 3 a 500 caracteres. 20261026150000.';
revoke all on function private."FC_EXIGIR_PODE_SUBSTITUIR_LISTA"(text, uuid, text, text) from public, anon, authenticated;

-- 5. Contratados ---------------------------------------------------------------------------------
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
    exists (select 1 from public."TB_CANDIDATO_APROVADO" c
              join public."TB_CONTRATACAO_APROVADO" x on x."CO_CANDIDATO_APROVADO" = c."CO_CANDIDATO_ANTERIOR"
             where c.id = p_candidato and x."TP_SITUACAO" = 'OUTRA_LISTA'));
$function$;
comment on function private."FC_EM_OUTRA_LISTA"(uuid) is
  'A linha Contratado está "em outra lista" pelo instantâneo do job (TB_CONTRATACAO_APROVADO): não conta nos contratados. Linha sem decisão segue a da linha anterior (CO_CANDIDATO_ANTERIOR) até o job voltar. 20261024120000, 20261026150000.';
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
  'Atualiza TB_MONITORAMENTO_INDIGENA.contratados de um edital ativo pela lista de aprovados vigente (Contratado ou Migração, menos os em outra lista); sem lista vigente, zera — só quando o edital já teve lista (20261026150000). Só grava se mudou.';
revoke all on function private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(uuid) from public, anon, authenticated;

-- 6. A nova versão da lista: a gravação comum aos dois caminhos ---------------------------------
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
  'A nova versão da lista de aprovados (XLSX ou Classificação), a partir de pg_temp.tmp_lista_nova e tmp_lista_vinculo: confere os vínculos, tira a anterior de vigor, leva o estado de quem casou (status, processo SEI, matrícula, DT_CONVOCACAO, sub judice, alteração judicial, análise, CO_CANDIDATO_ANTERIOR, anexos), mantém os sub judice sem par, grava TH_PUBLICACAO_APROVADO e recalcula os contratados. 20261026150000.';
revoke all on function private."FC_GRAVAR_NOVA_VERSAO_DA_LISTA"(uuid, uuid, text, boolean, text, text, uuid, uuid, integer, text, text) from public, anon, authenticated;

-- 7. Importar (XLSX): a nova versão pela função comum -------------------------------------------
drop function public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean, text);

create function public.importar_lista_aprovados(
  p_edital_id text,
  p_ativo boolean,
  p_arquivo_nome text,
  p_arquivo_path text,
  p_candidatos jsonb,
  p_substituir boolean default false,
  p_motivo text default null,
  p_vinculos jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role text := private.papel_recurso('importacao');
  v_lista_atual uuid;
  v_edital text;
  v_total integer;
  v_resultado jsonb;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital_id);
  if not (private.pode_recurso('importacao', 2)) then raise exception 'Sem permissão para este recurso' using errcode = '42501'; end if;
  if (select auth.uid()) is null then raise exception 'Usuario nao autenticado'; end if;
  if v_role not in ('edital_gestor', 'contratador', 'admin') then
    raise exception 'Perfil sem permissao para importar lista de aprovados';
  end if;
  if p_edital_id is null then raise exception 'Edital nao informado'; end if;
  if nullif(btrim(p_arquivo_nome), '') is null or nullif(btrim(p_arquivo_path), '') is null then
    raise exception 'Arquivo XLSX nao informado';
  end if;
  if jsonb_typeof(p_candidatos) is distinct from 'array' or jsonb_array_length(p_candidatos) = 0 then
    raise exception 'A lista precisa conter pelo menos um candidato';
  end if;
  if p_vinculos is not null and jsonb_typeof(p_vinculos) <> 'array' then
    raise exception 'Vínculos inválidos.' using errcode = '22023';
  end if;

  select m.edital into v_edital from public."TB_MONITORAMENTO_INDIGENA" m where m.id::text = p_edital_id;
  if not found then raise exception 'Edital nao encontrado na Equipe Nucleo'; end if;

  select id into v_lista_atual
    from public."TB_LISTA_APROVADO"
   where edital_id = p_edital_id and vigente is true
   for update;
  if v_lista_atual is not null and not coalesce(p_substituir, false) then
    raise exception 'Este edital ja possui lista. Use a opcao de substituicao administrativa';
  end if;
  perform private."FC_EXIGIR_PODE_SUBSTITUIR_LISTA"(p_edital_id, v_lista_atual, 'XLSX', p_motivo);

  -- Quem entra: uma linha por linha da planilha (a chave é o número da linha, de 1 em diante).
  perform private."FC_PREPARAR_NOVA_VERSAO_DA_LISTA"();
  insert into pg_temp.tmp_lista_nova (chave, nome, nome_normalizado, cargo, codigo_vaga, posicao, nota, modalidade, ordem)
  select x.linha::text, nullif(btrim(x.valor ->> 'nome'), ''),
         private."FC_NOME_DO_CASAMENTO"(x.valor ->> 'nome'),
         nullif(btrim(x.valor ->> 'cargo'), ''), nullif(btrim(x.valor ->> 'codigo_vaga'), ''),
         (x.valor ->> 'classificacao')::integer, (x.valor ->> 'nota')::numeric,
         nullif(btrim(x.valor ->> 'modalidade'), ''), x.linha
    from jsonb_array_elements(p_candidatos) with ordinality x(valor, linha);
  get diagnostics v_total = row_count;
  if v_total <> jsonb_array_length(p_candidatos) then
    raise exception 'Nem todos os candidatos puderam ser importados';
  end if;

  if p_vinculos is null then
    perform private."FC_CASAR_NOVA_VERSAO_DA_LISTA"(v_lista_atual);
  else
    insert into pg_temp.tmp_lista_vinculo (candidato_id, chave, forma)
    select (x.valor ->> 'candidato_id')::uuid, nullif(btrim(x.valor ->> 'linha'), ''),
           upper(coalesce(nullif(btrim(x.valor ->> 'forma'), ''), 'MANUAL'))
      from jsonb_array_elements(p_vinculos) x(valor);
    if exists (select 1 from pg_temp.tmp_lista_vinculo k where k.forma = 'ANALISE') then
      raise exception 'A planilha não traz análise: vincule pelo nome, pela vaga ou à mão.' using errcode = '22023';
    end if;
  end if;

  v_resultado := private."FC_GRAVAR_NOVA_VERSAO_DA_LISTA"(
    p_edital_id::uuid, v_lista_atual, 'XLSX', coalesce(p_ativo, true), btrim(p_arquivo_nome),
    btrim(p_arquivo_path), null, null, null, null, p_motivo);

  return v_resultado || jsonb_build_object(
    'edital_id', p_edital_id, 'edital', v_edital, 'total', v_resultado -> 'candidatos',
    'ativo', coalesce(p_ativo, true));
end;
$function$;
comment on function public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean, text, jsonb) is
  'Importa ou substitui a lista XLSX de aprovados de um edital pela nova versão comum (FC_GRAVAR_NOVA_VERSAO_DA_LISTA): preserva o estado de quem casou (p_vinculos da tela: {candidato_id, linha, forma}; nulo = o banco casa), grava o histórico e recalcula os contratados. 20261026150000.';
revoke all on function public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean, text, jsonb) from public, anon;
grant execute on function public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean, text, jsonb) to authenticated;

-- 8. Publicar da Classificação: a mesma gravação e a mesma permissão ---------------------------
drop function public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb);

create function public.publicar_lista_aprovados_da_classificacao(
  p_lista_classificacao uuid,
  p_lista_vigente uuid,
  p_vinculos jsonb default null,
  p_motivo text default null
)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_l public."TB_LISTA_CLASSIFICACAO";
  v_anterior public."TB_LISTA_APROVADO";
  v_edital text;
  v_qt integer;
begin
  select * into v_l from public."TB_LISTA_CLASSIFICACAO" where "CO_LISTA_CLASSIFICACAO" = p_lista_classificacao;
  if v_l."CO_LISTA_CLASSIFICACAO" is null then
    raise exception 'Lista de classificação não encontrada' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(v_l."CO_MONITORAMENTO", 2);
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
  perform private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(v_l."CO_MONITORAMENTO", v_l."DS_RESULTADO");
  if p_vinculos is not null and jsonb_typeof(p_vinculos) <> 'array' then
    raise exception 'Vínculos inválidos.' using errcode = '22023';
  end if;
  v_edital := v_l."CO_MONITORAMENTO"::text;

  select * into v_anterior from public."TB_LISTA_APROVADO"
   where edital_id = v_edital and vigente is true for update;
  if v_anterior.id is distinct from p_lista_vigente then
    raise exception 'A lista de aprovados do edital mudou desde a prévia; abra a publicação de novo.' using errcode = 'PT409';
  end if;
  if v_anterior."CO_LISTA_CLASSIFICACAO" = p_lista_classificacao then
    raise exception 'Este resultado final já é a lista de aprovados vigente.' using errcode = '22023';
  end if;
  -- A mesma regra do XLSX: lista já cadastrada, só o admin; com estado, motivo.
  perform private."FC_EXIGIR_PODE_SUBSTITUIR_LISTA"(v_edital, v_anterior.id, 'CLASSIFICACAO', p_motivo);

  -- Quem entra: um por análise (a posição da geral; quem só está na lista da
  -- modalidade, a dela; a primeira vaga em que aparece).
  perform private."FC_PREPARAR_NOVA_VERSAO_DA_LISTA"();
  insert into pg_temp.tmp_lista_nova (
    chave, analise_id, nome, nome_normalizado, cargo, codigo_vaga, posicao, nota, situacao, modalidade, ordem
  )
  select y.analise_id::text, y.analise_id, y.nome, private."FC_NOME_DO_CASAMENTO"(y.nome), y.cargo,
         y.codigo_vaga, y.posicao, y.nota, y.situacao, y.modalidade,
         row_number() over (order by y.vaga_ordem, y.posicao, y.nome)
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
    ) y;

  select count(*) into v_qt from pg_temp.tmp_lista_nova;
  if v_qt = 0 then
    raise exception 'O resultado final não tem candidatos para publicar.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.tmp_lista_nova n
              where n.posicao is null or n.posicao < 1 or n.nota is null or n.nota < 0
                 or nullif(n.nome, '') is null) then
    raise exception 'O resultado final tem candidato sem posição, nota ou nome; gere de novo.' using errcode = '22023';
  end if;

  if p_vinculos is null then
    perform private."FC_CASAR_NOVA_VERSAO_DA_LISTA"(v_anterior.id);
  else
    insert into pg_temp.tmp_lista_vinculo (candidato_id, chave, forma)
    select (x.valor ->> 'candidato_id')::uuid, ((x.valor ->> 'analise_id')::uuid)::text,
           upper(coalesce(nullif(btrim(x.valor ->> 'forma'), ''), 'MANUAL'))
      from jsonb_array_elements(p_vinculos) x(valor);
  end if;

  return private."FC_GRAVAR_NOVA_VERSAO_DA_LISTA"(
    v_l."CO_MONITORAMENTO", v_anterior.id, 'CLASSIFICACAO', true,
    'Classificação — resultado final (regra v' || v_l."NU_VERSAO_REGRA" || ')', '',
    p_lista_classificacao, v_l."CO_REGRA_CLASSIFICACAO", v_l."NU_VERSAO_REGRA", v_l."DS_HASH", p_motivo
  )::json;
end;
$function$;
comment on function public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb, text) is
  'Publica o resultado final da Classificação como a lista de aprovados vigente pela nova versão comum (FC_GRAVAR_NOVA_VERSAO_DA_LISTA), com a mesma permissão do XLSX (FC_EXIGIR_PODE_SUBSTITUIR_LISTA: lista já cadastrada só o admin; com estado, p_motivo). PT409 se a lista vigente mudou. 20261026150000.';
revoke all on function public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb, text) to authenticated;

-- 9. Remover e ativar/inativar recalculam os contratados ----------------------------------------
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
  if private.monitora_role() <> 'admin' then raise exception 'Somente admin pode remover lista de aprovados'; end if;
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
  v_role text := private.papel_recurso('importacao');
  v_edital_id text;
  v_vencimento date;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_LISTA_APROVADO" l where l.id = p_lista_id));
  if not (private.pode_recurso('importacao',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if v_role not in ('edital_gestor', 'contratador', 'admin') then
    raise exception 'Perfil sem permissao para alterar a lista';
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

-- 10. A prévia diz se a pessoa pode substituir --------------------------------------------------
CREATE OR REPLACE FUNCTION public.obter_publicacao_lista_aprovados(p_edital uuid, p_com_candidatos boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_pode_substituir boolean;
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  if v_m.id is null then raise exception 'Edital não encontrado' using errcode = '22023'; end if;
  if not (private.pode_recurso('classificacao', 1) or private.pode_recurso('aprovados', 1)
          or private.pode_recurso('importacao', 2)) then
    raise exception 'Sem permissão para a lista de aprovados' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(v_m."CO_AREA") then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
  -- A mesma regra de FC_EXIGIR_PODE_SUBSTITUIR_LISTA.
  v_pode_substituir := private.papel_recurso('importacao') = 'admin'
    or not exists (select 1 from public."TB_LISTA_APROVADO" l where l.edital_id = p_edital::text);

  return json_build_object(
    'edital_id', v_m.id,
    'pode_publicar', private.pode_recurso('classificacao', 2) and v_pode_substituir,
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

commit;
