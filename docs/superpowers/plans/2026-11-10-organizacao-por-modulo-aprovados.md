---
tags:
  - tipo/desenho
  - area/front
  - area/aprovados
---

# Organização por módulo: piloto Aprovados — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado)
> ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam caixas
> (`- [ ]`) para acompanhamento.

**Objetivo:** reunir tudo do módulo Aprovados em `src/modulos/aprovados/` (telas, `regras/` com porta
de entrada e `CLAUDE.md`) e todos os testes dele em `tests/aprovados/`, sem mudar comportamento.

**Arquitetura:** os 24 arquivos de regra saem de `src/lib/` para `src/modulos/aprovados/regras/` com
`git mv` (mesmo nome). Um `regras/index.ts` exporta só o que código de fora do módulo usa hoje. Duas
regras do ESLint guardam a fronteira (de fora, só pelo `index.ts`) e a pureza (`regras/` sem React).
Os testes do módulo vão para `tests/aprovados/`, com só os caminhos atualizados.

**Tecnologias:** Vite, React, TypeScript (`allowImportingTsExtensions`, `verbatimModuleSyntax`),
ESLint 9 (flat config), Vitest, tsc.

**Desenho:** `docs/superpowers/specs/2026-11-10-organizacao-por-modulo-design.md` — leia antes.

## Restrições globais

- Nenhuma mudança de lógica, de nome de função ou de comportamento. Só lugar, caminho de import e
  fronteira.
- **Nomes de arquivo mantidos** (chamada deste plano, que o desenho deixou ao construtor): os 24
  arquivos de regra e os testes movidos guardam o nome atual. Menos diff, histórico do `git mv`
  preservado; renomear fica para depois, se o usuário pedir.
- Imports com extensão explícita, como o projeto faz (`"./regras/index.ts"`, nunca pasta sem
  arquivo). Tipo exportado pelo `index.ts` com `export type` (`verbatimModuleSyntax`).
- Sem `export *` no `index.ts`.
- Testes não mudam de conteúdo, só de caminho. O total de testes do Vitest é o mesmo antes e depois.
- Português em nomes, commits e docs. Commits terminam com
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tem de passar no fim: `npm run typecheck`, `npm test`, `npm run lint`, `npm run check:architecture`,
  `npm run build`.

## Foco da revisão

1. **Caminho antigo esquecido em texto** (docs, `CLAUDE.md`, base da Aya, comentários): ninguém
   deve achar `src/lib/<arquivo do conjunto>` depois da mudança. Coberto pela busca da Tarefa 4.
2. **Ciclo de execução entre `regras/index.ts` e `lib/classificacao/`**: `convocacao-do-edital.ts`
   importa o `index.ts`, que carrega `carta-de-convocacao-documento.ts`, que importa
   `lib/classificacao/documento-sei.ts`. Um ciclo daria erro de inicialização (TDZ) só em tempo de
   execução. Coberto pelos testes existentes de Classificação e pelo passo de ciclo da Tarefa 1.
3. **Pacote maior**: a Classificação, ao importar o `index.ts`, passa a carregar todas as regras de
   Aprovados (inclusive a geração de documento). Coberto pelo `npm run build`
   (`check:bundle-size`) da Tarefa 4.
4. **Testes que somem**: um teste movido que deixa de ser achado (pasta, extensão, `tsconfig`)
   passa despercebido porque nada falha. Coberto pela contagem antes × depois da Tarefa 3.
5. **Teste de tipos fora da checagem**: `tests/aprovados/tipos/*.tsx` precisa ser pego pelo
   `tsconfig.frontend.json` e não pelo `tsconfig.tests.json`. Coberto pelo passo de erro proposital
   da Tarefa 3.

---

### Tarefa 0: Área de trabalho e linha de base

O usuário está no branch `docs/organizacao-obsidian`, com trabalho não commitado. Nada dele pode
ser tocado: o piloto roda numa **worktree** separada, a partir do `origin/main`.

