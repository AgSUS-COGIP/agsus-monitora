/*
  ENSAIO de 20261007160000_link_do_candidato_na_empregare.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e confere:
    E1  colunas novas, tabelas sem acesso direto, fechar_vaga_empregare só com
        a assinatura nova e só para o service_role; nenhuma outra função lê
        DS_LINK_DETALHE (o link não vaza para lista);
    E2  como o robô (service_role), na vaga fictícia 99999501: lote com link
        válido, link inválido e sem link; fechar com o identificador interno;
        depois uma carga como o robô antigo (sem link, fechar com 4 argumentos)
        e outra com link novo e identificador numérico (ignorado);
    E3  como pessoas (authenticated): o analista da vaga recebe os links na
        ficha; quem não vê a ficha é barrado (42501); a fila não traz o link;
    E4  depois de "reset role": o que ficou nas tabelas e as CKs.
  Termina em ROLLBACK: nada fica gravado. Links e identificadores são
  fictícios (ENSAIO…); a ficha usada é uma existente, com o candidato e a vaga
  dela recebendo link fictício só dentro da transação; nada pessoal é mostrado.

  Precisa de: 20261005170000 e 20261007130000 aplicadas, ao menos uma ficha da
  avaliação documental e nenhuma execução do robô em andamento
  (iniciar_sync_empregare recusaria com 55P03).

  Resultado esperado: as mensagens "ok E1" … "ok E4" e a linha "ENSAIO OK" do
  SELECT final. Qualquer "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/link-do-candidato-na-empregare-migration.test.js
  confere que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.fechar_vaga_empregare(text, text, jsonb, text)') is null
     or to_regprocedure('public.gravar_lote_empregare(text, text, integer, jsonb)') is null then
    raise exception 'Aplique antes 20261005170000_robo_empregare.sql.';
  end if;
  if to_regprocedure('public.obter_ficha_analise(uuid)') is null
     or to_regprocedure('private."FC_EXIGIR_VER_FICHA"(public."TB_FICHA_ANALISE")') is null then
    raise exception 'Aplique antes 20261007130000_conteudo_da_ficha.sql.';
  end if;
end;
$$;

-- 1. Colunas ----------------------------------------------------------------------------
alter table public."TB_EMPREGARE_VAGA"
  add column "CO_VAGA_INTERNO" varchar(100),
  add column "DT_CAPTURA_LINK" timestamptz,
  add constraint "CK_EMPREGVAGA_COVAGAINTERNO" check (
    "CO_VAGA_INTERNO" is null
    or ("CO_VAGA_INTERNO" ~ '^[A-Za-z0-9_.~=-]{1,96}[|]{0,3}$' and "CO_VAGA_INTERNO" !~ '^[0-9]+[|]*$'));
comment on column public."TB_EMPREGARE_VAGA"."CO_VAGA_INTERNO" is 'Identificador interno da vaga na Empregare, capturado pelo robô (o trecho de /empresa/vagas/candidaturas/<id>|, com a barra vertical; ex.: Ab1cD2eF3g|). Abre as candidaturas da vaga; o código numérico não abre. Pode mudar: o robô sobrescreve.';
comment on column public."TB_EMPREGARE_VAGA"."DT_CAPTURA_LINK" is 'Quando o robô capturou o identificador interno da vaga pela última vez.';
comment on constraint "CK_EMPREGVAGA_COVAGAINTERNO" on public."TB_EMPREGARE_VAGA" is 'Identificador interno: letras, dígitos e _.~=- com até 3 barras verticais no fim; nunca só o código numérico.';

alter table public."TB_EMPREGARE_CANDIDATO"
  add column "DS_LINK_DETALHE" varchar(600),
  add column "DT_CAPTURA_LINK" timestamptz,
  add constraint "CK_EMPREGCAND_DSLINKDETALHE" check (
    "DS_LINK_DETALHE" is null
    or ("DS_LINK_DETALHE" ~ '^https://corporate\.empregare\.com/empresa/curriculo/detalhes\?[A-Za-z0-9_.~=&%|+/:-]+$'
        and length("DS_LINK_DETALHE") <= 600));
comment on column public."TB_EMPREGARE_CANDIDATO"."DS_LINK_DETALHE" is 'Link da página de detalhes do candidato na Empregare (currículo e questionário), capturado pelo robô na lista de candidaturas da vaga. DADO RESTRITO: leva tokens de acesso da área logada; só a RPC da ficha devolve, a quem pode ver a ficha. Nunca em lista, CSV ou log.';
comment on column public."TB_EMPREGARE_CANDIDATO"."DT_CAPTURA_LINK" is 'Quando o robô capturou o link de detalhes pela última vez.';
comment on constraint "CK_EMPREGCAND_DSLINKDETALHE" on public."TB_EMPREGARE_CANDIDATO" is 'Link só da página de detalhes do currículo na Empregare (https), sem espaço, aspas nem sinais de HTML.';

-- 2. Gravação pelo robô -----------------------------------------------------------------
create or replace function public.gravar_lote_empregare(p_sync text, p_vaga text, p_total integer, p_linhas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_situacao text;
  v_qt integer;
begin
  perform private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync);
  if p_vaga is null or p_vaga !~ '^[0-9]{1,20}$' then
    raise exception 'Código de vaga inválido' using errcode = '22023';
  end if;
  if coalesce(p_total, -1) not between 1 and 50000 then
    raise exception 'Total de candidatos fora de 1 a 50000' using errcode = '22023';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) not between 1 and 1000 then
    raise exception 'Envie de 1 a 1000 linhas por lote' using errcode = '22023';
  end if;

  v_situacao := private."FC_EMPREGARE_ABRIR_VAGA"(p_sync, p_vaga, p_total);
  if v_situacao <> 'EM_CARGA' then
    return jsonb_build_object('situacao', v_situacao, 'gravadas', 0);
  end if;

  create temporary table if not exists pg_temp.tmp_empregare_lote_link (
    chave text, tipo text, codigo text, nome text, email text, cpf text, telefone text,
    nascimento date, situacao text, candidatura timestamptz, colunas jsonb, hash text, link text
  ) on commit drop;
  truncate pg_temp.tmp_empregare_lote_link;

  insert into pg_temp.tmp_empregare_lote_link
  select distinct on (l.chave)
         l.chave, l.tipo,
         nullif(left(btrim(l.codigo), 60), ''),
         nullif(left(btrim(l.nome), 300), ''),
         nullif(left(lower(btrim(l.email)), 320), ''),
         case when l.cpf ~ '^[0-9]{11}$' then l.cpf end,
         nullif(left(btrim(l.telefone), 60), ''),
         private."FC_EMPREGARE_DATA"(l.nascimento),
         nullif(left(btrim(l.situacao), 200), ''),
         private."FC_EMPREGARE_MOMENTO"(l.candidatura),
         l.colunas,
         encode(sha256(convert_to(l.colunas::text, 'UTF8')), 'hex'),
         -- Link fora do formato (outro site, javascript:, aspas) vira nulo: mantém o anterior.
         case when l.link ~ '^https://corporate\.empregare\.com/empresa/curriculo/detalhes\?[A-Za-z0-9_.~=&%|+/:-]+$'
                   and length(l.link) <= 600
              then l.link end
    from jsonb_to_recordset(p_linhas) as l(
      chave text, tipo text, codigo text, nome text, email text, cpf text, telefone text,
      nascimento text, situacao text, candidatura text, colunas jsonb, link text)
   where l.chave ~ '^(cod:[A-Za-z0-9._-]{1,60}|cpf:[0-9a-f]{64}|email:[0-9a-f]{64})$'
     and l.tipo in ('CODIGO', 'CPF', 'EMAIL')
     and jsonb_typeof(l.colunas) = 'object'
   order by l.chave;

  insert into public."TB_EMPREGARE_CANDIDATO" as c (
    "CO_VAGA", "DS_CHAVE_CANDIDATO", "TP_CHAVE", "CO_CANDIDATO_EMPREGARE", "NO_CANDIDATO", "DS_EMAIL",
    "NU_CPF", "NU_TELEFONE", "DT_NASCIMENTO", "DS_SITUACAO_EMPREGARE", "DT_CANDIDATURA",
    "DS_COLUNA_ORIGINAL", "DS_HASH_LINHA", "CO_SYNC", "ST_REGISTRO_ATIVO", "DS_LINK_DETALHE", "DT_CAPTURA_LINK")
  select p_vaga, t.chave, t.tipo, t.codigo, t.nome, t.email, t.cpf, t.telefone, t.nascimento,
         t.situacao, t.candidatura, t.colunas, t.hash, p_sync, 'S', t.link,
         case when t.link is not null then now() end
    from pg_temp.tmp_empregare_lote_link t
  on conflict ("CO_VAGA", "DS_CHAVE_CANDIDATO") do update set
    "TP_CHAVE" = excluded."TP_CHAVE",
    "CO_CANDIDATO_EMPREGARE" = excluded."CO_CANDIDATO_EMPREGARE",
    "NO_CANDIDATO" = excluded."NO_CANDIDATO",
    "DS_EMAIL" = excluded."DS_EMAIL",
    "NU_CPF" = excluded."NU_CPF",
    "NU_TELEFONE" = excluded."NU_TELEFONE",
    "DT_NASCIMENTO" = excluded."DT_NASCIMENTO",
    "DS_SITUACAO_EMPREGARE" = excluded."DS_SITUACAO_EMPREGARE",
    "DT_CANDIDATURA" = excluded."DT_CANDIDATURA",
    "DS_COLUNA_ORIGINAL" = excluded."DS_COLUNA_ORIGINAL",
    "DS_HASH_LINHA" = excluded."DS_HASH_LINHA",
    "CO_SYNC" = excluded."CO_SYNC",
    "DT_ATUALIZACAO" = case
      when c."DS_HASH_LINHA" is distinct from excluded."DS_HASH_LINHA" or c."ST_REGISTRO_ATIVO" = 'N' then now()
      else c."DT_ATUALIZACAO" end,
    "DT_CONFERENCIA" = now(),
    "ST_REGISTRO_ATIVO" = 'S',
    "DT_DESATIVACAO" = null,
    "DS_LINK_DETALHE" = coalesce(excluded."DS_LINK_DETALHE", c."DS_LINK_DETALHE"),
    "DT_CAPTURA_LINK" = coalesce(excluded."DT_CAPTURA_LINK", c."DT_CAPTURA_LINK");

  select count(*) into v_qt from pg_temp.tmp_empregare_lote_link;
  update public."TB_EMPREGARE_VAGA" set "QT_RECEBIDA" = "QT_RECEBIDA" + v_qt, "DT_ATUALIZACAO" = now()
   where "CO_VAGA" = p_vaga;
  update public."TL_SYNC_EMPREGARE" set "QT_LINHA" = "QT_LINHA" + v_qt where "CO_SYNC" = p_sync;
  return jsonb_build_object('situacao', 'EM_CARGA', 'recebidas', jsonb_array_length(p_linhas), 'gravadas', v_qt,
                            'com_link', (select count(*) from pg_temp.tmp_empregare_lote_link t where t.link is not null));
end;
$function$;
comment on function public.gravar_lote_empregare(text, text, integer, jsonb) is
  'Recebe um lote (até 1000) de candidatos de uma vaga e faz upsert em TB_EMPREGARE_CANDIDATO pela chave natural (o hash da linha diz se mudou). Cada linha aceita "link" (opcional): o link da página de detalhes do candidato na Empregare, gravado em DS_LINK_DETALHE quando válido; sem link, fica o anterior. p_total = candidatos do arquivo inteiro: no primeiro lote da vaga, a trava recusa (RECUSADA, nada gravado) o arquivo com menos da metade dos ativos sem forçar. Fechar com fechar_vaga_empregare. Só service_role.';

drop function public.fechar_vaga_empregare(text, text, jsonb, text);
create function public.fechar_vaga_empregare(p_sync text, p_vaga text, p_colunas jsonb, p_arquivo text default null,
                                             p_vaga_interno text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_situacao text;
  v_desativadas integer;
  v_ativos integer;
  v_recebidas integer;
  -- Identificador fora do formato (ou só o código numérico) é ignorado: fica o anterior.
  v_interno text := case
    when btrim(p_vaga_interno) ~ '^[A-Za-z0-9_.~=-]{1,96}[|]{0,3}$' and btrim(p_vaga_interno) !~ '^[0-9]+[|]*$'
    then btrim(p_vaga_interno) end;
begin
  perform private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync);
  if p_vaga is null or p_vaga !~ '^[0-9]{1,20}$' then
    raise exception 'Código de vaga inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(p_colunas) is distinct from 'array' or jsonb_array_length(p_colunas) > 2000 then
    raise exception 'Colunas em lista de até 2000 nomes' using errcode = '22023';
  end if;

  -- Arquivo sem nenhum candidato não passou por gravar_lote: a trava vale aqui.
  v_situacao := private."FC_EMPREGARE_ABRIR_VAGA"(p_sync, p_vaga, 0);

  -- O identificador da vaga não é dado de candidato: grava mesmo se a trava recusar o arquivo.
  if v_interno is not null then
    update public."TB_EMPREGARE_VAGA" set "CO_VAGA_INTERNO" = v_interno, "DT_CAPTURA_LINK" = now()
     where "CO_VAGA" = p_vaga;
  end if;

  if v_situacao = 'RECUSADA' then
    return jsonb_build_object('situacao', 'RECUSADA',
      'mensagem', (select v."DS_MENSAGEM" from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga));
  end if;
  if v_situacao <> 'EM_CARGA' then
    raise exception 'Vaga % já fechada nesta execução', p_vaga using errcode = '22023';
  end if;

  update public."TB_EMPREGARE_CANDIDATO" c set
    "ST_REGISTRO_ATIVO" = 'N', "DT_DESATIVACAO" = now(), "DT_ATUALIZACAO" = now()
   where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S' and c."CO_SYNC" is distinct from p_sync;
  get diagnostics v_desativadas = row_count;

  select count(*) into v_ativos
    from public."TB_EMPREGARE_CANDIDATO" c
   where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S';

  update public."TB_EMPREGARE_VAGA" set
    "TP_SITUACAO" = 'GRAVADA', "DS_COLUNA" = p_colunas, "NO_ARQUIVO" = left(p_arquivo, 300),
    "QT_CANDIDATO_ATIVO" = v_ativos, "DS_MENSAGEM" = null, "DT_ULTIMA_CARGA" = now(), "DT_ATUALIZACAO" = now()
   where "CO_VAGA" = p_vaga
  returning "QT_RECEBIDA" into v_recebidas;

  update public."TL_SYNC_EMPREGARE" set "QT_DESATIVADA" = "QT_DESATIVADA" + v_desativadas where "CO_SYNC" = p_sync;
  return jsonb_build_object('situacao', 'GRAVADA', 'recebidas', v_recebidas, 'ativos', v_ativos, 'desativadas', v_desativadas,
                            'vaga_interno', v_interno is not null);
end;
$function$;
comment on function public.fechar_vaga_empregare(text, text, jsonb, text, text) is
  'Fecha a vaga na execução: desativa (ST_REGISTRO_ATIVO = N) quem não veio no arquivo e grava colunas, arquivo e ativos em TB_EMPREGARE_VAGA. Vaga recusada pela trava não muda. Arquivo sem candidatos passa pela trava aqui. p_vaga_interno (opcional): o identificador interno da vaga na Empregare, gravado em CO_VAGA_INTERNO quando válido (mesmo com a trava). Só service_role.';
revoke all on function public.fechar_vaga_empregare(text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.fechar_vaga_empregare(text, text, jsonb, text, text) to service_role;

-- 3. A ficha devolve os links -------------------------------------------------------------
create or replace function public.obter_ficha_analise(p_ficha uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_papel text;
  v_uid uuid := (select auth.uid());
  v_regra record;
  v_vigente integer;
  v_m public."TB_MONITORAMENTO_INDIGENA";
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha;
  v_papel := private."FC_EXIGIR_VER_FICHA"(v_f);
  select * into v_regra from private."FC_REGRA_VIGENTE_FICHA"(p_ficha);
  select r."NU_VERSAO_VIGENTE" into v_vigente from public."TB_REGRA_ANALISE" r where r."CO_REGRA_ANALISE" = v_f."CO_REGRA_ANALISE";
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = v_f."CO_MONITORAMENTO";
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'rotulo', private."FC_ROTULO_DO_EDITAL"(v_m.edital), 'area', v_m."CO_AREA"),
    'papel', v_papel,
    'eu', v_uid,
    'pode_editar', v_f."TP_SITUACAO" = 'EM_ANALISE' and v_f."CO_USUARIO_RESERVA" = v_uid and v_f."DT_RESERVA_EXPIRA" > now(),
    'pode_reabrir', v_f."TP_SITUACAO" = 'CONCLUIDA' and coalesce(v_papel, '') = 'COORDENADOR',
    'ficha', (private."FC_FICHA_ANALISE_JSON"(p_ficha)::jsonb || jsonb_build_object(
               'lancamento', v_f."DS_LANCAMENTO", 'resultado', v_f."DS_RESULTADO", 'parecer', v_f."DS_PARECER",
               'tp_resultado', v_f."TP_RESULTADO", 'nota_final', v_f."VL_NOTA_FINAL", 'nota_apurada', v_f."VL_NOTA_APURADA",
               'rascunho_em', v_f."DT_RASCUNHO", 'concluida_em', v_f."DT_CONCLUSAO",
               'concluida_por', (select coalesce(u.nome, u.email) from public."TB_PERFIL_USUARIO" u where u.user_id = v_f."CO_USUARIO_CONCLUSAO"))),
    'regra', json_build_object('versao', v_regra.p_versao, 'vigente', v_vigente, 'situacao', v_regra.p_situacao,
                               'configuracao', v_regra.p_configuracao),
    'documental', private."FC_DOCUMENTAL_DO_EDITAL"(v_f."CO_MONITORAMENTO"),
    'declarada_gravada', (select json_build_object('total', p."VL_NOTA_DECLARADA", 'parciais', p."DS_NOTA_DECLARADA" -> 'parciais',
                                                   'art', p."VL_ART", 'divergente', p."ST_DIVERGENTE" = 'S')
                            from public."TB_PRE_CLASSIFICACAO" p
                           where p."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO"),
    'respostas', private."FC_RESPOSTAS_DA_FICHA"(v_f."CO_EMPREGARE_CANDIDATO", v_regra.p_configuracao),
    -- Links da Empregare (dado restrito, só aqui): o do candidato e o das candidaturas da vaga.
    'empregare', (select json_build_object(
                           'link_candidato', c."DS_LINK_DETALHE",
                           'capturado_em', c."DT_CAPTURA_LINK",
                           'vaga_interno', ev."CO_VAGA_INTERNO",
                           'link_vaga', case when ev."CO_VAGA_INTERNO" is not null
                                             then 'https://corporate.empregare.com/empresa/vagas/candidaturas/' || ev."CO_VAGA_INTERNO" end)
                    from public."TB_EMPREGARE_CANDIDATO" c
                    left join public."TB_EMPREGARE_VAGA" ev on ev."CO_VAGA" = c."CO_VAGA"
                   where c."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO"),
    'historico', coalesce((
      select json_agg(json_build_object('versao', h."NU_VERSAO", 'acao', h."TP_ACAO", 'situacao', h."TP_SITUACAO",
                                        'quando', h."DT_REGISTRO", 'por', coalesce(u.nome, u.email), 'motivo', h."DS_MOTIVO",
                                        'resultado', h."TP_RESULTADO", 'nota_final', h."VL_NOTA_FINAL",
                                        'alteracao', h."DS_ALTERACAO")
                      order by h."CO_HISTORICO_FICHA" desc)
        from (select * from public."TH_FICHA_ANALISE" x where x."CO_FICHA_ANALISE" = p_ficha
               order by x."CO_HISTORICO_FICHA" desc limit 200) h
        left join public."TB_PERFIL_USUARIO" u on u.user_id = h."CO_USUARIO"), '[]'::json)
  );
end;
$function$;
comment on function public.obter_ficha_analise(uuid) is
  'A ficha para analisar (json): o cabeçalho (sem CPF nem contato), o lançamento e o resultado gravados, a regra com que é analisada (a vigente; a da conclusão, se concluída — AM-2.3), a nota mínima e os níveis da regra de classificação, a nota declarada e a ART da pré-classificação, as respostas da Empregare SÓ das perguntas que a regra liga, os links da Empregare capturados pelo robô (empregare: link_candidato da página de detalhes, vaga_interno e link_vaga das candidaturas; dado restrito, só aqui), o histórico (até 200, com as alterações) e se quem chama pode editar (reserva vigente, em análise) ou reabrir (coordenação, concluída). Vê: coordenação e revisão; o analista, só nas vagas dele; o leitor, só concluída.';
revoke all on function public.obter_ficha_analise(uuid) from public, anon;
grant execute on function public.obter_ficha_analise(uuid) to authenticated;

-- ═══ CORPO DA MIGRATION (fim) ═══

-- E1. Colunas, sem acesso direto, permissões; o link só em duas funções.
do $$
declare
  v_outras text;
begin
  if (select count(*) from information_schema.columns
       where table_schema = 'public'
         and ((table_name = 'TB_EMPREGARE_VAGA' and column_name in ('CO_VAGA_INTERNO', 'DT_CAPTURA_LINK'))
           or (table_name = 'TB_EMPREGARE_CANDIDATO' and column_name in ('DS_LINK_DETALHE', 'DT_CAPTURA_LINK')))) <> 4 then
    raise exception 'FALHOU E1: colunas novas';
  end if;
  if has_table_privilege('authenticated', 'public."TB_EMPREGARE_CANDIDATO"', 'select')
     or has_table_privilege('anon', 'public."TB_EMPREGARE_CANDIDATO"', 'select')
     or has_column_privilege('authenticated', 'public."TB_EMPREGARE_CANDIDATO"', 'DS_LINK_DETALHE', 'select')
     or has_table_privilege('authenticated', 'public."TB_EMPREGARE_VAGA"', 'select')
     or not (select c.relrowsecurity from pg_class c where c.oid = 'public."TB_EMPREGARE_CANDIDATO"'::regclass) then
    raise exception 'FALHOU E1: tabela da Empregare com acesso direto ou sem RLS';
  end if;
  if to_regprocedure('public.fechar_vaga_empregare(text, text, jsonb, text)') is not null then
    raise exception 'FALHOU E1: a assinatura antiga de fechar_vaga_empregare ficou';
  end if;
  if not has_function_privilege('service_role', 'public.fechar_vaga_empregare(text, text, jsonb, text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.fechar_vaga_empregare(text, text, jsonb, text, text)', 'execute')
     or has_function_privilege('anon', 'public.fechar_vaga_empregare(text, text, jsonb, text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.gravar_lote_empregare(text, text, integer, jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.obter_ficha_analise(uuid)', 'execute')
     or has_function_privilege('anon', 'public.obter_ficha_analise(uuid)', 'execute') then
    raise exception 'FALHOU E1: permissões das funções';
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_outras
    from pg_proc p
   where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
     and p.prosrc ~ 'DS_LINK_DETALHE'
     and p.proname not in ('gravar_lote_empregare', 'obter_ficha_analise');
  if v_outras is not null then
    raise exception 'FALHOU E1: outras funções leem o link: %', v_outras;
  end if;
  raise notice 'ok E1: colunas, RLS sem grant, fechar só service_role (assinatura nova), link só na gravação e na ficha';
end;
$$;

-- E2. A gravação como o robô (papel service_role), na vaga fictícia 99999501.
set local role service_role;
do $$
declare
  c_link1 constant text := 'https://corporate.empregare.com/empresa/curriculo/detalhes?tokenCandidato=ENSAIOtk1&id=ENSAIOid1|&candidatura=ENSAIOcd1||';
  c_link1b constant text := 'https://corporate.empregare.com/empresa/curriculo/detalhes?tokenCandidato=ENSAIOtk1b&id=ENSAIOid1|&candidatura=ENSAIOcd1||';
  v jsonb;
  v_linhas jsonb;
begin
  -- Carga 1: robô novo (link válido, link inválido, sem link) e o identificador da vaga.
  perform public.iniciar_sync_empregare('gh-ensaio-link-0001', 'GITHUB', null, '{}'::jsonb, 1, null, false);
  v_linhas := jsonb_build_array(
    jsonb_build_object('chave', 'cod:ENSAIOL1', 'tipo', 'CODIGO', 'codigo', 'ENSAIOL1', 'colunas', '{"Nome":"Ensaio 1"}'::jsonb, 'link', c_link1),
    jsonb_build_object('chave', 'cod:ENSAIOL2', 'tipo', 'CODIGO', 'codigo', 'ENSAIOL2', 'colunas', '{"Nome":"Ensaio 2"}'::jsonb,
                       'link', 'javascript:alert(1)//https://corporate.empregare.com/empresa/curriculo/detalhes?x=1'),
    jsonb_build_object('chave', 'cod:ENSAIOL3', 'tipo', 'CODIGO', 'codigo', 'ENSAIOL3', 'colunas', '{"Nome":"Ensaio 3"}'::jsonb));
  v := public.gravar_lote_empregare('gh-ensaio-link-0001', '99999501', 3, v_linhas);
  if v ->> 'situacao' <> 'EM_CARGA' or (v ->> 'gravadas')::int <> 3 or (v ->> 'com_link')::int <> 1 then
    raise exception 'FALHOU E2: lote com links (%)', v;
  end if;
  v := public.fechar_vaga_empregare('gh-ensaio-link-0001', '99999501', '["Nome"]'::jsonb, 'ensaio.xlsx', 'ENSAIOvaga01|');
  if v ->> 'situacao' <> 'GRAVADA' or not (v ->> 'vaga_interno')::boolean then
    raise exception 'FALHOU E2: fechar com o identificador (%)', v;
  end if;
  perform public.finalizar_sync_empregare('gh-ensaio-link-0001', 1, 0, null);

  -- Carga 2: robô antigo (linhas sem link, fechar com 4 argumentos): nada muda nos links.
  perform public.iniciar_sync_empregare('gh-ensaio-link-0002', 'GITHUB', null, '{}'::jsonb, 1, null, false);
  v := public.gravar_lote_empregare('gh-ensaio-link-0002', '99999501', 3,
    (select jsonb_agg(l - 'link') from jsonb_array_elements(v_linhas) l));
  if (v ->> 'gravadas')::int <> 3 or (v ->> 'com_link')::int <> 0 then
    raise exception 'FALHOU E2: lote sem links (%)', v;
  end if;
  v := public.fechar_vaga_empregare('gh-ensaio-link-0002', '99999501', '["Nome"]'::jsonb, 'ensaio.xlsx');
  if v ->> 'situacao' <> 'GRAVADA' or (v ->> 'vaga_interno')::boolean then
    raise exception 'FALHOU E2: fechar como o robô antigo (%)', v;
  end if;
  perform public.finalizar_sync_empregare('gh-ensaio-link-0002', 1, 0, null);

  -- Carga 3: link novo do candidato 1 e identificador só numérico (ignorado).
  perform public.iniciar_sync_empregare('gh-ensaio-link-0003', 'GITHUB', null, '{}'::jsonb, 1, null, false);
  v := public.gravar_lote_empregare('gh-ensaio-link-0003', '99999501', 3,
    jsonb_set(v_linhas, '{0,link}', to_jsonb(c_link1b)));
  v := public.fechar_vaga_empregare('gh-ensaio-link-0003', '99999501', '["Nome"]'::jsonb, 'ensaio.xlsx', '99999501|');
  if v ->> 'situacao' <> 'GRAVADA' or (v ->> 'vaga_interno')::boolean then
    raise exception 'FALHOU E2: identificador numérico aceito (%)', v;
  end if;
  perform public.finalizar_sync_empregare('gh-ensaio-link-0003', 1, 0, null);
  raise notice 'ok E2: lote com e sem link, robô antigo sem quebrar, link recapturado, identificador numérico ignorado';
end;
$$;
reset role;

/*
  Para a ficha: uma ficha existente e uma pessoa sintética que analisa o
  edital dela (como a "Ana" do ensaio de 20261007130000), mais uma sem acesso.
  O candidato e a vaga da ficha recebem link e identificador fictícios só
  dentro da transação.
*/
do $$
declare
  v_ficha uuid;
  v_edital uuid;
  v_area text;
  v_cand uuid;
