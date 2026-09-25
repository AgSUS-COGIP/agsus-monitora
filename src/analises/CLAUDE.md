# Módulo Análises (`src/analises/`)

App separado: `analises.html` → `main.js`. Bundle e CSS próprios. Herda `agsus-monitora/CLAUDE.md`.

- `main.js` — bootstrap; comece a leitura por aqui.
- `analises-app.js` — **59 KB, não ler inteiro.** `grep -n` + `sed -n 'A,Bp'`.
- `analises-scope-*.js` — escopo/permissão de quem vê qual análise.
- `analises-infinite-table*.js` — tabela virtualizada; lógica pura em `analises-infinite-table-utils.js`.
- `analises-detail-*.js` — drawer de detalhe.
- `analises-filter-layout.js`, `analises-modern-selects.js` — filtros (Tom Select).
- `analises-*-fix.js`, `*-refinement.js`, `analises-residual-ui-fixes.js` — correções acumuladas.
  Não consolidar sem pedido explícito; cada uma cobre um bug.
- CSS: `analises.css` (tem `:root` **próprio, com valores divergentes** do app principal — ver
  `DESIGN.md` seção 1), `analises-layout-modern.css`, `analises-responsive-fixes.css`
  (importado pelo `main.js`), `analises-infinite-table.css`.
- KPIs aqui são **botões de filtro** (`aria-pressed`): mudar o visual sem quebrar o filtro.
- Gráficos em Chart.js; paleta e regras em `DESIGN.md` seção 6.

Regras: dados só por RPC via `analises-consolidated-transport.js` / `analises-shared-client-bootstrap.js`
— nada de cliente Supabase novo. Bug → arquivo pequeno + teste em `tests/analises/`, sem inchar
`analises-app.js`. CSS novo segue `DESIGN.md` seção 0.

Teste: `npx vitest run tests/analises/` ou o arquivo específico.
