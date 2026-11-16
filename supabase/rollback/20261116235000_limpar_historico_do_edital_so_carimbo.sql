/*
  ROLLBACK de 20261116235000_limpar_historico_do_edital_so_carimbo: não há o que desfazer no schema.

  Dado não se desfaz: os registros apagados de TH_MONITORAMENTO não voltam. Eram fotos
  automáticas do edital idênticas à anterior, a não ser por updated_at, updated_by e
  "DT_FONTE_FUNIL"; o conteúdo de cada mudança continua no registro que ficou (a migration conferiu,
  registro por registro). Liberar esse espaço era o objetivo.

  Para desfazer a regra que impede novos registros só de carimbo, rode o rollback de
  20261116234000_historico_do_edital_ignora_so_carimbo.
*/
begin;

do $nada$
begin
  raise notice 'Rollback de 20261116235000: nada a desfazer (os registros apagados não voltam; ver o comentário).';
end;
$nada$;

commit;
