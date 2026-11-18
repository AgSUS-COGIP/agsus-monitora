# Organização por assunto: achar as coisas pelo nome da tela

Data: 2026-11-17 · Estado: aguardando aprovação

## Intenção e porquê

Quem trabalha no MONITORA se perde procurando arquivo. A causa não é a arquitetura (telas em
`src/modulos/`, lógica em `src/lib/`, visual em `src/ui/` já separam bem as camadas), e sim três
pilhas de arquivos soltos, em ordem alfabética, sem agrupamento:

| Pilha             | Arquivos soltos na raiz da pasta |
| ----------------- | -------------------------------- |
| `src/lib/`        | 244                              |
| `tests/`          | 337                              |
| `scripts/`        | 35                               |
| `src/styles/`     | 20                               |

O pedido original foi "arquitetura MVC". O que se quer de fato é **encontrar rápido**. A separação
do MVC já existe aqui com outros nomes (`src/lib/` = modelo e regras; `src/modulos/` + `src/ui/` =
visão; `src/app/` = coordenação). Falta o segundo nível: o **assunto**.

## Objetivo

Quem procura "entrevistas" encontra, sob o mesmo nome de pasta:

```
src/modulos/entrevistas/     a tela
src/lib/entrevistas/         a lógica
tests/modulos/entrevistas/   os testes da tela
tests/lib/entrevistas/       os testes da lógica
```

Critério de pronto: nenhuma das quatro pilhas tem mais que um punhado de arquivos soltos, e
[[mapa-do-repositorio]] tem uma tabela "assunto → pastas".

## Fora do escopo

- Pastas `models/`, `views/`, `controllers/`.
- Mudar comportamento, renomear função, dividir ou juntar arquivo. **É só mover e ajustar caminho.**
- Converter `.js` em `.ts`, migrar legado, mexer em `src/modulos/`, `src/ui/`, `src/app/`,
  `python/`, `supabase/`.
- A raiz do repositório: `api/`, `auth/callback.html`, `icons/`, `index.html`, `sw.js`,
  `offline.html`, `manifest.webmanifest` e os arquivos de configuração estão onde a Vercel, o Vite
  e as URLs públicas exigem. Ficam.

## O que tornaria isto um fracasso

- Build, teste ou checagem quebrados em `main` por causa de uma etapa.
- Documentação apontando para caminho que não existe mais (`check:docs` não pega caminho de
  código; é preciso `grep`).
- Histórico do git perdido (mover sem `git mv`).
- Um PR gigante que conflita com todo trabalho em andamento.

## Caminhos considerados

- **A. Agrupar por assunto, espelhando os módulos (escolhido pelo João).** Mantém as regras e
  checagens do projeto; a mudança é mecânica e pode ser feita em etapas.
- **B. MVC dentro de cada módulo** (`src/modulos/x/{modelo,visao,controle}`). Junta tudo de uma
  tela, mas a lógica compartilhada entre telas fica sem dono, contraria "lógica pura em
  `src/lib/`" e obriga a reescrever checagens e a biblioteca. Maior e mais arriscado.
- **C. MVC global na raiz.** Espalha cada tela por três árvores distantes: piora o problema.

## Desenho

### Regra de destino (vale para `src/lib/` e para os testes)

1. O nome da pasta de assunto é **o mesmo de `src/modulos/<nome>/`** quando o arquivo serve a uma
   tela só (ou principalmente a ela).
2. Arquivo usado por várias telas vai para uma pasta de assunto técnico (lista abaixo).
3. Na dúvida, decide o grafo de imports: quem mais importa o arquivo é o dono.
4. O nome do arquivo **não muda** nesta rodada (nem para tirar o prefixo repetido): assim o
   `grep` pelo nome antigo continua achando, e o diff é só de caminho.

### Pastas de `src/lib/`

Já existem e ficam: `avaliacao-documental/`, `classificacao/`, `triagem/`.

De tela (mesmo nome do módulo), com exemplos do que entra:

