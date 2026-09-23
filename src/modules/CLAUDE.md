# `src/modules/` — features de UI

Um arquivo por feature, instalado por `src/main.js` (a ordem importa). Pode tocar o DOM;
a lógica pura correspondente mora em `src/lib/`. O CSS da feature fica em `src/styles/`.

**Não ler por inteiro:**
- `legacy-app.js` — **402 KB, legado.** `grep -n "termo" src/modules/legacy-app.js` e ler a faixa
  com `sed -n`. Não crescer: feature nova = arquivo novo aqui.
- `indigenous-territories-layer.js` — 53 KB.
- `aya-conhecimento-gerado.js` — **gerado** por `npm run aya:conhecimento` a partir de `docs/aya/`.

Grupos: `aya-*` (assistente) · `map-*`, `health-*`, `indigenous-*`, `vinculos-territoriais.js`,
`lotacoes-geograficas-transport.js` (mapa e Saúde Indígena) · `nucleo-*` (cronograma e operação) ·
`config-*` (configurações) · `mobile-*`, `nielsen-shell-ux.js`, `colapsar-a-sidebar.js` (shell e
responsivo) · `access-*`, `sidebar-branding.js` (acesso e marca) · `lista-aprovados.js`,
`multi-select-busca.js` (aprovados) · `arara-*`, `nina-panel-drag.js` (guia interativo).

Regras: sem `innerHTML` cru (use `src/lib/sanitize.js`). Nenhum `MutationObserver` novo.
Dados só por RPC. Marcação nova segue os componentes do `DESIGN.md` (seção 4): reutilize
`.btn`, `.card`, `.table-card`, `.modal` em vez de inventar classe. Teste em `tests/` ou `tests/modules/`.
