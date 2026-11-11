# `src/componentes/` — a moldura React

Cada `[[nome]]` é `docs/biblioteca/<nome>.md`. Como o legado fala com os componentes:
[[legado-fala-com-react]].

Aqui fica só a moldura: barra lateral ([[modulo-barra-lateral]]), busca global
([[modulo-busca-global]]), Status das atualizações (`saude-das-cargas/`,
[[modulo-status-das-atualizacoes]]), Pessoas online, aviso de versão, ícone, seleção múltipla,
seletor de edital, selo de treinamento e os dados compartilhados do monitoramento
(`dados-do-monitoramento.ts`, `usar-area-atual.ts`). As telas são de `src/modulos/`; as pastas
daqui mudam para lá módulo a módulo ([[arquitetura-do-front]], [[componentes-padrao]]).

Regras daqui:

- O legado fala com o componente por estado externo (`useSyncExternalStore`) e eventos em
  `document`, **nunca pelo DOM do componente**; os ids e atributos que o legado ainda lê são
  contrato (lista na nota).
- Handler de navegação chama `window.navigate` **na hora do clique**.
- Nada de `createRoot` novo; parte fixa é filha da casca (`src/app/casca/`).
- Sem `innerHTML`/`dangerouslySetInnerHTML`; `StrictMode` ligado; modal é sempre `<Modal>`.
- Tudo em TypeScript; nomes em português, arquivo em kebab-case, componente em PascalCase.
- Teste em `tests/componentes/` (sem JSX, com `act`), modelo `tests/componentes/barra-lateral.test.ts`
  ([[testes]]).
