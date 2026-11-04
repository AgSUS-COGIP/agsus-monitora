/*
  PRESENÇA ENXUTA: UMA CHAMADA POR BATIDA, A CADA 150 s (03/11/2026)

  POR QUE
  Nos logs de 03/11/2026 a presença era ~35% das chamadas à API: registrar_presenca_monitora 145,
  registrar_navegacao_monitora 83, registrar_evento_acesso 41 e listar_presenca_online_monitora 32.
  A batida ia a cada 90 s; a lista de "Pessoas online" e o retrato de desempenho do front
  (frontend_performance) saíam em chamadas à parte. A tela passa a bater a cada 150 s, sempre por
  registrar_navegacao_monitora, com a lista e os eventos pendentes de carona.

  O QUE MUDA
    1. public.registrar_navegacao_monitora ganha dois parâmetros, ambos opcionais:
       - p_eventos jsonb: até 10 eventos de auditoria de carona ({evento, tela, origem, detalhes,
         client_session_id, app_version}); cada um vira a mesma linha de registrar_evento_acesso
         em TL_EVENTO_ACESSO. Um evento recusado não desfaz os outros nem a presença;
       - p_listar boolean: devolve, em `pessoas`, a lista de listar_presenca_online_monitora (a
         mesma função, a mesma permissão: administrador global ou Gestor). Sem permissão, volta
         `pessoas_erro` e a presença fica gravada.
       Os nove parâmetros de antes continuam, com o mesmo efeito: o front já publicado chama a
       função pelos nomes e cai nesta (os novos têm padrão). Por isso a de nove é apagada e a de
       onze criada no lugar (com as duas, a chamada pelos nove nomes ficaria ambígua).
    2. public.listar_presenca_online_monitora conta "online" por 6 min (eram 4): duas batidas de
       150 s e um minuto de folga. Uma batida perdida não derruba ninguém, como antes (90 s × 2 +
       1 min = 4 min). Aba oculta pausa a batida: quem a esconde some da lista em até 6 min.

  O que se grava não muda: TB_PRESENCA_ONLINE_MONITORA (seen_at a cada batida) e TL_EVENTO_ACESSO.
  private."FC_ULTIMO_ACESSO" lê o maior seen_at e o último evento: a hora fica com a precisão da
  batida (150 s), sem outro efeito. Nenhuma tabela nova, nenhum dado muda.

  ENSAIO: supabase/ensaios/20261103230000_presenca_enxuta.sql (administrador global, Gestor e
  pessoa sem permissão; batida com lista e eventos de carona; chamada só com os nove nomes de
  antes; grava e desfaz).
  ROLLBACK: supabase/rollback/20261103230000_presenca_enxuta.sql (volta a função de nove
  parâmetros e os 4 min).
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.registrar_presenca_monitora(text)') is null
     or to_regprocedure('public.registrar_evento_acesso(text, text, text, jsonb, text, text, text)') is null
     or to_regprocedure('public.listar_presenca_online_monitora()') is null
     or to_regprocedure('private.is_master()') is null then
    raise exception 'Faltam as RPCs de presença, auditoria ou a verificação do administrador global.';
  end if;
end;
$$;

-- 1. "Online" por 6 min (duas batidas de 150 s e um minuto de folga) ------------------------------
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
       where po.seen_at > timezone('utc', now()) - interval '6 minutes'
       order by po.seen_at desc
       limit 200
    ) person;
  return v_result;
end;
$function$;

comment on function public.listar_presenca_online_monitora() is
  'Quem está online agora: presença nos últimos 6 min (a batida é a cada 150 s; uma perdida não derruba ninguém). Só administrador global ou Gestor.';

-- 2. A batida numa chamada: presença, eventos e, se pedida, a lista ------------------------------
drop function if exists public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text);

create function public.registrar_navegacao_monitora(
  p_evento text default null,
  p_tela text default null,
  p_detalhes jsonb default '{}'::jsonb,
  p_client_session_id text default null,
  p_user_agent text default null,
  p_app_version text default null,
  p_origem text default 'index',
  p_presenca boolean default true,
  p_current_view text default null,
  p_eventos jsonb default null,
  p_listar boolean default false
)
 returns jsonb
 language plpgsql
 security invoker
 set search_path to ''
 set statement_timeout to '3s'
as $function$
declare
  v_evento_id bigint;
  v_eventos bigint[] := '{}';
  v_item jsonb;
  v_presenca jsonb := '{}'::jsonb;
  v_resposta jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sessao nao localizada.' using errcode = '28000';
  end if;

  -- O mesmo registro de registrar_evento_acesso (TL_EVENTO_ACESSO).
  if nullif(btrim(p_evento), '') is not null then
    v_evento_id := public.registrar_evento_acesso(
      p_evento, p_tela, p_origem, p_detalhes,
      p_client_session_id, p_user_agent, p_app_version
    );
  end if;

  -- Eventos de carona (até 10), cada um a mesma linha; um recusado não desfaz o resto.
  if jsonb_typeof(p_eventos) = 'array' then
    for v_item in
      select t.e from jsonb_array_elements(p_eventos) with ordinality as t(e, n) where t.n <= 10
    loop
      continue when jsonb_typeof(v_item) <> 'object'
                 or nullif(btrim(v_item ->> 'evento'), '') is null;
      begin
        v_eventos := v_eventos || public.registrar_evento_acesso(
          v_item ->> 'evento',
          coalesce(nullif(btrim(v_item ->> 'tela'), ''), p_tela),
          coalesce(nullif(btrim(v_item ->> 'origem'), ''), p_origem),
          case when jsonb_typeof(v_item -> 'detalhes') = 'object' then v_item -> 'detalhes' else '{}'::jsonb end,
          coalesce(nullif(btrim(v_item ->> 'client_session_id'), ''), p_client_session_id),
          p_user_agent,
          coalesce(nullif(btrim(v_item ->> 'app_version'), ''), p_app_version)
        );
      exception when others then
        null;
      end;
    end loop;
  end if;

  -- A mesma linha de registrar_presenca_monitora; a falha dela não desfaz os eventos.
  if p_presenca then
    begin
      v_presenca := public.registrar_presenca_monitora(p_current_view);
    exception when others then
      v_presenca := jsonb_build_object(
        'presenca_erro', jsonb_build_object('codigo', sqlstate, 'mensagem', sqlerrm)
      );
    end;
  end if;

  v_resposta := coalesce(v_presenca, '{}'::jsonb) || jsonb_build_object('evento_id', v_evento_id);
  if cardinality(v_eventos) > 0 then
    v_resposta := v_resposta || jsonb_build_object('eventos_ids', to_jsonb(v_eventos));
  end if;

  -- "Pessoas online" de carona: a mesma função, com a mesma permissão.
  if p_listar then
    begin
      v_resposta := v_resposta
        || jsonb_build_object('pessoas', public.listar_presenca_online_monitora());
    exception when others then
      v_resposta := v_resposta || jsonb_build_object(
        'pessoas_erro', jsonb_build_object('codigo', sqlstate, 'mensagem', sqlerrm)
      );
    end;
  end if;

  return v_resposta;
end;
$function$;

comment on function public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text, jsonb, boolean) is
  'A batida e a navegação numa chamada: o evento de auditoria (registrar_evento_acesso), até 10 eventos de carona (p_eventos), a presença (registrar_presenca_monitora, com a versão do catálogo de abas) e, com p_listar, a lista de Pessoas online (listar_presenca_online_monitora). Falha da presença volta em presenca_erro e a da lista em pessoas_erro; nenhuma desfaz os eventos.';

revoke all on function public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text, jsonb, boolean) from public, anon;
grant execute on function public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text, jsonb, boolean) to authenticated;

commit;
