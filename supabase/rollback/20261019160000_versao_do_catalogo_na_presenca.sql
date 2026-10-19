/*
  Rollback de 20261019160000_versao_do_catalogo_na_presenca.sql: volta
  registrar_presenca_monitora como estava no banco antes da migration (retorno
  só com `status`, search_path de 20261006150000) e apaga
  private."FC_VERSAO_DO_CATALOGO_DE_ABAS". A tela continua funcionando: sem
  `versao_do_catalogo` na resposta, ela só não relê o catálogo no meio da
  sessão (volta ao comportamento de antes). Os GRANTs ficam como estão.
*/

begin;

set local lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.registrar_presenca_monitora(p_current_view text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $function$
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

drop function if exists private."FC_VERSAO_DO_CATALOGO_DE_ABAS"();

commit;
