/*
  ENSAIO de 20261008160000_anexos_da_empregare.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e confere:
    E1  tabela com RLS e sem acesso direto; RPCs do robô só para o service_role;
        só a gravação, a consulta do robô e a ficha leem TB_EMPREGARE_ANEXO;
    E2  como o robô (service_role), na vaga fictícia 99999502: anexos válidos
        gravados por pergunta, link fora do formato e candidato de fora
        recusados, a consulta dos já capturados e a releitura que tira a
        pergunta que sumiu;
    E3  como pessoas (authenticated): o analista da vaga recebe os anexos na
        ficha; quem não vê a ficha é barrado (42501); a fila não traz o link;
    E4  depois de "reset role": o enunciado guardado e as CKs da tabela.
  Termina em ROLLBACK: nada fica gravado. Links são fictícios (ENSAIO…); a
  ficha usada é uma existente, com o candidato dela recebendo um anexo
  fictício só dentro da transação; nada pessoal é mostrado.

  Precisa de: 20261007160000 aplicada, ao menos uma ficha da avaliação
  documental e nenhuma execução do robô em andamento.

  Resultado esperado: as mensagens "ok E1" … "ok E4" e a linha "ENSAIO OK" do
  SELECT final. Qualquer "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/anexos-da-empregare-migration.test.js confere
  que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

-- 0. Pré-requisito ----------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.fechar_vaga_empregare(text, text, jsonb, text, text)') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'TB_EMPREGARE_CANDIDATO'
                       and column_name = 'DS_LINK_DETALHE') then
    raise exception 'Aplique antes 20261007160000_link_do_candidato_na_empregare.sql.';
  end if;
end;
$$;

-- 1. Tabela -----------------------------------------------------------------------------
create table public."TB_EMPREGARE_ANEXO" (
  "CO_EMPREGARE_ANEXO" uuid not null default gen_random_uuid(),
  "CO_EMPREGARE_CANDIDATO" uuid not null,
  "NU_PERGUNTA" smallint not null,
  "DS_ENUNCIADO" varchar(2000),
  "TP_LINK" varchar(12) not null,
  "DS_LINK" varchar(1000) not null,
  "CO_SYNC" text,
  "DT_CAPTURA" timestamptz not null default now(),
  constraint "PK_TB_EMPREGARE_ANEXO" primary key ("CO_EMPREGARE_ANEXO"),
  constraint "UK_EMPREGANEXO_CANDPERGUNTA" unique ("CO_EMPREGARE_CANDIDATO", "NU_PERGUNTA"),
  constraint "FK_EMPREGCAND_EMPREGANEXO" foreign key ("CO_EMPREGARE_CANDIDATO")
    references public."TB_EMPREGARE_CANDIDATO" ("CO_EMPREGARE_CANDIDATO") on delete cascade,
  constraint "FK_SYNCEMPREG_EMPREGANEXO" foreign key ("CO_SYNC") references public."TL_SYNC_EMPREGARE" ("CO_SYNC"),
  constraint "CK_EMPREGANEXO_NUPERGUNTA" check ("NU_PERGUNTA" between 1 and 999),
  constraint "CK_EMPREGANEXO_TPLINK" check ("TP_LINK" in ('ARQUIVO', 'QUESTIONARIO')),
  constraint "CK_EMPREGANEXO_DSLINK" check (
    length("DS_LINK") <= 1000
    and case "TP_LINK"
          when 'ARQUIVO' then "DS_LINK" ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/[^[:space:]"''<>`\\]*$'
          else "DS_LINK" ~ '^https://corporate\.empregare\.com/[A-Za-z0-9_.~=&%|+/:?#-]*$'
        end)
);
comment on table public."TB_EMPREGARE_ANEXO" is 'Link de cada anexo do questionário de um candidato da Empregare, capturado pelo robô na aba Questionários da página de detalhes (uma linha por pergunta de anexo). DADO RESTRITO: os links levam tokens; só a RPC da ficha devolve, a quem pode ver a ficha. Nunca em lista, CSV ou log.';
comment on column public."TB_EMPREGARE_ANEXO"."CO_EMPREGARE_ANEXO" is 'Identificador da linha.';
comment on column public."TB_EMPREGARE_ANEXO"."CO_EMPREGARE_CANDIDATO" is 'Candidato da vaga (TB_EMPREGARE_CANDIDATO).';
comment on column public."TB_EMPREGARE_ANEXO"."NU_PERGUNTA" is 'Número da pergunta no questionário da vaga (o "Pergunta N" da exportação ou a ordem do bloco na aba).';
comment on column public."TB_EMPREGARE_ANEXO"."DS_ENUNCIADO" is 'Enunciado da pergunta como a aba mostra (texto do edital), sem nome de arquivo.';
comment on column public."TB_EMPREGARE_ANEXO"."TP_LINK" is 'ARQUIVO: o link do próprio arquivo (público e sem validade). QUESTIONARIO: o link da página do questionário com âncora (o arquivo exige sessão ou o link expira).';
comment on column public."TB_EMPREGARE_ANEXO"."DS_LINK" is 'O link (https). DADO RESTRITO: leva tokens; só a ficha devolve.';
comment on column public."TB_EMPREGARE_ANEXO"."CO_SYNC" is 'Execução do robô que capturou (TL_SYNC_EMPREGARE).';
comment on column public."TB_EMPREGARE_ANEXO"."DT_CAPTURA" is 'Quando o robô capturou o link pela última vez.';
comment on constraint "CK_EMPREGANEXO_DSLINK" on public."TB_EMPREGARE_ANEXO" is 'Link https sem espaço, aspas nem sinais de HTML; o da página do questionário, só da Empregare.';

create index "IN_FKEMPREGANEXO_COSYNC" on public."TB_EMPREGARE_ANEXO" ("CO_SYNC");

alter table public."TB_EMPREGARE_ANEXO" enable row level security;
revoke all on public."TB_EMPREGARE_ANEXO" from public, anon, authenticated;

-- 2. Gravação pelo robô -----------------------------------------------------------------
create function public.gravar_anexos_empregare(p_sync text, p_vaga text, p_anexos jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_gravados integer;
  v_removidos integer;
  v_sem_candidato integer;
begin
  perform private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync);
  if p_vaga is null or p_vaga !~ '^[0-9]{1,20}$' then
    raise exception 'Código de vaga inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(p_anexos) is distinct from 'array' or jsonb_array_length(p_anexos) not between 1 and 2000 then
    raise exception 'Envie de 1 a 2000 anexos por lote' using errcode = '22023';
  end if;

  create temporary table if not exists pg_temp.tmp_empregare_anexo (
    candidato uuid, pergunta smallint, enunciado text, tipo text, link text
  ) on commit drop;
  truncate pg_temp.tmp_empregare_anexo;

  -- Só candidatos desta vaga; link ou pergunta fora do formato ficam de fora.
  insert into pg_temp.tmp_empregare_anexo
  select distinct on (c."CO_EMPREGARE_CANDIDATO", a.pergunta)
         c."CO_EMPREGARE_CANDIDATO", a.pergunta::smallint,
         nullif(left(btrim(regexp_replace(a.enunciado, '\s+', ' ', 'g')), 2000), ''),
         a.tipo, btrim(a.link)
    from jsonb_to_recordset(p_anexos) as a(codigo text, pergunta integer, enunciado text, tipo text, link text)
    join public."TB_EMPREGARE_CANDIDATO" c
      on c."CO_VAGA" = p_vaga and c."CO_CANDIDATO_EMPREGARE" = btrim(a.codigo)
   where a.pergunta between 1 and 999
     and a.tipo in ('ARQUIVO', 'QUESTIONARIO')
     and length(btrim(a.link)) <= 1000
     and case a.tipo
           when 'ARQUIVO' then btrim(a.link) ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/[^[:space:]"''<>`\\]*$'
           else btrim(a.link) ~ '^https://corporate\.empregare\.com/[A-Za-z0-9_.~=&%|+/:?#-]*$'
         end
   order by c."CO_EMPREGARE_CANDIDATO", a.pergunta;

  select count(*) into v_sem_candidato
    from jsonb_to_recordset(p_anexos) as a(codigo text)
   where not exists (select 1 from public."TB_EMPREGARE_CANDIDATO" c
                      where c."CO_VAGA" = p_vaga and c."CO_CANDIDATO_EMPREGARE" = btrim(a.codigo));

  insert into public."TB_EMPREGARE_ANEXO" as x (
    "CO_EMPREGARE_CANDIDATO", "NU_PERGUNTA", "DS_ENUNCIADO", "TP_LINK", "DS_LINK", "CO_SYNC", "DT_CAPTURA")
  select t.candidato, t.pergunta, t.enunciado, t.tipo, t.link, p_sync, now()
    from pg_temp.tmp_empregare_anexo t
  on conflict ("CO_EMPREGARE_CANDIDATO", "NU_PERGUNTA") do update set
    "DS_ENUNCIADO" = coalesce(excluded."DS_ENUNCIADO", x."DS_ENUNCIADO"),
    "TP_LINK" = excluded."TP_LINK",
    "DS_LINK" = excluded."DS_LINK",
    "CO_SYNC" = excluded."CO_SYNC",
    "DT_CAPTURA" = excluded."DT_CAPTURA";
  get diagnostics v_gravados = row_count;

  -- O candidato relido nesta execução fica só com as perguntas lidas agora (o anexo que sumiu sai).
  delete from public."TB_EMPREGARE_ANEXO" x
   where x."CO_EMPREGARE_CANDIDATO" in (select distinct t.candidato from pg_temp.tmp_empregare_anexo t)
     and x."CO_SYNC" is distinct from p_sync;
  get diagnostics v_removidos = row_count;

  return jsonb_build_object('recebidos', jsonb_array_length(p_anexos), 'gravados', v_gravados,
                            'removidos', v_removidos, 'sem_candidato', v_sem_candidato);
end;
$function$;
comment on function public.gravar_anexos_empregare(text, text, jsonb) is
  'Recebe (até 2000 por lote) os anexos do questionário dos candidatos de uma vaga, capturados pelo robô da Empregare: [{codigo, pergunta, enunciado, tipo ARQUIVO|QUESTIONARIO, link}], e faz upsert em TB_EMPREGARE_ANEXO por candidato e pergunta. Só candidatos da vaga; link fora do formato fica de fora; o candidato relido fica só com as perguntas desta execução. Só service_role, com a execução em andamento.';

create function public.anexos_capturados_empregare(p_vaga text, p_dias integer default 7)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object('candidatos', coalesce(jsonb_agg(distinct c."CO_CANDIDATO_EMPREGARE"), '[]'::jsonb))
    from public."TB_EMPREGARE_ANEXO" a
    join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
   where c."CO_VAGA" = p_vaga
     and c."CO_CANDIDATO_EMPREGARE" is not null
     and a."DT_CAPTURA" > now() - make_interval(days => least(greatest(coalesce(p_dias, 7), 0), 365));
$function$;
comment on function public.anexos_capturados_empregare(text, integer) is
  'Códigos (CO_CANDIDATO_EMPREGARE) dos candidatos da vaga com anexo capturado nos últimos p_dias dias (padrão 7): o robô lê esses por último, para a fila andar entre execuções. Sem links. Só service_role.';

revoke all on function public.gravar_anexos_empregare(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.anexos_capturados_empregare(text, integer) from public, anon, authenticated;
grant execute on function public.gravar_anexos_empregare(text, text, jsonb) to service_role;
grant execute on function public.anexos_capturados_empregare(text, integer) to service_role;

-- 3. A ficha devolve os anexos ------------------------------------------------------------
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
    -- Links da Empregare (dado restrito, só aqui): o do candidato, o das candidaturas da vaga e os dos anexos.
    'empregare', (select json_build_object(
                           'link_candidato', c."DS_LINK_DETALHE",
                           'capturado_em', c."DT_CAPTURA_LINK",
                           'vaga_interno', ev."CO_VAGA_INTERNO",
                           'link_vaga', case when ev."CO_VAGA_INTERNO" is not null
                                             then 'https://corporate.empregare.com/empresa/vagas/candidaturas/' || ev."CO_VAGA_INTERNO" end,
                           'anexos', coalesce((
                             select json_agg(json_build_object('pergunta', a."NU_PERGUNTA", 'enunciado', a."DS_ENUNCIADO",
                                                               'tipo', a."TP_LINK", 'link', a."DS_LINK",
                                                               'capturado_em', a."DT_CAPTURA")
                                             order by a."NU_PERGUNTA")
                               from public."TB_EMPREGARE_ANEXO" a
                              where a."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO"), '[]'::json))
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
  'A ficha para analisar (json): o cabeçalho (sem CPF nem contato), o lançamento e o resultado gravados, a regra com que é analisada (a vigente; a da conclusão, se concluída — AM-2.3), a nota mínima e os níveis da regra de classificação, a nota declarada e a ART da pré-classificação, as respostas da Empregare SÓ das perguntas que a regra liga, os links da Empregare capturados pelo robô (empregare: link_candidato da página de detalhes, vaga_interno e link_vaga das candidaturas, e anexos: [{pergunta, enunciado, tipo ARQUIVO|QUESTIONARIO, link, capturado_em}]; dado restrito, só aqui), o histórico (até 200, com as alterações) e se quem chama pode editar (reserva vigente, em análise) ou reabrir (coordenação, concluída). Vê: coordenação e revisão; o analista, só nas vagas dele; o leitor, só concluída.';
revoke all on function public.obter_ficha_analise(uuid) from public, anon;
grant execute on function public.obter_ficha_analise(uuid) to authenticated;

-- ═══ CORPO DA MIGRATION (fim) ═══

-- E1. Sem acesso direto, permissões; só três funções leem a tabela.
do $$
declare
  v_outras text;
begin
  if has_table_privilege('authenticated', 'public."TB_EMPREGARE_ANEXO"', 'select')
     or has_table_privilege('anon', 'public."TB_EMPREGARE_ANEXO"', 'select')
     or not (select c.relrowsecurity from pg_class c where c.oid = 'public."TB_EMPREGARE_ANEXO"'::regclass) then
    raise exception 'FALHOU E1: TB_EMPREGARE_ANEXO com acesso direto ou sem RLS';
  end if;
  if not has_function_privilege('service_role', 'public.gravar_anexos_empregare(text, text, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.gravar_anexos_empregare(text, text, jsonb)', 'execute')
     or has_function_privilege('anon', 'public.gravar_anexos_empregare(text, text, jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.anexos_capturados_empregare(text, integer)', 'execute')
     or has_function_privilege('authenticated', 'public.anexos_capturados_empregare(text, integer)', 'execute')
     or has_function_privilege('anon', 'public.anexos_capturados_empregare(text, integer)', 'execute')
     or not has_function_privilege('authenticated', 'public.obter_ficha_analise(uuid)', 'execute')
     or has_function_privilege('anon', 'public.obter_ficha_analise(uuid)', 'execute') then
    raise exception 'FALHOU E1: permissões das funções';
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_outras
    from pg_proc p
   where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
     and p.prosrc ~ 'TB_EMPREGARE_ANEXO'
     and p.proname not in ('gravar_anexos_empregare', 'anexos_capturados_empregare', 'obter_ficha_analise');
  if v_outras is not null then
    raise exception 'FALHOU E1: outras funções leem os anexos: %', v_outras;
  end if;
  raise notice 'ok E1: RLS sem grant, RPCs do robô só service_role, anexos só na gravação, na consulta do robô e na ficha';
end;
$$;

-- E2. A gravação como o robô (papel service_role), na vaga fictícia 99999502.
set local role service_role;
do $$
declare
  c_arq constant text := 'https://arquivos.ensaio.invalid/anexos/ENSAIOarq1.pdf';
  c_arq2 constant text := 'https://arquivos.ensaio.invalid/anexos/ENSAIOarq2.pdf';
  c_pag constant text := 'https://corporate.empregare.com/empresa/questionarios/imprimir/ENSAIOq1|#pergunta-5';
  v jsonb;
begin
  perform public.iniciar_sync_empregare('gh-ensaio-anexo-0001', 'GITHUB', null, '{}'::jsonb, 1, null, false);
  v := public.gravar_lote_empregare('gh-ensaio-anexo-0001', '99999502', 2, jsonb_build_array(
    jsonb_build_object('chave', 'cod:ENSAIOA1', 'tipo', 'CODIGO', 'codigo', 'ENSAIOA1', 'colunas', '{"Nome":"Ensaio A1"}'::jsonb),
    jsonb_build_object('chave', 'cod:ENSAIOA2', 'tipo', 'CODIGO', 'codigo', 'ENSAIOA2', 'colunas', '{"Nome":"Ensaio A2"}'::jsonb)));
  perform public.fechar_vaga_empregare('gh-ensaio-anexo-0001', '99999502', '["Nome"]'::jsonb, 'ensaio.xlsx');

  v := public.gravar_anexos_empregare('gh-ensaio-anexo-0001', '99999502', jsonb_build_array(
    jsonb_build_object('codigo', 'ENSAIOA1', 'pergunta', 4, 'enunciado', '  Anexe   o documento ', 'tipo', 'ARQUIVO', 'link', c_arq),
    jsonb_build_object('codigo', 'ENSAIOA1', 'pergunta', 5, 'enunciado', 'Anexe o diploma', 'tipo', 'QUESTIONARIO', 'link', c_pag),
    jsonb_build_object('codigo', 'ENSAIOA2', 'pergunta', 4, 'tipo', 'ARQUIVO', 'link', 'javascript:alert(1)//https://x.invalid/a'),
    jsonb_build_object('codigo', 'ENSAIOA2', 'pergunta', 6, 'tipo', 'QUESTIONARIO', 'link', 'https://outro.invalid/empresa/x'),
    jsonb_build_object('codigo', 'ENSAIOA2', 'pergunta', 0, 'tipo', 'ARQUIVO', 'link', c_arq),
    jsonb_build_object('codigo', 'ENSAIOZZ', 'pergunta', 4, 'tipo', 'ARQUIVO', 'link', c_arq)));
  if (v ->> 'gravados')::int <> 2 or (v ->> 'sem_candidato')::int <> 1 or (v ->> 'removidos')::int <> 0 then
    raise exception 'FALHOU E2: primeira gravação (%)', v;
  end if;
  v := public.anexos_capturados_empregare('99999502');
  if v -> 'candidatos' is distinct from '["ENSAIOA1"]'::jsonb then
    raise exception 'FALHOU E2: já capturados (%)', v;
  end if;
  perform public.finalizar_sync_empregare('gh-ensaio-anexo-0001', 1, 0, null);

  -- Releitura: A1 só com a pergunta 4 (link novo); a 5 sumiu e sai.
  perform public.iniciar_sync_empregare('gh-ensaio-anexo-0002', 'GITHUB', null, '{}'::jsonb, 1, null, false);
  v := public.gravar_anexos_empregare('gh-ensaio-anexo-0002', '99999502', jsonb_build_array(
    jsonb_build_object('codigo', 'ENSAIOA1', 'pergunta', 4, 'tipo', 'ARQUIVO', 'link', c_arq2)));
  if (v ->> 'gravados')::int <> 1 or (v ->> 'removidos')::int <> 1 then
    raise exception 'FALHOU E2: releitura (%)', v;
  end if;
  perform public.finalizar_sync_empregare('gh-ensaio-anexo-0002', 1, 0, null);
  begin
    perform public.gravar_anexos_empregare('gh-ensaio-anexo-0002', '99999502',
      '[{"codigo":"ENSAIOA1","pergunta":4,"tipo":"ARQUIVO","link":"https://a.invalid/x"}]'::jsonb);
    raise exception 'FALHOU E2: gravou com a execução fechada';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok E2: anexos por pergunta, links fora do formato e candidato de fora recusados, releitura tira a pergunta que sumiu, execução fechada recusa';
end;
$$;
reset role;

/* Para a ficha: uma ficha existente, um anexo fictício no candidato dela e pessoas sintéticas. */
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

  delete from public."TB_EMPREGARE_ANEXO" where "CO_EMPREGARE_CANDIDATO" = v_cand;
  insert into public."TB_EMPREGARE_ANEXO" ("CO_EMPREGARE_CANDIDATO", "NU_PERGUNTA", "DS_ENUNCIADO", "TP_LINK", "DS_LINK")
  values (v_cand, 7, 'Anexe o comprovante (ENSAIO)', 'ARQUIVO', 'https://arquivos.ensaio.invalid/anexos/ENSAIOarqF.pdf');

  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-0000000f8a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f8.gestor@ensaio.invalid'),
    ('00000000-0000-4000-a000-0000000f8a02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f8.ana@ensaio.invalid'),
    ('00000000-0000-4000-a000-0000000f8a03', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f8.sem@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-0000000f8a01', 'ensaio.f8.gestor@ensaio.invalid', 'Ensaio F8 Gestor', 'edital_gestor', true),
    ('00000000-0000-4000-a000-0000000f8a02', 'ensaio.f8.ana@ensaio.invalid', 'Ensaio F8 Ana', 'usuario', true),
    ('00000000-0000-4000-a000-0000000f8a03', 'ensaio.f8.sem@ensaio.invalid', 'Ensaio F8 Sem Acesso', 'usuario', true);
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select u.id, v_area from public."TB_PERFIL_USUARIO" u where u.email like 'ensaio.f8.%@ensaio.invalid';
  insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by)
  select u.id, 'avaliacao_documental', 'editor', '00000000-0000-4000-a000-0000000f8a01'
    from public."TB_PERFIL_USUARIO" u where u.email = 'ensaio.f8.ana@ensaio.invalid';
  insert into public."RL_ANALISTA_EDITAL" ("CO_MONITORAMENTO", "CO_USUARIO", "TP_PAPEL", "CO_VAGA", "CO_USUARIO_ATUALIZACAO") values
    (v_edital, '00000000-0000-4000-a000-0000000f8a02', 'ANALISTA', null, '00000000-0000-4000-a000-0000000f8a01');