begin
  select f."CO_FICHA_ANALISE", f."CO_MONITORAMENTO", m."CO_AREA", f."CO_EMPREGARE_CANDIDATO"
    into v_ficha, v_edital, v_area, v_cand
    from public."TB_FICHA_ANALISE" f
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id = f."CO_MONITORAMENTO"
    join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
   order by f."DT_CRIACAO"
   limit 1;
  if v_ficha is null then raise exception 'ENSAIO: nenhuma ficha da avaliação documental para conferir'; end if;
  perform set_config('ensaio.ficha', v_ficha::text, true);
  perform set_config('ensaio.edital', v_edital::text, true);

  update public."TB_EMPREGARE_CANDIDATO" set
    "DS_LINK_DETALHE" = 'https://corporate.empregare.com/empresa/curriculo/detalhes?tokenCandidato=ENSAIOtkF&id=ENSAIOidF|&candidatura=ENSAIOcdF||',
    "DT_CAPTURA_LINK" = now()
   where "CO_EMPREGARE_CANDIDATO" = v_cand;
  update public."TB_EMPREGARE_VAGA" v set "CO_VAGA_INTERNO" = 'ENSAIOvagaF|', "DT_CAPTURA_LINK" = now()
    from public."TB_EMPREGARE_CANDIDATO" c
   where c."CO_EMPREGARE_CANDIDATO" = v_cand and v."CO_VAGA" = c."CO_VAGA";

  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-0000000f7a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f7.gestor@ensaio.invalid'),
    ('00000000-0000-4000-a000-0000000f7a02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f7.ana@ensaio.invalid'),
    ('00000000-0000-4000-a000-0000000f7a03', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f7.sem@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-0000000f7a01', 'ensaio.f7.gestor@ensaio.invalid', 'Ensaio F7 Gestor', 'edital_gestor', true),
    ('00000000-0000-4000-a000-0000000f7a02', 'ensaio.f7.ana@ensaio.invalid', 'Ensaio F7 Ana', 'usuario', true),
    ('00000000-0000-4000-a000-0000000f7a03', 'ensaio.f7.sem@ensaio.invalid', 'Ensaio F7 Sem Acesso', 'usuario', true);
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select u.id, v_area from public."TB_PERFIL_USUARIO" u where u.email like 'ensaio.f7.%@ensaio.invalid';
  insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by)
  select u.id, 'avaliacao_documental', 'editor', '00000000-0000-4000-a000-0000000f7a01'
    from public."TB_PERFIL_USUARIO" u where u.email = 'ensaio.f7.ana@ensaio.invalid';
  insert into public."RL_ANALISTA_EDITAL" ("CO_MONITORAMENTO", "CO_USUARIO", "TP_PAPEL", "CO_VAGA", "CO_USUARIO_ATUALIZACAO") values
    (v_edital, '00000000-0000-4000-a000-0000000f7a02', 'ANALISTA', null, '00000000-0000-4000-a000-0000000f7a01');
