/*
  ROLLBACK de migrations/20260925150000_remove_objetos_mortos.sql

  Recria exatamente o que aquela migration apagou, com as definições lidas do
  banco de produção em 25/09/2026 (pg_get_functiondef, pg_views, pg_trigger,
  pg_policies, ACLs). Não é migration: só rode se precisar desfazer a remoção.
  TA_DASHBOARD_ANALISE e TL_NOTIFICACAO voltam vazias, como estavam.
*/
begin;

-- Tabelas
create table private."TA_DASHBOARD_ANALISE" (
  cache_key text not null,
  payload jsonb not null,
  refreshed_at timestamptz not null default now(),
  constraint analises_dashboard_cache_pkey primary key (cache_key)
);
revoke all on private."TA_DASHBOARD_ANALISE" from public;

create table public."TL_NOTIFICACAO" (
  id uuid not null default gen_random_uuid(),
  id_registro uuid not null,
  tipo text not null,
  enviado_em timestamptz not null default now(),
  enviado_para text,
  enviado_dia date generated always as (((enviado_em at time zone 'America/Sao_Paulo'))::date) stored,
  constraint log_notificacoes_pkey primary key (id),
  constraint log_notificacoes_id_registro_tipo_enviado_dia_key unique (id_registro, tipo, enviado_dia)
);
alter table public."TL_NOTIFICACAO" enable row level security;
revoke all on public."TL_NOTIFICACAO" from public, anon, authenticated, service_role;
grant select on public."TL_NOTIFICACAO" to authenticated;
grant delete, truncate, references, trigger, maintain on public."TL_NOTIFICACAO" to service_role;
create policy log_notif_no_delete on public."TL_NOTIFICACAO" for delete to authenticated using (false);
create policy log_notif_no_insert on public."TL_NOTIFICACAO" for insert to authenticated with check (false);
create policy log_notif_no_update on public."TL_NOTIFICACAO" for update to authenticated using (false) with check (false);
create policy log_notif_select on public."TL_NOTIFICACAO" for select to authenticated
  using (private.has_perm('config') or private.has_perm('admin'));

-- Views
create or replace view public."VW_ANALISES_DASHBOARD_POR_EDITAL" with (security_invoker = true) as SELECT grupo,
    unidade,
    edital,
    (count(*))::integer AS total_candidatos,
    (count(*) FILTER (WHERE (status_consolidado = 'Pendente'::text)))::integer AS pendentes,
    (count(*) FILTER (WHERE (status_consolidado = 'Revisar'::text)))::integer AS revisar,
    (count(*) FILTER (WHERE (status_consolidado = 'Aprovado'::text)))::integer AS aprovados,
    (count(*) FILTER (WHERE (status_consolidado = 'Reprovado'::text)))::integer AS reprovados,
    (count(*) FILTER (WHERE ((link_pdf IS NOT NULL) AND (btrim(link_pdf) <> ''::text))))::integer AS com_pdf,
    (count(*) FILTER (WHERE ((link_pdf IS NULL) OR (btrim(link_pdf) = ''::text))))::integer AS sem_pdf,
    min(data_analise) AS primeira_analise,
    max(data_analise) AS ultima_analise,
    max(updated_at) AS updated_at
   FROM "VW_ANALISES_DASHBOARD_BASE"
  WHERE (edital_ativo IS TRUE)
  GROUP BY grupo, unidade, edital;

create or replace view public."VW_ANALISES_KPIS" with (security_invoker = true) as SELECT (count(*))::integer AS total_candidatos,
    (count(*) FILTER (WHERE (status_consolidado = 'Pendente'::text)))::integer AS pendentes,
    (count(*) FILTER (WHERE (status_consolidado = 'Revisar'::text)))::integer AS revisar,
    (count(*) FILTER (WHERE (status_consolidado = 'Aprovado'::text)))::integer AS aprovados,
    (count(*) FILTER (WHERE (status_consolidado = 'Reprovado'::text)))::integer AS reprovados,
    (count(*) FILTER (WHERE (status_consolidado = ANY (ARRAY['Revisar'::text, 'Aprovado'::text, 'Reprovado'::text]))))::integer AS analisados,
    (count(*) FILTER (WHERE ((link_pdf IS NOT NULL) AND (btrim(link_pdf) <> ''::text))))::integer AS com_pdf,
    (count(*) FILTER (WHERE ((link_pdf IS NULL) OR (btrim(link_pdf) = ''::text))))::integer AS sem_pdf,
    (count(*) FILTER (WHERE (upper(COALESCE(pdf_status, ''::text)) = 'ERRO'::text)))::integer AS pdf_com_erro,
    (count(*) FILTER (WHERE (data_validacao_status = 'FORA_PERIODO'::text)))::integer AS fora_periodo,
    (count(*) FILTER (WHERE (data_validacao_status = 'SEM_JANELA'::text)))::integer AS sem_janela,
    round(
        CASE
            WHEN (count(*) > 0) THEN (((count(*) FILTER (WHERE (status_consolidado = ANY (ARRAY['Aprovado'::text, 'Reprovado'::text]))))::numeric / (count(*))::numeric) * (100)::numeric)
            ELSE (0)::numeric
        END, 2) AS pct_decididos,
    max(ultima_atualizacao) AS ultima_atualizacao
   FROM "VW_ANALISES_DASHBOARD_BASE"
  WHERE (edital_ativo IS TRUE);

