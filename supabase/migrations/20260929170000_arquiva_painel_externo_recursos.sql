/*
  Arquiva o painel externo "Recursos" (Apps Script beta).

  A aba Recursos nativa (20260929120000, recursos.html) foi aprovada pelo
  usuário em 29/09/2026. O painel antigo sai de "Painéis": ativo = false,
  sem apagar a linha nem as permissões painel:<uuid> (histórico).
*/
begin;

update public."TB_PAINEL_EXTERNO"
   set ativo = false
 where codigo = 'recursos' and ativo is true;

commit;
