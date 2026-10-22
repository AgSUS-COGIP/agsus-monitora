/*
  DATAS NO FUSO DE BRASÍLIA E ACENTOS QUEBRADOS (auditoria do back-end, 06/10/2026)

  1. "HOJE" EM UTC (médio)
     O banco roda em UTC. get_monitoramento_cronograma e get_nucleo_cronograma_resumo
     calculavam o estado do cronograma (etapa atual, próxima atividade, "dias para
     a próxima", alertas de 3 e 7 dias) com current_date: das 21h à meia-noite de
     Brasília o Núcleo e o formulário já viam o dia seguinte. Agora o dia é
     (now() at time zone 'America/Sao_Paulo')::date, como no resto do banco.
     obter_marcos_da_area: o "ano" e as concluídas no ano também pelo fuso de
     Brasília (na noite de 31/12 o marco virava o ano antes da hora).
     As duas do cronograma passam a search_path = '' (todas as referências já
     eram qualificadas).

  2. ACENTOS EM DUPLA CODIFICAÇÃO
     Textos gravados em UTF-8 lido como Latin-1 ("SessÃ£o", "ConfiguraÃ§Ãµes"):
       - set_my_avatar_choice: as mensagens de erro (passa a search_path = '';
         referências já qualificadas);
       - restaurar_configuracoes_versao: o motivo padrão gravado no histórico;
       - get_acessos_config_master: os nomes das telas;
       - private.definir_fundo_acesso_monitora: "Caminho de armazenamento inválido".
     restaurar_configuracoes_versao e get_acessos_config_master só ganham pg_temp
     no fim do search_path (ver 20261006150000).

  Corpos iguais aos do banco em 06/10/2026, salvo o descrito acima. Assinaturas,
  grants e comentários não mudam (src/lib/rpc-contrato.js não muda).
*/
begin;

-- get_monitoramento_cronograma
CREATE OR REPLACE FUNCTION public.get_monitoramento_cronograma(p_monitoramento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then
    raise exception 'Sem permissao para consultar cronograma';
  end if;

  if exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_monitoramento_id and not private."FC_PODE_VER_EDITAL"(m.id)) then
    raise exception 'Sem permissão para editais desta área' using errcode='42501';
  end if;

  return jsonb_build_object(
    'monitoramento', (
      select jsonb_build_object(
        'id', m.id,
        'edital', m.edital,
        'unidade', m.unidade,
        'cronograma_automatico', m.cronograma_automatico,
        'cronograma_origem', m.cronograma_origem,
        'cronograma_revisado_at', m.cronograma_revisado_at,
        'status_override', m.status_override,
        'etapa_override', m.etapa_override,
        'status_override_motivo', m.status_override_motivo,
        'status_override_data', m.status_override_data,
        'status_override_previsao_retomada', m.status_override_previsao_retomada,
        'cronograma_ultima_errata', m.cronograma_ultima_errata
      )
      from public."TB_MONITORAMENTO_INDIGENA" m
      where m.id = p_monitoramento_id
    ),
    'estado', public.get_monitoramento_cronograma_estado(p_monitoramento_id, (now() at time zone 'America/Sao_Paulo')::date),
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'ordem', c.ordem,
        'atividade', c.atividade,
        'tipo_atividade', c.tipo_atividade,
        'data_inicio', c.data_inicio,
        'data_fim', c.data_fim,
        'concluida', c.concluida,
        'observacao', c.observacao,
        'origem', c.origem,
        'confianca_extracao', c.confianca_extracao
      ) order by c.ordem)
      from public."TB_CRONOGRAMA_MONIT_INDIG" c
      where c.monitoramento_id = p_monitoramento_id
    ), '[]'::jsonb),
    'historico', public.get_monitoramento_cronograma_historico(p_monitoramento_id, 20)
  );
end;
$function$;