end;
$$;

-- E3. A ficha, como cada pessoa (papel authenticated).
set local role authenticated;
do $$
declare
  c_ana constant text := '{"sub":"00000000-0000-4000-a000-0000000f7a02","role":"authenticated","email":"ensaio.f7.ana@ensaio.invalid"}';
  c_sem constant text := '{"sub":"00000000-0000-4000-a000-0000000f7a03","role":"authenticated","email":"ensaio.f7.sem@ensaio.invalid"}';
  v_ficha uuid := current_setting('ensaio.ficha')::uuid;
  v json;
begin
  perform set_config('request.jwt.claims', c_sem, true);
  begin
    perform public.obter_ficha_analise(v_ficha);
    raise exception 'FALHOU E3: quem não vê a ficha recebeu o link';
  exception when sqlstate '42501' then null;
  end;

  perform set_config('request.jwt.claims', c_ana, true);
  v := public.obter_ficha_analise(v_ficha);
  if v -> 'empregare' ->> 'link_candidato' is distinct from
       'https://corporate.empregare.com/empresa/curriculo/detalhes?tokenCandidato=ENSAIOtkF&id=ENSAIOidF|&candidatura=ENSAIOcdF||'
     or v -> 'empregare' ->> 'vaga_interno' is distinct from 'ENSAIOvagaF|'
     or v -> 'empregare' ->> 'link_vaga' is distinct from 'https://corporate.empregare.com/empresa/vagas/candidaturas/ENSAIOvagaF|'
     or v -> 'empregare' ->> 'capturado_em' is null then
    raise exception 'FALHOU E3: links da Empregare na ficha';
  end if;
  if v -> 'ficha' is null or v -> 'regra' is null or v -> 'historico' is null then
    raise exception 'FALHOU E3: a ficha perdeu chaves de antes';
  end if;
  v := public.obter_fila_avaliacao(current_setting('ensaio.edital')::uuid);
  if v::text ~ 'ENSAIOtk' or v::text ~ 'curriculo/detalhes' then
    raise exception 'FALHOU E3: a fila traz o link do candidato';
  end if;
  raise notice 'ok E3: analista da vaga recebe os links na ficha; sem acesso, 42501; a fila não traz o link';