| Pasta                    | Exemplos                                                                 |
| ------------------------ | ------------------------------------------------------------------------ |
| `acessos/`               | `access-roles`, `convite-de-acesso`, `matriz-de-acessos`, `ver-como`      |
| `analises/`              | `analises-curriculares`, `*-do-painel-de-analises`, `ritmo-da-analise`    |
| `aprovados/`             | `aprovados-*`, `carta-de-convocacao*`, `lista-*-rules`, `publicacao-de-aprovados` |
| `automacao/`             | `catalogo-dos-robos`, `agenda-do-cron`, `robos-de-carga`, `saude-das-cargas` |
| `aya/`                   | `aya-*`, `*-da-aya`; a pasta `aya-tours/` vira `aya/tours/`               |
| `comemoracao/`           | `fogos*`, `comemoracao`, `*-comemoracoes`, `motor-de-efeitos`             |
| `conferencias/`          | `avisos-de-conferencia`, `texto-da-conferencia`                           |
| `configuracoes/`         | `apresentacao-das-configuracoes`, `publicacao-de-configuracoes`           |
| `cronograma/`            | `cronograma-do-edital`, `datas-do-cronograma`, `retificacao-do-cronograma` |
| `editais/`               | `editais-*`, `ciclo-do-edital`, `etapas-de-edital`, `numero-do-edital`    |
| `encerramento-do-edital/`| `encerramento-do-edital`, `pendencias-do-edital`                          |
| `entrevistas/`           | `agenda-das-entrevistas`, `conducao-de-entrevista`, `roteiro-de-entrevista` |
| `mapas/`                 | `mapa-*`, `filtros-do-mapa`, `fabrica-do-leaflet`, `coordenadas-*`, `uf-ibge`; recebe `mapa-saude-indigena/` e `terras-indigenas/` como subpastas |
| `paineis/`               | `fontes-dos-paineis`, `relatorios-dos-paineis`, `pagina-do-painel`        |
| `recursos/`              | `recursos-dos-candidatos`, `parecer-do-recurso`; recebe `parecer-em-blocos/` |
| `regras-do-edital/`      | `regras-do-edital*`, `rascunho-da-regra`                                  |
| `resumo-do-dia/`         | `resumo-do-dia`                                                           |
| `selecao/`               | `selecao-*`                                                               |
| `visao-geral/`           | `visao-geral*`, `criticos-da-visao-geral`, `relatorio-da-visao-geral*`    |

Técnicas (servem a várias telas):

| Pasta          | Exemplos                                                                           |
| -------------- | ---------------------------------------------------------------------------------- |
| `sessao/`      | `sessao`, `session-lifecycle`, `supabaseClient`, `auth-flow`, `novas-tentativas`, `copia-da-sessao`, `env` |
| `seguranca/`   | `sanitize`, `html-security`, `csv-security`, `csp-report-monitor`                  |
| `entrada/`     | `access-branding*`, `boas-vindas`, `esqueleto-da-entrada`, `loading-copy`          |
| `navegacao/`   | `rotas`, `navegacao`, `menu-lateral`, `modulos-e-abas`, `busca-global`, `link-interno` |
| `carga/`       | `cache-de-payload`, `carga-continua`, `carga-de-telas`, `falha-de-rede`            |
| `base/`        | `formatters`, `contraste`, `erro-amigavel`, `planilhas`, `chartjs-global`          |

Fica solto na raiz de `src/lib/`: **só `rpc-contrato.ts`** (contrato de todo o sistema, citado
nas regras centrais e lido por três scripts de checagem) e o `CLAUDE.md`.

A tabela dá a pasta e exemplos; o destino de cada um dos 244 arquivos é do construtor, pela regra
de destino. Ele entrega a lista completa (origem → destino) no PR.

### Testes

- `tests/lib/<assunto>/` e `tests/modulos/<nome>/` com os mesmos nomes de `src/`.
- Teste de script vai para `tests/scripts/`; de Apps Script, `tests/apps-script/`; de API,
  `tests/api/`; de arquitetura e configuração do repositório (`actions-por-sha`,
  `arquitetura-typescript`…), `tests/repositorio/`.
- Specs do Playwright (`*.spec.js`) vão para `tests/e2e/`, com ajuste em `playwright.config.js`,
  no script `test:smoke` e nos workflows.
- As subpastas que já existem (`apoio`, `fixtures`, `setup`, `python`, `sql`, `tipos`, `ui`,
  `app`, `componentes`) ficam; `tests/lib/` e `tests/modulos/` ganham o nível de assunto.

### Scripts