- [ ] **Passo 1: Criar a worktree**

```bash
cd C:/Users/joao.armandes/Desktop/Projetos/agsus-monitora
git fetch origin
git worktree add ../agsus-monitora-aprovados -b organizacao/modulo-aprovados origin/main
cd ../agsus-monitora-aprovados && npm ci
```

Esperado: worktree criada, `npm ci` sem erro.

- [ ] **Passo 2: Trazer o desenho e o plano**

Copiar da worktree original para a nova, nos mesmos caminhos:
`docs/superpowers/specs/2026-11-10-organizacao-por-modulo-design.md` e
`docs/superpowers/plans/2026-11-10-organizacao-por-modulo-aprovados.md`. Em `docs/README.md`, na
seção "Arquitetura e decisões", depois da linha do TypeScript, acrescentar:

```markdown
- [Organização por módulo](superpowers/specs/2026-11-10-organizacao-por-modulo-design.md): regras, `CLAUDE.md` e testes por módulo; piloto em Aprovados ([plano](superpowers/plans/2026-11-10-organizacao-por-modulo-aprovados.md)).
```

- [ ] **Passo 3: Conferir que o levantamento ainda vale**

O `main` andou desde 10/11. Rodar:

```bash
ls src/lib/{aprovados-e-cronograma-da-api,aprovados-import,tipos-da-importacao-de-aprovados,candidatos-aprovados-compactos,carta-de-convocacao,carta-de-convocacao-documento,dados-da-carta,tipos-da-carta,dados-da-publicacao-de-aprovados,publicacao-de-aprovados,tipos-da-publicacao-de-aprovados,dados-do-estado-de-aprovados,tipos-do-estado-de-aprovados,dados-do-historico-de-publicacoes,lista-aprovados-rules,tipos-das-regras-de-aprovados,lista-convocacao-rules,tipos-da-lista-de-convocacao,ordem-dos-aprovados,configuracao-de-convocacao,modelo-de-convocacao,dados-da-configuracao-de-convocacao,tipos-da-configuracao-de-convocacao,anexos-do-candidato}.ts
```

Esperado: os 24 existem. Se algum sumiu ou surgiu arquivo novo de Aprovados em `src/lib/`, parar e
avisar o usuário.

- [ ] **Passo 4: Linha de base**

```bash
npx vitest run 2>&1 | tail -5     # anotar "Tests  N passed" e "Test Files  M passed"
npm run typecheck && npm run check:architecture
```

Esperado: tudo verde. Anotar N e M no PR. Se algo já falha no `main`, anotar e não corrigir.

- [ ] **Passo 5: Commit**

```bash
git add docs/superpowers docs/README.md
git commit -m "Desenho e plano: organização por módulo, piloto em Aprovados"
```

---

### Tarefa 1: Regras de Aprovados em `src/modulos/aprovados/regras/`

**Arquivos:**
- Mover (`git mv`, mesmo nome): os 24 arquivos do Passo 3 da Tarefa 0, de `src/lib/` para
  `src/modulos/aprovados/regras/`.
- Criar: `src/modulos/aprovados/regras/index.ts`.
- Modificar: todo arquivo de `src/` que importa algum deles (telas de `src/modulos/aprovados/`,
  incluindo as subpastas `carta-de-convocacao/` e `pendencias/`; `src/modulos/classificacao/estado.ts`
  e `publicar-aprovados.tsx`; `src/lib/classificacao/convocacao-do-edital.ts`, `dados-do-motor.ts`,
  `tipos-das-vagas.ts`), e os imports dentro dos 24 que apontam para o compartilhado.
- Modificar: imports dos testes que apontam para os 24 (só o caminho; a mudança de pasta dos
  testes é na Tarefa 3).

**Interfaces:**
- Produz `src/modulos/aprovados/regras/index.ts`, a porta de entrada, com exatamente:

