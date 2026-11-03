/*
  ROLLBACK de 20261103230000_presenca_enxuta.sql

  Volta registrar_navegacao_monitora aos nove parâmetros (20261029121700) e "online" a 4 min.
  O front desta versão percebe a função sem p_eventos/p_listar (PGRST202) e volta a chamar a
  lista e os eventos à parte; a batida de 150 s com "online" de 4 min deixaria quem perde uma
  batida fora da lista, então o rollback do banco anda junto com o do front (INTERVALO_DA_PRESENCA_MS
  de volta a 90 s). Nada de dado a desfazer.
*/
begin;

set local lock_timeout = '5s';

drop function if exists public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text, jsonb, boolean);

create function public.registrar_navegacao_monitora(
  p_evento text default null,
  p_tela text default null,
  p_detalhes jsonb default '{}'::jsonb,
  p_client_session_id text default null,
  p_user_agent text default null,
  p_app_version text default null,
  p_origem text default 'index',
  p_presenca boolean default true,
  p_current_view text default null
)
 returns jsonb
 language plpgsql
 security invoker
 set search_path to ''
 set statement_timeout to '3s'
as $function$
declare
  v_evento_id bigint;
  v_presenca jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sessao nao localizada.' using errcode = '28000';
  end if;

  if nullif(btrim(p_evento), '') is not null then
    v_evento_id := public.registrar_evento_acesso(
      p_evento, p_tela, p_origem, p_detalhes,
      p_client_session_id, p_user_agent, p_app_version
    );
  end if;

  if p_presenca then
    begin
      v_presenca := public.registrar_presenca_monitora(p_current_view);
    exception when others then
      v_presenca := jsonb_build_object(
        'presenca_erro', jsonb_build_object('codigo', sqlstate, 'mensagem', sqlerrm)
      );
    end;
  end if;

  return coalesce(v_presenca, '{}'::jsonb) || jsonb_build_object('evento_id', v_evento_id);
end;
$function$;

comment on function public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text) is
  'Uma chamada por navegação: o evento de auditoria (registrar_evento_acesso) e a presença (registrar_presenca_monitora, com a versão do catálogo de abas). Falha da presença volta em presenca_erro e não desfaz o evento.';

revoke all on function public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text) from public, anon;
grant execute on function public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text) to authenticated;

create or replace function public.listar_presenca_online_monitora()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_result jsonb;
  v_user_id uuid := (select auth.uid());
  v_email text := coalesce((select auth.jwt() ->> 'email'), '');
begin
  if v_user_id is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;

  if not (
    private.is_master()
    or exists (
      select 1 from public."TB_PERFIL_USUARIO" p
       where p.ativo is true
         and lower(coalesce(p.perfil, '')) = 'edital_gestor'
         and (p.user_id = v_user_id or lower(p.email) = lower(v_email))
    )
  ) then
    raise exception 'Acesso restrito ao administrador global e ao Gestor.'
      using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(person) order by person."fullName", person."userId"), '[]'::jsonb)
    into v_result
    from (
      select po.user_id as "userId",
             coalesce(nullif(trim(p.nome), ''), split_part(coalesce(p.email, ''), '@', 1), 'Usuário AgSUS') as "fullName",
             coalesce(case when p.avatar_source in ('GOOGLE', 'UPLOADED') then p.avatar_url end,
                      p.google_avatar_url) as "avatarUrl",
             initcap(coalesce(nullif(p.perfil, ''), 'Usuário')) as "profileLabel",
             po.current_view as "currentView",
             po.seen_at as "onlineAt"
        from public."TB_PRESENCA_ONLINE_MONITORA" po
        join lateral (
          select profile.* from public."TB_PERFIL_USUARIO" profile
           where profile.ativo is true
             and (profile.user_id = po.user_id
                  or lower(profile.email) = lower(coalesce(
                    (select email from auth.users where id = po.user_id), '')))
           order by case when profile.user_id = po.user_id then 0 else 1 end,
                    profile.updated_at desc nulls last
           limit 1
        ) p on true
       where po.seen_at > timezone('utc', now()) - interval '4 minutes'
       order by po.seen_at desc
       limit 200
    ) person;
  return v_result;
end;
$function$;

comment on function public.listar_presenca_online_monitora() is
  'Lista quem está online agora (presença nos últimos 4 min). Só administrador global ou Gestor.';

commit;
