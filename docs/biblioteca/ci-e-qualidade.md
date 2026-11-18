---
tipo: referencia
area: testes
atualizado: 2026-11-17
---

# CI, checagens e scripts

Todo Pull Request para `main` roda `.github/workflows/build-and-smoke.yml` ("AgSUS Monitora Quality
Gate"). A `main` é protegida: só entra com o check **"Arquitetura, qualidade, build e smoke"** verde.
As checagens são scripts de `scripts/`; esta nota diz o que roda, onde, e o que cada grupo de
scripts faz ou gera.

## O que roda em todo PR

- **Arquitetura, qualidade, build e smoke** (obrigatório): auth, contrato de RPC, sem
  `MutationObserver` novo, sem camadas de remendo, legado só encolhe, timestamps das migrations;
  lint e formatação dos arquivos alterados; Vitest com cobertura, 2 processos e 20 min de limite
  (inclui o teste da biblioteca de documentação; em 18/11/2026 a máquina do GitHub caía em 2 min sem
  log, "The runner has received a shutdown signal": desde o #887 os blocos de um assunto rodam no
  mesmo processo e os bancos PGlite que ninguém fechava se somavam, 8,5 GB num arquivo; o bloco
  agora fecha cada banco, `tests/apoio/bancos-abertos.ts`); `npm run build` (inclui `typecheck`, segurança do HTML e orçamento de
  bundles);
  todos os testes do Playwright sobre o `dist/` desse build, inclusive o app com sessão e o Supabase
  simulados; o smoke e a sessão simulada de novo no servidor TypeScript, e o smoke na imagem Docker.
  Na falha, o relatório e os traces ficam no artefato `relatorio-do-playwright` ([[testes]]).
  O Chromium entra com as dependências do sistema (apt); se o espelho do Ubuntu cair (11/11/2026),
  entra sem elas, com um aviso no job, e o smoke diz se faltou alguma.
- **Python:** Ruff (lint e formatação) e pytest.
- **Contrato de RPC contra o banco de desenvolvimento** (abaixo).

### Validação do banco no CI

O Quality Gate distingue as verificações estáticas, os testes com dados simulados e o contrato de
RPC contra o catálogo real.

- **Em pull request**, o job de banco real fica **skipped** e o resumo informa **NÃO EXECUTADO**.
  Nenhuma credencial de banco é entregue ao código de um PR.
- **Execução real:** rodar manualmente o workflow na `main`, depois da revisão, com
  `SUPABASE_DB_URL_DEV` nos segredos do GitHub (conexão só de desenvolvimento; nunca produção; não
  enviar a credencial em mensagem, commit ou log). Sem o segredo, o job falha antes de instalar e
  consultar (não existe `exit 0` que transforme a falta do banco em aprovação); o resumo só registra
  sucesso depois de `check:rpc-contract:db` terminar com código zero.
- Isso não cria banco de desenvolvimento nem substitui ensaios de RLS, Storage, gravação, rollback
  ou testes de ponta a ponta; migrations continuam exigindo ensaio e registro manual
  ([[banco-e-migrations]]).

**Limitações conhecidas:** os testes de banco são, na maioria, estáticos; a exceção é o PGlite de
`tests/apoio/`. A cobertura mínima configurada é baixa e não comprova cobertura dos fluxos
críticos.

## Comandos locais

```bash
npm run typecheck                        # tsc do front, do servidor e dos testes
npm run lint && npm run format:check     # ESLint e Prettier só nos arquivos alterados
npm run check:architecture               # auth + rpc + MutationObserver + remendos + legado + docs
npm run check:docs                       # links e notas órfãs da biblioteca
npm test                                 # Vitest (rede bloqueada)
python -m pip install -r python/requirements-dev.txt -r scripts/robo-empregare/requirements.txt
python -m pytest && python -m ruff check . && python -m ruff format --check .
```

### `npm run check:architecture`

Roda, em ordem: `check-no-new-mutation-observer.mjs`, `check-no-new-patch-layers.mjs`,
`check-legado-so-encolhe.mjs`, `check-acabamento-so-encolhe.mjs`, `check:auth-architecture`,
`check:rpc-contract`, `check:docs` (`checar-links-da-biblioteca.mjs`: todo `[[link]]` do
`CLAUDE.md` da raiz, dos `CLAUDE.md` das pastas e de `docs/biblioteca/` aponta para uma nota que
existe; nenhuma nota fica sem ser ligada; nenhuma nota repete o nome de outro `.md` do vault;
[[documentacao]]) e `check:lib-por-assunto`.

### `check-lib-sem-arquivo-solto.mjs`

`src/lib/` é organizada por assunto ([[mapa-do-repositorio]], "Assunto → pastas"). Reprova
arquivo solto na raiz de `src/lib/` (só `CLAUDE.md` e `rpc-contrato.ts` ficam ali) e pasta com
mais de 30 arquivos diretos. Roda no `check:architecture` e, no CI, pelo teste que aplica a mesma
regra aos arquivos do repositório (o `check:architecture` não roda no CI). As pastas que já passavam disso quando a organização
foi feita estão em `ACIMA_DO_LIMITE`, com o tamanho daquele dia como teto: só encolhem (hoje,
`avaliacao-documental/` com 55). Teste: `tests/repositorio-e-banco.test.ts` (bloco `scripts/check-lib-sem-arquivo-solto`).

### `check-acabamento-so-encolhe.mjs`

Conta, por arquivo de `src/` (`.css` e, nos `.tsx`, só os literais de string), os desvios de token
que uma máquina enxerga (cor fixa, `!important`, z-index numérico, raio, sombra, curva e animação
de layout, blur fora de camada fixa) e compara com `scripts/acabamento-linha-de-base.json`: o
número de cada tipo só pode cair; arquivo novo entra com limite zero. Corrigiu um lote:
`node scripts/check-acabamento-so-encolhe.mjs --atualizar` baixa a linha de base (e recusa se algum
número subir). Teste: `tests/repositorio-e-banco.test.js` (bloco `check-acabamento-so-encolhe`). Regras de contagem e o marcador
de exceção: [[design-e-tokens]].

## Scripts (`scripts/`)

`scripts/` guarda as ferramentas Node (`*.mjs`) e os jobs Python. Cada script documenta o próprio
uso no comentário do topo: leia só as primeiras ~30 linhas (`sed -n '1,30p'`) antes de rodar.
Prefira o `npm run` equivalente quando houver.

| Grupo                      | Scripts                                                                                                                                                                                                                                                                                                                                                                                                                                                                | O que faz ou gera                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Checagens do build**     | `check-rpc-contract.mjs`, `check-supabase-auth-architecture.mjs`, `check-no-new-mutation-observer.mjs`, `check-no-new-patch-layers.mjs`, `check-legado-so-encolhe.mjs`, `check-acabamento-so-encolhe.mjs`, `check-dist-html-security.mjs`, `check-bundle-size.mjs`, `check-workflow-uniqueness.mjs`, `check-migrations-timestamp-unico.mjs`, `check-lib-sem-arquivo-solto.mjs`, `check-changed-lint.mjs`, `check-changed-format.mjs`, `checar-links-da-biblioteca.mjs` | rodam no build/CI; falha aqui = regra violada: corrija o código (ou a nota), não o script                 |
| **Banco**                  | `check-rpc-contract-db.mjs`, `capturar-baseline-rpcs.mjs`, `estado-das-migrations*.mjs`, `gerar-esquema-atual.mjs` (`npm run db:esquema`), `validar-migration-branding.mjs`, `validar-migration-recusar.mjs`, `carregar-admissoes-conciliadas.mjs` (`--seco`)                                                                                                                                                                                                          | precisam de credencial de banco (`pg`) ([[banco-e-migrations]])                                           |
| **Geografia**              | `compilar-terras-indigenas.mjs`, `compilar-contornos-dos-dseis.mjs`                                                                                                                                                                                                                                                                                                                                                                                                    | geram `public/data/terras-indigenas*.json` e `public/data/contornos-dos-dseis.json` ([[mapas-e-leaflet]]) |
| **AYA**                    | `compilar-conhecimento-aya.mjs` (`npm run aya:conhecimento`)                                                                                                                                                                                                                                                                                                                                                                                                           | gera `src/modules/aya-conhecimento-gerado.js` a partir de `docs/aya/` ([[aya-base-de-conhecimento]])      |
| **Ícones**                 | `gerar-icones-lucide.mjs` (`npm run icones`)                                                                                                                                                                                                                                                                                                                                                                                                                           | gera `src/styles/icones-lucide.css` ([[componentes-padrao]])                                              |
| **Servidor**               | `dev.mjs` (`npm run dev`), `test-servidor-smoke.mjs`                                                                                                                                                                                                                                                                                                                                                                                                                   | [[servidor-web]]                                                                                          |
| **Cargas de planilha**     | `sincronizar-entrevistas.mjs`, `sincronizar-selecao.mjs`, comum em `carga-de-planilha.mjs`; `--seco` só lê                                                                                                                                                                                                                                                                                                                                                             | [[planilhas]]                                                                                             |
| **Classificação**          | `classificacao/classificar-como-a-tela.mjs`, `classificacao/gerar-casos-do-motor.mjs` e o job `classificacao/classificacao.py` (`--calculo`, `--desempate`, `--seco`)                                                                                                                                                                                                                                                                                                  | [[classificacao-por-dentro]]                                                                              |
| **Aprovados**              | `aprovados/contratacao.py` (`--seco`), `aprovados/casamento_da_lista.py` (`--pedido`, `--seco`), `aprovados/pendencias.py`                                                                                                                                                                                                                                                                                                                                             | [[python-e-jobs]]                                                                                         |
| **Painéis**                | `paineis/pacotes.py` (`--seco`, `--caches`)                                                                                                                                                                                                                                                                                                                                                                                                                            | pacotes prontos dos painéis (workflow `pacotes-dos-paineis.yml`)                                          |
| **Conferências e triagem** | `conferencias/conferencias.py`, `pre_classificacao/pre_classificacao.py`                                                                                                                                                                                                                                                                                                                                                                                               | [[modulo-conferencias]], [[modulo-triagem]]                                                               |
| **Robô da Empregare**      | `robo-empregare/` (Python + Selenium)                                                                                                                                                                                                                                                                                                                                                                                                                                  | [[robos-e-agenda]]                                                                                        |
| **Cargos**                 | `cargos/grafias-de-cargo.sql` (só leitura), `cargos/previa_do_casamento.py` (`--grafias`, `--saida`, `--correcao`, `--ensaio-da-correcao`, `--incluir-cargo`, `--ja-gravados`, `--lista-atualizada`)                                                                                                                                                                                                                                                                   | casamento das grafias de cargo com a tabela oficial (20261104150000); regras em `python/monitora/cargos/` |
| **Diversos**               | `medir-cronograma.mjs` (`npm run medir:cronograma`)                                                                                                                                                                                                                                                                                                                                                                                                                    |                                                                                                           |

### Regras dos scripts

- **Arquivo gerado se regenera com o script, nunca se edita à mão.**
- Script novo: nome em português, verbo no infinitivo (`validar-…`, `compilar-…`), comentário de
  topo dizendo por que existe e como rodar, teste em `tests/` quando tiver lógica.
- Não rodar script de banco contra produção sem pedido explícito.

## Relacionadas

- [[testes]] — o que os testes cobrem (Vitest, PGlite, pytest e Playwright)
- [[deploy-e-vercel]] — o PR até o merge e a publicação
- [[regras-do-codigo]] — as regras que as checagens guardam
- [[banco-e-migrations]] — os scripts de banco e o registro das migrations
- [[comandos-e-ambiente]] — os outros comandos do dia a dia