| De | Valores | Tipos |
|---|---|---|
| `publicacao-de-aprovados.ts` | `candidatosDaListaFinal`, `MOTIVO_MAXIMO`, `motivoValido`, `origemDaLista` | |
| `dados-da-publicacao-de-aprovados.ts` | `situacaoDaPublicacao`, `resultadoDaPublicacao` | |
| `tipos-da-publicacao-de-aprovados.ts` | | `ResultadoDaPublicacao` |
| `configuracao-de-convocacao.ts` | `configuracaoDaVaga`, `lerConfiguracoesDoBanco`, `lerModelosDoBanco` | |
| `lista-convocacao-rules.ts` | `derivarQuadro` | |
| `modelo-de-convocacao.ts` | `normalizarModelo` | |
| `tipos-da-configuracao-de-convocacao.ts` | | `CategoriaDaConvocacao`, `ModeloDaConvocacao` |

  Se o `main` atual tiver outro import de fora do módulo (Passo 2), o nome entra na tabela.
- Quem é de fora do módulo (`src/modulos/classificacao/`, `src/lib/classificacao/`) importa só de
  `…/modulos/aprovados/regras/index.ts`. As telas do próprio módulo importam direto
  (`./regras/<arquivo>.ts`).

- [ ] **Passo 1: Mover os arquivos**

`git mv src/lib/<arquivo>.ts src/modulos/aprovados/regras/<arquivo>.ts` para cada um dos 24.

- [ ] **Passo 2: Levantar os importadores de fora**

```bash
grep -rnE 'lib/(aprovados-e-cronograma-da-api|aprovados-import|…os 24…)\.ts"' src --include=*.ts --include=*.tsx --include=*.js | grep -v '^src/modulos/aprovados/'
```

Esperado: só os 5 arquivos de Classificação listados acima. Arquivo a mais → nome a mais na tabela.

- [ ] **Passo 3: Ver o typecheck quebrar**

Run: `npm run typecheck:frontend`
Esperado: FALHA, com "Cannot find module" nos imports antigos. É a lista do que corrigir.

- [ ] **Passo 4: Corrigir os caminhos e criar o `index.ts`**

- Dentro dos 24: `./<compartilhado>` vira `../../../lib/<compartilhado>` (ex.:
  `./classificacao/documento-sei.ts` → `../../../lib/classificacao/documento-sei.ts`,
  `../ui/botao-de-acao.tsx` → `../../../ui/botao-de-acao.tsx`); imports entre os 24 continuam `./`.
- Telas de `src/modulos/aprovados/`: `../../lib/<arquivo>.ts` → `./regras/<arquivo>.ts`; nas
  subpastas, `../../../lib/<arquivo>.ts` → `../regras/<arquivo>.ts`.
- Os 5 arquivos de Classificação: o import vira `…/modulos/aprovados/regras/index.ts`
  (`../../modulos/aprovados/regras/index.ts` a partir de `src/lib/classificacao/`;
  `../aprovados/regras/index.ts` a partir de `src/modulos/classificacao/`). Em `tipos-das-vagas.ts`,
  o `import type` e o `export type … from` passam os dois a apontar para o `index.ts`.
- `index.ts`: um `export { … } from "./<arquivo>.ts"` por linha da tabela; `export type { … }` para
  os tipos. Comentário de uma linha no topo: "Porta de entrada das regras de Aprovados: só o que
  código de fora do módulo usa."
- Testes: atualizar só o caminho para `src/modulos/aprovados/regras/<arquivo>.ts`. Inclui
  `vi.mock(...)` e `import(...)` em texto, se houver.

- [ ] **Passo 5: Verificar**

```bash
npm run typecheck
npx vitest run tests/lib/classificacao-convocacao-do-edital.test.js tests/lib/carta-de-convocacao.test.ts tests/lista-convocacao-rules.test.js
npx vitest run 2>&1 | tail -5
```

