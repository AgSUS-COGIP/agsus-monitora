# `src/modules/` — LEGADO (só encolhe)

Features de UI sem framework, instaladas por `src/main.ts` (a ordem importa). **Nada novo aqui:**
tela ou feature nova é React (`src/componentes/` → `src/modulos/`, com `src/ui/` e `src/app/`; ver
`docs/arquitetura-react.md`). `scripts/check-legado-so-encolhe.mjs` quebra o build e o CI se surgir
arquivo novo nesta pasta. Ao migrar uma tela, o módulo dela sai daqui.

**Não ler por inteiro:**

- `indigenous-territories-layer.ts` — 41 KB (as partes puras estão em `src/lib/terras-indigenas/`).
- `aya-conhecimento-gerado.js` — **gerado** por `npm run aya:conhecimento` a partir de `docs/aya/`.

Grupos: `aya-*` (assistente) · `map-*`, `health-*`, `indigenous-*` (mapa e Saúde Indígena) ·
`icones.ts` (registro único de ícones Lucide, usado também pelo
React) · `src/app/carregamento.ts` (skeleton da
entrada e barra do "Atualizar dados"; a antiga tela `#loader` ficou só para salvamentos) · a barra
lateral, o Núcleo (Editais), o Calendário de Editais e a Lista de Aprovados são React, em
`src/componentes/` (a marca da barra é `src/componentes/barra-lateral/marca.ts`; o Sair
confirmado, `src/app/casca/saida.ts`). O painel da Aya é React, em `src/modulos/aya/`.

**Sem JavaScript escrito à mão**: a pasta é só TypeScript, fora o gerado da Aya.
`scripts/check-legado-so-encolhe.mjs` quebra o build e o CI com qualquer `.js`/`.jsx` aqui (nem
editar um antigo): módulo que precise mudar vira `.ts`.

Regras: sem `innerHTML` cru (use `src/lib/sanitize.ts`). Nenhum `MutationObserver` novo.
Dados só por RPC. Marcação nova segue os componentes do `DESIGN.md` (seção 4): reutilize
`.btn`, `.card`, `.table-card`, `.modal` em vez de inventar classe. Teste em `tests/` ou `tests/modules/`.
