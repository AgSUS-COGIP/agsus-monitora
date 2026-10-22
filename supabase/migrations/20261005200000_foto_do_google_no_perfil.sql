/*
  FOTO DO GOOGLE NO PERFIL

  A foto do Google só ia para TB_PERFIL_USUARIO.google_avatar_url quando a
  própria pessoa escolhia "usar a foto do Google" no perfil
  (salvar_avatar_perfil). Na conta dela a foto aparecia (vem da sessão), mas
  para os colegas — Pessoas online, chat, Acessos — só as iniciais: em
  05/10/2026, 1 de 28 perfis ativos tinha a foto guardada, embora 26 tivessem
  foto no login do Google.

  Agora o próprio banco copia a foto do login (auth.users.raw_user_meta_data:
  avatar_url ou picture, só https) para google_avatar_url:
    - a cada sinal de presença da tela (registrar_presenca_monitora), só quando
      a foto mudou (o Supabase não deixa pôr gatilho em auth.users);
    - quando o perfil é criado ou ligado ao usuário (gatilho no perfil);
    - uma vez agora, para quem já entrou.
  A escolha de avatar não existe mais na tela (05/10/2026): vale a foto do
  Google de quem tem. Não mexe em avatar_source nem em avatar_url; as telas já
  usam google_avatar_url (ex.: listar_presenca_online_monitora, o chat).
*/
begin;

create or replace function private."FC_FOTO_DO_GOOGLE"(p_meta jsonb)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case
    when length(u) <= 2048 and u ~* '^https://' then u
  end
  from (select nullif(btrim(coalesce(p_meta ->> 'avatar_url', p_meta ->> 'picture', '')), '') as u) x;
$function$;

comment on function private."FC_FOTO_DO_GOOGLE"(jsonb) is
  'URL da foto do Google nos metadados do login (avatar_url ou picture), só https e até 2048 caracteres; senão null.';

-- A cada sinal de presença (a tela manda a cada minuto, logada): leva a foto
-- do login para o perfil, só quando mudou. (auth.users não aceita gatilho de
-- fora do serviço de autenticação: o Supabase recusa com 42501.) Mesmo corpo de
-- 20260901120443_online_presence_sigav.sql mais a cópia da foto.
create or replace function public.registrar_presenca_monitora(p_current_view text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text := coalesce(auth.jwt() ->> 'email', '');
  v_foto text;
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

  select private."FC_FOTO_DO_GOOGLE"(u.raw_user_meta_data)
    into v_foto
    from auth.users u
   where u.id = v_user_id;
  if v_foto is not null then
    update public."TB_PERFIL_USUARIO" p
       set google_avatar_url = v_foto
     where p.user_id = v_user_id
       and p.google_avatar_url is distinct from v_foto;
  end if;

  return jsonb_build_object('status', 'OK');
end;
$function$;

comment on function public.registrar_presenca_monitora(text) is
  'Sinal de presença do MONITORA (Pessoas online) e, de quebra, copia a foto do Google do login para TB_PERFIL_USUARIO.google_avatar_url quando ela mudou.';

-- Perfil criado ou ligado ao usuário depois do primeiro login.
create or replace function private."FC_PERFIL_FOTO_AO_LIGAR"()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_foto text;
begin
  if new.user_id is not null then
    select private."FC_FOTO_DO_GOOGLE"(u.raw_user_meta_data)
      into v_foto
      from auth.users u
     where u.id = new.user_id;
    if v_foto is not null then
      new.google_avatar_url := v_foto;
    end if;
  end if;
  return new;
end;
$function$;

comment on function private."FC_PERFIL_FOTO_AO_LIGAR"() is
  'Gatilho no perfil: ao criar ou ligar ao usuário (user_id), preenche google_avatar_url com a foto do login.';

drop trigger if exists "TG_PERFILUSUARIO_FOTO_LOGIN" on public."TB_PERFIL_USUARIO";
create trigger "TG_PERFILUSUARIO_FOTO_LOGIN"
  before insert or update of user_id on public."TB_PERFIL_USUARIO"
  for each row execute function private."FC_PERFIL_FOTO_AO_LIGAR"();

comment on trigger "TG_PERFILUSUARIO_FOTO_LOGIN" on public."TB_PERFIL_USUARIO" is
  'Preenche google_avatar_url com a foto do login quando o perfil é criado ou ligado ao usuário.';

revoke all on function private."FC_FOTO_DO_GOOGLE"(jsonb) from public, anon, authenticated;
revoke all on function private."FC_PERFIL_FOTO_AO_LIGAR"() from public, anon, authenticated;

-- Quem já entrou com o Google.
update public."TB_PERFIL_USUARIO" p
   set google_avatar_url = f.foto
  from (
    select u.id, private."FC_FOTO_DO_GOOGLE"(u.raw_user_meta_data) as foto
      from auth.users u
  ) f
 where p.user_id = f.id
   and f.foto is not null
   and p.google_avatar_url is distinct from f.foto;

commit;