create or replace view public."VW_ANALISES_POR_RESPONSAVEL" with (security_invoker = true) as SELECT COALESCE(NULLIF(btrim(responsavel_analise), ''::text), 'Sem responsavel'::text) AS responsavel_analise,
    (count(*))::integer AS total,
    (count(*) FILTER (WHERE (status_consolidado = 'Pendente'::text)))::integer AS pendentes,
    (count(*) FILTER (WHERE (status_consolidado = 'Revisar'::text)))::integer AS revisar,
    (count(*) FILTER (WHERE (status_consolidado = 'Aprovado'::text)))::integer AS aprovados,
    (count(*) FILTER (WHERE (status_consolidado = 'Reprovado'::text)))::integer AS reprovados,
    (count(*) FILTER (WHERE (data_validacao_status = 'FORA_PERIODO'::text)))::integer AS fora_periodo,
    (count(*) FILTER (WHERE ((link_pdf IS NULL) OR (btrim(link_pdf) = ''::text))))::integer AS sem_pdf,
    max(ultima_atualizacao) AS ultima_atualizacao
   FROM "VW_ANALISES_DASHBOARD_BASE"
  WHERE (edital_ativo IS TRUE)
  GROUP BY COALESCE(NULLIF(btrim(responsavel_analise), ''::text), 'Sem responsavel'::text);

create or replace view public."VW_ANALISES_TENDENCIA_DIARIA" with (security_invoker = true) as SELECT data_analise,
    (count(*))::integer AS total_analises,
    (count(*) FILTER (WHERE (data_validacao_status = 'FORA_PERIODO'::text)))::integer AS fora_periodo,
    (count(*) FILTER (WHERE (status_consolidado = 'Aprovado'::text)))::integer AS aprovados,
    (count(*) FILTER (WHERE (status_consolidado = 'Reprovado'::text)))::integer AS reprovados,
    (count(*) FILTER (WHERE (status_consolidado = 'Revisar'::text)))::integer AS revisar
   FROM "VW_ANALISES_DASHBOARD_BASE"
  WHERE ((data_analise IS NOT NULL) AND (edital_ativo IS TRUE))
  GROUP BY data_analise;

create or replace view public."VW_AUDITORIA_ACESSOS_DIARIA" as SELECT ((created_at AT TIME ZONE 'America/Sao_Paulo'::text))::date AS data_acesso,
    origem,
    tela,
    evento,
    (count(*))::integer AS total_eventos,
    (count(DISTINCT user_id))::integer AS usuarios_distintos,
    (count(DISTINCT client_session_id))::integer AS sessoes_distintas,
    max(created_at) AS ultimo_evento
   FROM "TL_EVENTO_ACESSO"
  GROUP BY (((created_at AT TIME ZONE 'America/Sao_Paulo'::text))::date), origem, tela, evento;


revoke all on public."VW_ANALISES_DASHBOARD_POR_EDITAL", public."VW_ANALISES_KPIS",
  public."VW_ANALISES_POR_RESPONSAVEL", public."VW_ANALISES_TENDENCIA_DIARIA",
  public."VW_AUDITORIA_ACESSOS_DIARIA" from public, anon, authenticated, service_role;
grant select on public."VW_ANALISES_DASHBOARD_POR_EDITAL", public."VW_ANALISES_KPIS",
  public."VW_ANALISES_POR_RESPONSAVEL", public."VW_ANALISES_TENDENCIA_DIARIA",
  public."VW_AUDITORIA_ACESSOS_DIARIA" to authenticated;
grant select, delete, truncate, references, trigger, maintain on public."VW_ANALISES_DASHBOARD_POR_EDITAL" to service_role;
grant delete, truncate, references, trigger, maintain on public."VW_ANALISES_KPIS",
  public."VW_ANALISES_POR_RESPONSAVEL", public."VW_ANALISES_TENDENCIA_DIARIA",
  public."VW_AUDITORIA_ACESSOS_DIARIA" to service_role;

