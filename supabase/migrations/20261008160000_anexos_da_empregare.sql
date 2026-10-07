/*
  ROBÔ DA EMPREGARE: O LINK DE CADA ANEXO DO QUESTIONÁRIO

  Na ficha da avaliação documental, o "Ver na Empregare" de cada anexo abria o
  currículo do candidato (DS_LINK_DETALHE, migration 20261007160000), não o
  documento: a exportação da Empregare não traz o link dos anexos (só
  "Sim"/"--"). Os arquivos ficam na página de detalhes, aba Questionários. O
  robô (scripts/robo-empregare/anexos_empregare.py, com --anexos) lê essa aba e
  guarda aqui, por pergunta de anexo, o link do arquivo ou, se o arquivo
  exigir sessão ou expirar, o link da página do questionário com âncora.

  O QUE ENTRA
    TB_EMPREGARE_ANEXO              um link por candidato e pergunta
    gravar_anexos_empregare         o robô grava os anexos de uma vaga (só service_role)
    anexos_capturados_empregare     o robô pergunta quem já tem anexo recente (só service_role)
    obter_ficha_analise             "empregare" ganha "anexos": [{pergunta, enunciado,
                                    tipo, link, capturado_em}]

  DADO RESTRITO
    Os links levam tokens (da área logada ou da assinatura do arquivo). A
    tabela tem RLS e nenhum grant; só a RPC da ficha devolve, a quem pode ver
    a ficha (private."FC_EXIGIR_VER_FICHA"). Nunca em lista, CSV ou log do robô.

  PRÉ-REQUISITO: 20261007160000_link_do_candidato_na_empregare.sql.

  Ensaio: supabase/ensaios/20261008160000_anexos_da_empregare.sql
  Rollback: supabase/rollback/20261008160000_anexos_da_empregare.sql
*/
begin;

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

commit;
