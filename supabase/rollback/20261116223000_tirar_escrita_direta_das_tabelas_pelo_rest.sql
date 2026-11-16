/*
  ROLLBACK de 20261116223000_tirar_escrita_direta_das_tabelas_pelo_rest: devolve
  exatamente os grants de escrita de 16/11/2026 (lidos do catálogo antes da
  migration). A RLS e as policies não mudaram e não precisam voltar.
*/
begin;

set local lock_timeout = '5s';

grant insert, update, delete on table public."RL_PERFIL_USUARIO_PAINEL_EXT" to authenticated;
grant insert, update on table public."TB_CONFIGURACAO" to authenticated;
grant insert, update, delete on table public."TB_CONFIG_MAPA_SAUDE_INDIG" to authenticated;
grant insert, update on table public."TB_MONITORAMENTO_INDIGENA" to authenticated;
grant update on table public."TB_PAINEL_EXTERNO" to authenticated;
grant insert, update on table public."TB_PERFIL_USUARIO" to authenticated;
grant insert, update, delete on table public."TL_SYNC_ANALISE" to authenticated;
grant insert, delete on table public."TM_ANALISE_CURRICULAR" to authenticated;

grant insert (id, user_id, evento, tela, origem, detalhes, client_session_id, user_agent, app_version)
  on table public."TL_EVENTO_ACESSO"
to anon;

commit;