-- Funções
CREATE OR REPLACE FUNCTION public.get_analises_dashboard_contadores()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'ativos', count(*) filter (where ativo is true),
    'inativos', count(*) filter (where ativo is false),
    'todos', count(*)
  )
  from public."VW_ANALISES_DASHBOARD_BASE" where private.pode_recurso('analises');
$function$
;

CREATE OR REPLACE FUNCTION public.get_analises_dashboard_payload()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
 SET statement_timeout TO '8s'
AS $function$
declare
  v_payload jsonb;
  v_ttl_minutes integer := 5;
  v_can_view boolean;
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  select (
    private.pode_recurso('analises')
  ) into v_can_view;

  if not coalesce(v_can_view, false) then
    raise exception 'Sem permissao para visualizar painel de analises';
  end if;

  select least(greatest(coalesce(nullif(valor, '')::integer, 5), 1), 120)
  into v_ttl_minutes
  from public."TB_CONFIGURACAO"
  where chave = 'analises_cache_ttl_minutos'
  limit 1;

  v_ttl_minutes := coalesce(v_ttl_minutes, 5);

  select c.payload
  into v_payload
  from private."TA_DASHBOARD_ANALISE" c
  where c.cache_key = 'payload'
    and c.refreshed_at >= now() - make_interval(mins => v_ttl_minutes);

  if v_payload is not null then
    return v_payload || jsonb_build_object(
      'cache', jsonb_build_object(
        'hit', true,
        'refreshed_at', (
          select refreshed_at
          from private."TA_DASHBOARD_ANALISE"
          where cache_key = 'payload'
        )
      )
    );
  end if;

  select jsonb_build_object(
    'kpis', coalesce((select to_jsonb(k) from public."VW_ANALISES_KPIS" k limit 1), '{}'::jsonb),
    'por_responsavel', coalesce((select jsonb_agg(to_jsonb(r) order by r.total desc, r.responsavel_analise) from public."VW_ANALISES_POR_RESPONSAVEL" r), '[]'::jsonb),
    'tendencia_diaria', coalesce((select jsonb_agg(to_jsonb(t) order by t.data_analise) from public."VW_ANALISES_TENDENCIA_DIARIA" t), '[]'::jsonb),
    'por_edital', coalesce((select jsonb_agg(to_jsonb(e) order by e.unidade, e.edital) from public."VW_ANALISES_DASHBOARD_POR_EDITAL" e), '[]'::jsonb),
    'config', coalesce((
      select jsonb_object_agg(chave, valor order by chave)
      from public."TB_CONFIGURACAO"
      where chave in (
        'app_version_current',
        'analises_cache_ttl_minutos',
        'access_heartbeat_minutos',
        'password_reset_flow'
      )
    ), '{}'::jsonb),
    'cache', jsonb_build_object(
      'hit', false,
      'refreshed_at', now()
    )
  ) into v_payload;

  insert into private."TA_DASHBOARD_ANALISE"(cache_key, payload, refreshed_at)
  values ('payload', v_payload, now())
  on conflict (cache_key) do update
    set payload = excluded.payload,
        refreshed_at = excluded.refreshed_at;

  return v_payload;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_analises_dashboard_recorte(p_situacao text DEFAULT 'Ativo'::text, p_limit integer DEFAULT 1000, p_offset integer DEFAULT 0)
 RETURNS SETOF "VW_ANALISES_DASHBOARD_BASE_TODOS"
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select *
  from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
  where private.pode_recurso('analises') and
    case
      when coalesce(p_situacao, 'Ativo') = 'Ativo' then v.ativo is true
      when coalesce(p_situacao, 'Ativo') = 'Inativo' then v.ativo is false
      else true
    end
  order by
    v.unidade asc,
    v.edital asc,
    v.codigo_vaga asc,
    v.candidato asc
  limit greatest(1, least(coalesce(p_limit, 1000), 2000))
  offset greatest(0, coalesce(p_offset, 0));
$function$
;

