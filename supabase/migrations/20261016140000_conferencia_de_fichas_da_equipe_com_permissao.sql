/*
  CONFERÊNCIA DE FICHAS DA EQUIPE COM A PERMISSÃO DO SISTEMA

  Ao tirar alguém da equipe do edital (RL_ANALISTA_EDITAL.ST_ATIVO S → N),
  o gatilho TG_ANALISTAEDT_FICHAS confere se a pessoa ainda tem fichas em
  aberto. O gatilho é DEFERRABLE INITIALLY DEFERRED: roda no COMMIT, depois
  que salvar_equipe_edital (SECURITY DEFINER) já terminou — portanto com o
  papel da sessão (authenticated), que não lê TB_FICHA_ANALISE. Resultado na
  tela (16/10/2026): "permission denied for table TB_FICHA_ANALISE" ao tirar
  qualquer pessoa da equipe ou mudar a função.

  A função do gatilho passa a ser SECURITY DEFINER (search_path vazio, como as
  demais), sem execução direta para ninguém. Corpo e mensagem ficam iguais.

  Ensaio: supabase/ensaios/20261016140000_conferencia_de_fichas_da_equipe_com_permissao.sql
  Rollback: supabase/rollback/20261016140000_conferencia_de_fichas_da_equipe_com_permissao.sql
*/
alter function private."FC_TG_EQUIPE_COM_FICHAS"() security definer;
alter function private."FC_TG_EQUIPE_COM_FICHAS"() set search_path = '';
revoke all on function private."FC_TG_EQUIPE_COM_FICHAS"() from public, anon, authenticated;
