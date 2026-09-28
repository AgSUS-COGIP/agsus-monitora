/*
  SINCRONIZAÇÃO DE ANÁLISES CURRICULARES POR PLANILHA

  Três planilhas (Saúde Indígena, Projetos e, no futuro, SEDE) passam a enviar
  para as MESMAS tabelas (TB_ANALISE_CURRICULAR, TB_EDITAL_ANALISE). Até aqui a
  sincronização supunha uma planilha só:
    - finalizar_sync_analises_incremental / finalizar_sync_analises_lotes
      desativavam TODO edital (e, no FULL, toda análise) ausente do envio: o
      envio de Projetos desativaria os dados da Saúde Indígena, e vice-versa;
    - iniciar_sync_analises_incremental, os finalizar_* e o lote usavam um lock
      consultivo global, e o iniciar recusava se houvesse QUALQUER sync
      pendente; o gatilho analises_sync_guard_before_insert fazia o mesmo no
      insert do log (FULL). As planilhas se bloqueariam umas às outras;
    - iniciar_sync_analises_incremental gravava origem fixa (a da SI);
    - verificar_sync_analises_incremental contava ativos de todas as planilhas.

  DESENHO (aprovado pelo responsável, opção A: mesmas tabelas, etiqueta)
    - public."TB_PLANILHA_ANALISE": cadastro das planilhas (saude-indigena,
      projetos, sede), cada uma de uma área (TB_AREA).
    - public."TA_ORIGEM_ANALISE": cada `origem` que o Apps Script grava em
      TL_SYNC_ANALISE aponta para uma planilha. Origem fora dela é recusada.
    - "CO_PLANILHA" em TB_ANALISE_CURRICULAR, TB_EDITAL_ANALISE e
      TL_SYNC_ANALISE. O log recebe a etiqueta pelo gatilho a partir da origem;
      as tabelas de dados, pelo processamento.
    - Porteiro: o processamento descobre a planilha pela origem do sync. Linha
      de staging (FATO_ANALISES ou DIM_EDITAIS) com `grupo` diferente do
      TB_AREA."NO_GRUPO_PLANILHA" da área da planilha recusa o sync inteiro
      (raise exception: nada é gravado). Checagem no preparar (incremental) e
      no primeiro lote (FULL); os lotes seguintes e os finalizar_* conferem de
      novo o que vão gravar.
    - Isolamento: toda desativação (editais e análises) só alcança linhas da
      planilha do sync. Um upsert que encontre a mesma chave em outra planilha
      recusa o sync.
    - Filas por planilha: lock consultivo e "sync pendente" passam a ser por
      planilha. SI e Projetos podem ter um sync pendente cada, ao mesmo tempo.
    - Colunas experiencia_profissional_anos/meses/dias/total (Edital 30/2026,
      Projetos), em minúsculas como as colunas legadas desta tabela
      (experiencia_saude_indigena_total etc.), mapeadas no FULL e no incremental.

  COMPATIBILIDADE (script atual da Saúde Indígena, sem mudança)
    - iniciar_sync_analises_incremental(p_sync_id) e
      verificar_sync_analises_incremental(p_total_ativos_local) ganham
      p_origem text com default = origem incremental da SI. Para o PostgREST
      não ficar com duas sobrecargas ambíguas, a assinatura antiga é removida e
      a nova criada nesta mesma transação, com os mesmos nomes de parâmetro.
    - As demais RPCs mantêm assinatura. Os JSON devolvidos mantêm todas as
      chaves de antes; só ganham "planilha".
    - O FULL continua inserindo o log direto pelo REST, com a origem dele.

  POR QUE O PREENCHIMENTO NÃO DISPARA GATILHOS
    As linhas atuais recebem "CO_PLANILHA" por ADD COLUMN ... NOT NULL DEFAULT
    'saude-indigena' seguido de DROP DEFAULT. No PostgreSQL 11+ isso só grava
    metadado: nenhuma linha é reescrita, nenhum gatilho roda (set_updated_at,
    bloqueio de importação, área) e nenhum updated_at muda — o mesmo objetivo
    de desligar os gatilhos em 20260925170000_areas_do_sistema.sql, sem
    precisar desligá-los. Antes, um bloco confere que todo dado atual é da
    Saúde Indígena; se não for, a migration aborta.

  AUXILIARES SECURITY DEFINER EM public
    As RPCs incrementais são SECURITY INVOKER e rodam como service_role, que
    não tem USAGE no schema private nem SELECT em TB_AREA. Por isso os três
    auxiliares ficam em public, SECURITY DEFINER, search_path vazio, com
    EXECUTE só para service_role (nem anon nem authenticated).

  DEPENDENTES
    Apps Script das planilhas (apps-script/). O front só lê estas tabelas.

  ROLLBACK
    supabase/rollback/20260928140000_sync_de_analises_por_planilha.sql
    (devolve as funções às definições anteriores e remove o que foi criado;
    recusa rodar se já houver dados de outra planilha que não a SI).
*/
begin;

set local lock_timeout = '5s';

-- 0. Pré-condição: todo dado atual é da Saúde Indígena ------------------------
do $$
declare
  v_fora integer;
begin
  select count(*) into v_fora from public."TB_ANALISE_CURRICULAR"
   where public.analises_norm_key(grupo) is distinct from public.analises_norm_key('Saúde Indígena');
  if v_fora > 0 then
    raise exception 'Abortado: % análise(s) com grupo diferente de Saúde Indígena; decida a planilha delas antes.', v_fora;
  end if;
  select count(*) into v_fora from public."TB_EDITAL_ANALISE"
   where public.analises_norm_key(grupo) is distinct from public.analises_norm_key('Saúde Indígena');
  if v_fora > 0 then
    raise exception 'Abortado: % edital(is) de análise com grupo diferente de Saúde Indígena.', v_fora;
  end if;
  select count(*) into v_fora from public."TL_SYNC_ANALISE"
   where origem is distinct from 'apps_script_analises_incremental_v1'
     and origem is distinct from 'apps_script_analises_curriculares_v2_pdf';
  if v_fora > 0 then
    raise exception 'Abortado: % log(s) de sync com origem desconhecida.', v_fora;
  end if;
end;
$$;

-- 1. Cadastro de planilhas e origens -------------------------------------------
create table public."TB_PLANILHA_ANALISE" (
  "CO_PLANILHA" text not null,
  "CO_AREA" text not null,
  "NO_PLANILHA" text not null,
  "DS_PLANILHA_ID" text,
  constraint "PK_TB_PLANILHA_ANALISE" primary key ("CO_PLANILHA"),
  constraint "UK_PLANILHAANALISE_COAREA" unique ("CO_AREA"),
  constraint "FK_AREA_PLANILHA_ANALISE" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA"),
  constraint "CK_PLANILHAANALISE_COPLANILHA" check ("CO_PLANILHA" ~ '^[a-z]+(-[a-z]+)*$')
);
comment on table public."TB_PLANILHA_ANALISE" is
  'Planilhas Google que enviam análises curriculares. Cada uma é de uma área; o grupo aceito no envio é TB_AREA.NO_GRUPO_PLANILHA dessa área.';