Esperado: typecheck verde; os três testes passam; total igual ao da linha de base.

- [ ] **Passo 6: Conferir ciclo de execução (Foco 2)**

```bash
npx vite-node -e "await import('./src/lib/classificacao/convocacao-do-edital.ts'); await import('./src/modulos/aprovados/regras/index.ts'); console.log('ok')"
```

Se `vite-node` não estiver disponível sem instalar, usar um teste temporário do Vitest com os dois
`await import(...)` e apagá-lo depois. Esperado: `ok`, sem "Cannot access … before initialization".
Se der ciclo, parar e avisar o usuário (a saída prevista no desenho é o import pelo `index.ts`; não
improvisar outra).

- [ ] **Passo 7: Commit**

```bash
git add -A src tests
git commit -m "Regras de Aprovados em src/modulos/aprovados/regras/, com porta de entrada"
```

---

### Tarefa 2: Fronteira e pureza no ESLint

**Arquivos:**
- Modificar: `eslint.config.js` (dois blocos novos no fim da lista).
- Criar: `tests/aprovados/fronteira-das-regras.test.ts`.

**Interfaces:**
- Consome: a pasta `src/modulos/aprovados/regras/` e o `index.ts` da Tarefa 1.
- Produz: uma lista `MODULOS_ORGANIZADOS = ["aprovados"]` no topo de `eslint.config.js`, de onde os
  dois blocos são gerados. Módulo organizado depois entra nesta lista.

- [ ] **Passo 1: Escrever o teste que falha**

`tests/aprovados/fronteira-das-regras.test.ts`, com `// @vitest-environment node`. Usa
`new ESLint({ cwd: <raiz do repositório> })` e `lintText(codigo, { filePath })`. Os `filePath` são
**arquivos que existem** (o bloco com tipos do ESLint exige arquivo do projeto). Um ajudante
`erros(codigo, filePath)` devolve as mensagens de `no-restricted-imports` (ou
`@typescript-eslint/no-restricted-imports`).

```ts
const DE_FORA = "src/modulos/classificacao/estado.ts";
const DE_DENTRO = "src/modulos/aprovados/estado.ts";
const REGRA = "src/modulos/aprovados/regras/ordem-dos-aprovados.ts";

it("de fora do módulo, importar o interior de regras/ é erro", async () => {
  expect(await erros('import { x } from "../aprovados/regras/publicacao-de-aprovados.ts";', DE_FORA)).not.toHaveLength(0);
});
it("de fora do módulo, importar pelo index.ts é permitido", async () => {
  expect(await erros('import { x } from "../aprovados/regras/index.ts";', DE_FORA)).toHaveLength(0);
});
it("de src/lib/, a mesma fronteira vale", async () => {
  expect(await erros('import { x } from "../../modulos/aprovados/regras/modelo-de-convocacao.ts";',
    "src/lib/classificacao/dados-do-motor.ts")).not.toHaveLength(0);
});
it("dentro do módulo, as telas importam o interior", async () => {
  expect(await erros('import { x } from "./regras/publicacao-de-aprovados.ts";', DE_DENTRO)).toHaveLength(0);
});
it("regras/ não importa react", async () => {
  expect(await erros('import { useState } from "react";', REGRA)).not.toHaveLength(0);
});
it("regras/ não importa tela (.tsx) nem o estado do módulo", async () => {
  expect(await erros('import { A } from "../aba-aprovados.tsx";', REGRA)).not.toHaveLength(0);
  expect(await erros('import { estado } from "../estado.ts";', REGRA)).not.toHaveLength(0);
});
it("regras/ pode importar tipo de .tsx e o compartilhado de src/lib/", async () => {
  expect(await erros('import type { EstadoDaAcao } from "../../../ui/botao-de-acao.tsx";', REGRA)).toHaveLength(0);
  expect(await erros('import { sanitizeCsvCell } from "../../../lib/csv-security";', REGRA)).toHaveLength(0);
});
```

