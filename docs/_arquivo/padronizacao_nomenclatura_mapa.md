# Mapa de padronizacao de nomenclatura - tabelas AgSUS

Referencia: padrão de nomenclatura de tabelas da AgSUS (PDTIC 2026-2027, v1.0), item 6. O PDF saiu do repositório em 25/09/2026 (está no histórico do git).

| Nome atual | Nome padronizado | Tipo (item 6) |
|---|---|---|
| `perfis_paineis_externos` | `RL_PERFIL_USUARIO_PAINEL_EXT` | Tabela de relacionamento (N:N) |
| `solicitacoes_acesso_paineis` | `RL_SOLIC_ACESSO_PAINEL` | Tabela de relacionamento (N:N) |
| `analises_curriculares_quarentena` | `TA_ANALISE_QUARENTENA` | Tabela auxiliar |
| `analises_dashboard_cache` | `TA_DASHBOARD_ANALISE` | Tabela auxiliar |
| `analises_importacoes_bloqueadas` | `TA_IMPORTACAO_BLOQUEADA` | Tabela auxiliar |
| `analises_curriculares` | `TB_ANALISE_CURRICULAR` | Tabela de sistema |
| `aya_bridge` | `TB_BRIDGE_AYA` | Tabela de sistema |
| `lista_aprovados_candidatos` | `TB_CANDIDATO_APROVADO` | Tabela de sistema |
| `configuracoes` | `TB_CONFIGURACAO` | Tabela de sistema |
| `mapa_saude_indigena_config` | `TB_CONFIG_MAPA_SAUDE_INDIG` | Tabela de sistema |
| `monitoramento_indigena_cronograma` | `TB_CRONOGRAMA_MONIT_INDIG` | Tabela de sistema |
| `analises_editais` | `TB_EDITAL_ANALISE` | Tabela de sistema |
| `listas_aprovados` | `TB_LISTA_APROVADO` | Tabela de sistema |
| `monitoramento_indigena` | `TB_MONITORAMENTO_INDIGENA` | Tabela de sistema |
| `paineis_externos` | `TB_PAINEL_EXTERNO` | Tabela de sistema |
| `perfis_usuarios` | `TB_PERFIL_USUARIO` | Tabela de sistema |
| `presenca_online_monitora` | `TB_PRESENCA_ONLINE_MONITORA` | Tabela de sistema |
| `solicitacoes_acesso` | `TB_SOLICITACAO_ACESSO` | Tabela de sistema |
| `dim_unidades` | `TD_UNIDADE` | Tabela dimensao (DM/DW) |
| `lista_aprovados_historico` | `TH_CANDIDATO_APROVADO` | Tabela de historico |
| `configuracoes_versoes` | `TH_CONFIGURACAO` | Tabela de historico |
| `monitoramento_indigena_cronograma_versoes` | `TH_CRONOGRAMA_MONIT_INDIG` | Tabela de historico |
| `historico_monitoramento` | `TH_MONITORAMENTO` | Tabela de historico |
| `eventos_acesso` | `TL_EVENTO_ACESSO` | Tabela de log de operacoes |
| `log_notificacoes` | `TL_NOTIFICACAO` | Tabela de log de operacoes |
| `analises_sync_log` | `TL_SYNC_ANALISE` | Tabela de log de operacoes |
| `monitoramento_indigena_sync_log` | `TL_SYNC_MONIT_INDIGENA` | Tabela de log de operacoes |
| `analises_staging` | `TM_ANALISE_CURRICULAR` | Tabela temporaria |
| `monitoramento_indigena_dashboard_staging` | `TM_DASHBOARD_MONIT_INDIG` | Tabela temporaria |