comment on column public."TB_PLANILHA_ANALISE"."CO_PLANILHA" is 'Código da planilha (saude-indigena, projetos, sede). Etiqueta gravada nas análises, editais e logs.';
comment on column public."TB_PLANILHA_ANALISE"."CO_AREA" is 'Área da planilha (TB_AREA). Define o grupo aceito pelo porteiro.';
comment on column public."TB_PLANILHA_ANALISE"."NO_PLANILHA" is 'Nome da planilha para exibição e mensagens.';
comment on column public."TB_PLANILHA_ANALISE"."DS_PLANILHA_ID" is 'ID do arquivo no Google Drive (nulo enquanto a planilha não existe).';

insert into public."TB_PLANILHA_ANALISE" ("CO_PLANILHA", "CO_AREA", "NO_PLANILHA", "DS_PLANILHA_ID") values
  ('saude-indigena', 'saude-indigena', 'Central Monitora Análises - Saúde Indígena', '15jEbApj-tdxKAm2DQZdojrgvU_SbO00G8031vmAg7cw'),
  ('projetos', 'projetos', 'Central AgSus Monitora Sede e Projetos', '1BJbi9SJRc-UaEEYR5PMPReyvyUYt9kGoeGqdepXhkJQ'),
  ('sede', 'sede', 'Central Monitora Análises - SEDE', null);

create table public."TA_ORIGEM_ANALISE" (
  "CO_ORIGEM" text not null,
  "CO_PLANILHA" text not null,
  "TP_CARGA" text not null,
  constraint "PK_TA_ORIGEM_ANALISE" primary key ("CO_ORIGEM"),
  constraint "FK_PLANILHA_ORIGEM_ANALISE" foreign key ("CO_PLANILHA") references public."TB_PLANILHA_ANALISE" ("CO_PLANILHA"),
  constraint "CK_ORIGEMANALISE_TPCARGA" check ("TP_CARGA" in ('FULL', 'INCREMENTAL'))
);
comment on table public."TA_ORIGEM_ANALISE" is
  'Origem (TL_SYNC_ANALISE.origem) de cada script de sincronização -> planilha. Origem fora desta tabela é recusada.';
comment on column public."TA_ORIGEM_ANALISE"."CO_ORIGEM" is 'Valor da constante ORIGEM do Apps Script.';
comment on column public."TA_ORIGEM_ANALISE"."CO_PLANILHA" is 'Planilha dona da origem (TB_PLANILHA_ANALISE).';
comment on column public."TA_ORIGEM_ANALISE"."TP_CARGA" is 'FULL (log inserido pelo REST) ou INCREMENTAL (log criado por iniciar_sync_analises_incremental).';

insert into public."TA_ORIGEM_ANALISE" ("CO_ORIGEM", "CO_PLANILHA", "TP_CARGA") values
  ('apps_script_analises_incremental_v1', 'saude-indigena', 'INCREMENTAL'),
  ('apps_script_analises_curriculares_v2_pdf', 'saude-indigena', 'FULL'),
  ('apps_script_analises_projetos_incremental_v1', 'projetos', 'INCREMENTAL'),
  ('apps_script_analises_projetos_full_v1', 'projetos', 'FULL'),
  ('apps_script_analises_sede_incremental_v1', 'sede', 'INCREMENTAL'),
  ('apps_script_analises_sede_full_v1', 'sede', 'FULL');

create index "IN_FKORIGEMANALISE_COPLANILHA" on public."TA_ORIGEM_ANALISE" ("CO_PLANILHA");

alter table public."TB_PLANILHA_ANALISE" enable row level security;
alter table public."TA_ORIGEM_ANALISE" enable row level security;
create policy "PL_PLANILHA_ANALISE_LEITURA" on public."TB_PLANILHA_ANALISE" for select to authenticated using (true);
create policy "PL_ORIGEM_ANALISE_LEITURA" on public."TA_ORIGEM_ANALISE" for select to authenticated using (true);
revoke all on public."TB_PLANILHA_ANALISE", public."TA_ORIGEM_ANALISE" from public, anon, authenticated, service_role;
grant select on public."TB_PLANILHA_ANALISE", public."TA_ORIGEM_ANALISE" to authenticated, service_role;

-- 2. Etiqueta "CO_PLANILHA" (sem reescrever linhas, sem gatilhos) ----------------
alter table public."TB_ANALISE_CURRICULAR" add column "CO_PLANILHA" text not null default 'saude-indigena';
alter table public."TB_ANALISE_CURRICULAR" alter column "CO_PLANILHA" drop default;
alter table public."TB_EDITAL_ANALISE" add column "CO_PLANILHA" text not null default 'saude-indigena';
alter table public."TB_EDITAL_ANALISE" alter column "CO_PLANILHA" drop default;
alter table public."TL_SYNC_ANALISE" add column "CO_PLANILHA" text not null default 'saude-indigena';
alter table public."TL_SYNC_ANALISE" alter column "CO_PLANILHA" drop default;

alter table public."TB_ANALISE_CURRICULAR"
  add constraint "FK_PLANILHA_ANALISE_CURRICULAR" foreign key ("CO_PLANILHA") references public."TB_PLANILHA_ANALISE" ("CO_PLANILHA");
alter table public."TB_EDITAL_ANALISE"
  add constraint "FK_PLANILHA_EDITAL_ANALISE" foreign key ("CO_PLANILHA") references public."TB_PLANILHA_ANALISE" ("CO_PLANILHA");
alter table public."TL_SYNC_ANALISE"
  add constraint "FK_PLANILHA_SYNC_ANALISE" foreign key ("CO_PLANILHA") references public."TB_PLANILHA_ANALISE" ("CO_PLANILHA");

create index "IN_FKANALISECURRICULAR_COPLANILHA" on public."TB_ANALISE_CURRICULAR" ("CO_PLANILHA", ativo);
create index "IN_FKEDITALANALISE_COPLANILHA" on public."TB_EDITAL_ANALISE" ("CO_PLANILHA", ativo);
create index "IN_FKSYNCANALISE_COPLANILHA" on public."TL_SYNC_ANALISE" ("CO_PLANILHA", status);

comment on column public."TB_ANALISE_CURRICULAR"."CO_PLANILHA" is
  'Planilha que enviou a análise (TB_PLANILHA_ANALISE). Só o sync dessa planilha altera ou desativa a linha.';
comment on column public."TB_EDITAL_ANALISE"."CO_PLANILHA" is
  'Planilha que enviou o edital (TB_PLANILHA_ANALISE). Só o sync dessa planilha altera ou desativa a linha.';
comment on column public."TL_SYNC_ANALISE"."CO_PLANILHA" is
  'Planilha do sync, preenchida pelo gatilho trg_analises_sync_guard_before_insert a partir da origem (TA_ORIGEM_ANALISE).';