- [ ] **Passo 2: Ver falhar**

Run: `npx vitest run tests/aprovados/fronteira-das-regras.test.ts`
Esperado: FALHA nos casos que pedem erro (a regra ainda não existe).

- [ ] **Passo 3: Escrever os dois blocos em `eslint.config.js`**

Para cada módulo `m` de `MODULOS_ORGANIZADOS`, usando `@typescript-eslint/no-restricted-imports`
(o plugin já está importado como `tsPlugin`; esta versão da regra aceita `allowTypeImports`):

- **Fronteira:** `files: ["src/**/*.{js,jsx,ts,tsx}"]`, `ignores: ["src/modulos/<m>/**"]`; padrão
  `regex: "modulos/<m>/regras/(?!index\\.ts$).+"`, mensagem: "De fora do módulo <m>, importe as
  regras por modulos/<m>/regras/index.ts."
- **Pureza:** `files: ["src/modulos/<m>/regras/**/*.{js,ts}"]`; padrões: `group: ["react",
  "react-dom", "react-dom/*"]` (mensagem: "regras/ é lógica pura: sem React."), e com
  `allowTypeImports: true`, `regex: "\\.tsx$"` e `regex: "^\\.\\./(?!\\.\\./)"` (mensagem:
  "regras/ não importa tela nem estado do módulo; o compartilhado vem de src/lib/.").

Comentário acima dos blocos, no estilo do arquivo, explicando a regra e apontando para o desenho.

- [ ] **Passo 4: Ver passar, e o projeto limpo**

```bash
npx vitest run tests/aprovados/fronteira-das-regras.test.ts
npx eslint src/modulos src/lib/classificacao
```

Esperado: o teste passa; o ESLint não acusa nenhum `no-restricted-imports` no código real. Se acusar,
o import real está errado (corrigir o import, não a regra).

- [ ] **Passo 5: Commit**

```bash
git add eslint.config.js tests/aprovados/fronteira-das-regras.test.ts
git commit -m "ESLint: fronteira e pureza das regras dos módulos organizados (Aprovados)"
```

---

### Tarefa 3: Testes de Aprovados em `tests/aprovados/`

**Arquivos:**
- Mover (`git mv`, mesmo nome), para `tests/aprovados/`: da raiz de `tests/`:
  `anexos-do-candidato.test.js`, `aprovados-e-cronograma-api.test.js`,
  `candidatos-aprovados-compactos.test.js`, `convocacao-mgi-e-saude-indigena.test.js`,
  `lista-aprovados-filtros-multiplos.test.js`, `lista-aprovados-paginacao.test.js`,
  `lista-convocacao-regras-do-edital.test.js`, `lista-convocacao-rules.test.js`,
  `modelo-de-convocacao.test.js`, `ordem-dos-aprovados.test.js`; de `tests/componentes/`:
  `campos-dos-aprovados.test.ts`, `convocado-e-carta.test.ts`, `lista-aprovados.test.ts`,
  `lista-de-convocacao.test.ts`; de `tests/lib/`: `carta-de-convocacao.test.ts`,
  `configuracao-da-convocacao-dados.test.ts`, `contratado-em-outra-lista.test.ts`,
  `convocacao-sub-judice-por-edital.test.ts`, `dados-da-publicacao-de-aprovados.test.ts`,
  `dados-do-estado-de-aprovados.test.ts`, `historicos-dos-aprovados.test.ts`,
  `importacao-xlsx-de-aprovados.test.ts`, `publicacao-de-aprovados.test.ts`; de `tests/modulos/`:
  `carta-confirmacao-e-modelos.test.js`, `carta-de-convocacao-troca-de-area.test.js`.
