# `tests/`

Cada `[[nome]]` é `docs/biblioteca/<nome>.md`. Guia completo: [[testes]] (Vitest, PGlite, pytest)
e [[testes-de-navegador]] (Playwright).

- **Teste novo é `.ts`** (`.tsx` só com JSX), checado por `npm run typecheck:testes` (strict). Sem
  `any`, `@ts-ignore`/`@ts-nocheck` nem `as unknown as`: tipe o mock com `Partial<>`/`Pick<>`,
  `vi.mocked` ou ajudante tipado.
- **React** sem JSX: monte com a função de montagem e envolva cada mudança em `act`; campo
  controlado com `digitar`, `escolher`, `clicar` e `teclar` de `tests/componentes/interacoes.ts`.
  Modelo: `tests/componentes/barra-lateral.test.ts`.
- **Rede bloqueada** em todo teste unitário (`setup/rede-bloqueada.ts`): não desligue; use mock.
- **Postgres de verdade** em `apoio/banco-dos-robos.ts` (PGlite, `// @vitest-environment node`);
  modelo antes × depois × rollback: `catalogo-dos-robos-no-banco.test.ts`.
- Teste novo de tela com sessão vai em `sessao-simulada.spec.js`, simulando as RPCs.
- Nome do arquivo descreve o comportamento em português. Bug corrigido → teste que falharia antes.
  Não leia `public/data/*.json` inteiro; use recorte fixo. Dados sempre fictícios.

```bash
npx vitest run tests/<arquivo>.test.ts     # um arquivo — o padrão
npx vitest run -t "trecho do nome"         # um caso
npm test                                   # tudo (só antes de entregar)
```
