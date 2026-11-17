# Testes mais rápidos — Plano de implementação

> **Feito** no PR #839 (16/11/2026). As caixas abaixo não foram marcadas durante a execução: ficam como o roteiro que se seguiu, e o que vale é o código do PR.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Baixar o `npm test` (Vitest) de ~7 min para menos de 3 min sem perder nenhum teste.

**Architecture:** O tempo vai para montar o jsdom em todo arquivo, inclusive nos ~50% que não tocam
DOM. O ambiente padrão passa a ser `node`, e só os arquivos que precisam de DOM declaram
`// @vitest-environment jsdom`. Nos testes de banco, o PGlite é montado uma vez por arquivo (um
molde) e cada teste recebe um `clone()` dele, em vez de montar o Postgres do zero.

**Tech Stack:** Vitest 4.1.12, jsdom 28.1.0, @electric-sql/pglite 0.5.12, Node 24, Windows (12 núcleos).

**Spec:** não há documento de spec. O pedido é "os testes estão demorando demais". A medição abaixo
(feita em 2026-11-16, branch `funcionalidade/aba-de-paineis`) é a base que o plano usa.

| Medida                                           | Valor                                                           |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `npm test`, relógio                              | 397–435 s                                                       |
| Somatório `environment` (jsdom)                  | 2495 s                                                          |
| Somatório `tests`                                | 1280 s                                                          |
| Somatório `import` / `transform`                 | 245 s / 82 s                                                    |
| `tests/lib` (95 arquivos) em jsdom × node        | 46 s × 13 s (9 arquivos falham em node: precisam de DOM)        |
| PGlite `bancoComRelatoriosProntos()` × `clone()` | 1822 ms × ~290 ms                                               |
| `lista-aprovados.test.ts` sozinho × na suíte     | 17 s × 132 s (CPU disputada pelo jsdom)                         |
| Resultado da suíte                               | 557 arquivos; 7188 passam, 12 pulados, **1 falha já existente** |

