/*
  Arquiva o painel externo "Entrevistas" (Apps Script sobre "[dash] entrevistados").

  A aba Entrevistas nativa (20260929235000, entrevistas.html) foi aprovada pelo
  usuário em 30/09/2026. O painel antigo sai de "Painéis": ativo = false, sem
  apagar a linha nem as permissões painel:<uuid> (histórico). Os dados seguem
  chegando pelo Apps Script 5-entrevistas-para-supabase.gs.

  Rollback: supabase/rollback/20260930210000_arquiva_painel_externo_entrevistas.sql
*/
begin;

update public."TB_PAINEL_EXTERNO"
   set ativo = false, updated_at = now()
 where id = '5c0bbc63-35b9-4a1a-b196-f2b3ecf65198' and ativo is true;

commit;
