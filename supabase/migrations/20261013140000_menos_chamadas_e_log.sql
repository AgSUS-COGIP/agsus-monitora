/*
  MENOS CHAMADAS, MENOS LOG

  Por quê: o plano gratuito do Supabase chegou a 0,96 de 1 GB de "Log
  Ingestion" no ciclo (e 3,74 de 5 GB de egress). Cada chamada à API vira uma
  linha de log da plataforma, e cada execução do pg_cron vira outra (o
  cron.log_statement está ligado e não se muda por SQL). O frontend deste
  mesmo PR espaça as batidas; aqui, o lado do banco.

  O QUE MUDA
    Presença          a batida do navegador passa de 45 s para 90 s; a janela
                      de "online" vai de 2 para 4 minutos, para quem perde
                      uma batida não piscar offline. Nos dois lugares que a
                      usam: Pessoas online (listar_presenca_online_monitora)
                      e o status do chat (FC_CHAT_PESSOA). Corpo igual ao do
                      banco, só a janela muda.
    Caches dos        de 2 em 2 para de 5 em 5 minutos, desencontrados (0, 1
    painéis           e 3 do ciclo) para não atropelar. São "só quando muda":
                      o painel fica no máximo 5 min atrás, não 2.
    Realtime do       feature_realtime_monitoramento = false. Cada mudança em
    monitoramento     TB_MONITORAMENTO_INDIGENA (o job de KPIs roda de 10 em
                      10 min) fazia TODO usuário aberto baixar a visão
                      inteira de novo. Volta a ser ligável em Configurações ›
                      Operação; "Atualizar dados" e o F5 seguem trazendo o
                      que mudou.
*/

begin;

-- 1. Presença: janela de 4 minutos ------------------------------------------

CREATE OR REPLACE FUNCTION public.listar_presenca_online_monitora()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

CREATE OR REPLACE FUNCTION private."FC_CHAT_PESSOA"(p_usuario uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'id', p_usuario,
    'nome', coalesce(p.nome, 'Pessoa'),
    'avatar', p.avatar,
    'online', exists (
      select 1 from public."TB_PRESENCA_ONLINE_MONITORA" po
       where po.user_id = p_usuario
         and po.seen_at > timezone('utc', now()) - interval '4 minutes'),
    'status', coalesce((
      select s."TP_STATUS" from public."TB_STATUS_PRESENCA_CHAT" s
       where s."CO_USUARIO" = p_usuario), 'DISPONIVEL'))
  from (select 1) um
  left join lateral (
    select coalesce(nullif(btrim(u.nome), ''), split_part(coalesce(u.email, ''), '@', 1)) as nome,
           coalesce(case when u.avatar_source in ('GOOGLE', 'UPLOADED') then u.avatar_url end, u.google_avatar_url) as avatar
      from public."TB_PERFIL_USUARIO" u
     where u.user_id = p_usuario
     order by u.ativo desc, u.updated_at desc nulls last
     limit 1
  ) p on true;
$function$;

-- 2. Caches dos painéis: de 5 em 5 minutos -----------------------------------

select cron.alter_job(j.jobid, schedule := v.agenda)
  from cron.job j
  join (values ('agsus_analises_cache_do_painel', '*/5 * * * *'),
               ('agsus_aprovados_cache_por_area', '1-59/5 * * * *'),
               ('agsus_entrevistas_cache_do_painel', '3-59/5 * * * *')) v(nome, agenda)
    on v.nome = j.jobname;

-- 3. Configuração: sem realtime do monitoramento ---------------------------

update public."TB_CONFIGURACAO"
   set valor = 'false', updated_at = now()
 where chave = 'feature_realtime_monitoramento';

commit;
