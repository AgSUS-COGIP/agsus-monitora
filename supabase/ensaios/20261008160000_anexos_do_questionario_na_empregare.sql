/*
  ENSAIO de 20261008160000_anexos_do_questionario_na_empregare.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e confere:
    E1  tabelas com RLS e sem acesso direto, RPC do robô só para o
        service_role; só a gravação e a ficha leem as tabelas;
    E2  como o robô (service_role), na vaga fictícia 99999502: resposta com
        impressão e anexos gravada, link fora do formato e candidato de fora
        recusados, a releitura troca os anexos, execução fechada recusa;
    E3  como pessoas (authenticated): o analista da vaga recebe respostas e
        anexos na ficha; quem não vê a ficha é barrado (42501); a fila não
        traz os links;
    E4  depois de "reset role": o que ficou gravado e as CKs.
  Termina em ROLLBACK: nada fica gravado. Links e identificadores são
  fictícios (ENSAIO…); a ficha usada é uma existente, com o candidato dela
  recebendo uma resposta fictícia só dentro da transação; nada pessoal é mostrado.

  Precisa de: 20261007160000 aplicada, ao menos uma ficha da avaliação
  documental e nenhuma execução do robô em andamento.

  Resultado esperado: as mensagens "ok E1" … "ok E4" e a linha "ENSAIO OK" do
  SELECT final. Qualquer "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/anexos-do-questionario-migration.test.js confere
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

-- 1. Tabelas ----------------------------------------------------------------------------
create table public."TB_EMPREGARE_RESPOSTA" (
  "CO_EMPREGARE_RESPOSTA" uuid not null default gen_random_uuid(),
  "CO_EMPREGARE_CANDIDATO" uuid not null,
  "CO_RESPOSTA_QUESTIONARIO" varchar(20) not null,
  "DS_LINK_IMPRESSAO" varchar(1500),
  "QT_PERGUNTA" integer not null default 0,
  "QT_ANEXO" integer not null default 0,
  "CO_SYNC" text,
  "DT_CAPTURA" timestamptz not null default now(),
  constraint "PK_TB_EMPREGARE_RESPOSTA" primary key ("CO_EMPREGARE_RESPOSTA"),
  constraint "UK_EMPREGRESP_CANDRESPOSTA" unique ("CO_EMPREGARE_CANDIDATO", "CO_RESPOSTA_QUESTIONARIO"),
  constraint "FK_EMPREGCAND_EMPREGRESP" foreign key ("CO_EMPREGARE_CANDIDATO")
    references public."TB_EMPREGARE_CANDIDATO" ("CO_EMPREGARE_CANDIDATO") on delete cascade,
  constraint "FK_SYNCEMPREG_EMPREGRESP" foreign key ("CO_SYNC") references public."TL_SYNC_EMPREGARE" ("CO_SYNC"),
  constraint "CK_EMPREGRESP_CORESPOSTA" check ("CO_RESPOSTA_QUESTIONARIO" ~ '^[0-9]{1,20}$'),
  constraint "CK_EMPREGRESP_DSLINKIMPRESSAO" check ("DS_LINK_IMPRESSAO" is null or "DS_LINK_IMPRESSAO" ~ '^https://corporate\.empregare\.com/Company/VacancyTests/PrintResult\?[A-Za-z0-9_.~=&%|+/:-]+$'),
  constraint "CK_EMPREGRESP_QUANTIDADES" check ("QT_PERGUNTA" between 0 and 10000 and "QT_ANEXO" between 0 and 10000)
);
comment on table public."TB_EMPREGARE_RESPOSTA" is 'Resposta de um candidato a um questionário da vaga na Empregare (data-resposta da lista de candidaturas), lida pelo robô em GetRespostaDetails. DADO RESTRITO: o link de impressão leva o token da pessoa; só a RPC da ficha devolve.';
comment on column public."TB_EMPREGARE_RESPOSTA"."CO_EMPREGARE_RESPOSTA" is 'Identificador da linha.';
comment on column public."TB_EMPREGARE_RESPOSTA"."CO_EMPREGARE_CANDIDATO" is 'Candidato da vaga (TB_EMPREGARE_CANDIDATO).';
comment on column public."TB_EMPREGARE_RESPOSTA"."CO_RESPOSTA_QUESTIONARIO" is 'Identificador da resposta na Empregare (data-resposta).';
comment on column public."TB_EMPREGARE_RESPOSTA"."DS_LINK_IMPRESSAO" is 'Link da impressão das respostas (/Company/VacancyTests/PrintResult?…; abre com o login da Empregare). DADO RESTRITO.';
comment on column public."TB_EMPREGARE_RESPOSTA"."QT_PERGUNTA" is 'Perguntas lidas na resposta.';
comment on column public."TB_EMPREGARE_RESPOSTA"."QT_ANEXO" is 'Anexos (links Visualizar Arquivo) lidos na resposta.';
comment on column public."TB_EMPREGARE_RESPOSTA"."CO_SYNC" is 'Execução do robô que leu (TL_SYNC_EMPREGARE).';
comment on column public."TB_EMPREGARE_RESPOSTA"."DT_CAPTURA" is 'Quando o robô leu pela última vez.';
create index "IN_FKEMPREGRESP_COSYNC" on public."TB_EMPREGARE_RESPOSTA" ("CO_SYNC");

create table public."TB_EMPREGARE_ANEXO" (
  "CO_EMPREGARE_ANEXO" uuid not null default gen_random_uuid(),
  "CO_EMPREGARE_RESPOSTA" uuid not null,
  "CO_PERGUNTA_EMPREGARE" varchar(20) not null,
  "NU_ARQUIVO" smallint not null default 1,
  "NU_ORDEM" smallint,
  "DS_ENUNCIADO" varchar(2000),
  "DS_COLUNA" varchar(1000),
  "TP_LINK" varchar(20) not null default 'ARQUIVO_EMPREGARE',
  "DS_LINK" varchar(1500) not null,
  "DT_CAPTURA" timestamptz not null default now(),
  constraint "PK_TB_EMPREGARE_ANEXO" primary key ("CO_EMPREGARE_ANEXO"),
  constraint "UK_EMPREGANEXO_RESPPERGARQ" unique ("CO_EMPREGARE_RESPOSTA", "CO_PERGUNTA_EMPREGARE", "NU_ARQUIVO"),
  constraint "FK_EMPREGRESP_EMPREGANEXO" foreign key ("CO_EMPREGARE_RESPOSTA")
    references public."TB_EMPREGARE_RESPOSTA" ("CO_EMPREGARE_RESPOSTA") on delete cascade,
  constraint "CK_EMPREGANEXO_COPERGUNTA" check ("CO_PERGUNTA_EMPREGARE" ~ '^[0-9]{1,20}$'),
  constraint "CK_EMPREGANEXO_NUARQUIVO" check ("NU_ARQUIVO" between 1 and 50),
  constraint "CK_EMPREGANEXO_NUORDEM" check ("NU_ORDEM" is null or "NU_ORDEM" between 1 and 999),
  constraint "CK_EMPREGANEXO_TPLINK" check ("TP_LINK" in ('ARQUIVO_EMPREGARE')),
  constraint "CK_EMPREGANEXO_DSLINK" check ("DS_LINK" ~ '^https://corporate\.empregare\.com/Company/VacancyTests/GetViewerLogArquivo\?[A-Za-z0-9_.~=&%|+/:-]+$')
);
comment on table public."TB_EMPREGARE_ANEXO" is 'Link "Visualizar Arquivo" de cada anexo de uma resposta de questionário na Empregare, por pergunta e arquivo, lido pelo robô em GetRespostaDetails (o robô nunca abre o arquivo: abrir registra a visualização). DADO RESTRITO: leva o token do candidato; só a RPC da ficha devolve.';
comment on column public."TB_EMPREGARE_ANEXO"."CO_EMPREGARE_ANEXO" is 'Identificador da linha.';
comment on column public."TB_EMPREGARE_ANEXO"."CO_EMPREGARE_RESPOSTA" is 'Resposta do questionário (TB_EMPREGARE_RESPOSTA).';
comment on column public."TB_EMPREGARE_ANEXO"."CO_PERGUNTA_EMPREGARE" is 'Identificador da pergunta na Empregare (perguntaID do link).';
comment on column public."TB_EMPREGARE_ANEXO"."NU_ARQUIVO" is 'Ordem do arquivo na pergunta (1, 2…).';
comment on column public."TB_EMPREGARE_ANEXO"."NU_ORDEM" is 'Ordem da pergunta no questionário (bate com o "Pergunta N" da exportação).';
comment on column public."TB_EMPREGARE_ANEXO"."DS_ENUNCIADO" is 'Enunciado da pergunta como o HTML mostra (texto do edital), sem nome de arquivo.';
comment on column public."TB_EMPREGARE_ANEXO"."DS_COLUNA" is 'Coluna do Excel da exportação ("Pergunta N - enunciado") casada pela Ordem e confirmada pelo enunciado (ou só pelo enunciado); nula se não casou.';
comment on column public."TB_EMPREGARE_ANEXO"."TP_LINK" is 'ARQUIVO_EMPREGARE: abre o visualizador da Empregare com login (não expira).';
comment on column public."TB_EMPREGARE_ANEXO"."DS_LINK" is 'Link Visualizar Arquivo (/Company/VacancyTests/GetViewerLogArquivo?…). DADO RESTRITO.';
comment on column public."TB_EMPREGARE_ANEXO"."DT_CAPTURA" is 'Quando o robô leu pela última vez.';
comment on constraint "CK_EMPREGANEXO_DSLINK" on public."TB_EMPREGARE_ANEXO" is 'Só o Visualizar Arquivo da Empregare (https), sem espaço, aspas nem sinais de HTML.';

alter table public."TB_EMPREGARE_RESPOSTA" enable row level security;
alter table public."TB_EMPREGARE_ANEXO" enable row level security;
revoke all on public."TB_EMPREGARE_RESPOSTA", public."TB_EMPREGARE_ANEXO" from public, anon, authenticated;

-- 2. Gravação pelo robô -----------------------------------------------------------------
create function public.gravar_anexos_empregare(p_sync text, p_vaga text, p_respostas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_r jsonb;
  v_cand uuid;
  v_resp uuid;
  v_impressao text;
  v_respostas integer := 0;
  v_anexos integer := 0;
  v_qt integer;
  v_sem_candidato integer := 0;
begin
  perform private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync);
  if p_vaga is null or p_vaga !~ '^[0-9]{1,20}$' then
    raise exception 'Código de vaga inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(p_respostas) is distinct from 'array' or jsonb_array_length(p_respostas) not between 1 and 500 then
    raise exception 'Envie de 1 a 500 respostas por lote' using errcode = '22023';
  end if;

  for v_r in select x from jsonb_array_elements(p_respostas) x loop
    continue when coalesce(v_r ->> 'resposta', '') !~ '^[0-9]{1,20}$';
    select c."CO_EMPREGARE_CANDIDATO" into v_cand
      from public."TB_EMPREGARE_CANDIDATO" c
     where c."CO_VAGA" = p_vaga and c."CO_CANDIDATO_EMPREGARE" = btrim(v_r ->> 'codigo');
    if v_cand is null then
      v_sem_candidato := v_sem_candidato + 1;
      continue;
    end if;
    -- Link fora do formato vira nulo (impressão) ou fica de fora (anexo).
    v_impressao := case when v_r ->> 'impressao' ~ '^https://corporate\.empregare\.com/Company/VacancyTests/PrintResult\?[A-Za-z0-9_.~=&%|+/:-]+$'
                        and length(v_r ->> 'impressao') <= 1500 then v_r ->> 'impressao' end;
    insert into public."TB_EMPREGARE_RESPOSTA" as x (
      "CO_EMPREGARE_CANDIDATO", "CO_RESPOSTA_QUESTIONARIO", "DS_LINK_IMPRESSAO", "QT_PERGUNTA", "CO_SYNC", "DT_CAPTURA")
    values (v_cand, v_r ->> 'resposta', v_impressao,
            least(greatest(coalesce((v_r ->> 'perguntas')::integer, 0), 0), 10000), p_sync, now())
    on conflict ("CO_EMPREGARE_CANDIDATO", "CO_RESPOSTA_QUESTIONARIO") do update set
      "DS_LINK_IMPRESSAO" = coalesce(excluded."DS_LINK_IMPRESSAO", x."DS_LINK_IMPRESSAO"),
      "QT_PERGUNTA" = excluded."QT_PERGUNTA",
      "CO_SYNC" = excluded."CO_SYNC",
      "DT_CAPTURA" = excluded."DT_CAPTURA"
    returning x."CO_EMPREGARE_RESPOSTA" into v_resp;
    v_respostas := v_respostas + 1;

    -- A resposta relida fica só com os anexos lidos agora.
    delete from public."TB_EMPREGARE_ANEXO" a where a."CO_EMPREGARE_RESPOSTA" = v_resp;
    insert into public."TB_EMPREGARE_ANEXO" (
      "CO_EMPREGARE_RESPOSTA", "CO_PERGUNTA_EMPREGARE", "NU_ARQUIVO", "NU_ORDEM", "DS_ENUNCIADO", "DS_COLUNA", "DS_LINK",
      "DT_CAPTURA")
    select distinct on (an.pergunta, an.arquivo)
           v_resp, an.pergunta, an.arquivo::smallint,
           case when an.ordem between 1 and 999 then an.ordem::smallint end,
           nullif(left(btrim(regexp_replace(an.enunciado, '\s+', ' ', 'g')), 2000), ''),
           nullif(left(btrim(an.coluna), 1000), ''),
           an.link, now()
      from jsonb_to_recordset(coalesce(v_r -> 'anexos', '[]'::jsonb))
           as an(pergunta text, arquivo integer, ordem integer, enunciado text, coluna text, link text)
     where an.pergunta ~ '^[0-9]{1,20}$'
       and an.arquivo between 1 and 50
       and length(an.link) <= 1500
       and an.link ~ '^https://corporate\.empregare\.com/Company/VacancyTests/GetViewerLogArquivo\?[A-Za-z0-9_.~=&%|+/:-]+$'
     order by an.pergunta, an.arquivo;
    get diagnostics v_qt = row_count;
    update public."TB_EMPREGARE_RESPOSTA" set "QT_ANEXO" = v_qt where "CO_EMPREGARE_RESPOSTA" = v_resp;
    v_anexos := v_anexos + v_qt;
  end loop;

  return jsonb_build_object('recebidas', jsonb_array_length(p_respostas), 'respostas', v_respostas,
                            'anexos', v_anexos, 'sem_candidato', v_sem_candidato);
end;
$function$;
comment on function public.gravar_anexos_empregare(text, text, jsonb) is
  'Recebe (até 500 por lote) as respostas de questionário dos candidatos de uma vaga, lidas pelo robô da Empregare em GetRespostaDetails: [{codigo, resposta, impressao, perguntas, anexos: [{pergunta, arquivo, ordem, enunciado, coluna, link}]}]. Faz upsert em TB_EMPREGARE_RESPOSTA e troca os anexos da resposta em TB_EMPREGARE_ANEXO. Só candidatos da vaga; link fora do formato fica de fora. Só service_role, com a execução em andamento.';
revoke all on function public.gravar_anexos_empregare(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.gravar_anexos_empregare(text, text, jsonb) to service_role;

-- 3. A ficha devolve as respostas e os anexos -------------------------------------------
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
    -- Links da Empregare (dado restrito, só aqui): o do candidato, o das candidaturas, os das respostas e dos anexos.
    'empregare', (select json_build_object(
                           'link_candidato', c."DS_LINK_DETALHE",
                           'capturado_em', c."DT_CAPTURA_LINK",
                           'vaga_interno', ev."CO_VAGA_INTERNO",
                           'link_vaga', case when ev."CO_VAGA_INTERNO" is not null
                                             then 'https://corporate.empregare.com/empresa/vagas/candidaturas/' || ev."CO_VAGA_INTERNO" end,
                           'respostas', coalesce((
                             select json_agg(json_build_object('resposta', r."CO_RESPOSTA_QUESTIONARIO",
                                                               'link_impressao', r."DS_LINK_IMPRESSAO",
                                                               'perguntas', r."QT_PERGUNTA", 'anexos', r."QT_ANEXO",
                                                               'capturado_em', r."DT_CAPTURA")
                                             order by r."CO_RESPOSTA_QUESTIONARIO")
                               from public."TB_EMPREGARE_RESPOSTA" r
                              where r."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO"), '[]'::json),
                           'anexos', coalesce((
                             select json_agg(json_build_object('resposta', r."CO_RESPOSTA_QUESTIONARIO",
                                                               'pergunta', a."CO_PERGUNTA_EMPREGARE",
                                                               'arquivo', a."NU_ARQUIVO", 'ordem', a."NU_ORDEM",
                                                               'enunciado', a."DS_ENUNCIADO",
                                                               'coluna', a."DS_COLUNA", 'tipo', a."TP_LINK",
                                                               'link', a."DS_LINK")
                                             order by r."CO_RESPOSTA_QUESTIONARIO", a."CO_PERGUNTA_EMPREGARE", a."NU_ARQUIVO")
                               from public."TB_EMPREGARE_ANEXO" a
                               join public."TB_EMPREGARE_RESPOSTA" r on r."CO_EMPREGARE_RESPOSTA" = a."CO_EMPREGARE_RESPOSTA"
                              where r."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO"), '[]'::json))
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
  'A ficha para analisar (json): o cabeçalho (sem CPF nem contato), o lançamento e o resultado gravados, a regra com que é analisada (a vigente; a da conclusão, se concluída — AM-2.3), a nota mínima e os níveis da regra de classificação, a nota declarada e a ART da pré-classificação, as respostas da Empregare SÓ das perguntas que a regra liga, os links da Empregare capturados pelo robô (empregare: link_candidato da página de detalhes, vaga_interno e link_vaga das candidaturas, respostas [{resposta, link_impressao, perguntas, anexos, capturado_em}] e anexos [{resposta, pergunta, arquivo, ordem, enunciado, coluna, tipo, link}] do questionário; dado restrito, só aqui), o histórico (até 200, com as alterações) e se quem chama pode editar (reserva vigente, em análise) ou reabrir (coordenação, concluída). Vê: coordenação e revisão; o analista, só nas vagas dele; o leitor, só concluída.';
revoke all on function public.obter_ficha_analise(uuid) from public, anon;
grant execute on function public.obter_ficha_analise(uuid) to authenticated;

-- ═══ CORPO DA MIGRATION (fim) ═══

-- E1. Sem acesso direto, permissões; só a gravação e a ficha leem as tabelas.
do $$
declare
  v_outras text;
begin
  if has_table_privilege('authenticated', 'public."TB_EMPREGARE_ANEXO"', 'select')
     or has_table_privilege('anon', 'public."TB_EMPREGARE_ANEXO"', 'select')
     or has_table_privilege('authenticated', 'public."TB_EMPREGARE_RESPOSTA"', 'select')
     or has_table_privilege('anon', 'public."TB_EMPREGARE_RESPOSTA"', 'select')
     or not (select c.relrowsecurity from pg_class c where c.oid = 'public."TB_EMPREGARE_ANEXO"'::regclass)
     or not (select c.relrowsecurity from pg_class c where c.oid = 'public."TB_EMPREGARE_RESPOSTA"'::regclass) then
    raise exception 'FALHOU E1: tabelas com acesso direto ou sem RLS';
  end if;
  if not has_function_privilege('service_role', 'public.gravar_anexos_empregare(text, text, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.gravar_anexos_empregare(text, text, jsonb)', 'execute')
     or has_function_privilege('anon', 'public.gravar_anexos_empregare(text, text, jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.obter_ficha_analise(uuid)', 'execute')
     or has_function_privilege('anon', 'public.obter_ficha_analise(uuid)', 'execute') then
    raise exception 'FALHOU E1: permissões das funções';
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_outras
    from pg_proc p
   where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
     and p.prosrc ~ 'TB_EMPREGARE_(ANEXO|RESPOSTA)'
     and p.proname not in ('gravar_anexos_empregare', 'obter_ficha_analise');
  if v_outras is not null then
    raise exception 'FALHOU E1: outras funções leem os anexos: %', v_outras;
  end if;
  raise notice 'ok E1: RLS sem grant, RPC do robô só service_role, anexos só na gravação e na ficha';
end;
$$;

-- E2. A gravação como o robô (papel service_role), na vaga fictícia 99999502.
set local role service_role;
do $$
declare
  c_arq1 constant text := 'https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?arquivo=ENSAIOa1.pdf&nome=RG&token=ENSAIOtk&questionarioRespostaID=9900001&perguntaID=501';
  c_arq2 constant text := 'https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?arquivo=ENSAIOa2.pdf&nome=Diploma&token=ENSAIOtk&questionarioRespostaID=9900001&perguntaID=502';
  c_imp constant text := 'https://corporate.empregare.com/Company/VacancyTests/PrintResult?respostaID=9900001&pessoa=ENSAIOps&vaga=Vaga%20Ensaio';
  v jsonb;
begin
  perform public.iniciar_sync_empregare('gh-ensaio-anexo-0001', 'GITHUB', null, '{}'::jsonb, 1, null, false);
  v := public.gravar_lote_empregare('gh-ensaio-anexo-0001', '99999502', 2, jsonb_build_array(
    jsonb_build_object('chave', 'cod:ENSAIOA1', 'tipo', 'CODIGO', 'codigo', 'ENSAIOA1', 'colunas', '{"Nome":"Ensaio A1"}'::jsonb),
    jsonb_build_object('chave', 'cod:ENSAIOA2', 'tipo', 'CODIGO', 'codigo', 'ENSAIOA2', 'colunas', '{"Nome":"Ensaio A2"}'::jsonb)));
  perform public.fechar_vaga_empregare('gh-ensaio-anexo-0001', '99999502', '["Nome"]'::jsonb, 'ensaio.xlsx');

  v := public.gravar_anexos_empregare('gh-ensaio-anexo-0001', '99999502', jsonb_build_array(
    jsonb_build_object('codigo', 'ENSAIOA1', 'resposta', '9900001', 'impressao', c_imp, 'perguntas', 25,
      'anexos', jsonb_build_array(
        jsonb_build_object('pergunta', '501', 'arquivo', 1, 'ordem', 4, 'enunciado', '  Anexe   o RG ', 'coluna', 'Pergunta 4 - Anexe o RG', 'link', c_arq1),
        jsonb_build_object('pergunta', '502', 'arquivo', 1, 'enunciado', 'Anexe o diploma', 'link', c_arq2),
        jsonb_build_object('pergunta', '503', 'arquivo', 1, 'link', 'https://storage.empregare.com/anexocurriculo/x.pdf?se=1&sig=y'),
        jsonb_build_object('pergunta', 'x', 'arquivo', 1, 'link', c_arq1))),
    jsonb_build_object('codigo', 'ENSAIOA2', 'resposta', '9900002', 'impressao', 'javascript:alert(1)', 'anexos', '[]'::jsonb),
    jsonb_build_object('codigo', 'ENSAIOA2', 'resposta', '99x'),
    jsonb_build_object('codigo', 'ENSAIOZZ', 'resposta', '9900003')));
  if (v ->> 'respostas')::int <> 2 or (v ->> 'anexos')::int <> 2 or (v ->> 'sem_candidato')::int <> 1 then
    raise exception 'FALHOU E2: primeira gravação (%)', v;
  end if;
  perform public.finalizar_sync_empregare('gh-ensaio-anexo-0001', 1, 0, null);

  -- Releitura: só a pergunta 501; a 502 sai.
  perform public.iniciar_sync_empregare('gh-ensaio-anexo-0002', 'GITHUB', null, '{}'::jsonb, 1, null, false);
  v := public.gravar_anexos_empregare('gh-ensaio-anexo-0002', '99999502', jsonb_build_array(
    jsonb_build_object('codigo', 'ENSAIOA1', 'resposta', '9900001', 'perguntas', 25,
      'anexos', jsonb_build_array(jsonb_build_object('pergunta', '501', 'arquivo', 1, 'link', c_arq1)))));
  if (v ->> 'respostas')::int <> 1 or (v ->> 'anexos')::int <> 1 then
    raise exception 'FALHOU E2: releitura (%)', v;
  end if;
  perform public.finalizar_sync_empregare('gh-ensaio-anexo-0002', 1, 0, null);
  begin
    perform public.gravar_anexos_empregare('gh-ensaio-anexo-0002', '99999502', '[{"codigo":"ENSAIOA1","resposta":"1"}]'::jsonb);
    raise exception 'FALHOU E2: gravou com a execução fechada';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok E2: resposta e anexos gravados, links fora do formato e candidato de fora recusados, releitura troca os anexos, execução fechada recusa';
end;
$$;
reset role;

/* Para a ficha: uma ficha existente, uma resposta fictícia no candidato dela e pessoas sintéticas. */
do $$
declare
  v_ficha uuid;
  v_edital uuid;
  v_area text;
  v_cand uuid;
  v_resp uuid;
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

  insert into public."TB_EMPREGARE_RESPOSTA" ("CO_EMPREGARE_CANDIDATO", "CO_RESPOSTA_QUESTIONARIO", "DS_LINK_IMPRESSAO", "QT_PERGUNTA", "QT_ANEXO")
  values (v_cand, '9988776', 'https://corporate.empregare.com/Company/VacancyTests/PrintResult?respostaID=9988776&pessoa=ENSAIOpsF&vaga=Ensaio', 25, 1)
  returning "CO_EMPREGARE_RESPOSTA" into v_resp;
  insert into public."TB_EMPREGARE_ANEXO" ("CO_EMPREGARE_RESPOSTA", "CO_PERGUNTA_EMPREGARE", "NU_ARQUIVO", "NU_ORDEM", "DS_ENUNCIADO", "DS_COLUNA", "DS_LINK")
  values (v_resp, '701', 1, 7, 'Anexe o comprovante', 'Pergunta 7 - Anexe o comprovante',
          'https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?arquivo=ENSAIOaF.pdf&token=ENSAIOtkF&questionarioRespostaID=9988776&perguntaID=701');

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
     or v -> 'empregare' -> 'anexos' -> 0 ->> 'coluna' is distinct from 'Pergunta 7 - Anexe o comprovante'
     or (v -> 'empregare' -> 'anexos' -> 0 ->> 'ordem')::int is distinct from 7
     or v -> 'empregare' -> 'anexos' -> 0 ->> 'tipo' is distinct from 'ARQUIVO_EMPREGARE'
     or v -> 'empregare' -> 'anexos' -> 0 ->> 'link' !~ 'GetViewerLogArquivo'
     or json_array_length(v -> 'empregare' -> 'respostas') <> 1
     or v -> 'empregare' -> 'respostas' -> 0 ->> 'link_impressao' !~ 'PrintResult' then
    raise exception 'FALHOU E3: respostas e anexos na ficha';
  end if;
  if v -> 'ficha' is null or v -> 'regra' is null or v -> 'historico' is null
     or not ((v -> 'empregare')::jsonb ? 'link_candidato') then
    raise exception 'FALHOU E3: a ficha perdeu chaves de antes';
  end if;
  v := public.obter_fila_avaliacao(current_setting('ensaio.edital')::uuid);
  if v::text ~ 'GetViewerLogArquivo' or v::text ~ 'PrintResult' then
    raise exception 'FALHOU E3: a fila traz os links';
  end if;
  raise notice 'ok E3: analista da vaga recebe respostas e anexos; sem acesso, 42501; a fila não traz os links';
