# `supabase/migrations-historicas/` — já aplicadas, só para histórico

Migrations antigas que **já correram** no banco (ou cujo efeito correu e foi depois renomeado
ou removido por migration posterior). Ficam no Git porque contam como o schema chegou onde
está, mas fora de `supabase/migrations/` porque são **perigosas se reaplicadas**:

- usam a tabela antiga `perfis_usuarios` e nomes anteriores à padronização MAD de 18/09/2026
  (`solicitacoes_acesso_paineis`, `lista_aprovados_candidatos`, `presenca_online_monitora`…);
- criam funções `SECURITY DEFINER` com `search_path` não vazio (`public`), o que a auditoria de
  06/10/2026 eliminou;
- recriariam funções que migrations posteriores removeram de propósito, ou sobrescreveriam o
  corpo atual de RPCs com uma versão velha.

Movidas em 20/10/2026, sem mudar o conteúdo (o sha256 continua o mesmo do registro).

**Não aplicar.** Nenhuma ferramenta deve pegar esta pasta: o Supabase CLI só lê
`supabase/migrations/` (e o projeto não usa `supabase db push`, ver
`supabase/migrations/README.md`).

## Como o registro as vê

`public.migracoes_aplicadas` guarda o caminho de origem, `migrations/<arquivo>` (o caminho que
tinham quando foram registradas). `scripts/estado-das-migrations-nucleo.mjs` lê esta pasta e
compara pelo mesmo caminho de origem, então:

- registrada → aparece como **aplicada** (como antes da mudança);
- sem registro → aparece à parte, como **histórica sem registro (não reaplicar)**, e nunca entra
  em "POR APLICAR" nem em `--registrar-todas-pendentes`.

## O que está aqui

| Arquivo                                                       | Registro     | Por que é histórica                                                                                                     |
| ------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `add_update_user_access_rpc.sql`                              | aplicada     | sem timestamp; `perfis_usuarios`, `search_path` não vazio                                                               |
| `restrict_access_management_to_master.sql`                    | aplicada     | sem timestamp; `perfis_usuarios`, `search_path` não vazio                                                               |
| `20260624_access_requests_and_panel_permissions.sql`          | sem registro | timestamp de 8 dígitos; tabelas renomeadas pela padronização (`RL_SOLIC_ACESSO_PAINEL`, `RL_PERFIL_USUARIO_PAINEL_EXT`) |
| `20260721144500_create_get_analises_dashboard_filtrado.sql`   | sem registro | `get_analises_dashboard_filtrado` removida em `20260929150000_analises_lista_enxuta.sql`                                |
| `20260721152000_paginate_get_analises_dashboard_filtrado.sql` | sem registro | idem                                                                                                                    |
| `20260721190000_normalize_analises_historical_filters.sql`    | sem registro | idem                                                                                                                    |
| `20260901114500_configurable_access_branding.sql`             | sem registro | insere em `public.configuracoes`, renomeada para `TB_CONFIGURACAO` pela padronização                                    |
| `20260901120443_online_presence_sigav.sql`                    | sem registro | tabela renomeada para `TB_PRESENCA_ONLINE_MONITORA`; usa `perfis_usuarios`                                              |
| `20260901171419_quarantine_edital_101_2026_analises.sql`      | sem registro | tabelas renomeadas (`TA_ANALISE_QUARENTENA`, `TA_IMPORTACAO_BLOQUEADA`)                                                 |
| `20260915150000_lista_aprovados_e_perfis.sql`                 | sem registro | tabelas renomeadas (`TB_CANDIDATO_APROVADO`, `TH_CANDIDATO_APROVADO`); usa `perfis_usuarios`                            |
| `20260918160000_padronizacao_nomenclatura_tabelas.sql`        | sem registro | a própria renomeação MAD (148 KB); reaplicar sobrescreveria dezenas de RPCs com o corpo de 18/09                        |
| `20260918170000_padronizacao_views_item9.sql`                 | sem registro | funções removidas em `20260925150000_remove_objetos_mortos.sql` e `20261007220100_sai_payload_do_monitoramento.sql`     |
| `20260929121200_recorte_por_coordenacao_nas_rpcs.sql`         | sem registro | recria `get_analises_dashboard_filtrado` (removida) e corpos antigos de RPCs reescritas depois                          |

"Sem registro": a auditoria do registro em 13/10/2026
(`supabase/correcoes/20261013-registro-das-migrations.sql`) não conseguiu conferir o efeito no
banco porque os objetos que criam já tinham sido renomeados ou removidos, e por isso as deixou
"pendentes, de propósito". Não há o que aplicar: o estado atual vem das migrations posteriores.

Não havia ensaio (`supabase/ensaios/`) nem rollback (`supabase/rollback/`) destes arquivos.
