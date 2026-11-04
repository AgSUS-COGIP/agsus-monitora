/*
  ROLLBACK de 20261104150000_tabela_de_cargos.sql

  Tira a RPC listar_cargos, as funções da grafia e as tabelas de cargos e de
  apelidos. ATENÇÃO: apaga os apelidos gravados desde a aplicação (inclusive os
  da correção 20261104-apelidos-de-cargo.sql); exporte antes se precisar deles.
  Nenhuma coluna existente nem tela depende destas tabelas na fase 1.
*/
begin;

set local lock_timeout = '5s';

drop function if exists public.listar_cargos(text);
drop function if exists private."FC_CARGO_DA_GRAFIA"(text, text);

drop table if exists public."TD_CARGO_APELIDO";
drop table if exists public."TD_CARGO";

drop function if exists private."FC_NORMALIZAR_GRAFIA_CARGO"(text);

notify pgrst, 'reload schema';

commit;
