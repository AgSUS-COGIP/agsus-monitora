# `tests/`

- **Vitest** (ambiente jsdom) — `vitest.config.js` inclui `tests/**/*.test.{js,ts,tsx}`. Os testes estão
  passando de `.js` para `.ts` em lotes: **teste novo é `.ts`** (`.tsx` só com JSX), checado por
  `npm run typecheck:testes` (`tsconfig.tests.json`, strict). Sem `any`, `@ts-ignore`/`@ts-nocheck` nem
  `as unknown as` (o lint recusa): tipe o mock com `Partial<>`/`Pick<>`, `vi.mocked` ou um ajudante tipado.
  Globais só de teste (`IS_REACT_ACT_ENVIRONMENT`) ficam em `tests/globais.d.ts`.
  Subpastas: `lib/`, `modules/`, `componentes/` (React), `modulos/` (telas de src/modulos/), `ui/`, `analises/`; a maioria fica na raiz,
  nomeada pelo comportamento (`terras-do-dsei.test.js`, `sobreposicao-na-tela.test.js`).
- **React** — o teste fica sem JSX (`.test.ts`): monte com a função de montagem do componente e
  envolva cada mudança em `act` (de `react`), com `globalThis.IS_REACT_ACT_ENVIRONMENT = true`.
  Modelo: `tests/componentes/barra-lateral.test.js`. Campo controlado não aceita `campo.value = …`
  seguido de evento: use `digitar`, `escolher`, `clicar` e `teclar` de `tests/componentes/interacoes.ts`.
- **Playwright** (`*.spec.js`) — o CI roda todos (`npm run test:e2e`). Sobe o servidor sozinho
  (`playwright.config.js`), refazendo o build; `PLAYWRIGHT_DIST_PRONTO=1` serve o `dist/` que já existe.
  - Sem sessão: `smoke`, `aviso-global`, `contraste-dos-temas`.
  - `sessao-simulada`: o app com sessão e o Supabase respondido por `page.route` (rotas, F5,
    voltar/avançar, áreas, sem perfil). Precisa de build com
    `VITE_SUPABASE_URL=https://teste.supabase.co` (o do CI); com outro endereço, é pulado.
    **Teste novo de tela com sessão vai aqui**, simulando as RPCs que ela chama.
  - Com banco de desenvolvimento (`E2E_SUPABASE_SESSION_JSON`; sem ela, pulados): `sessao-autenticada`,
    `analises-authenticated`, `mapa-workspace-autenticado`.
- `setup/rede-bloqueada.ts` — **bloqueia a rede em todo teste unitário.** Existe porque um teste
  já chamou o Supabase de produção via `.env.local`. Não desligue; teste que precisa de rede está errado,
  use mock.

## Rode o mínimo

```bash
npx vitest run tests/<arquivo>.test.js     # um arquivo — o padrão
npx vitest run tests/modulos/              # uma pasta
npx vitest run -t "trecho do nome"         # um caso
npm test                                   # tudo (só antes de entregar)
npm run test:smoke                         # Playwright smoke (lento)
VITE_SUPABASE_URL=https://teste.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=teste npm run build
PLAYWRIGHT_DIST_PRONTO=1 npx playwright test tests/sessao-simulada.spec.js   # com sessão simulada
```

## Escrever teste

- Nome do arquivo descreve o comportamento em português, não o arquivo testado.
- Teste a lógica em `src/lib/` (pura). Para `src/modules/`, monte o DOM mínimo no jsdom.
- Bug corrigido → teste que falharia antes da correção.
- Não leia `public/data/*.json` inteiro no teste; use um recorte fixo.