- Mover para `tests/aprovados/tipos/`: de `tests/tipos/`: `aba-e-regras-de-aprovados.tsx`,
  `base-dos-aprovados.tsx`, `cartas-e-navegador.tsx`, `configuracao-da-convocacao.tsx`,
  `estado-dos-aprovados.tsx`, `lista-de-convocacao.tsx`, `modais-dos-aprovados.tsx`.
- Mover para `tests/aprovados/apoio/`: `tests/modelos-de-convocacao-antigos.ts`,
  `tests/componentes/abertura-dos-aprovados.ts` — **só se** nenhum teste de outro módulo os importar
  (conferir com `grep`); se outro importar, ficam onde estão.
- Ficam: `convocacao-da-entrevista.test.js`, `tipos/convocacao-de-entrevistas.tsx` (Entrevistas),
  `lib/classificacao-convocacao-do-edital.test.js` (Classificação), `modulos/ordem-dos-territorios.test.js`
  (Mapa da saúde indígena), `fixtures/`, `setup/`, `python/`.
- Modificar: `tsconfig.frontend.json` (`include`: `"tests/tipos/**/*.tsx"` →
  `"tests/**/tipos/**/*.tsx"`), `tsconfig.tests.json` (`exclude`: `"tests/tipos/**"` →
  `"tests/**/tipos/**"`).

- [ ] **Passo 1: Conferir os candidatos pelo que importam**

Para cada arquivo da lista, confirmar que ele importa principalmente `src/modulos/aprovados/`
(inclusive `regras/`). Um que importe principalmente outro módulo fica onde está e é anotado no PR.

- [ ] **Passo 2: Mover e corrigir caminhos**

`git mv` de cada um. Corrigir os relativos pela nova profundidade: da raiz de `tests/` (`../src/…`,
`./componentes/…`, `./fixtures/…`) para `tests/aprovados/` (`../../src/…`, `../componentes/…`,
`../fixtures/…`); de `tests/tipos/` para `tests/aprovados/tipos/` (`../../src/…` → `../../../src/…`).
Inclui caminhos dentro de `vi.mock(...)`, `import(...)` e `readFileSync`/`new URL(…)`.

- [ ] **Passo 3: Ajustar os `tsconfig`**

As duas trocas da lista de arquivos.

- [ ] **Passo 4: Provar que os testes de tipos ainda são conferidos (Foco 5)**

Em `tests/aprovados/tipos/base-dos-aprovados.tsx`, acrescentar temporariamente
`const _x: number = "texto";`. Run: `npm run typecheck:frontend`. Esperado: FALHA apontando esse
arquivo. Desfazer a linha.

- [ ] **Passo 5: Verificar (Foco 4)**

```bash
npm run typecheck
npx vitest run tests/aprovados
npx vitest run 2>&1 | tail -5
npm run lint
```

Esperado: tudo verde; o total de testes e de arquivos de teste é **igual** ao da linha de base
(N e M, mais 1 arquivo e os testes de `fronteira-das-regras.test.ts`).

- [ ] **Passo 6: Commit**

```bash
git add -A tests tsconfig.frontend.json tsconfig.tests.json
git commit -m "Testes de Aprovados juntos em tests/aprovados/"
```

---

### Tarefa 4: `CLAUDE.md` do módulo, documentos e base da Aya

**Arquivos:**
- Renomear: `src/modulos/aprovados/README.md` → `src/modulos/aprovados/CLAUDE.md` (`git mv`).
- Modificar: `docs/arquitetura-react.md` (regra 2), `CLAUDE.md` da raiz, `src/lib/CLAUDE.md`,
  `tests/CLAUDE.md`, `src/modulos/README.md`, `src/modulos/classificacao/README.md`,
  `api/CLAUDE.md`, `docs/banco-de-dados.md`, `docs/typescript-no-frontend.md`,
  `docs/historias-de-usuario/lista-de-aprovados.md`, e em `docs/aya/`:
  `regras-da-lista-de-aprovados.md`, `regras-da-classificacao.md`, `regras-dos-editais.md`.
