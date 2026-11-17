/*
  ROLLBACK de supabase/migrations/20261117040000_roteiro_do_93_aceita_nota_com_duas_casas.sql: o passo do roteiro do 93/2026 volta a 0,50.
  As notas já gravadas com duas casas continuam valendo (a ficha aceita a gravada); só a nota nova
  volta a ter de ser de 0,5 em 0,5.
*/

begin;

update public."TB_ROTEIRO_ENTREVISTA" set "VL_PASSO" = 0.50 where "CO_ROTEIRO" = 'a153cace-9188-4b54-8328-a69979f895ec';

commit;
