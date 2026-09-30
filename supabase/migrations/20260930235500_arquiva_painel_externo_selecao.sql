/*
  Arquiva o painel externo "Seleção" (Apps Script).

  A aba Seleção nativa (selecao.html, PR #188) substitui o painel antigo,
  confirmado pelo usuário em 30/09/2026. Como em 20260930210000 (Entrevistas):
  ativo = false, sem apagar a linha nem as permissões painel:<uuid>
  (histórico). Era o último painel externo ativo; o grupo "Painéis" some do
  menu por ficar vazio.

  Rollback: supabase/rollback/20260930235500_arquiva_painel_externo_selecao.sql
*/
begin;

update public."TB_PAINEL_EXTERNO"
   set ativo = false, updated_at = now()
 where id = 'f4508663-b3c6-4909-b01d-96026063f790' and ativo is true;

commit;