-- get_nucleo_cronograma_resumo
CREATE OR REPLACE FUNCTION public.get_nucleo_cronograma_resumo()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then
    raise exception 'Sem permissao para consultar resumo da Equipe Nucleo';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id,
      'edital', m.edital,
      'unidade', m.unidade,
      'status', e ->> 'status',
      'etapa', e ->> 'etapa',
      'cronograma_automatico', m.cronograma_automatico,
      'cronograma_total', coalesce(c.total, 0),
      'tem_resultado_final', coalesce(c.tem_resultado_final, false),
      'percentual', coalesce((e ->> 'percentual')::numeric, 0),
      'proxima_atividade', e ->> 'proxima_atividade',
      'proxima_data', e ->> 'proxima_data',
      'dias_para_proxima', (e ->> 'dias_para_proxima')::integer,
      'status_override', m.status_override,
      'alerta_tipo', case
        when nullif(m.status_override, '') is not null then 'excepcional'
        when not m.cronograma_automatico or coalesce(c.total, 0) = 0 then 'sem_cronograma'
        when coalesce(c.total, 0) < 2 or not coalesce(c.tem_resultado_final, false) then 'incompleto'
        when (e ->> 'dias_para_proxima')::integer between 0 and 3 then 'proxima_3d'
        when (e ->> 'dias_para_proxima')::integer between 4 and 7 then 'proxima_7d'
        else 'ok'
      end
    ) order by m.unidade, m.edital)
    from public."TB_MONITORAMENTO_INDIGENA" m
    cross join lateral public.get_monitoramento_cronograma_estado(m.id, (now() at time zone 'America/Sao_Paulo')::date) e
    left join lateral (
      select
        count(*)::integer as total,
        bool_or(lower(atividade) like '%resultado final%') as tem_resultado_final
      from public."TB_CRONOGRAMA_MONIT_INDIG" c
      where c.monitoramento_id = m.id
    ) c on true
    where m.ativo is true
      and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
  ), '[]'::jsonb);
end;
$function$;

