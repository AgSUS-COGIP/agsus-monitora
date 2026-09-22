# `tests/`

- **Vitest** (`*.test.js`, ambiente jsdom) — `vitest.config.js` inclui `tests/**/*.test.js`.
  Subpastas: `lib/`, `modules/`, `analises/`; a maioria fica na raiz, nomeada pelo comportamento
  (`terras-do-dsei.test.js`, `sobreposicao-na-tela.test.js`).
- **Playwright** (`*.spec.js`) — `smoke`, `aviso-global`, `sessao-autenticada`,
  `analises-authenticated`, `mapa-workspace-autenticado`. Sobe o servidor sozinho (`playwright.config.js`).
- `setup/rede-bloqueada.js` — **bloqueia a rede em todo teste unitário.** Existe porque um teste
  já chamou o Supabase de produção via `.env.local`. Não desligue; teste que precisa de rede está errado,
  use mock.

## Rode o mínimo

```bash
npx vitest run tests/<arquivo>.test.js     # um arquivo — o padrão
npx vitest run tests/analises/             # uma pasta
npx vitest run -t "trecho do nome"         # um caso
npm test                                   # tudo (só antes de entregar)
npm run test:smoke                         # Playwright smoke (lento)
```

## Escrever teste

- Nome do arquivo descreve o comportamento em português, não o arquivo testado.
- Teste a lógica em `src/lib/` (pura). Para `src/modules/`, monte o DOM mínimo no jsdom.
- Bug corrigido → teste que falharia antes da correção.
- Não leia `public/data/*.json` inteiro no teste; use um recorte fixo.
