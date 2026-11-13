/*
  ROLLBACK de 20261113150000_vidro_ajustavel_no_painel_de_acesso.sql

  Volta public.obter_branding_acesso_publico() à lista de antes (sem a cor e
  o desfoque do vidro). As chaves em TB_CONFIGURACAO ficam; só deixam de sair
  antes do login.

  Guarda: só desfaz se o corpo vigente for o da migration (md5 cfa755e6a28e40111283afe33a450eb2).
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.obter_branding_acesso_publico()')), chr(13), '')) is distinct from 'cfa755e6a28e40111283afe33a450eb2' then
    raise exception 'obter_branding_acesso_publico não está no corpo da migration 20261113150000: nada a desfazer, ou mudou depois.';
  end if;
end;
$guarda$;

create or replace function public.obter_branding_acesso_publico()
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
 set statement_timeout to '3s'
as $$
  select coalesce(
    jsonb_object_agg(c.chave, c.valor)
      filter (where c.valor is not null and btrim(c.valor) <> ''),
    '{}'::jsonb
  )
  from public."TB_CONFIGURACAO" as c
  where c.chave in (
    'auth_access_background_url',
    'auth_access_logo_url',
    'auth_access_panel_color',
    'auth_access_greeting',
    'auth_access_instruction',
    'auth_google_button_text',
    'auth_access_texto_modo',
    'auth_access_painel_estilo'
  );
$$;

comment on function public.obter_branding_acesso_publico() is 'Identidade da tela de acesso para visitantes não autenticados. Lista de chaves fixa, sem dado de pessoa ou sessão (desde 20261112180000, também o estilo do painel: sólido ou vidro).';

commit;
