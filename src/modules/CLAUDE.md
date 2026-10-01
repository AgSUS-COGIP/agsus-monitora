# `src/modules/` — LEGADO (só encolhe)

Features de UI sem framework, instaladas por `src/main.js` (a ordem importa). **Nada novo aqui:**
tela ou feature nova é React (`src/componentes/` → `src/modulos/`, com `src/ui/` e `src/app/`; ver
`docs/arquitetura-react.md`). `scripts/check-legado-so-encolhe.mjs` quebra o build e o CI se surgir
arquivo novo nesta pasta. Ao migrar uma tela, o módulo dela sai daqui.

**Não ler por inteiro:**

- `legacy-app.js` — **legado.** `grep -n "termo" src/modules/legacy-app.js` e ler a faixa
  com `sed -n`. Não crescer; a cada tela migrada, ele encolhe.
- `indigenous-territories-layer.js` — 53 KB.
- `aya-conhecimento-gerado.js` — **gerado** por `npm run aya:conhecimento` a partir de `docs/aya/`.

Grupos: `aya-*` (assistente) · `map-*`, `health-*`, `indigenous-*`, `vinculos-territoriais.js`,
`lotacoes-geograficas-transport.js` (mapa e Saúde Indígena) ·
`config-secoes.js` (monta as seções de Configurações; todas são React, em
`src/componentes/configuracoes/`) · `icones.js` (registro único de ícones Lucide, usado também pelo
React), `mobile-*`, `nielsen-shell-ux.js` (shell e responsivo; tema, logout e presença) · `carregamento.js` (skeleton da
entrada e barra do "Atualizar dados"; a antiga tela `#loader` ficou só para salvamentos) · a barra
lateral, o Núcleo (Editais), o Calendário de Editais e a Lista de Aprovados são React, em
`src/componentes/` · `access-*`,
`sidebar-branding.js` (acesso e marca) · `arara-*`, `nina-panel-drag.js` (guia interativo).

Regras: sem `innerHTML` cru (use `src/lib/sanitize.js`). Nenhum `MutationObserver` novo.
Dados só por RPC. Marcação nova segue os componentes do `DESIGN.md` (seção 4): reutilize
`.btn`, `.card`, `.table-card`, `.modal` em vez de inventar classe. Teste em `tests/` ou `tests/modules/`.
