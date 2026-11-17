# `src/modules/` — LEGADO (só encolhe)

Cada `[[nome]]` é `docs/biblioteca/<nome>.md`. Regra completa: [[nova-tela-e-legado]].

- **Nada novo aqui.** Tela ou feature nova é React em `src/modulos/` ([[nova-tela-e-legado]]).
  `scripts/check-legado-so-encolhe.mjs` quebra o build e o CI com arquivo novo nesta pasta.
- **Sem JavaScript escrito à mão**: só TypeScript, fora o gerado da Aya. Módulo que precise mudar
  vira `.ts` (qualquer `.js`/`.jsx` editado quebra a checagem).
- Instalados por `src/main.ts`; a ordem importa. Ao migrar uma tela, o módulo dela sai daqui.
- Não ler por inteiro: `indigenous-territories-layer.ts` (41 KB; partes puras em
  `src/lib/terras-indigenas/`, [[mapas-e-leaflet]]) e `aya-conhecimento-gerado.js` (**gerado** por
  `npm run aya:conhecimento` a partir de `docs/aya/`; [[aya-base-de-conhecimento]]).
- Grupos: `aya-*` (assistente) · `map-*` (seletor Mapa/Satélite, [[mapas-e-leaflet]]) ·
  `indigenous-*` (terras indígenas) · `icones.ts` (registro único de ícones, [[componentes-padrao]]) ·
  `auth-storage.ts` ([[seguranca]]) · IndexedDB e PWA.
- Quem ainda mexe aqui: sem `innerHTML` cru (`src/lib/sanitize.ts`), nenhum `MutationObserver`
  novo, dados só por RPC, marcação com os componentes do Design System (seção 11: `.btn`, `.card`,
  `.table-card`, `.modal`); teste em `tests/` ou `tests/modules/`.
- O legado fala com o React por estado externo e eventos ([[nova-tela-e-legado]]).
