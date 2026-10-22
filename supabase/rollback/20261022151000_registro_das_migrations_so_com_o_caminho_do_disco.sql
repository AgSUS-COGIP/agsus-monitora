/*
  Rollback de 20261022151000_registro_das_migrations_so_com_o_caminho_do_disco.sql.
  Tira a regra do caminho; os dados ficam como estão.
*/
begin;

alter table public.migracoes_aplicadas drop constraint if exists ck_migracoes_aplicadas_caminho;

commit;
