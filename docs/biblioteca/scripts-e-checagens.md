---
tipo: referencia
area: operacao
atualizado: 2026-11-10
---

# Scripts e checagens

`scripts/` guarda as ferramentas Node (`*.mjs`) e os jobs Python. Cada script documenta o próprio
uso no comentário do topo: leia só as primeiras ~30 linhas (`sed -n '1,30p'`) antes de rodar.
Prefira o `npm run` equivalente quando houver.

## Grupos

| Grupo                  | Scripts                                                                                                                                                                                                 | Observação |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **Checagens do build** | `check-rpc-contract.mjs`, `check-supabase-auth-architecture.mjs`, `check-no-new-mutation-observer.mjs`, `check-no-new-patch-layers.mjs`, `check-legado-so-encolhe.mjs`, `check-dist-html-security.mjs`, `check-bundle-size.mjs`, `check-workflow-uniqueness.mjs`, `check-migrations-timestamp-unico.mjs`, `check-changed-lint.mjs`, `check-changed-format.mjs`, `checar-links-da-biblioteca.mjs` | rodam no build/CI; falha aqui = regra violada: corrija o código (ou a nota), não o script |
| **Banco**              | `check-rpc-contract-db.mjs`, `capturar-baseline-rpcs.mjs`, `estado-das-migrations*.mjs`, `gerar-esquema-atual.mjs` (`npm run db:esquema`), `validar-migration-branding.mjs`, `validar-migration-recusar.mjs` | precisam de credencial de banco (`pg`) |
| **Geografia**          | `compilar-terras-indigenas.mjs`, `compilar-contornos-dos-dseis.mjs`                                                                                                                                      | geram `public/data/terras-indigenas*.json` e `public/data/contornos-dos-dseis.json` ([[terras-indigenas]]) |
| **AYA**                | `compilar-conhecimento-aya.mjs` (`npm run aya:conhecimento`)                                                                                                                                             | gera `src/modules/aya-conhecimento-gerado.js` a partir de `docs/aya/` |
| **Ícones**             | `gerar-icones-lucide.mjs` (`npm run icones`)                                                                                                                                                             | gera `src/styles/icones-lucide.css` ([[icones]]) |
| **Servidor**           | `dev.mjs` (`npm run dev`), `test-servidor-smoke.mjs`                                                                                                                                                     | [[servidor-web]] |
| **Cargas de planilha** | `sincronizar-entrevistas.mjs`, `sincronizar-selecao.mjs`, comum em `carga-de-planilha.mjs`; `--seco` só lê                                                                                              | [[cargas-de-planilha]] |
| **Classificação**      | `classificacao/classificar-como-a-tela.mjs`, `classificacao/gerar-casos-do-motor.mjs` e o job `classificacao/classificacao.py` (`--calculo`, `--desempate`, `--seco`)                                    | [[classificacao-em-python]] |
| **Aprovados**          | `aprovados/contratacao.py` (`--seco`), `aprovados/casamento_da_lista.py` (`--pedido`, `--seco`), `aprovados/pendencias.py`                                                                               | [[python-e-jobs]] |
| **Painéis**            | `paineis/pacotes.py` (`--seco`, `--caches`)                                                                                                                                                              | pacotes prontos dos painéis (workflow `pacotes-dos-paineis.yml`) |
| **Conferências e triagem** | `conferencias/conferencias.py`, `pre_classificacao/pre_classificacao.py`                                                                                                                             | [[modulo-conferencias]], [[modulo-triagem]] |
| **Robô da Empregare**  | `robo-empregare/` (Python + Selenium)                                                                                                                                                                    | [[robos-e-agenda]] |
| **Cargos**             | `cargos/grafias-de-cargo.sql` (só leitura), `cargos/previa_do_casamento.py` (`--grafias`, `--saida`, `--correcao`, `--ensaio-da-correcao`, `--incluir-cargo`, `--ja-gravados`, `--lista-atualizada`) | casamento das grafias de cargo com a tabela oficial (20261104150000); regras em `python/monitora/cargos/` |
| **Diversos**           | `medir-cronograma.mjs` (`npm run medir:cronograma`)                                                                                                                                                     |            |

## `npm run check:architecture`

Roda, em ordem: `check-no-new-mutation-observer.mjs`, `check-no-new-patch-layers.mjs`,
`check-legado-so-encolhe.mjs`, `check:auth-architecture`, `check:rpc-contract` e `check:docs`
(`checar-links-da-biblioteca.mjs`: todo `[[link]]` do `CLAUDE.md` da raiz, dos `CLAUDE.md` das
pastas e de `docs/biblioteca/` aponta para uma nota que existe; nenhuma nota fica sem ser ligada;
nenhuma nota repete o nome de outro `.md` do vault; [[documentacao]]).

## Regras

- **Arquivo gerado se regenera com o script, nunca se edita à mão.**
- Script novo: nome em português, verbo no infinitivo (`validar-…`, `compilar-…`), comentário de
  topo dizendo por que existe e como rodar, teste em `tests/` quando tiver lógica.
- Não rodar script de banco contra produção sem pedido explícito.

## Relacionadas

- [[ci-e-qualidade]] — onde as checagens rodam
- [[regras-do-codigo]] — as regras que as checagens guardam
- [[banco-e-migrations]] — os scripts de banco
