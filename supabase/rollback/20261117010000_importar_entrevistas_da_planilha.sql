/*
  ROLLBACK de supabase/migrations/20261117010000_importar_entrevistas_da_planilha.sql

  Tira a função de importação. As entrevistas já importadas ficam: são as notas da banca, com
  histórico, e se corrigem pela tela (Conduzir entrevistas › ficha de notas).
*/

begin;

drop function if exists private."FC_IMPORTAR_ENTREVISTAS_DA_PLANILHA"(uuid, jsonb, text, uuid);

commit;