-- 3. Colunas do Edital 30/2026 (Projetos) ---------------------------------------
-- Minúsculas, como as colunas legadas desta tabela (experiencia_saude_indigena_total).
alter table public."TB_ANALISE_CURRICULAR"
  add column experiencia_profissional_anos integer,
  add column experiencia_profissional_meses integer,
  add column experiencia_profissional_dias integer,
  add column experiencia_profissional_total numeric;
comment on column public."TB_ANALISE_CURRICULAR".experiencia_profissional_anos is 'Anos de experiência profissional informados na planilha (Projetos, Edital 30/2026).';
comment on column public."TB_ANALISE_CURRICULAR".experiencia_profissional_meses is 'Meses de experiência profissional informados na planilha.';
comment on column public."TB_ANALISE_CURRICULAR".experiencia_profissional_dias is 'Dias de experiência profissional informados na planilha.';
comment on column public."TB_ANALISE_CURRICULAR".experiencia_profissional_total is 'Total de experiência profissional (mesmo tipo de experiencia_saude_indigena_total).';

-- 4. Auxiliares ------------------------------------------------------------------
create function public."FC_PLANILHA_DA_ORIGEM_ANALISE"(p_origem text, p_tp_carga text default null)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_planilha text;
  v_tp text;
begin
  select o."CO_PLANILHA", o."TP_CARGA" into v_planilha, v_tp
    from public."TA_ORIGEM_ANALISE" o
   where o."CO_ORIGEM" = p_origem;
  if v_planilha is null then
    raise exception 'Origem de sincronizacao nao cadastrada em TA_ORIGEM_ANALISE: "%". Sync recusado.', coalesce(p_origem, '<nula>')
      using errcode = '22023';
  end if;
  if p_tp_carga is not null and v_tp <> p_tp_carga then
    raise exception 'Origem "%" e de carga %, nao %. Sync recusado.', p_origem, v_tp, p_tp_carga
      using errcode = '22023';
  end if;
  return v_planilha;
end;
$$;
comment on function public."FC_PLANILHA_DA_ORIGEM_ANALISE"(text, text) is
  'Planilha de uma origem de sync (TA_ORIGEM_ANALISE). Recusa origem não cadastrada ou de outro tipo de carga.';

create function public."FC_PLANILHA_DO_SYNC_ANALISE"(p_sync_id uuid)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_origem text;
begin
  select l.origem into v_origem
    from public."TL_SYNC_ANALISE" l
   where l.sync_id = p_sync_id
   order by l.id desc
   limit 1;
  if not found then
    return null; -- quem chama responde com a própria mensagem de "sync indisponível"
  end if;
  return public."FC_PLANILHA_DA_ORIGEM_ANALISE"(v_origem, null);
end;
$$;
comment on function public."FC_PLANILHA_DO_SYNC_ANALISE"(uuid) is
  'Planilha de um sync pela origem gravada no log. Nulo se o sync não existe; exceção se a origem não é cadastrada.';

create function public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(p_sync_id uuid, p_planilha text)
returns integer
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_grupo text;
  v_grupo_norm text;
  v_total integer;
  v_fora integer;
  v_grupos text;
begin
  select a."NO_GRUPO_PLANILHA" into v_grupo
    from public."TB_PLANILHA_ANALISE" p
    join public."TB_AREA" a on a."CO_AREA" = p."CO_AREA"
   where p."CO_PLANILHA" = p_planilha;
  if v_grupo is null then
    raise exception 'Planilha "%" nao cadastrada em TB_PLANILHA_ANALISE. Sync recusado.', coalesce(p_planilha, '<nula>')
      using errcode = '22023';
  end if;
  v_grupo_norm := public.analises_norm_key(v_grupo);

  select count(*)::integer,
         count(*) filter (where coalesce(public.analises_norm_key(public.jsonb_text_or_null(s.payload, 'grupo')), '') <> v_grupo_norm)::integer,
         left(string_agg(distinct coalesce(public.jsonb_text_or_null(s.payload, 'grupo'), '<vazio>'), ', ')
              filter (where coalesce(public.analises_norm_key(public.jsonb_text_or_null(s.payload, 'grupo')), '') <> v_grupo_norm), 300)
    into v_total, v_fora, v_grupos
    from public."TM_ANALISE_CURRICULAR" s
   where s.sync_id = p_sync_id
     and s.entidade in ('FATO_ANALISES', 'DIM_EDITAIS');

  if v_fora > 0 then
    raise exception 'Sync % recusado pelo porteiro: % linha(s) do envio com grupo diferente de "%" (planilha %). Grupo(s) encontrado(s): %. Nada foi gravado; corrija a coluna grupo na planilha.',
      p_sync_id, v_fora, v_grupo, p_planilha, v_grupos
      using errcode = '22023';
  end if;
  return v_total;
end;
$$;
comment on function public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(uuid, text) is
  'Porteiro: recusa o sync se alguma linha de staging (FATO_ANALISES ou DIM_EDITAIS) tiver grupo diferente do grupo da área da planilha.';

revoke all on function public."FC_PLANILHA_DA_ORIGEM_ANALISE"(text, text) from public, anon, authenticated;
revoke all on function public."FC_PLANILHA_DO_SYNC_ANALISE"(uuid) from public, anon, authenticated;
revoke all on function public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(uuid, text) from public, anon, authenticated;
grant execute on function public."FC_PLANILHA_DA_ORIGEM_ANALISE"(text, text) to service_role;
grant execute on function public."FC_PLANILHA_DO_SYNC_ANALISE"(uuid) to service_role;
grant execute on function public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(uuid, text) to service_role;

-- 5. Gatilho do log: origem cadastrada, etiqueta e fila por planilha ------------------
CREATE OR REPLACE FUNCTION public.analises_sync_guard_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_active record;
  v_planilha text;
begin
  -- [por-planilha] origem precisa estar cadastrada; o log recebe a planilha.
  select o."CO_PLANILHA" into v_planilha
    from public."TA_ORIGEM_ANALISE" o
   where o."CO_ORIGEM" = new.origem;
  if v_planilha is null then
    raise exception 'Origem de sincronizacao nao cadastrada em TA_ORIGEM_ANALISE: "%". Sync recusado.', coalesce(new.origem, '<nula>')
      using errcode = '22023';
  end if;
  new."CO_PLANILHA" := v_planilha;

  if coalesce(new.status, 'iniciado') in ('iniciado', 'carregado', 'processando') then

    update public."TL_SYNC_ANALISE" l
    set status = 'erro',
        finished_at = now(),
        updated_at = now(),
        erro = coalesce(l.erro, 'Carga de analises marcada como erro automaticamente por expirar sem finalizacao.'),
        mensagem = coalesce(l.mensagem, 'Carga anterior expirada; liberada para permitir nova sincronizacao.'),
        resultado = coalesce(l.resultado, '{}'::jsonb) || jsonb_build_object(
          'ok', false,
          'auto_expired', true,
          'expired_at', now(),
          'previous_status', l.status
        )
    where l."CO_PLANILHA" = v_planilha
      and l.finished_at is null
      and (
        (l.status in ('carregado', 'processando') and l.updated_at < now() - interval '15 minutes')
        or (l.status = 'iniciado' and l.created_at < now() - interval '45 minutes')
      );

    select l.sync_id, l.status, l.created_at
      into v_active
    from public."TL_SYNC_ANALISE" l
    where l."CO_PLANILHA" = v_planilha
      and l.status in ('iniciado', 'carregado', 'processando')
      and l.created_at >= now() - interval '45 minutes'
      and l.finished_at is null
    order by l.created_at desc
    limit 1;

    if found then
      raise exception 'Ja existe uma carga de analises em andamento para a planilha % (sync_id %, status %, criada em %). Aguarde finalizar antes de iniciar outra.',
        v_planilha, v_active.sync_id, v_active.status, v_active.created_at
        using errcode = '55P03';
    end if;
  end if;

  return new;
