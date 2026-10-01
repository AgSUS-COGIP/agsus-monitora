# `src/modulos/` — uma pasta por tela

Cada tela do MONITORA, quando migra, mora aqui: `<nome>/<nome>.jsx` (componente e
`montar<Nome>()`, que usa `montarModulo` de `src/app/`), `estado.js` (store sem React, lido com
`useSyncExternalStore`), as consultas RPC e, se precisar, um CSS só da tela. O visual vem de
`src/ui/`; as regras puras, de `src/lib/`.

Já aqui: `recursos/` (Recursos dos candidatos, o modelo de tela de página inteira). As outras
mudam uma a uma, na etapa de cada uma (Entrevistas e Seleção em seguida). Guia completo, com o
mapa de hoje → alvo: `docs/arquitetura-react.md`.
