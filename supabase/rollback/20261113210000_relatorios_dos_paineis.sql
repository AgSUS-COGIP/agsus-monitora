/*
  DESFAZ 20261113210000_relatorios_dos_paineis.sql: tira as três leituras dos Painéis e a guarda.
*/
begin;

drop function if exists public.listar_aprovados_do_painel(text);
drop function if exists public.listar_editais_por_cargo_do_painel(text);
drop function if exists public.listar_resumo_dos_editais_do_painel(text);
drop function if exists private."FC_EXIGIR_PAINEIS_DA_AREA"(text);

commit;