end;
$function$;

-- 6. Lote (FULL e incremental) ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.processar_sync_analises_lote(p_sync_id uuid, p_limite integer DEFAULT 250)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
 SET statement_timeout TO '20s'
 SET lock_timeout TO '2s'
 SET work_mem TO '8MB'
 SET jit TO 'off'
AS $function$
declare
  v_limite integer := greatest(1, least(coalesce(p_limite,250),500));
  v_cursor integer := 0;
  v_novo_cursor integer := 0;
  v_lidas integer := 0;
  v_alteradas integer := 0;
  v_lidas_total integer := 0;
  v_alteradas_total integer := 0;
  v_planilha text;
  v_grupo_norm text;
  v_validada boolean := false;
  v_fora integer := 0;
  v_conflitos integer := 0;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  -- [por-planilha] planilha pela origem do sync; lock e checagens por planilha.
  v_planilha := public."FC_PLANILHA_DO_SYNC_ANALISE"(p_sync_id);
  if v_planilha is null then raise exception 'Sync % indisponivel para processamento em lotes.', p_sync_id; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:'||v_planilha)::bigint) then
    raise exception 'Outro processamento de analises ja esta em andamento.';
  end if;

  select coalesce(nullif(resultado->>'lote_cursor','')::integer,0),
         coalesce((resultado->>'planilha_validada')::boolean,false)
    into v_cursor,v_validada
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id and status in ('carregado','processando')
  order by id desc limit 1;
  if not found then raise exception 'Sync % indisponivel para processamento em lotes.', p_sync_id; end if;

  -- [por-planilha] porteiro: o staging inteiro, uma vez por sync.
  if not v_validada then
    perform public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(p_sync_id, v_planilha);
  end if;

  select public.analises_norm_key(a."NO_GRUPO_PLANILHA") into v_grupo_norm
  from public."TB_PLANILHA_ANALISE" p join public."TB_AREA" a on a."CO_AREA"=p."CO_AREA"
  where p."CO_PLANILHA"=v_planilha;

  create temporary table tmp_lote on commit drop as
  select s.*
  from public."TM_ANALISE_CURRICULAR" s
  where s.sync_id=p_sync_id
    and s.entidade='FATO_ANALISES'
    and coalesce(s.linha_origem,0)>v_cursor
  order by s.linha_origem,s.id
  limit v_limite;

  select count(*)::integer, coalesce(max(linha_origem),v_cursor)::integer
    into v_lidas,v_novo_cursor
  from tmp_lote;

  if v_lidas=0 then
    return jsonb_build_object('ok',true,'sync_id',p_sync_id,'lidas',0,'alteradas',0,'cursor',v_cursor,'concluido_fato',true);
  end if;

  -- [por-planilha] o que este lote grava é do grupo da planilha e não é de outra planilha.
  select count(*)::integer into v_fora
  from tmp_lote s
  where coalesce(public.analises_norm_key(public.jsonb_text_or_null(s.payload,'grupo')),'') <> v_grupo_norm;
  if v_fora > 0 then
    raise exception 'Sync % recusado pelo porteiro: % linha(s) do lote com grupo diferente do grupo da planilha %. Nada foi gravado.', p_sync_id, v_fora, v_planilha
      using errcode = '22023';
  end if;

  select count(*)::integer into v_conflitos
  from tmp_lote s
  join public."TB_ANALISE_CURRICULAR" a
    on a.chave_natural=public.analises_make_chave_natural(
        public.jsonb_text_or_null(s.payload,'grupo'),
        coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada'),
        coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital'),
        public.jsonb_text_or_null(s.payload,'codigo_vaga'),
        public.jsonb_text_or_null(s.payload,'id'),
        public.jsonb_text_or_null(s.payload,'candidato'))
  where a."CO_PLANILHA" <> v_planilha;
  if v_conflitos > 0 then
    raise exception 'Sync % recusado: % analise(s) do lote ja pertencem a outra planilha (mesma chave_natural). Nada foi gravado.', p_sync_id, v_conflitos
      using errcode = '22023';
  end if;

  with dados as (
    select
      public.analises_make_chave_natural(
        public.jsonb_text_or_null(s.payload,'grupo'),
        coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada'),
        coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital'),
        public.jsonb_text_or_null(s.payload,'codigo_vaga'),
        public.jsonb_text_or_null(s.payload,'id'),
        public.jsonb_text_or_null(s.payload,'candidato')) as chave_natural,
      public.jsonb_text_or_null(s.payload,'grupo') as grupo,
      coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada') as unidade,
      coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital') as edital,
      public.jsonb_text_or_null(s.payload,'codigo_vaga') as codigo_vaga,
      public.jsonb_text_or_null(s.payload,'nome_vaga') as nome_vaga,
      public.jsonb_text_or_null(s.payload,'regime') as regime,
      public.jsonb_text_or_null(s.payload,'carga_horaria') as carga_horaria,
      public.jsonb_text_or_null(s.payload,'categoria') as categoria,
      public.jsonb_text_or_null(s.payload,'candidato') as candidato,
      public.jsonb_text_or_null(s.payload,'id') as id_origem,
      public.jsonb_date_or_null(s.payload,'data_nascimento') as data_nascimento,
      public.jsonb_int_or_null(s.payload,'idade') as idade,
      public.jsonb_num_or_null(s.payload,'nota_empregare') as nota_empregare,
      public.jsonb_text_or_null(s.payload,'modalidade_concorrencia') as modalidade_concorrencia,
      public.jsonb_num_or_null(s.payload,'nota_final_ajustada') as nota_final_ajustada,
      public.jsonb_num_or_null(s.payload,'somatorio') as somatorio,
      public.jsonb_num_or_null(s.payload,'pontuacao_escolaridade') as pontuacao_escolaridade,
      public.jsonb_num_or_null(s.payload,'pontuacao_cursos_aperfeicoamento') as pontuacao_cursos_aperfeicoamento,
      public.jsonb_num_or_null(s.payload,'pontuacao_experiencia_profissional') as pontuacao_experiencia_profissional,
      public.jsonb_num_or_null(s.payload,'pontuacao_criterio_etnico') as pontuacao_criterio_etnico,
      public.jsonb_num_or_null(s.payload,'experiencia_saude_indigena_total') as experiencia_saude_indigena_total,
      public.jsonb_num_or_null(s.payload,'experiencia_atencao_basica_total') as experiencia_atencao_basica_total,
      public.jsonb_int_or_null(s.payload,'experiencia_profissional_anos') as experiencia_profissional_anos,
      public.jsonb_int_or_null(s.payload,'experiencia_profissional_meses') as experiencia_profissional_meses,
      public.jsonb_int_or_null(s.payload,'experiencia_profissional_dias') as experiencia_profissional_dias,
      public.jsonb_num_or_null(s.payload,'experiencia_profissional_total') as experiencia_profissional_total,
      public.jsonb_text_or_null(s.payload,'etapa') as etapa,
      public.jsonb_date_or_null(s.payload,'data_analise') as data_analise,
      public.jsonb_text_or_null(s.payload,'analise') as analise,
      public.jsonb_text_or_null(s.payload,'pcd') as pcd,
      public.jsonb_text_or_null(s.payload,'responsavel_analise') as responsavel_analise,
      public.jsonb_text_or_null(s.payload,'coord_demandante') as coord_demandante,
      public.jsonb_text_or_null(s.payload,'email_demandante') as email_demandante,
      coalesce(public.jsonb_text_or_null(s.payload,'status_consolidado'),'Pendente') as status_consolidado,
      public.jsonb_text_or_null(s.payload,'origem_planilha') as origem_planilha,
      public.jsonb_text_or_null(s.payload,'origem_arquivo_id') as origem_arquivo_id,
      coalesce(public.jsonb_timestamptz_or_null(s.payload,'ultima_atualizacao'),now()) as ultima_atualizacao,
      public.jsonb_text_or_null(s.payload,'pdf_gerado') as pdf_gerado,
      public.jsonb_text_or_null(s.payload,'link_pdf') as link_pdf,
      public.jsonb_timestamptz_or_null(s.payload,'data_geracao_pdf') as data_geracao_pdf,
      public.jsonb_text_or_null(s.payload,'erro_pdf') as erro_pdf,
      public.jsonb_text_or_null(s.payload,'pdf_status') as pdf_status,
      public.jsonb_text_or_null(s.payload,'pdf_file_id') as pdf_file_id,
      public.jsonb_timestamptz_or_null(s.payload,'pdf_ultima_tentativa') as pdf_ultima_tentativa,
      public.jsonb_text_or_null(s.payload,'pdf_hash_origem') as pdf_hash_origem,
      s.linha_origem,
      s.hash_registro
    from tmp_lote s
  )
  insert into public."TB_ANALISE_CURRICULAR"(
    chave_natural,grupo,unidade,edital,codigo_vaga,nome_vaga,regime,carga_horaria,categoria,candidato,
    id_origem,data_nascimento,idade,nota_empregare,modalidade_concorrencia,nota_final_ajustada,somatorio,
    pontuacao_escolaridade,pontuacao_cursos_aperfeicoamento,pontuacao_experiencia_profissional,
    pontuacao_criterio_etnico,experiencia_saude_indigena_total,experiencia_atencao_basica_total,
    experiencia_profissional_anos,experiencia_profissional_meses,experiencia_profissional_dias,experiencia_profissional_total,
    etapa,data_analise,analise,pcd,responsavel_analise,coord_demandante,email_demandante,status_consolidado,
    origem_planilha,origem_arquivo_id,ultima_atualizacao,pdf_gerado,link_pdf,data_geracao_pdf,erro_pdf,pdf_status,
    pdf_file_id,pdf_ultima_tentativa,pdf_hash_origem,linha_origem,hash_registro,ativo,updated_at,"CO_PLANILHA")
  select
    d.chave_natural,d.grupo,d.unidade,d.edital,d.codigo_vaga,d.nome_vaga,d.regime,d.carga_horaria,d.categoria,d.candidato,
    d.id_origem,d.data_nascimento,d.idade,d.nota_empregare,d.modalidade_concorrencia,d.nota_final_ajustada,d.somatorio,
    d.pontuacao_escolaridade,d.pontuacao_cursos_aperfeicoamento,d.pontuacao_experiencia_profissional,
    d.pontuacao_criterio_etnico,d.experiencia_saude_indigena_total,d.experiencia_atencao_basica_total,
    d.experiencia_profissional_anos,d.experiencia_profissional_meses,d.experiencia_profissional_dias,d.experiencia_profissional_total,
    d.etapa,d.data_analise,d.analise,d.pcd,d.responsavel_analise,d.coord_demandante,d.email_demandante,d.status_consolidado,
    d.origem_planilha,d.origem_arquivo_id,d.ultima_atualizacao,
    coalesce(d.pdf_gerado,a.pdf_gerado),coalesce(d.link_pdf,a.link_pdf),coalesce(d.data_geracao_pdf,a.data_geracao_pdf),
    coalesce(d.erro_pdf,a.erro_pdf),coalesce(d.pdf_status,a.pdf_status),coalesce(d.pdf_file_id,a.pdf_file_id),
    coalesce(d.pdf_ultima_tentativa,a.pdf_ultima_tentativa),coalesce(d.pdf_hash_origem,a.pdf_hash_origem),
    d.linha_origem,d.hash_registro,true,now(),v_planilha
  from dados d
  left join public."TB_ANALISE_CURRICULAR" a on a.chave_natural=d.chave_natural
  on conflict (chave_natural) do update set
    grupo=excluded.grupo,unidade=excluded.unidade,edital=excluded.edital,codigo_vaga=excluded.codigo_vaga,
    nome_vaga=excluded.nome_vaga,regime=excluded.regime,carga_horaria=excluded.carga_horaria,categoria=excluded.categoria,
    candidato=excluded.candidato,id_origem=excluded.id_origem,data_nascimento=excluded.data_nascimento,idade=excluded.idade,
    nota_empregare=excluded.nota_empregare,modalidade_concorrencia=excluded.modalidade_concorrencia,
    nota_final_ajustada=excluded.nota_final_ajustada,somatorio=excluded.somatorio,pontuacao_escolaridade=excluded.pontuacao_escolaridade,
    pontuacao_cursos_aperfeicoamento=excluded.pontuacao_cursos_aperfeicoamento,
    pontuacao_experiencia_profissional=excluded.pontuacao_experiencia_profissional,
    pontuacao_criterio_etnico=excluded.pontuacao_criterio_etnico,experiencia_saude_indigena_total=excluded.experiencia_saude_indigena_total,
    experiencia_atencao_basica_total=excluded.experiencia_atencao_basica_total,
    experiencia_profissional_anos=excluded.experiencia_profissional_anos,experiencia_profissional_meses=excluded.experiencia_profissional_meses,
    experiencia_profissional_dias=excluded.experiencia_profissional_dias,experiencia_profissional_total=excluded.experiencia_profissional_total,
    etapa=excluded.etapa,data_analise=excluded.data_analise,
    analise=excluded.analise,pcd=excluded.pcd,responsavel_analise=excluded.responsavel_analise,
    coord_demandante=excluded.coord_demandante,email_demandante=excluded.email_demandante,status_consolidado=excluded.status_consolidado,
    origem_planilha=excluded.origem_planilha,origem_arquivo_id=excluded.origem_arquivo_id,ultima_atualizacao=excluded.ultima_atualizacao,
    pdf_gerado=excluded.pdf_gerado,link_pdf=excluded.link_pdf,data_geracao_pdf=excluded.data_geracao_pdf,erro_pdf=excluded.erro_pdf,
    pdf_status=excluded.pdf_status,pdf_file_id=excluded.pdf_file_id,pdf_ultima_tentativa=excluded.pdf_ultima_tentativa,
    pdf_hash_origem=excluded.pdf_hash_origem,linha_origem=excluded.linha_origem,hash_registro=excluded.hash_registro,ativo=true,updated_at=now()
  where "TB_ANALISE_CURRICULAR"."CO_PLANILHA"=excluded."CO_PLANILHA";

  get diagnostics v_alteradas=row_count;

  select coalesce(nullif(resultado->>'lote_lidas','')::integer,0)+v_lidas,
         coalesce(nullif(resultado->>'lote_alteradas','')::integer,0)+v_alteradas
    into v_lidas_total,v_alteradas_total
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id
  order by id desc limit 1;

  update public."TL_SYNC_ANALISE"
  set status='processando',
      resultado=coalesce(resultado,'{}'::jsonb)||jsonb_build_object(
        'modo_processamento','lotes','lote_cursor',v_novo_cursor,'lote_lidas',v_lidas_total,
        'lote_alteradas',v_alteradas_total,'ultimo_lote_lidas',v_lidas,'ultimo_lote_alteradas',v_alteradas,
        'ultimo_lote_em',now(),'planilha',v_planilha,'planilha_validada',true),
      updated_at=now()
  where sync_id=p_sync_id;

  return jsonb_build_object('ok',true,'sync_id',p_sync_id,'lidas',v_lidas,'alteradas',v_alteradas,
    'lidas_total',v_lidas_total,'alteradas_total',v_alteradas_total,'cursor',v_novo_cursor,'concluido_fato',v_lidas<v_limite);
