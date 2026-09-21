# Padronizacao de nomenclatura - ajustes de codigo (APLICADOS)

Status: **aplicado em 2026-09-18** no projeto `agsusmonitora-dais`
(`gnudtaxhjfgtvwkwpsel`), via a migration
`supabase/migrations/20260918160000_padronizacao_nomenclatura_tabelas.sql`.

Como os nomes estao em MAIUSCULAS, toda referencia exige aspas duplas no SQL
e a grafia exata no PostgREST/supabase-js: `.from('TB_CONFIGURACAO')`.

## Pontos de codigo alterados (21)

### Chamadas `.from()` (14)
src/analises/analises-scope-guard.js:411
  - .from('analises_editais')
  + .from('TB_EDITAL_ANALISE')
src/modules/health-status-details.js:112
  - .from('monitoramento_indigena')
  + .from('TB_MONITORAMENTO_INDIGENA')
src/modules/legacy-app.js:1586
  - .from('solicitacoes_acesso')
  + .from('TB_SOLICITACAO_ACESSO')
src/modules/legacy-app.js:1645
  - .from('solicitacoes_acesso')
  + .from('TB_SOLICITACAO_ACESSO')
src/modules/legacy-app.js:1679
  - .from('configuracoes')
  + .from('TB_CONFIGURACAO')
src/modules/legacy-app.js:1946
  - .from('dim_unidades')
  + .from('TD_UNIDADE')
src/modules/legacy-app.js:2072
  - .from('paineis_externos')
  + .from('TB_PAINEL_EXTERNO')
src/modules/legacy-app.js:2189
  - .from('monitoramento_indigena')
  + .from('TB_MONITORAMENTO_INDIGENA')
src/modules/legacy-app.js:11877
  - .from('solicitacoes_acesso')
  + .from('TB_SOLICITACAO_ACESSO')
src/modules/legacy-app.js:11885
  - .from('perfis_usuarios')
  + .from('TB_PERFIL_USUARIO')
src/modules/sidebar-branding.js:406
  - .from('configuracoes')
  + .from('TB_CONFIGURACAO')
tests/cronograma-sem-duplicata.test.js:20
  - .from('monitoramento_indigena')
  + .from('TB_MONITORAMENTO_INDIGENA')
tests/monitoramento-operational-transport.test.js:25
  - .from('monitoramento_indigena')
  + .from('TB_MONITORAMENTO_INDIGENA')
tests/monitoramento-operational-transport.test.js:60
  - .from('configuracoes')
  + .from('TB_CONFIGURACAO')

# total de pontos: 14

### Literais de string fora de `.from()` (7)

Estes nao aparecem numa varredura por `.from()` e por isso exigiram busca
adicional por literais; incluem constantes e uma inscricao de realtime:

src/analises/analises-app.js:521
  - fetchAllSupabaseRows("analises_editais", ...)
  + fetchAllSupabaseRows("TB_EDITAL_ANALISE", ...)
src/modules/legacy-app.js:123
  - const MAPA_CONFIG_TABLE = "mapa_saude_indigena_config"
  + const MAPA_CONFIG_TABLE = "TB_CONFIG_MAPA_SAUDE_INDIG"
src/modules/legacy-app.js:12729  (subscricao realtime)
  - { event: "*", schema: "public", table: "monitoramento_indigena" }
  + { event: "*", schema: "public", table: "TB_MONITORAMENTO_INDIGENA" }
src/modules/lotacoes-geograficas-transport.js:9
  - const MAP_TABLE = "mapa_saude_indigena_config"
  + const MAP_TABLE = "TB_CONFIG_MAPA_SAUDE_INDIG"
src/modules/monitoramento-operational-transport.js:1
  - const SOURCE_TABLE = "monitoramento_indigena"
  + const SOURCE_TABLE = "TB_MONITORAMENTO_INDIGENA"
tests/fronteira-de-dados.test.js:58
tests/monitoramento-operational-transport.test.js:34
  (assercoes ajustadas para os novos nomes)

## Validacao

- Dry-run completo (transacao com rollback) executado antes da aplicacao.
- 88 arquivos de teste / 723 testes passando apos os ajustes.
- Views e RPCs verificadas em execucao contra as tabelas renomeadas.