`scripts/checagens/` (`check-*`, `checar-*`, linhas de base), `scripts/banco/` (migrations,
esquema, baseline, validar-*), `scripts/geradores/` (`compilar-*`, `gerar-*`), `scripts/cargas/`
(`sincronizar-*`, `carga-de-planilha`, `carregar-*`), `scripts/dev/` (`dev.mjs`,
`servir-api-no-vite.mjs`, smoke). As subpastas atuais ficam. Ajusta `package.json`, workflows e
documentação.

### CSS

Só agrupar em subpastas (`base/`, `casca/`, `mapas/`, `ajustes/`), **sem mudar a ordem de import
em `src/main.ts`** e sem juntar nem renomear arquivo: a ordem define a cascata.

## Como se faz

- Uma etapa por PR, nesta ordem: **1** `src/lib/` · **2** `tests/` · **3** `scripts/` · **4**
  `src/styles/` · **5** documentação final. A etapa 1 pode ser quebrada em PRs por grupo de
  assuntos se o diff ficar difícil de revisar.
- Cada etapa: `git mv` + reescrita automática dos caminhos (imports relativos em `src/`,
  `tests/`, `api/`, `server/`, `scripts/`, `vite.config.js`; e menções de caminho em `docs/`,
  nos `CLAUDE.md`, em `DESIGN.md`, em comentários de `python/` e nos workflows). Hoje há 492
  menções a `src/lib/<arquivo>` em 119 arquivos fora de `src/` e `tests/`.
- A reescrita é feita por script descartável (não entra no repositório), não à mão.
- Cuidados conhecidos:
  - 464 testes leem arquivo-fonte por caminho (`readFileSync`) ou citam `src/lib/`: esses
    caminhos são texto, o TypeScript não acusa.
  - Linhas de base das checagens (`scripts/acabamento-linha-de-base.json`,
    `check-legado-so-encolhe`, `check-no-new-patch-layers`) podem listar arquivos por caminho.
  - `docs/superpowers/` e `docs/_arquivo/` são história: não se reescrevem.
- Verificação de cada etapa, antes do PR: `npm run typecheck`, `npm run check:architecture`,
  `npm run lint && npm run format:check`, `npm test` e `npm run build`. A etapa 2 roda também
  `npm run test:e2e`. Depois, `grep` pelos caminhos antigos tem de voltar vazio (fora da história).
- Para não conflitar: cada etapa parte de `main` atualizada e entra rápido; antes de começar, o
  trabalho em aberto (hoje o ramo `correcao/mapa-ponto-sem-cep`) é mesclado ou avisado.

## O que a reescrita de caminhos tem de cobrir (conferido no repositório)

Não basta tratar `import … from`. O script de reescrita cobre, em cada etapa:

1. **Imports nos três estilos**: sem extensão, `.ts` e `.js` (`api/*.ts` importa
   `../src/lib/editais-da-api.js`; `vite.config.js` importa `./src/lib/html-security`).
2. **Profundidade**: arquivo que desce um nível muda todo caminho relativo que sai dele, inclusive
   `new URL("../", import.meta.url)`, `resolve(dirname(…), "..")` e afins (`scripts/dev.mjs`,
   `compilar-terras-indigenas.mjs`, `compilar-contornos-dos-dseis.mjs`, `carga-de-planilha.mjs`,
   `gerar-icones-lucide.mjs`, `test-servidor-smoke.mjs`, `compilar-conhecimento-aya.mjs`; 8 testes
   usam `import.meta.url`, `__dirname` ou `process.cwd`).
3. **Caminho escrito como texto**:
   - `scripts/check-supabase-auth-architecture.mjs` tem a lista de permitidos com
     `"src/lib/supabaseClient.ts"`: muda junto, senão a checagem de auth quebra.
   - `tests/aya-tours.test.js` e `tests/app/gaveta-do-celular.test.ts` leem a pasta
     `src/lib/aya-tours` com `readdirSync`.
   - `scripts/compilar-contornos-dos-dseis.mjs` importa de `src/lib/mapa-saude-indigena/`.
   - `tests/funcoes-da-vercel-leves.test.js` afere o pacote das funções por caminho
     (`includeFiles`/`excludeFiles` em `api/`).