A falha existente, `tests/lib/avaliacao-documental-espelho-visual.test.ts` ("PDF do espelho
(regressão) com pontos e eliminado"), compara hash de PDF e está fora do escopo. Ela continua
falhando igual. Não é efeito deste plano.

## Global Constraints

- Nenhum teste some: ao fim, **7188 passam, 12 pulados, 1 falha (a mesma de antes)**, nos mesmos 557 arquivos.
- Nada de `isolate: false`, troca de pool ou mudança no `testTimeout`: o ganho vem só do ambiente e do PGlite.
- `tests/setup/rede-bloqueada.ts` e `tests/setup/endereco.ts` continuam em `setupFiles` para todos os arquivos.
- Comentários e docs em português, como o resto do repositório. Teste novo é `.ts`.
- O CI (`npm run test:coverage`) não muda de comando.

## Review Focus

1. Um arquivo que passa em `node` por cair num caminho "sem window" do código, e não no que testava antes. Quem lê espera que o teste continue cobrindo o mesmo comportamento. A contagem 7188/12/1 pega teste que some, mas não pega teste que fica vazio. Revisar por amostragem os arquivos movidos que citam `window`/`document` no código-fonte testado.
2. Um teste de banco que dependia de estado deixado por um teste anterior do mesmo arquivo (o `beforeEach` antigo escondia isso). Com clone, cada teste continua começando limpo. O teste de independência na Task 2 prova isso.
3. Arquivo de teste novo que usa DOM sem a anotação deve falhar alto ("document is not defined"), não passar em silêncio. A Task 1 documenta a regra em `docs/biblioteca/testes.md`.
4. Instâncias PGlite que nunca são fechadas acumulam memória no worker. Os clones são fechados no `afterEach`.
5. Rodar um único arquivo de DOM (`npx vitest run tests/componentes/x.test.ts`) continua funcionando, porque a anotação está no arquivo e não num glob da config.

---

### Task 1: Ambiente padrão `node`; jsdom só onde há DOM

**Files:**

- Create: `tests/ambiente-padrao.test.ts`
- Modify: `vitest.config.js` (`environment: "jsdom"` → `"node"`, com comentário do porquê e a medição)
- Modify: todo arquivo `tests/**/*.test.{js,ts,tsx}` que falha em `node` (primeira linha: `// @vitest-environment jsdom`)
- Modify: `docs/biblioteca/testes.md` (linha 9 e a seção Vitest: a regra nova)

**Interfaces:**

- Produces: a regra "padrão node; DOM declara `// @vitest-environment jsdom` na primeira linha", que a Task 2 e os testes futuros seguem.

- [ ] **Step 1: Escrever o teste que falha**

`tests/ambiente-padrao.test.ts` (sem anotação de ambiente):

```ts
import { expect, it } from "vitest";

it("sem anotação, o arquivo roda em node (jsdom só onde é declarado)", () => {
  expect(typeof document).toBe("undefined");
  expect(typeof window).toBe("undefined");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/ambiente-padrao.test.ts`
Expected: FAIL, `expected 'object' to be 'undefined'`

- [ ] **Step 3: Classificar os arquivos**

Run: `npx vitest run --environment=node --silent --reporter=json --outputFile=<scratch>/em-node.json`
(`<scratch>` = um diretório temporário fora do repo.) Com um script de uso único (fora do repo),
liste cada arquivo do relatório com `status !== "passed"`. Esses são os arquivos de DOM. A falha
pré-existente (`avaliacao-documental-espelho-visual.test.ts`) entra na lista: fica em jsdom, como
estava. Arquivos que já têm `// @vitest-environment node` ficam como estão.

- [ ] **Step 4: Anotar os arquivos de DOM**

Insira `// @vitest-environment jsdom` como primeira linha de cada arquivo da lista do Step 3. Se a
primeira linha já for um comentário de cabeçalho, a anotação vai antes dele.

- [ ] **Step 5: Trocar o padrão em `vitest.config.js`**

`environment: "node"`, com um comentário curto: o jsdom custava 2495 s somados em 557 arquivos;
arquivo com DOM declara `// @vitest-environment jsdom`.

- [ ] **Step 6: Rodar o teste novo**

Run: `npx vitest run tests/ambiente-padrao.test.ts`
Expected: PASS

- [ ] **Step 7: Rodar a suíte inteira**

Run: `npx vitest run --silent`
Expected: `Test Files 1 failed | 557 passed (558)`, `Tests 1 failed | 7189 passed | 12 skipped`. A
única falha é a do espelho visual. A linha `Duration` mostra `environment` muito abaixo de 2495 s.
Anote o relógio no ledger. Se algum arquivo falhar e não estava na lista, ele também usa DOM:
anote-o (Step 4) e rode de novo.

- [ ] **Step 8: Atualizar `docs/biblioteca/testes.md`**

Linha 9: "Vitest (ambiente node por padrão; jsdom nos arquivos que declaram)". Na seção Vitest, um
item: arquivo que usa DOM começa com `// @vitest-environment jsdom`; sem a anotação ele roda em
node, que é ~3× mais rápido; esquecer a anotação dá "document is not defined". Linha 58: "monte o
DOM mínimo no jsdom (com a anotação)". Atualize `atualizado:` no cabeçalho para 2026-11-16.
Run: `npm run check:docs`. Expected: sem erro.

- [ ] **Step 9: Commit**

```bash
git add vitest.config.js tests docs/biblioteca/testes.md
git commit -m "Testes em node por padrão; jsdom só nos arquivos que usam DOM"
```

### Task 2: PGlite montado uma vez por arquivo, clonado por teste

**Files:**

- Create: `tests/apoio/molde-de-banco.ts`
- Create: `tests/molde-de-banco.test.ts`
- Modify: `tests/apoio/banco-dos-paineis.ts` (`bancoDosPaineis`, `bancoComRelatoriosProntos`)
- Modify: `tests/apoio/banco-dos-robos.ts` (`bancoDeHoje`, só quando chamado sem opções)
- Modify: `tests/apoio/banco-do-fundamento.ts` (`bancoDeHoje`)
- Modify: `tests/exportacao-de-aprovados-no-banco.test.ts` (`bancoComLista`, local)

**Interfaces:**

- Consumes: a regra de ambiente da Task 1 (os arquivos de banco já são `// @vitest-environment node`).
- Produces: `moldeDeBanco(montar: () => Promise<PGlite>): () => Promise<PGlite>` em `tests/apoio/molde-de-banco.ts`. A primeira chamada monta o molde (guardado como promessa, uma vez por módulo, ou seja, por arquivo de teste). Toda chamada devolve `await molde.clone()`. Registra cada clone e os fecha num `afterEach` (de `vitest`), registrado na primeira chamada.

- [ ] **Step 1: Escrever os testes que falham**

`tests/molde-de-banco.test.ts` (`// @vitest-environment node`):

- `"monta o banco uma vez só"`: `montar` é um `vi.fn` que devolve `PGlite.create()`. Chame o
  retorno de `moldeDeBanco(montar)` duas vezes. `expect(montar).toHaveBeenCalledTimes(1)`.
- `"cada chamada é um banco independente"`: `montar` cria `create table t (x int)`. No clone `a`,
  `insert into t values (1)`. No clone `b`, `select count(*)::int as n from t` dá `n === 0`.
- `"o molde não é alterado pelos clones"`: depois do insert em `a`, um terceiro clone também tem `n === 0`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/molde-de-banco.test.ts`
Expected: FAIL, não acha o módulo `./apoio/molde-de-banco.ts`

- [ ] **Step 3: Implementar `moldeDeBanco` em `tests/apoio/molde-de-banco.ts`**

Comentário de cabeçalho com a medição (criar 1822 ms × clonar ~290 ms).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/molde-de-banco.test.ts`
Expected: PASS (3)

- [ ] **Step 5: Usar o molde nos montadores**

- `banco-dos-paineis.ts`: o corpo atual vira `montarBancoDosPaineis` (não exportado), e
  `export const bancoDosPaineis = moldeDeBanco(montarBancoDosPaineis)`. O mesmo vale para
  `bancoComRelatoriosProntos`, que continua partindo de `await bancoDosPaineis()`.
- `banco-do-fundamento.ts`: `bancoDeHoje` igual.
- `banco-dos-robos.ts`: `bancoDeHoje(opcoes = {})` usa o molde quando `opcoes` não tem chave
  nenhuma. Com opções, monta do zero, como hoje.
- `exportacao-de-aprovados-no-banco.test.ts`: `const bancoComLista = moldeDeBanco(async () => {…corpo atual…})`.

As assinaturas exportadas não mudam, e nenhum arquivo de teste que chama esses montadores muda.

- [ ] **Step 6: Rodar os testes de banco**

Run: `npx vitest run tests/catalogo-dos-robos-no-banco.test.ts tests/exportacao-de-aprovados-no-banco.test.ts tests/fontes-dos-paineis-no-banco.test.ts tests/fundamento-da-eliminacao-no-banco.test.ts tests/relatorios-prontos-dos-paineis-no-banco.test.ts tests/molde-de-banco.test.ts`
Expected: todos passam. Compare com a soma da base (85+63+91+51+95 s na suíte cheia): o tempo
desses arquivos sozinhos deve cair visivelmente. Anote no ledger.

- [ ] **Step 7: Typecheck dos testes**

Run: `npm run typecheck:testes`
Expected: sem erro

- [ ] **Step 8: Rodar a suíte inteira e medir**

Run: `npx vitest run --silent`
Expected: `Tests 1 failed | 7192 passed | 12 skipped` (7188 + 1 da Task 1 + 3 desta), a única falha
é a do espelho visual. Anote o relógio e a linha `Duration` no ledger e compare com 397–435 s.

- [ ] **Step 9: Commit**

```bash
git add tests/apoio tests/molde-de-banco.test.ts tests/exportacao-de-aprovados-no-banco.test.ts
git commit -m "Testes de banco clonam um PGlite montado uma vez por arquivo"
```
