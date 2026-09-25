/*
  ARQUIVA TA_ANALISE_QUARENTENA (etapa 2 de docs/arquitetura.md)

  469 linhas paradas desde 01/09/2026. Nenhuma função, view, job do pg_cron ou
  arquivo do front usa a tabela (conferido em 25/09/2026). A decisão foi tirá-la
  do sistema.

  Em vez de DROP, ela vai para o schema `arquivo`: sai de `public` (e portanto
  da Data API), ninguém além do dono alcança, e os dados continuam lá. Um DROP
  definitivo, se um dia for desejado, é decisão da equipe:
    drop table arquivo."TA_ANALISE_QUARENTENA";

  O schema `arquivo` é o lugar de tudo que sai do sistema mas ainda não pode
  ser apagado. Na migração para o banco próprio, ele fica para trás.

  ROLLBACK:
    alter table arquivo."TA_ANALISE_QUARENTENA" set schema public;
*/
begin;

create schema if not exists arquivo;
revoke all on schema arquivo from public, anon, authenticated, service_role;
comment on schema arquivo is
  'Tabelas que saíram do sistema mas ainda não podem ser apagadas. Fora da Data API; sem acesso de anon/authenticated.';

alter table public."TA_ANALISE_QUARENTENA" set schema arquivo;
revoke all on arquivo."TA_ANALISE_QUARENTENA" from public, anon, authenticated, service_role;

commit;