end;
$$;
reset role;

-- E4. O que ficou gravado e as CKs.
do $$
declare
  v_resp uuid := (select r."CO_EMPREGARE_RESPOSTA" from public."TB_EMPREGARE_RESPOSTA" r
                    join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = r."CO_EMPREGARE_CANDIDATO"
                   where c."CO_VAGA" = '99999502' and r."CO_RESPOSTA_QUESTIONARIO" = '9900001');
begin
  if (select r."DS_LINK_IMPRESSAO" from public."TB_EMPREGARE_RESPOSTA" r where r."CO_EMPREGARE_RESPOSTA" = v_resp) !~ 'PrintResult'
     or (select count(*) from public."TB_EMPREGARE_ANEXO" a where a."CO_EMPREGARE_RESPOSTA" = v_resp) <> 1
     or (select r."QT_ANEXO" from public."TB_EMPREGARE_RESPOSTA" r where r."CO_EMPREGARE_RESPOSTA" = v_resp) <> 1
     or (select r."DS_LINK_IMPRESSAO" from public."TB_EMPREGARE_RESPOSTA" r
           join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = r."CO_EMPREGARE_CANDIDATO"
          where c."CO_VAGA" = '99999502' and r."CO_RESPOSTA_QUESTIONARIO" = '9900002') is not null then
    raise exception 'FALHOU E4: o que ficou gravado';
  end if;
  begin
    insert into public."TB_EMPREGARE_ANEXO" ("CO_EMPREGARE_RESPOSTA", "CO_PERGUNTA_EMPREGARE", "NU_ARQUIVO", "DS_LINK")
    values (v_resp, '9', 1, 'https://storage.empregare.com/anexocurriculo/x.pdf?se=1&sig=y');
    raise exception 'FALHOU E4: a CK aceitou link do storage';
  exception when check_violation then null;
  end;
  begin
    insert into public."TB_EMPREGARE_ANEXO" ("CO_EMPREGARE_RESPOSTA", "CO_PERGUNTA_EMPREGARE", "NU_ARQUIVO", "DS_LINK")
    values (v_resp, '9', 1, 'https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?a="b"');
    raise exception 'FALHOU E4: a CK aceitou aspas';
  exception when check_violation then null;
  end;
  begin
    update public."TB_EMPREGARE_RESPOSTA" set "CO_RESPOSTA_QUESTIONARIO" = '12a' where "CO_EMPREGARE_RESPOSTA" = v_resp;
    raise exception 'FALHOU E4: a CK aceitou resposta com letra';
  exception when check_violation then null;
  end;
  raise notice 'ok E4: gravado como esperado; CKs barram link do storage, aspas e resposta com letra';
end;
$$;

select
  'ENSAIO OK' as resultado,
  (select count(*) from public."TB_EMPREGARE_ANEXO" a
     join public."TB_EMPREGARE_RESPOSTA" r on r."CO_EMPREGARE_RESPOSTA" = a."CO_EMPREGARE_RESPOSTA"
     join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = r."CO_EMPREGARE_CANDIDATO"
    where c."CO_VAGA" = '99999502') as anexos_da_vaga_ficticia;

rollback;
