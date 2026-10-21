/*
  Rollback de 20261021180000_encerramento_do_edital: tira as duas RPCs, a
  função dos editais encerrados e a tabela de quem já viu a tela. O front sem
  as RPCs só não mostra a tela de encerramento nem os selos (a função ausente
  é tratada como "nada a mostrar"). Quem já viu a tela volta a vê-la se a
  migration for aplicada de novo.
*/
begin;

drop function if exists public.marcar_encerramento_visto(uuid);
drop function if exists public.obter_encerramentos_do_edital();
drop function if exists private."FC_EDITAIS_ENCERRADOS"();
drop table if exists public."RL_ENCERRAMENTO_EDITAL_USUARIO";

commit;
