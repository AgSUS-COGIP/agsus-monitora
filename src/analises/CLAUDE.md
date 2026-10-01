# `src/analises/` — o que sobrou do antigo painel de Análises

Análises curriculares é o módulo React `src/modulos/analises/` desde a Etapa 4
(`docs/arquitetura-react.md`); `analises.html` e o JS do painel saíram. Aqui fica só o que os
painéis que ainda rodam no quadro (Seleção e Entrevistas, via `<PainelNoQuadro>`) usam:

- CSS: `analises.css` (tem `:root` **próprio, com valores divergentes** do app — ver `DESIGN.md`
  seção 1) e `analises-layout-modern.css` (pelo `<link>` de `selecao.html`/`entrevistas.html`);
  `analises-responsive-fixes.css`, `analises-esqueleto.css`, `analises-infinite-table.css` e
  `analises-painel.css` (pelo `main.jsx` de cada painel).
- `analises-loading-feedback.js` — o skeleton e os avisos `agsus:painel-carregando`/`pronto` do
  quadro, chamados por `src/componentes/entrevistas|selecao/*.jsx`. Teste em `tests/analises/`.

Legado: só encolhe (arquivo novo aqui quebra `npm run check:architecture`). Quando Seleção e
Entrevistas saírem do quadro, a pasta sai inteira, junto com `src/ui/no-quadro.jsx`.