- Regenerar: `src/modules/aya-conhecimento-gerado.js` (`npm run aya:conhecimento`).

- [ ] **Passo 1: Escrever o `CLAUDE.md` do módulo**

Partindo do README renomeado (148 linhas), manter o conteúdo e acrescentar, logo depois do
primeiro parágrafo:

- `## Regras (regras/)`: lógica pura, sem React nem estado do módulo (checado pelo ESLint); a
  tabela do que o `index.ts` oferece (Tarefa 1); de fora do módulo, só pelo `index.ts`.
- `## Testes`: tudo em `tests/aprovados/` (tipos em `tests/aprovados/tipos/`); rodar com
  `npx vitest run tests/aprovados`.

Atualizar no bloco de arquivos os caminhos que mudaram. Não duplicar o que já está no `CLAUDE.md`
da raiz.

- [ ] **Passo 2: Atualizar as regras nos documentos**

- `docs/arquitetura-react.md`, regra 2: "regras em `src/lib/`" → "regras de um módulo em
  `src/modulos/<modulo>/regras/` (lógica pura, porta de entrada `index.ts`); em `src/lib/`, só o
  compartilhado"; na tabela "Onde está cada coisa", a linha `src/lib/` ganha "o que é de um módulo
  só vai para o `regras/` dele, módulo a módulo".
- `CLAUDE.md` da raiz: no Mapa, `src/modulos/` passa a dizer "telas, `regras/` e `CLAUDE.md` por
  módulo"; em "Regras do código", "lógica pura em `src/lib/` + teste" ganha "(ou no `regras/` do
  módulo)"; a linha "Lista de aprovados" do índice aponta para `src/modulos/aprovados/` (com
  `regras/`) e `tests/aprovados/`.
- `src/lib/CLAUDE.md`: um parágrafo com o critério do desenho ("usado por telas de dois ou mais
  módulos fica aqui; de um só vai para `src/modulos/<modulo>/regras/`").
- `tests/CLAUDE.md`: em Subpastas, "teste de um módulo organizado vai em `tests/<modulo>/` (tipos
  em `tests/<modulo>/tipos/`)".
- `src/modulos/README.md`: a forma da pasta de um módulo organizado (`CLAUDE.md`, telas,
  `regras/`).

- [ ] **Passo 3: Trocar os caminhos antigos em todo o texto, e regenerar a Aya**

Trocar `src/lib/<arquivo do conjunto>` por `src/modulos/aprovados/regras/<arquivo>` em todos os
arquivos da lista acima (os da Aya estão no campo `fonte`). Depois:

```bash
npm run aya:conhecimento
git diff --stat src/modules/aya-conhecimento-gerado.js
```

Esperado: o gerado muda só nos caminhos.

- [ ] **Passo 4: Nenhum caminho antigo sobrou (Foco 1)**

```bash
grep -rnE 'src/lib/(…os 24, separados por |…)\b' --exclude-dir={node_modules,dist,.git} --exclude-dir=superpowers .
```

Esperado: nenhuma linha. (A pasta `docs/superpowers/` fica de fora: o desenho e o plano descrevem o
antes.)

- [ ] **Passo 5: Verificação final (Foco 3)**

```bash
npm run typecheck && npm run lint && npm run check:architecture && npm test && npm run build
```

Esperado: tudo verde, inclusive `check:bundle-size`. Se o tamanho estourar por causa da
Classificação carregar o `index.ts`, parar e avisar o usuário com o número.

- [ ] **Passo 6: Commit**

```bash
git add -A
git commit -m "CLAUDE.md do módulo Aprovados, regra das pastas por módulo nos docs e base da Aya"
```

- [ ] **Passo 7: Entregar**

Mostrar ao usuário o resumo (arquivos movidos, o `index.ts`, contagem de testes antes × depois) e
perguntar se abre o PR. Não fazer push sem o "sim" dele. A worktree fica até o PR ser aceito.
