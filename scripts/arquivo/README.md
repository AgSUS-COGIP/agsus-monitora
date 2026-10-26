# `scripts/arquivo/` — scripts que já cumpriram o papel

Ficam aqui para consulta e para reproduzir o que foi feito. Nenhum roda no build, no CI ou em
workflow; os testes que os cobrem continuam em `tests/`, apontando para este caminho.

| Script                                    | Usado em      | Para quê                                                                                                                                                                                   |
| ----------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auditar-coordenadas.mjs`                 | 14/09/2026    | Auditoria geográfica do mapa: mede a procedência e os problemas das coordenadas do `lmap` (`docs/auditoria-geografica.md`). Substituída pela auditoria oficial de 01–02/10/2026.           |
| `relatorio-reconciliacao.mjs`             | 14/09/2026    | Pares de unidades que vinham das duas fontes do mapa, para a mesma auditoria. Lê pelo `auditar-coordenadas.mjs`.                                                                           |
| `malhas-dos-municipios.mjs`               | 22–23/09/2026 | Baixa e consulta as malhas municipais do IBGE (cache em `.cache/`); usado pelo `localizar-sedes-dos-dsei.mjs`.                                                                             |
| `localizar-sedes-dos-dsei.mjs`            | 23/09/2026    | Gerou `docs/sedes-dos-dsei.md` e a correção `supabase/correcoes/20260923-leva-as-sedes-dos-dsei-ao-endereco.sql`.                                                                          |
| `exportar-retratos-do-rascunho.mjs`       | 23/10/2026    | Exportou (só SELECT) os retratos do rascunho antes da correção `supabase/correcoes/20261023-compactar-retratos-do-rascunho.sql`; também lê de volta um retrato do arquivo exportado.       |
| `experiencia_ate_o_fim_das_inscricoes.py` | 23/10/2026    | Correção de dados do edital 114/2026: recalculou só a experiência das fichas concluídas, com o corte no fim das inscrições (RPC `corrigir_experiencia_da_ficha`, conta do setor). Uma vez. |

Os comentários de topo de cada script ainda explicam como rodar; os caminhos já estão com
`scripts/arquivo/`. Não rodar contra produção sem pedido explícito.
