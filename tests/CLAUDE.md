# `tests/`

Cada `[[nome]]` é `docs/biblioteca/<nome>.md`. Guia completo: [[testes]] (Vitest, PGlite, pytest
e Playwright).

- **Poucos arquivos, um por assunto, em blocos.** Os `*.test.{js,ts}` ficam na raiz de `tests/`
  (`<assunto>.test.ts` roda em node; `<assunto>-na-tela.test.ts` roda em jsdom). Cada comportamento é
  um `bloco("nome", () => { … })` de `apoio/bloco.ts`, com o isolamento que o arquivo dava.
  **Teste novo entra como bloco no arquivo do assunto; não crie arquivo de teste novo** (cada
  arquivo custa um processo, um ambiente e a carga dos módulos: eram 560 e a suíte levava o dobro).
- **Teste novo é `.ts`** (`.tsx` só com JSX), checado por `npm run typecheck:testes` (strict). Sem
  `any`, `@ts-ignore`/`@ts-nocheck` nem `as unknown as`: tipe o mock com `Partial<>`/`Pick<>`,
  `vi.mocked` ou ajudante tipado.
- **Ambiente:** bloco que usa DOM vai no arquivo `-na-tela` (jsdom); os demais, no de node.
- **`vi.mock` vale para o arquivo inteiro** (o Vitest o sobe para o topo): bloco que simula módulo
  vai em `telas-com-modulo-simulado-na-tela.test.js` ou `casca-com-modulo-simulado-na-tela.test.ts`,
  com o `vi.mock` no topo do arquivo.
- **React** sem JSX: monte com a função de montagem e envolva cada mudança em `act`; campo
  controlado com `digitar`, `escolher`, `clicar` e `teclar` de `tests/componentes/interacoes.ts`.
  Modelo: `tests/casca-com-modulo-simulado-na-tela.test.ts` (bloco `componentes/barra-lateral`).
- **Rede bloqueada** em todo teste unitário (`setup/rede-bloqueada.ts`): não desligue; use mock.
- **Postgres de verdade** em `apoio/banco-dos-robos.ts`, `apoio/banco-dos-paineis.ts` e
  `apoio/banco-do-fundamento.ts` (PGlite, `// @vitest-environment node`); modelo antes × depois:
  `catalogo-dos-robos-no-banco.test.ts`. A migration já aplicada que monta o banco fica, sem
  mudança, em `fixtures/sql-do-banco/<mesmo nome>.sql` (rollback e ensaio não vêm junto).
- Teste novo de tela com sessão vai em `sessao-simulada.spec.js`, simulando as RPCs.
- Spec do Playwright continua `.spec.js` (o `playwright.config.js` só casa esse padrão); o apoio que ele importa fica em `apoio/` (`sessao-simulada.js`).
- Nome do bloco descreve o comportamento em português. Bug corrigido → teste que falharia antes.
  Não leia `public/data/*.json` inteiro; use recorte fixo. Dados sempre fictícios.

```bash
npx vitest run tests/<assunto>.test.ts -t "<bloco>"   # um bloco — o padrão
npx vitest run tests/<assunto>.test.ts               # um assunto
npx vitest run -t "trecho do nome"                   # um caso
npm test                                   # tudo (só antes de entregar)
```