end;
$$;
reset role;

-- E4. O que ficou nas tabelas e as CKs.
do $$
declare
  v_l1 text;
  v_l2 text;
  v_l3 text;
  v_cap timestamptz;
  v_interno text;
begin
  select max(c."DS_LINK_DETALHE") filter (where c."CO_CANDIDATO_EMPREGARE" = 'ENSAIOL1'),
         max(c."DS_LINK_DETALHE") filter (where c."CO_CANDIDATO_EMPREGARE" = 'ENSAIOL2'),
         max(c."DS_LINK_DETALHE") filter (where c."CO_CANDIDATO_EMPREGARE" = 'ENSAIOL3'),
         max(c."DT_CAPTURA_LINK") filter (where c."CO_CANDIDATO_EMPREGARE" = 'ENSAIOL1')
    into v_l1, v_l2, v_l3, v_cap
    from public."TB_EMPREGARE_CANDIDATO" c where c."CO_VAGA" = '99999501';
  select v."CO_VAGA_INTERNO" into v_interno from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = '99999501';
  if v_l1 is distinct from 'https://corporate.empregare.com/empresa/curriculo/detalhes?tokenCandidato=ENSAIOtk1b&id=ENSAIOid1|&candidatura=ENSAIOcd1||'
     or v_cap is null or v_l2 is not null or v_l3 is not null then
    raise exception 'FALHOU E4: links gravados (o 1 recapturado, o inválido e o ausente nulos)';
  end if;
  if v_interno is distinct from 'ENSAIOvaga01|' then
    raise exception 'FALHOU E4: identificador da vaga (o numérico não pode trocar o válido)';
  end if;
  begin
    update public."TB_EMPREGARE_CANDIDATO" set "DS_LINK_DETALHE" = 'https://exemplo.invalid/empresa/curriculo/detalhes?x=1'
     where "CO_VAGA" = '99999501' and "CO_CANDIDATO_EMPREGARE" = 'ENSAIOL3';
    raise exception 'FALHOU E4: a CK aceitou link de outro site';
  exception when check_violation then null;
  end;
  begin
    update public."TB_EMPREGARE_VAGA" set "CO_VAGA_INTERNO" = '99999501' where "CO_VAGA" = '99999501';
    raise exception 'FALHOU E4: a CK aceitou o código numérico como identificador';
  exception when check_violation then null;
  end;
  raise notice 'ok E4: links e identificador como esperado; CKs barram link de outro site e identificador numérico';
end;
$$;

select
  'ENSAIO OK' as resultado,
  (select count(*) from public."TB_EMPREGARE_CANDIDATO" c where c."CO_VAGA" = '99999501' and c."DS_LINK_DETALHE" is not null) as candidatos_com_link,
  (select v."CO_VAGA_INTERNO" is not null from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = '99999501') as vaga_com_identificador;

rollback;