-- obter_marcos_da_area
CREATE OR REPLACE FUNCTION public.obter_marcos_da_area(p_area text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  return (
    select json_build_object(
      'area', p_area,
      'ano', extract(year from now() at time zone 'America/Sao_Paulo')::integer,
      'concluidas_no_ano', count(*) filter (where v.data_analise >= date_trunc('year', now() at time zone 'America/Sao_Paulo')::date),
      'concluidas_total', count(*),
      'gerado_em', now())
      from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
      join public."TB_ANALISE_CURRICULAR" a on a.id = v.id
     where a."CO_AREA" = p_area
       and (v.edital_ativo is false or v.ativo is true)
       and v.status_consolidado in ('Aprovado', 'Reprovado')
  );
end;
$function$;

-- set_my_avatar_choice
CREATE OR REPLACE FUNCTION public.set_my_avatar_choice(p_source text, p_avatar_url text DEFAULT NULL::text, p_avatar_config jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(avatar_source text, avatar_url text, avatar_config jsonb, google_avatar_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare
  v_source text := upper(trim(coalesce(p_source, '')));
  v_url text := nullif(trim(coalesce(p_avatar_url, '')), '');
  v_config jsonb := coalesce(p_avatar_config, '{}'::jsonb);
begin
  if auth.uid() is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;

  if v_source not in ('GOOGLE', 'UPLOADED', 'GENERATED', 'INITIALS') then
    raise exception 'Origem de avatar inválida.' using errcode = '22023';
  end if;

  if v_source in ('GOOGLE', 'UPLOADED')
    and (v_url is null or v_url !~* '^https://') then
    raise exception 'A imagem selecionada precisa usar HTTPS.' using errcode = '22023';
  end if;

  if v_url is not null and length(v_url) > 2048 then
    raise exception 'URL de avatar inválida.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_config) <> 'object' then
    raise exception 'Configuração de avatar inválida.' using errcode = '22023';
  end if;

  update public."TB_PERFIL_USUARIO" p
  set
    avatar_source = v_source,
    avatar_url = case
      when v_source in ('GOOGLE', 'UPLOADED') then v_url
      else null
    end,
    avatar_config = case
      when v_source = 'GENERATED' then v_config
      else p.avatar_config
    end,
    google_avatar_url = case
      when v_source = 'GOOGLE' then v_url
      else p.google_avatar_url
    end,
    updated_at = now()
  where p.ativo = true
    and (
      p.user_id = auth.uid()
      or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );

  if not found then
    raise exception 'Perfil institucional não localizado.' using errcode = 'P0002';
  end if;

  return query
  select
    p.avatar_source,
    p.avatar_url,
    p.avatar_config,
    coalesce(
      p.google_avatar_url,
      auth.jwt() -> 'user_metadata' ->> 'avatar_url',
      auth.jwt() -> 'user_metadata' ->> 'picture'
    )
  from public."TB_PERFIL_USUARIO" p
  where p.ativo = true
    and (
      p.user_id = auth.uid()
      or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  limit 1;
end;
$function$;

-- restaurar_configuracoes_versao
CREATE OR REPLACE FUNCTION public.restaurar_configuracoes_versao(p_versao_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
 SET lock_timeout TO '5s'
AS $function$
declare
  r jsonb;
  v_target public."TH_CONFIGURACAO"%rowtype;
  v_id uuid;
  v_config_antes jsonb;
  v_config_depois jsonb;
  v_paineis_antes jsonb;
  v_paineis_depois jsonb;
  v_alteracoes jsonb;
  v_total integer;
begin
  if not (private.pode_recurso('configuracoes',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if not private.has_perm('config') then
    raise exception 'Sem permissao para restaurar "TB_CONFIGURACAO"';
  end if;

  if p_versao_id is null then
    raise exception 'Versao obrigatoria';
  end if;

  if not pg_try_advisory_xact_lock(hashtext('public.salvar_configuracoes_e_paineis_v2')::bigint) then
    raise exception 'Outra publicacao de "TB_CONFIGURACAO" esta em andamento. Aguarde e tente novamente.';
  end if;

  select * into v_target
  from public."TH_CONFIGURACAO"
  where id = p_versao_id;

  if not found then
    raise exception 'Versao de "TB_CONFIGURACAO" nao encontrada';
  end if;

  v_config_antes := private.snapshot_configuracoes();
  v_paineis_antes := private.snapshot_paineis_externos();
  v_alteracoes := private.diff_configuracoes_e_paineis(v_target.config_depois, v_target.paineis_depois);
  v_total := jsonb_array_length(v_alteracoes);

  if v_total = 0 then
    return jsonb_build_object(
      'ok', true,
      'sem_alteracoes', true,
      'total_alteracoes', 0,
      'versao_id', null,
      'restaurada_de', p_versao_id
    );
  end if;

  for r in select * from jsonb_array_elements(v_target.config_depois) loop
    insert into public."TB_CONFIGURACAO"(chave, valor, descricao)
    values (r ->> 'chave', r ->> 'valor', r ->> 'descricao')
    on conflict (chave) do update
      set valor = excluded.valor,
          descricao = excluded.descricao,
          updated_at = now();
  end loop;

  for r in select * from jsonb_array_elements(v_target.paineis_depois) loop
    update public."TB_PAINEL_EXTERNO"
    set titulo = coalesce(nullif(r ->> 'titulo', ''), titulo),
        url = r ->> 'url',
        ativo = coalesce((r ->> 'ativo')::boolean, ativo),
        em_manutencao = coalesce((r ->> 'em_manutencao')::boolean, em_manutencao),
        updated_at = now()
    where id = nullif(r ->> 'id', '')::uuid;
  end loop;

  v_config_depois := private.snapshot_configuracoes();
  v_paineis_depois := private.snapshot_paineis_externos();

  insert into public."TH_CONFIGURACAO"(
    acao,
    motivo,
    created_by,
    created_by_email,
    restaurada_de,
    config_antes,
    config_depois,
    paineis_antes,
    paineis_depois,
    alteracoes,
    total_alteracoes
  ) values (
    'restaurar',
    coalesce(nullif(btrim(p_motivo), ''), 'Restauração de versão anterior'),
    auth.uid(),
    nullif(auth.jwt() ->> 'email', ''),
    p_versao_id,
    v_config_antes,
    v_config_depois,
    v_paineis_antes,
    v_paineis_depois,
    v_alteracoes,
    v_total
  ) returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'sem_alteracoes', false,
    'total_alteracoes', v_total,
    'versao_id', v_id,
    'restaurada_de', p_versao_id,
    'alteracoes', v_alteracoes,
    'restaurado_em', now()
  );
end;
$function$;

-- get_acessos_config_master
CREATE OR REPLACE FUNCTION public.get_acessos_config_master(p_online_minutes integer DEFAULT 15, p_recent_limit integer DEFAULT 20, p_days integer DEFAULT 14)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
 SET statement_timeout TO '5s'
 SET lock_timeout TO '2s'
AS $function$
declare
  v_online_minutes integer := least(greatest(coalesce(p_online_minutes, 15), 1), 120);
  v_recent_limit integer := least(greatest(coalesce(p_recent_limit, 20), 1), 100);
  v_days integer := least(greatest(coalesce(p_days, 14), 1), 90);
  v_is_master boolean;
  v_result jsonb;
begin
  if not (private.is_master()) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  select exists (
    select 1
    from public."TB_PERFIL_USUARIO" p
    where p.ativo is true
      and lower(coalesce(p.perfil, '')) = 'admin'
      and (
        p.user_id = auth.uid()
        or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  ) into v_is_master;

  if not coalesce(v_is_master, false) then
    raise exception 'Sem permissao para visualizar acessos do sistema';
  end if;

  with params as (
    select
      now() as agora_utc,
      now() at time zone 'America/Sao_Paulo' as agora_sp,
      make_interval(mins => v_online_minutes) as janela_online,
      make_interval(days => v_days) as janela_dias
  ),
  resumo_base as (
    select
      (select count(*) from auth.users where deleted_at is null) as usuarios_auth_total,
      (select count(*) from public."TB_PERFIL_USUARIO") as perfis_total,
      (select count(*) from public."TB_PERFIL_USUARIO" where ativo is true) as perfis_ativos,
      (select count(*) from public."TL_EVENTO_ACESSO") as eventos_total,
      (select count(distinct user_id) from public."TL_EVENTO_ACESSO" where user_id is not null) as usuarios_com_evento_total,
      (
        select count(distinct user_id)
        from public."TL_EVENTO_ACESSO"
        where user_id is not null
          and (created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
      ) as usuarios_unicos_hoje,
      (
        select count(*)
        from public."TL_EVENTO_ACESSO"
        where (created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
      ) as eventos_hoje,
      (
        select count(distinct user_id)
        from public."TL_EVENTO_ACESSO", params
        where user_id is not null
          and created_at >= params.agora_utc - params.janela_online
      ) as usuarios_online
  ),
  resumo as (
    select jsonb_build_object(
      'usuarios_auth_total', usuarios_auth_total,
      'perfis_total', perfis_total,
      'perfis_ativos', perfis_ativos,
      'eventos_total', eventos_total,
      'usuarios_com_evento_total', usuarios_com_evento_total,
      'usuarios_unicos_hoje', usuarios_unicos_hoje,
      'usuarios_hoje', usuarios_unicos_hoje,
      'eventos_hoje', eventos_hoje,
      'usuarios_online', usuarios_online,
      'online_agora', usuarios_online,
      'janela_online_minutos', v_online_minutes,
      'retencao_heartbeat_dias', 30,
      'retencao_eventos_dias', 365
    ) as dados
    from resumo_base
  ),
  online as (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.ultima_atividade desc), '[]'::jsonb) as dados
    from (
      select
        e.user_id,
        coalesce(p.nome, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', u.email) as nome,
        coalesce(p.email, u.email) as email,
        p.perfil,
        max(e.created_at) as ultima_atividade,
        max(e.created_at) as ultimo_acesso,
        max(e.created_at) at time zone 'America/Sao_Paulo' as ultima_atividade_sp,
        max(e.created_at) at time zone 'America/Sao_Paulo' as ultimo_acesso_sp,
        (array_agg(case
          when e.tela is null or btrim(e.tela) = '' then coalesce(e.evento, '-')
          when e.tela = 'dashboard' then 'Dashboard'
          when e.tela = 'config' then 'Configurações'
          when e.tela = 'nucleo' then 'Equipe Núcleo'
          when e.tela = 'analises' then 'Análises'
          when e.tela = 'oauth' then 'Login Google'
          when e.tela = 'panel:analises' then 'Painel: Análises'
          when e.tela like 'panel:%' then 'Painel: ' || initcap(replace(substring(e.tela from 7), '_', ' '))
          else initcap(replace(e.tela, '_', ' '))
        end order by e.created_at desc))[1] as ultimo_evento,
        (array_agg(e.evento order by e.created_at desc))[1] as tipo_ultimo_evento,
        (array_agg(e.tela order by e.created_at desc))[1] as ultima_tela,
        (array_agg(case
          when e.tela is null or btrim(e.tela) = '' then coalesce(e.evento, '-')
          when e.tela = 'dashboard' then 'Dashboard'
          when e.tela = 'config' then 'Configurações'
          when e.tela = 'nucleo' then 'Equipe Núcleo'
          when e.tela = 'analises' then 'Análises'
          when e.tela = 'oauth' then 'Login Google'
          when e.tela = 'panel:analises' then 'Painel: Análises'
          when e.tela like 'panel:%' then 'Painel: ' || initcap(replace(substring(e.tela from 7), '_', ' '))
          else initcap(replace(e.tela, '_', ' '))
        end order by e.created_at desc))[1] as tela_atual,
        count(*) as eventos_na_janela,
        count(*) as eventos_online
      from public."TL_EVENTO_ACESSO" e
      join params on true
      left join auth.users u on u.id = e.user_id
      left join public."TB_PERFIL_USUARIO" p on p.user_id = e.user_id
      where e.user_id is not null
        and e.created_at >= params.agora_utc - params.janela_online
      group by e.user_id, p.nome, p.email, p.perfil, u.email, u.raw_user_meta_data
      order by max(e.created_at) desc
      limit v_recent_limit
    ) t
  ),
  recentes as (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.ultima_atividade desc), '[]'::jsonb) as dados
    from (
      select
        e.user_id,
        coalesce(p.nome, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', u.email) as nome,
        coalesce(p.email, u.email) as email,
        p.perfil,
        p.ativo,
        max(e.created_at) as ultima_atividade,
        max(e.created_at) as ultimo_acesso,
        max(e.created_at) at time zone 'America/Sao_Paulo' as ultima_atividade_sp,
        max(e.created_at) at time zone 'America/Sao_Paulo' as ultimo_acesso_sp,
        (array_agg(case
          when e.tela is null or btrim(e.tela) = '' then coalesce(e.evento, '-')
          when e.tela = 'dashboard' then 'Dashboard'
          when e.tela = 'config' then 'Configurações'
          when e.tela = 'nucleo' then 'Equipe Núcleo'
          when e.tela = 'analises' then 'Análises'
          when e.tela = 'oauth' then 'Login Google'
          when e.tela = 'panel:analises' then 'Painel: Análises'
          when e.tela like 'panel:%' then 'Painel: ' || initcap(replace(substring(e.tela from 7), '_', ' '))
          else initcap(replace(e.tela, '_', ' '))
        end order by e.created_at desc))[1] as ultimo_evento,
        (array_agg(e.evento order by e.created_at desc))[1] as tipo_ultimo_evento,
        (array_agg(e.tela order by e.created_at desc))[1] as ultima_tela,
        (array_agg(case
          when e.tela is null or btrim(e.tela) = '' then coalesce(e.evento, '-')
          when e.tela = 'dashboard' then 'Dashboard'
          when e.tela = 'config' then 'Configurações'
          when e.tela = 'nucleo' then 'Equipe Núcleo'
          when e.tela = 'analises' then 'Análises'
          when e.tela = 'oauth' then 'Login Google'
          when e.tela = 'panel:analises' then 'Painel: Análises'
          when e.tela like 'panel:%' then 'Painel: ' || initcap(replace(substring(e.tela from 7), '_', ' '))
          else initcap(replace(e.tela, '_', ' '))
        end order by e.created_at desc))[1] as tela_atual,
        count(*) as total_eventos
      from public."TL_EVENTO_ACESSO" e
      left join auth.users u on u.id = e.user_id
      left join public."TB_PERFIL_USUARIO" p on p.user_id = e.user_id
      where e.user_id is not null
      group by e.user_id, p.nome, p.email, p.perfil, p.ativo, u.email, u.raw_user_meta_data
      order by max(e.created_at) desc
      limit v_recent_limit
    ) t
  ),
  por_dia as (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.dia desc), '[]'::jsonb) as dados
    from (
      select
        (created_at at time zone 'America/Sao_Paulo')::date as dia,
        count(*) as eventos,
        count(distinct user_id) filter (where user_id is not null) as usuarios_unicos,
        count(distinct user_id) filter (where user_id is not null and created_at >= now() - make_interval(mins => v_online_minutes)) as online_maximo,
        count(distinct client_session_id) filter (where client_session_id is not null) as sessoes_cliente
      from public."TL_EVENTO_ACESSO", params
      where created_at >= params.agora_utc - params.janela_dias
      group by 1
      order by 1 desc
      limit v_days
    ) t
  ),
  por_evento as (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.total desc), '[]'::jsonb) as dados
    from (
      select
        evento,
        count(*) as total,
        count(*) filter (where created_at >= now() - interval '7 days') as ultimos_7_dias,
        count(distinct user_id) filter (where user_id is not null) as usuarios_unicos
      from public."TL_EVENTO_ACESSO"
      group by evento
      order by total desc
      limit 20
    ) t
  ),
  armazenamento as (
    select jsonb_build_object(
      'tamanho_total', pg_size_pretty(pg_total_relation_size('public."TL_EVENTO_ACESSO"'::regclass)),
      'total_size', pg_size_pretty(pg_total_relation_size('public."TL_EVENTO_ACESSO"'::regclass)),
      'tamanho_tabela', pg_size_pretty(pg_relation_size('public."TL_EVENTO_ACESSO"'::regclass)),
      'table_size', pg_size_pretty(pg_relation_size('public."TL_EVENTO_ACESSO"'::regclass)),
      'tamanho_indices', pg_size_pretty(pg_indexes_size('public."TL_EVENTO_ACESSO"'::regclass)),
      'index_size', pg_size_pretty(pg_indexes_size('public."TL_EVENTO_ACESSO"'::regclass))
    ) as dados
  )
  select jsonb_build_object(
    'consultado_em_sp', (select agora_sp from params),
    'online_minutes', v_online_minutes,
    'resumo', (select dados from resumo),
    'online', (select dados from online),
    'usuarios_online', (select dados from online),
    'recentes', (select dados from recentes),
    'usuarios_recentes', (select dados from recentes),
    'por_dia', (select dados from por_dia),
    'estatisticas_diarias', (select dados from por_dia),
    'por_evento', (select dados from por_evento),
    'eventos_por_tipo', (select dados from por_evento),
    'armazenamento', (select dados from armazenamento)
  ) into v_result;

  return v_result;
end;
$function$;

-- definir_fundo_acesso_monitora
CREATE OR REPLACE FUNCTION private.definir_fundo_acesso_monitora(p_url text DEFAULT NULL::text, p_caminho text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
  v_caminho text := nullif(btrim(coalesce(p_caminho, '')), '');
begin
  if not private.is_master() then
    raise exception 'Acesso restrito ao perfil Master.' using errcode = '42501';
  end if;
  if (v_url is null) <> (v_caminho is null) then
    raise exception 'Informe a URL e o caminho da arte em conjunto.' using errcode = '22023';
  end if;
  if v_url is not null and v_url not like 'https://%' then
    raise exception 'A imagem precisa ser servida por HTTPS.' using errcode = '22023';
  end if;
  if v_caminho is not null and v_caminho !~ '^branding/[A-Za-z0-9._-]+$' then
    raise exception 'Caminho de armazenamento inválido.' using errcode = '22023';
  end if;

  insert into public."TB_CONFIGURACAO" (chave, valor, descricao)
  values
    ('auth_access_background_url', coalesce(v_url, ''), 'Arte institucional da tela de acesso'),
    ('auth_access_background_path', coalesce(v_caminho, ''), 'Caminho da arte de acesso no Supabase Storage')
  on conflict (chave) do update
  set valor = excluded.valor,
      descricao = excluded.descricao;

  return jsonb_build_object('url', v_url, 'caminho', v_caminho);
end;
$function$;

commit;