end;
$$;

-- E3. A ficha, como cada pessoa (papel authenticated).
set local role authenticated;
do $$
declare
  c_ana constant text := '{"sub":"00000000-0000-4000-a000-0000000f8a02","role":"authenticated","email":"ensaio.f8.ana@ensaio.invalid"}';
  c_sem constant text := '{"sub":"00000000-0000-4000-a000-0000000f8a03","role":"authenticated","email":"ensaio.f8.sem@ensaio.invalid"}';
  v_ficha uuid := current_setting('ensaio.ficha')::uuid;
  v json;
begin
  perform set_config('request.jwt.claims', c_sem, true);
  begin
    perform public.obter_ficha_analise(v_ficha);
    raise exception 'FALHOU E3: quem não vê a ficha recebeu os anexos';
  exception when sqlstate '42501' then null;
  end;

  perform set_config('request.jwt.claims', c_ana, true);
  v := public.obter_ficha_analise(v_ficha);
  if json_array_length(v -> 'empregare' -> 'anexos') <> 1
     or (v -> 'empregare' -> 'anexos' -> 0 ->> 'pergunta')::int <> 7
     or v -> 'empregare' -> 'anexos' -> 0 ->> 'tipo' is distinct from 'ARQUIVO'
     or v -> 'empregare' -> 'anexos' -> 0 ->> 'link' is distinct from 'https://arquivos.ensaio.invalid/anexos/ENSAIOarqF.pdf'
     or v -> 'empregare' -> 'anexos' -> 0 ->> 'capturado_em' is null then
    raise exception 'FALHOU E3: anexos na ficha';
  end if;
  if v -> 'ficha' is null or v -> 'regra' is null or v -> 'historico' is null
     or not ((v -> 'empregare')::jsonb ? 'link_candidato') then
    raise exception 'FALHOU E3: a ficha perdeu chaves de antes';
  end if;
  v := public.obter_fila_avaliacao(current_setting('ensaio.edital')::uuid);
  if v::text ~ 'ENSAIOarq' then
    raise exception 'FALHOU E3: a fila traz o link do anexo';
  end if;
  raise notice 'ok E3: analista da vaga recebe os anexos na ficha; sem acesso, 42501; a fila não traz o link';
