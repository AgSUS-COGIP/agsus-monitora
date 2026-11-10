---
tipo: regra
area: banco
atualizado: 2026-11-10
---

# Nomenclatura MAD (banco)

Os nomes do banco seguem o **Padrão Institucional de Nomenclatura da AgSUS** (MAD, PDTIC
2026–2027). O PDF fica fora do repositório (saiu em 25/09/2026; está no histórico do git). A skill
`mad-ddl-review` revisa o DDL antes de virar migration.

## Regras

- Prefixo tipológico no nome da tabela, em **MAIÚSCULAS**, sempre entre **aspas duplas** no SQL e
  com a grafia exata no PostgREST/supabase-js (`.from('TB_CONFIGURACAO')`).
- Tipos de tabela (item 6 do padrão):

  | Prefixo | Tipo                          | Exemplo                       |
  | ------- | ----------------------------- | ----------------------------- |
  | `TB_`   | tabela de sistema             | `TB_EDITAL_ANALISE`           |
  | `TA_`   | tabela auxiliar               | `TA_DASHBOARD_ANALISE`        |
  | `TH_`   | tabela de histórico           | `TH_CONFIGURACAO`             |
  | `TL_`   | tabela de log de operações    | `TL_SYNC_ANALISE`             |
  | `TM_`   | tabela temporária             | `TM_ANALISE_CURRICULAR`       |
  | `TD_`   | tabela dimensão (DM/DW)       | `TD_UNIDADE`                  |
  | `RL_`   | tabela de relacionamento (N:N) | `RL_PERFIL_USUARIO_PAINEL_EXT` |

- Colunas com prefixo tipológico (no banco hoje: `ST_TREINAMENTO`, `DS_RETRATO`…).
- `COMMENT ON` em tudo (tabela, coluna, função).
- Como está no banco hoje (`supabase/esquema-atual.sql`): funções internas no schema `private` com
  `FC_` (`private."FC_DISPARAR_ROBO"`); as RPCs públicas que o front chama em português minúsculo
  (`obter_inicio_da_sessao`).

## A renomeação de 18/09/2026

As tabelas antigas (`configuracoes`, `analises_curriculares`, `dim_unidades`…) foram renomeadas
para o padrão em 18/09/2026. O mapa nome antigo → nome novo e o registro dos pontos de código
alterados estão em `docs/_arquivo/padronizacao_nomenclatura_mapa.md` e
`docs/_arquivo/padronizacao_nomenclatura_ajustes_frontend.md` (registro aplicado; útil para ler
código ou dado antigo).

## Relacionadas

- [[banco-e-migrations]] — onde os nomes entram
- [[rpc-e-contrato]] — os nomes das RPCs no contrato
