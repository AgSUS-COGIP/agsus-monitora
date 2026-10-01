# `src/legado/` — o que ainda não migrou

O código antigo, sem React, encolhe até sumir. Hoje ele está em `src/modules/` (o legado do
`index.html`, com o `legacy-app.js`; `src/analises/` já foi esvaziada e removida), e continua lá: nada é movido para esta
pasta aos poucos, porque mover arquivo gera conflito com quem trabalha em paralelo. Esta pasta só recebe código antigo numa mudança em bloco, combinada antes.

Regra: o legado só perde arquivos. Arquivo novo em `src/modules/` ou `src/analises/` quebra o
`npm run check:architecture` (`scripts/check-legado-so-encolhe.mjs`). Ver
`docs/arquitetura-react.md`.
