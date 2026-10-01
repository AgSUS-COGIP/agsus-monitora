/*
  registrar_evento_acesso (auditoria de acesso) nunca teve grant/revoke nas
  migrations: ficou com o EXECUTE padrão, que inclui PUBLIC e anon. O app só
  chama a função com usuário logado (trackAccess em legacy-app.js sai cedo sem
  currentUser), e ela é SECURITY INVOKER: quem barra o anônimo hoje é só a RLS
  de TL_EVENTO_ACESSO. Esta migration deixa a execução só para authenticated
  (e service_role), como as demais RPCs do app.

  Achado da varredura de bugs de 01/10/2026. Não muda o corpo da função.

  Rollback: supabase/rollback/20261001190000_registrar_evento_acesso_so_autenticado.sql
  Ensaio:   supabase/ensaios/20261001190000_registrar_evento_acesso_so_autenticado.sql
*/
begin;

revoke all on function public.registrar_evento_acesso(text, text, text, jsonb, text, text, text) from public, anon;
grant execute on function public.registrar_evento_acesso(text, text, text, jsonb, text, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