CREATE OR REPLACE FUNCTION private.invalidate_analises_dashboard_cache()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'pg_temp'
AS $function$
begin
  delete from private."TA_DASHBOARD_ANALISE"
  where cache_key = 'payload';

  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.monitora_role_in(p_roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(private.monitora_role() = any(p_roles), false);
$function$
;

CREATE OR REPLACE FUNCTION public.salvar_monitoramento_indigena(p_payload jsonb)
 RETURNS "TB_MONITORAMENTO_INDIGENA"
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_id uuid;
  v_row public."TB_MONITORAMENTO_INDIGENA";
begin
  if not ((private.pode_recurso('nucleo',2) or private.pode_recurso('calendario',2))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if not private.has_perm('cores') then
    raise exception 'Sem permissao para salvar monitoramento indigena';
  end if;

  v_id := nullif(p_payload ->> 'id', '')::uuid;

  if v_id is null then
    insert into public."TB_MONITORAMENTO_INDIGENA"(
      processo, edital, id_unidade, sigla_unidade, tipo_unidade, unidade, uf, ciclo,
      vagas_total, data_inicio, data_fim, status, etapa, risco, responsavel,
      link_edital, observacoes, observacoes_internas, ativo, created_by, updated_by
    ) values (
      nullif(p_payload ->> 'processo', ''),
      nullif(p_payload ->> 'edital', ''),
      nullif(p_payload ->> 'id_unidade', ''),
      nullif(p_payload ->> 'sigla_unidade', ''),
      nullif(p_payload ->> 'tipo_unidade', ''),
      nullif(p_payload ->> 'unidade', ''),
      nullif(upper(p_payload ->> 'uf'), ''),
      nullif(p_payload ->> 'ciclo', ''),
      coalesce(nullif(p_payload ->> 'vagas_total', '')::integer, 0),
      nullif(p_payload ->> 'data_inicio', '')::date,
      nullif(p_payload ->> 'data_fim', '')::date,
      nullif(p_payload ->> 'status', ''),
      nullif(p_payload ->> 'etapa', ''),
      coalesce(nullif(p_payload ->> 'risco', ''), 'Baixo'),
      nullif(p_payload ->> 'responsavel', ''),
      nullif(p_payload ->> 'link_edital', ''),
      nullif(p_payload ->> 'observacoes', ''),
      nullif(p_payload ->> 'observacoes_internas', ''),
      coalesce((p_payload ->> 'ativo')::boolean, true),
      auth.uid(),
      auth.uid()
    ) returning * into v_row;
  else
    update public."TB_MONITORAMENTO_INDIGENA"
    set
      processo = nullif(p_payload ->> 'processo', ''),
      edital = nullif(p_payload ->> 'edital', ''),
      id_unidade = nullif(p_payload ->> 'id_unidade', ''),
      sigla_unidade = nullif(p_payload ->> 'sigla_unidade', ''),
      tipo_unidade = nullif(p_payload ->> 'tipo_unidade', ''),
      unidade = nullif(p_payload ->> 'unidade', ''),
      uf = nullif(upper(p_payload ->> 'uf'), ''),
      ciclo = nullif(p_payload ->> 'ciclo', ''),
      vagas_total = coalesce(nullif(p_payload ->> 'vagas_total', '')::integer, 0),
      data_inicio = nullif(p_payload ->> 'data_inicio', '')::date,
      data_fim = nullif(p_payload ->> 'data_fim', '')::date,
      status = nullif(p_payload ->> 'status', ''),
      etapa = nullif(p_payload ->> 'etapa', ''),
      risco = coalesce(nullif(p_payload ->> 'risco', ''), 'Baixo'),
      responsavel = nullif(p_payload ->> 'responsavel', ''),
      link_edital = nullif(p_payload ->> 'link_edital', ''),
      observacoes = nullif(p_payload ->> 'observacoes', ''),
      observacoes_internas = nullif(p_payload ->> 'observacoes_internas', ''),
      ativo = coalesce((p_payload ->> 'ativo')::boolean, true),
      updated_by = auth.uid()
    where id = v_id
    returning * into v_row;
  end if;

  if v_row.id is null then
    raise exception 'Registro nao encontrado ou nao salvo';
  end if;

  return v_row;
end;
$function$
;


revoke all on function public.get_analises_dashboard_payload() from public, anon, authenticated, service_role;
revoke all on function public.get_analises_dashboard_contadores() from public, anon, authenticated, service_role;
revoke all on function public.get_analises_dashboard_recorte(text, integer, integer) from public, anon, authenticated, service_role;
revoke all on function public.salvar_monitoramento_indigena(jsonb) from public, anon, service_role;
grant execute on function public.salvar_monitoramento_indigena(jsonb) to authenticated;
revoke all on function private.monitora_role_in(text[]) from public, anon, service_role;
grant execute on function private.monitora_role_in(text[]) to authenticated;

-- Gatilhos
CREATE TRIGGER trg_invalidate_analises_dashboard_cache_curriculares AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public."TB_ANALISE_CURRICULAR" FOR EACH STATEMENT EXECUTE FUNCTION private.invalidate_analises_dashboard_cache();
CREATE TRIGGER trg_invalidate_analises_dashboard_cache_editais AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public."TB_EDITAL_ANALISE" FOR EACH STATEMENT EXECUTE FUNCTION private.invalidate_analises_dashboard_cache();
CREATE TRIGGER trg_invalidate_analises_dashboard_cache_configuracoes AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public."TB_CONFIGURACAO" FOR EACH STATEMENT EXECUTE FUNCTION private.invalidate_analises_dashboard_cache();

commit;
