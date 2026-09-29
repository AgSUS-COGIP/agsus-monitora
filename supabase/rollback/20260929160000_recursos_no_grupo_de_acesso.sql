-- Tira 'recursos' do modelo de grupos de acesso.
begin;
delete from public."TA_GRUPO_ACESSO_RECURSO" where "NO_RECURSO" = 'recursos';
delete from public."TB_PERMISSAO_RECURSO" where recurso = 'recursos';
create or replace function private."FC_RECURSOS_MODULO"() returns text[] language sql immutable set search_path to '' as $function$ select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos']::text[]; $function$;
commit;
