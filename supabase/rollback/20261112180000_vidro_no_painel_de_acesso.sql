/*
  ROLLBACK de 20261112180000_vidro_no_painel_de_acesso.sql

  Volta obter_branding_acesso_publico ao corpo de antes (md5 aa86cbdf60488563a3c93d6cad3d9a23, copiado do
  retrato supabase/esquema-atual.sql de 12/11/2026) e ao COMMENT de antes: a
  resposta deixa de trazer auth_access_painel_estilo.

  O front continua funcionando: sem a chave, a tela de acesso mostra o painel
  sólido antes do login. A chave gravada em TB_CONFIGURACAO fica (as
  Configurações continuam lendo e gravando).

  Guarda: não roda se a migration não foi aplicada (o corpo vigente não é o dela,
  md5 09273be0dc2f3b56b7c7426264afb48c).
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5((select prosrc from pg_proc where oid = to_regprocedure('public.obter_branding_acesso_publico()'))) is distinct from '09273be0dc2f3b56b7c7426264afb48c' then
    raise exception 'O corpo vigente de obter_branding_acesso_publico não é o da migration 20261112180000: nada a desfazer.';
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
    'auth_access_texto_modo'
  );
$$;

comment on function public.obter_branding_acesso_publico() is 'Identidade da tela de acesso para visitantes não autenticados. Lista de chaves fixa, sem dado de pessoa ou sessão.';

commit;