4. **Linha de base do acabamento**: `scripts/acabamento-linha-de-base.json` é indexada por
   caminho (inclui `src/styles/*.css`). Na etapa do CSS as **chaves são renomeadas uma a uma, com
   os valores intactos**; nunca `--atualizar`, que esconderia regressão. O diff do JSON tem de
   mostrar só chaves trocadas.
5. **`package.json`** (cerca de 33 chamadas `node scripts/…`), **workflows** que chamam `.mjs`
   movido, `test:smoke` e `build-and-smoke.yml` (`tests/smoke.spec.js`,
   `tests/sessao-simulada.spec.js`). O `playwright.config.js` já casa `**/*.spec.js` e não muda.
   Os jobs Python em `scripts/<job>/` não se movem, então `pytest.ini`, `ruff.toml`,
   `pyproject.toml` e os workflows de Python ficam como estão.
6. **Comentários em Python**: `python/monitora/**`, `tests/python/**` e `scripts/**/*.py` citam
   caminhos de TypeScript e de testes; entram na reescrita para o `grep` final voltar vazio.
7. **`docs/aya/`**: os arquivos não mudam de lugar, mas citam caminhos de código 273 vezes em 22
   notas. Em cada etapa corrigem-se os caminhos movidos e roda-se `npm run aya:conhecimento`; o
   arquivo gerado (`src/modules/aya-conhecimento-gerado.js`) muda junto. É a única mudança que
   chega ao app: a Aya passa a citar o caminho novo. Os testes que leem `docs/aya/` rodam na
   verificação da etapa.

Conferido e sem risco: `vitest.config.js`, `tsconfig*.json` e `eslint.config.js` usam globs que
aceitam subpastas; `Dockerfile` e `vercel.json` não citam `src/lib` nem `tests`; nenhum workflow
filtra por `paths:`. Antes da etapa 1, confirmar que `check-no-new-patch-layers` e
`check-legado-so-encolhe` não tratam arquivo movido com `git mv` como arquivo novo.

## Ajustes ao desenho depois da revisão

- **A etapa 1 já reescreve os imports dos testes** (eles apontam para `src/lib/`); a etapa 2 só
  muda os testes de lugar.
- **Ajudantes de teste soltos** (`supabase-falso.ts`, `montar-tela.ts`, `dom.ts`,
  `clientes-falsos.ts`, `indexeddb-falso.js`, `pagina-montada.ts`, `definido.ts`,
  `fonte-do-app.ts`, `casos-do-parecer.js` e parecidos) vão para `tests/apoio/`.
  `tests/globais.d.ts` fica na raiz de `tests/`.
- **`tests/modules/`** (teste do legado) fica: espelha `src/modules/` e some com ele.
- **Critério de pronto, com número**: zero arquivo de código solto em `src/lib/` além de
  `rpc-contrato.ts`; zero `*.test.*`/`*.spec.js` solto em `tests/`; nenhuma pasta de assunto com
  mais de 30 arquivos diretos (passou disso, ganha subpasta). `base/` e `carga/` não são gaveta:
  só entra o que três ou mais assuntos usam.

## Documentação que muda

`CLAUDE.md` da raiz, `src/lib/CLAUDE.md`, `tests/CLAUDE.md`, `scripts/CLAUDE.md`,
[[mapa-do-repositorio]] (ganha a tabela "assunto → pastas"), [[logica-em-src-lib]],
[[arquitetura-do-front]], [[testes]], [[scripts-e-checagens]] e as notas de módulo que citam
caminho. A regra "arquivo novo de lógica entra na pasta do assunto, nunca solto" passa a constar
em `src/lib/CLAUDE.md` e `tests/CLAUDE.md`.

## Decisões minhas (Claude), não combinadas com o João

- Nomes das pastas técnicas (`sessao`, `seguranca`, `entrada`, `navegacao`, `carga`, `base`).
- `rpc-contrato.ts` fica na raiz de `src/lib/`.
- Nome de arquivo não muda nesta rodada.
- Specs do Playwright em `tests/e2e/`.
- CSS só se agrupa; não se renomeia nem se junta.
- A raiz do repositório fica como está.
- Ordem das etapas e um PR por etapa.

## Fica para o construtor

- O destino de cada arquivo, pela regra de destino.
- Como escrever o script de reescrita.
- Em quantos PRs quebrar a etapa 1.
- Uma checagem nova que impeça arquivo solto em `src/lib/` e `tests/` (desejável; propor no plano).