end;
$$;
reset role;

-- E4. As CKs da tabela.
do $$
declare
  v_cand uuid := (select c."CO_EMPREGARE_CANDIDATO" from public."TB_EMPREGARE_CANDIDATO" c
                   where c."CO_VAGA" = '99999502' and c."CO_CANDIDATO_EMPREGARE" = 'ENSAIOA2');
begin
  if (select "DS_ENUNCIADO" from public."TB_EMPREGARE_ANEXO" a
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
       where c."CO_VAGA" = '99999502' and c."CO_CANDIDATO_EMPREGARE" = 'ENSAIOA1' and a."NU_PERGUNTA" = 4)
     is distinct from 'Anexe o documento' then
    raise exception 'FALHOU E4: enunciado guardado sem espaços repetidos';
  end if;
  begin
    insert into public."TB_EMPREGARE_ANEXO" ("CO_EMPREGARE_CANDIDATO", "NU_PERGUNTA", "TP_LINK", "DS_LINK")
    values (v_cand, 1, 'ARQUIVO', 'http://arquivos.ensaio.invalid/a.pdf');
    raise exception 'FALHOU E4: a CK aceitou link sem https';
  exception when check_violation then null;
  end;
  begin
    insert into public."TB_EMPREGARE_ANEXO" ("CO_EMPREGARE_CANDIDATO", "NU_PERGUNTA", "TP_LINK", "DS_LINK")
    values (v_cand, 1, 'QUESTIONARIO', 'https://outro.invalid/empresa/questionarios/imprimir/x');
    raise exception 'FALHOU E4: a CK aceitou página do questionário fora da Empregare';
  exception when check_violation then null;
  end;
  begin
    insert into public."TB_EMPREGARE_ANEXO" ("CO_EMPREGARE_CANDIDATO", "NU_PERGUNTA", "TP_LINK", "DS_LINK")
    values (v_cand, 1, 'ARQUIVO', 'https://arquivos.ensaio.invalid/a b".pdf');
    raise exception 'FALHOU E4: a CK aceitou link com espaço e aspas';
  exception when check_violation then null;
  end;
  begin
    insert into public."TB_EMPREGARE_ANEXO" ("CO_EMPREGARE_CANDIDATO", "NU_PERGUNTA", "TP_LINK", "DS_LINK")
    values (v_cand, 1000, 'ARQUIVO', 'https://arquivos.ensaio.invalid/a.pdf');
    raise exception 'FALHOU E4: a CK aceitou pergunta 1000';
  exception when check_violation then null;
  end;
  raise notice 'ok E4: CKs barram link sem https, página fora da Empregare, espaço/aspas e pergunta fora de 1 a 999';
end;
$$;

select
  'ENSAIO OK' as resultado,
  (select count(*) from public."TB_EMPREGARE_ANEXO" a
     join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
    where c."CO_VAGA" = '99999502') as anexos_da_vaga_ficticia;

rollback;