end;
$function$;

-- 7. Finalização do FULL ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalizar_sync_analises_lotes(p_sync_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
 SET statement_timeout TO '30s'
 SET lock_timeout TO '2s'
 SET work_mem TO '8MB'
 SET jit TO 'off'
AS $function$
declare
  v_cursor integer:=0;
  v_max integer:=0;
  v_total_staging integer:=0;
  v_total_fato integer:=0;
  v_total_editais integer:=0;
  v_normalizados integer:=0;
  v_inativados integer:=0;
  v_editais integer:=0;
  v_editais_inativados integer:=0;
  v_removido integer:=0;
  v_alteradas integer:=0;
  v_result jsonb;
  v_planilha text;
  v_conflitos integer:=0;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  -- [por-planilha]
  v_planilha := public."FC_PLANILHA_DO_SYNC_ANALISE"(p_sync_id);
  if v_planilha is null then raise exception 'Sync % nao esta em processamento por lotes.',p_sync_id; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:'||v_planilha)::bigint) then
    raise exception 'Outro processamento de analises ja esta em andamento.';
  end if;

  select coalesce(nullif(resultado->>'lote_cursor','')::integer,0),
         coalesce(nullif(resultado->>'lote_alteradas','')::integer,0)
    into v_cursor,v_alteradas
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id and status='processando'
  order by id desc limit 1;
  if not found then raise exception 'Sync % nao esta em processamento por lotes.',p_sync_id; end if;

  select coalesce(max(linha_origem) filter(where entidade='FATO_ANALISES'),0),
         count(*)::integer,
         count(*) filter(where entidade='FATO_ANALISES')::integer,
         count(*) filter(where entidade='DIM_EDITAIS')::integer
    into v_max,v_total_staging,v_total_fato,v_total_editais
  from public."TM_ANALISE_CURRICULAR"
  where sync_id=p_sync_id;

  if v_cursor<v_max then
    raise exception 'Ainda existem linhas FATO pendentes: cursor %, max %.',v_cursor,v_max;
  end if;

  -- [por-planilha] porteiro antes de qualquer desativação.
  perform public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(p_sync_id, v_planilha);

  create temporary table tmp_keys on commit drop as
  select distinct public.analises_make_chave_natural(
    public.jsonb_text_or_null(s.payload,'grupo'),
    coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada'),
    coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital'),
    public.jsonb_text_or_null(s.payload,'codigo_vaga'),
    public.jsonb_text_or_null(s.payload,'id'),
    public.jsonb_text_or_null(s.payload,'candidato')) as chave_natural
  from public."TM_ANALISE_CURRICULAR" s
  where s.sync_id=p_sync_id and s.entidade='FATO_ANALISES';

  select count(*)::integer into v_normalizados from tmp_keys;
  create unique index tmp_keys_idx on tmp_keys(chave_natural);
  analyze tmp_keys;

  -- [por-planilha] só desativa análises desta planilha.
  update public."TB_ANALISE_CURRICULAR" a
  set ativo=false,updated_at=now()
  where a.ativo is true
    and a."CO_PLANILHA"=v_planilha
    and not exists(select 1 from tmp_keys k where k.chave_natural=a.chave_natural);
  get diagnostics v_inativados=row_count;

  create temporary table tmp_editais on commit drop as
  with x as (
    select s.id,s.linha_origem,
      public.jsonb_text_or_null(s.payload,'grupo') as grupo,
      coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada') as unidade,
      coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital') as edital,
      coalesce(public.jsonb_bool_or_null(s.payload,'ativo'),true) as ativo,
      public.jsonb_date_or_null(s.payload,'data_inicio_analise') as data_inicio_analise,
      public.jsonb_date_or_null(s.payload,'data_fim_analise') as data_fim_analise
    from public."TM_ANALISE_CURRICULAR" s
    where s.sync_id=p_sync_id and s.entidade='DIM_EDITAIS'
  ), ranked as (
    select *,row_number() over(partition by grupo,unidade,edital order by coalesce(linha_origem,2147483647),id) rn
    from x
  )
  select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise
  from ranked where rn=1;

  if v_total_editais>0 then
    -- [por-planilha] edital já cadastrado por outra planilha: recusa.
    select count(*)::integer into v_conflitos
    from public."TB_EDITAL_ANALISE" e
    join tmp_editais x
      on e.grupo_norm=coalesce(public.analises_norm_key(x.grupo),'')
     and e.unidade_norm=coalesce(public.analises_norm_key(x.unidade),'')
     and e.edital_norm=coalesce(public.analises_norm_key(x.edital),'')
    where e."CO_PLANILHA"<>v_planilha;
    if v_conflitos>0 then
      raise exception 'Sync % recusado: % edital(is) do envio ja pertencem a outra planilha.',p_sync_id,v_conflitos
        using errcode = '22023';
    end if;

    insert into public."TB_EDITAL_ANALISE"(grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,"CO_PLANILHA")
    select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,v_planilha
    from tmp_editais
    on conflict(grupo,unidade,edital) do update set
      ativo=excluded.ativo,
      data_inicio_analise=excluded.data_inicio_analise,
      data_fim_analise=excluded.data_fim_analise,
      updated_at=now()
    where "TB_EDITAL_ANALISE"."CO_PLANILHA"=excluded."CO_PLANILHA";
    get diagnostics v_editais=row_count;

    -- [por-planilha] só desativa editais desta planilha.
    update public."TB_EDITAL_ANALISE" e
    set ativo=false,updated_at=now()
    where e.ativo is true
      and e."CO_PLANILHA"=v_planilha
      and not exists(select 1 from tmp_editais x
        where e.grupo is not distinct from x.grupo
          and e.unidade=x.unidade
          and e.edital=x.edital);
    get diagnostics v_editais_inativados=row_count;
  end if;

  delete from public."TM_ANALISE_CURRICULAR" where sync_id=p_sync_id;
  get diagnostics v_removido=row_count;

  v_result=jsonb_build_object(
    'ok',true,
    'sync_id',p_sync_id,
    'modo_processamento','lotes',
    'planilha',v_planilha,
    'staging',v_total_staging,
    'fato_analises_recebidas',v_total_fato,
    'fato_analises_normalizadas',v_normalizados,
    'fato_analises_upsert',v_alteradas,
    'fato_analises_inativadas',v_inativados,
    'analises_editais_recebidos',v_total_editais,
    'analises_editais_upsert',v_editais,
    'analises_editais_inativados',v_editais_inativados,
    'staging_removido',v_removido);

  update public."TL_SYNC_ANALISE"
  set status='processado',
      resultado=v_result,
      erro=null,
      total_processados=v_normalizados,
      finished_at=now(),
      updated_at=now()
  where sync_id=p_sync_id;

  return v_result;
end;
$function$;

-- 8. Incremental ------------------------------------------------------------------------
-- 8.1 iniciar: ganha p_origem (default = origem incremental da SI). A assinatura antiga
--     sai na mesma transação para o PostgREST não ter duas sobrecargas ambíguas.
drop function public.iniciar_sync_analises_incremental(uuid);

CREATE FUNCTION public.iniciar_sync_analises_incremental(p_sync_id uuid, p_origem text DEFAULT 'apps_script_analises_incremental_v1')
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '5s'
 SET lock_timeout TO '1s'
AS $function$
declare
  v_row public."TL_SYNC_ANALISE"%rowtype;
  v_planilha text;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  -- [por-planilha] origem cadastrada e de carga incremental; lock por planilha.
  v_planilha := public."FC_PLANILHA_DA_ORIGEM_ANALISE"(p_origem, 'INCREMENTAL');
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:'||v_planilha)::bigint) then
    raise exception 'Outro processamento de analises esta em andamento.';
  end if;

  select * into v_row from public."TL_SYNC_ANALISE" where sync_id=p_sync_id order by id desc limit 1;
  if found then
    if coalesce(v_row.modo,'') <> 'INCREMENTAL_ACTIVE' then
      raise exception 'sync_id ja existe com modo diferente: %',coalesce(v_row.modo,'<null>');
    end if;
    if v_row."CO_PLANILHA" is distinct from v_planilha then
      raise exception 'sync_id ja existe para outra planilha: %',coalesce(v_row."CO_PLANILHA",'<null>');
    end if;
    return jsonb_build_object('ok',true,'sync_id',p_sync_id,'status',v_row.status,'existing',true,'resultado',v_row.resultado);
  end if;

  -- [por-planilha] só um sync pendente por planilha.
  if exists(select 1 from public."TL_SYNC_ANALISE" where status in ('carregado','processando') and "CO_PLANILHA"=v_planilha) then
    raise exception 'Existe outro sync de Analises pendente para a planilha %.', v_planilha;
  end if;

  insert into public."TL_SYNC_ANALISE"(sync_id,origem,modo,status,linhas_staging,started_at,resultado)
  values(p_sync_id,p_origem,'INCREMENTAL_ACTIVE','carregado',0,now(),jsonb_build_object(
    'modo_processamento','incremental',
    'incremental_preparado',false,
    'incremental_cursor',0,
    'incremental_iniciado_em',now(),
    'planilha',v_planilha
  ));

  return jsonb_build_object('ok',true,'sync_id',p_sync_id,'status','carregado','existing',false);
end;
$function$;

revoke all on function public.iniciar_sync_analises_incremental(uuid, text) from public, anon, authenticated;
grant execute on function public.iniciar_sync_analises_incremental(uuid, text) to service_role;

-- 8.2 preparar: porteiro antes de qualquer gravação.
CREATE OR REPLACE FUNCTION public.preparar_sync_analises_incremental(p_sync_id uuid, p_total_ativos_local integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '10s'
 SET lock_timeout TO '1s'
AS $function$
declare
  v_fato integer;
  v_editais integer;
  v_total integer;
  v_planilha text;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  if p_total_ativos_local is null or p_total_ativos_local < 0 then raise exception 'p_total_ativos_local invalido'; end if;
  if not exists(select 1 from public."TL_SYNC_ANALISE" where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE' and status in ('carregado','processando')) then
    raise exception 'Sync incremental indisponivel.';
  end if;

  select count(*) filter(where entidade='FATO_ANALISES')::integer,
         count(*) filter(where entidade='DIM_EDITAIS')::integer,
         count(*)::integer
    into v_fato,v_editais,v_total
  from public."TM_ANALISE_CURRICULAR"
  where sync_id=p_sync_id;

  if v_editais < 1 then raise exception 'DIM_EDITAIS nao foi enviada para o staging.'; end if;

  -- [por-planilha] porteiro: falha rápido, antes de qualquer lote.
  v_planilha := public."FC_PLANILHA_DO_SYNC_ANALISE"(p_sync_id);
  perform public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(p_sync_id, v_planilha);

  update public."TL_SYNC_ANALISE"
  set linhas_staging=v_total,
      total_lidos=p_total_ativos_local,
      resultado=coalesce(resultado,'{}'::jsonb)||jsonb_build_object(
        'modo_processamento','incremental',
        'incremental_preparado',true,
        'incremental_total_ativos_local',p_total_ativos_local,
        'incremental_fato_alterados',v_fato,
        'incremental_editais',v_editais,
        'incremental_staging',v_total,
        'incremental_preparado_em',now(),
        'planilha',v_planilha,
        'planilha_validada',true
      ),
      updated_at=now()
  where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE';

  return jsonb_build_object('ok',true,'sync_id',p_sync_id,'total_ativos_local',p_total_ativos_local,'fato_alterados',v_fato,'editais',v_editais,'staging',v_total,'planilha',v_planilha);
end;
$function$;

-- 8.3 finalizar incremental: editais só desta planilha.
CREATE OR REPLACE FUNCTION public.finalizar_sync_analises_incremental(p_sync_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '30s'
 SET lock_timeout TO '2s'
 SET work_mem TO '8MB'
 SET jit TO 'off'
AS $function$
declare
  v_cursor integer:=0;
  v_max integer:=0;
  v_total_staging integer:=0;
  v_esperado integer:=0;
  v_total_fato integer:=0;
  v_total_editais integer:=0;
  v_editais_upsert integer:=0;
  v_editais_inativados integer:=0;
  v_removido integer:=0;
  v_total_ativos_local integer:=0;
  v_result jsonb;
  v_planilha text;
  v_conflitos integer:=0;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  -- [por-planilha]
  v_planilha := public."FC_PLANILHA_DO_SYNC_ANALISE"(p_sync_id);
  if v_planilha is null then raise exception 'Sync incremental nao esta pronto para finalizacao.'; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:'||v_planilha)::bigint) then
    raise exception 'Outro processamento de analises esta em andamento.';
  end if;

  select coalesce(nullif(resultado->>'lote_cursor','')::integer,0),
         coalesce(linhas_staging,0),
         coalesce(nullif(resultado->>'incremental_total_ativos_local','')::integer,0)
    into v_cursor,v_esperado,v_total_ativos_local
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE' and status in ('carregado','processando')
    and coalesce((resultado->>'incremental_preparado')::boolean,false)=true
  order by id desc limit 1;
  if not found then raise exception 'Sync incremental nao esta pronto para finalizacao.'; end if;

  select coalesce(max(linha_origem) filter(where entidade='FATO_ANALISES'),0),
         count(*)::integer,
         count(*) filter(where entidade='FATO_ANALISES')::integer,
         count(*) filter(where entidade='DIM_EDITAIS')::integer
    into v_max,v_total_staging,v_total_fato,v_total_editais
  from public."TM_ANALISE_CURRICULAR"
  where sync_id=p_sync_id;

  if v_total_staging <> v_esperado then raise exception 'Staging incremental divergente: esperado %, encontrado %.',v_esperado,v_total_staging; end if;
  if v_cursor < v_max then raise exception 'Ainda existem linhas FATO incrementais pendentes: cursor %, max %.',v_cursor,v_max; end if;
  if v_total_editais < 1 then raise exception 'DIM_EDITAIS ausente no incremental.'; end if;

  -- [por-planilha] porteiro antes de gravar editais.
  perform public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(p_sync_id, v_planilha);

  create temporary table tmp_editais_incremental on commit drop as
  with x as (
    select s.id,s.linha_origem,
      public.jsonb_text_or_null(s.payload,'grupo') as grupo,
      coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada') as unidade,
      coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital') as edital,
      coalesce(public.jsonb_bool_or_null(s.payload,'ativo'),true) as ativo,
      public.jsonb_date_or_null(s.payload,'data_inicio_analise') as data_inicio_analise,
      public.jsonb_date_or_null(s.payload,'data_fim_analise') as data_fim_analise
    from public."TM_ANALISE_CURRICULAR" s
    where s.sync_id=p_sync_id and s.entidade='DIM_EDITAIS'
  ), ranked as (
    select *,row_number() over(partition by grupo,unidade,edital order by coalesce(linha_origem,2147483647),id) rn
    from x
  )
  select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise
  from ranked where rn=1;

  -- [por-planilha] edital já cadastrado por outra planilha: recusa.
  select count(*)::integer into v_conflitos
  from public."TB_EDITAL_ANALISE" e
  join tmp_editais_incremental x
    on e.grupo_norm=coalesce(public.analises_norm_key(x.grupo),'')
   and e.unidade_norm=coalesce(public.analises_norm_key(x.unidade),'')
   and e.edital_norm=coalesce(public.analises_norm_key(x.edital),'')
  where e."CO_PLANILHA"<>v_planilha;
  if v_conflitos>0 then
    raise exception 'Sync % recusado: % edital(is) do envio ja pertencem a outra planilha.',p_sync_id,v_conflitos
      using errcode = '22023';
  end if;

  insert into public."TB_EDITAL_ANALISE"(grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,"CO_PLANILHA")
  select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,v_planilha
  from tmp_editais_incremental
  on conflict(grupo,unidade,edital) do update set
    ativo=excluded.ativo,
    data_inicio_analise=excluded.data_inicio_analise,
    data_fim_analise=excluded.data_fim_analise,
    updated_at=now()
  where "TB_EDITAL_ANALISE"."CO_PLANILHA"=excluded."CO_PLANILHA";
  get diagnostics v_editais_upsert=row_count;

  -- [por-planilha] só desativa editais desta planilha.
  update public."TB_EDITAL_ANALISE" e
  set ativo=false,updated_at=now()
  where e.ativo is true
    and e."CO_PLANILHA"=v_planilha
    and not exists(select 1 from tmp_editais_incremental x
      where e.grupo is not distinct from x.grupo
        and e.unidade=x.unidade
        and e.edital=x.edital);
  get diagnostics v_editais_inativados=row_count;

  delete from public."TM_ANALISE_CURRICULAR" where sync_id=p_sync_id;
  get diagnostics v_removido=row_count;

  v_result=jsonb_build_object(
    'ok',true,
    'sync_id',p_sync_id,
    'modo_processamento','incremental',
    'planilha',v_planilha,
    'total_ativos_local',v_total_ativos_local,
    'fato_analises_enviadas',v_total_fato,
    'analises_editais_recebidos',v_total_editais,
    'analises_editais_upsert',v_editais_upsert,
    'analises_editais_inativados',v_editais_inativados,
    'staging',v_total_staging,
    'staging_removido',v_removido,
    'historico_inativado',0
  );

  update public."TL_SYNC_ANALISE"
  set status='processado',resultado=v_result,erro=null,total_processados=v_total_fato,
      finished_at=now(),updated_at=now()
  where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE';

  return v_result;
end;
$function$;

-- 8.4 verificar: conta só a planilha da origem (default = SI). Mesma troca de assinatura do iniciar.
drop function public.verificar_sync_analises_incremental(integer);

CREATE FUNCTION public.verificar_sync_analises_incremental(p_total_ativos_local integer, p_origem text DEFAULT 'apps_script_analises_incremental_v1')
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '10s'
AS $function$
declare
  v_planilha text;
  v_qtd integer;
begin
  -- [por-planilha]
  v_planilha := public."FC_PLANILHA_DA_ORIGEM_ANALISE"(p_origem, null);

  select count(*)::integer into v_qtd
  from public."TB_ANALISE_CURRICULAR" a
  join public."TB_EDITAL_ANALISE" e
    on a.grupo_norm=e.grupo_norm
   and a.unidade_norm=e.unidade_norm
   and a.edital_norm=e.edital_norm
  where a.ativo is true and e.ativo is true
    and a."CO_PLANILHA"=v_planilha
    and e."CO_PLANILHA"=v_planilha;

  return jsonb_build_object(
    'ok',true,
    'planilha',v_planilha,
    'total_ativos_local',greatest(coalesce(p_total_ativos_local,0),0),
    'total_ativos_remoto',v_qtd,
    'reconciliacao_full_recomendada',v_qtd <> greatest(coalesce(p_total_ativos_local,0),0)
  );
end;
$function$;

revoke all on function public.verificar_sync_analises_incremental(integer, text) from public, anon, authenticated;
grant execute on function public.verificar_sync_analises_incremental(integer, text) to service_role;

commit;
