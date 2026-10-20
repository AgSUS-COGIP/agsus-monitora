/*
  Rollback de 20261020120000_relatorio_de_motivos.sql: sai
  public.listar_relatorio_de_motivos (nada mais dependia dela; nenhuma tabela
  nem índice mudou).
*/

begin;

drop function if exists public.listar_relatorio_de_motivos(uuid, jsonb);

commit;
