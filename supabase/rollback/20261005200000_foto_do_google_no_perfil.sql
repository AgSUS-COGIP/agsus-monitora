-- ROLLBACK de supabase/migrations/20261005200000_foto_do_google_no_perfil.sql
-- Volta registrar_presenca_monitora ao corpo de 20260901120443 (sem copiar a
-- foto) e tira o gatilho e as funções. As fotos já copiadas para
-- google_avatar_url ficam (são as do próprio login de cada pessoa).
begin;

create or replace function public.registrar_presenca_monitora(p_current_view text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text := coalesce(auth.jwt() ->> 'email', '');
begin
  if v_user_id is null then
    raise exception 'Sessao nao localizada.' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public."TB_PERFIL_USUARIO" p
    where p.ativo is true
      and (
        p.user_id = v_user_id
        or lower(p.email) = lower(v_email)
      )
  ) then
    raise exception 'Perfil institucional nao localizado.' using errcode = 'P0002';
  end if;

  insert into public."TB_PRESENCA_ONLINE_MONITORA" (user_id, current_view, seen_at)
  values (v_user_id, left(nullif(trim(p_current_view), ''), 120), timezone('utc', now()))
  on conflict (user_id) do update
    set current_view = excluded.current_view,
        seen_at = excluded.seen_at;

  return jsonb_build_object('status', 'OK');
end;
$function$;

drop trigger if exists "TG_PERFILUSUARIO_FOTO_LOGIN" on public."TB_PERFIL_USUARIO";
drop function if exists private."FC_PERFIL_FOTO_AO_LIGAR"();
drop function if exists private."FC_FOTO_DO_GOOGLE"(jsonb);

commit;
