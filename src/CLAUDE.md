# `src/` — o front

Cada `[[nome]]` é `docs/biblioteca/<nome>.md`.

| Pasta              | O que é                                                                    | Nota                                   |
| ------------------ | -------------------------------------------------------------------------- | -------------------------------------- |
| `app/`             | raiz React única, rotas (`telas.tsx`), navegação, sessão, carga, casca      | [[arquitetura-do-front]]               |
| `modulos/<nome>/`  | uma pasta por tela (componente, `estado.ts`, consultas, CSS da tela)        | [[nova-tela-react]], `modulo-<nome>`   |
| `ui/`              | design system (Topo, Filtros, Kpi, Tabela, Gaveta, Modal…), só tokens      | [[componentes-padrao]]                 |
| `componentes/`     | moldura: barra lateral, busca global, Status das atualizações, dados comuns | [[legado-fala-com-react]]              |
| `lib/`             | lógica pura e testável (regras, contratos, formatos)                       | [[logica-em-src-lib]]                  |
| `modules/`         | LEGADO: só encolhe, nada novo                                              | [[codigo-legado]]                      |
| `styles/`          | CSS do app (ordem de import em `main.ts`; `app.css` não se lê inteiro)     | [[css]]                                |
| `main.ts`          | bootstrap: importa CSS e instala módulos, em ordem                          |                                        |

Regras daqui:

- Tela nova é React em `modulos/`, registrada em `app/telas.tsx`; nada novo em `modules/`.
- Visual só com `ui/` e tokens; antes de tocar em CSS, as regras de ouro de [[design-e-tokens]].
- Sem `innerHTML`/`dangerouslySetInnerHTML`; `StrictMode` ligado (efeito limpa o que instala); nada
  de `createRoot` novo nem `MutationObserver` novo.
- Dados só por RPC do contrato ([[rpc-e-contrato]]); auth só pela sessão ([[sessao-e-auth]]).
- Texto da tela sem explicação genérica ([[textos-da-interface]]).
- Módulo novo ganha nota `docs/biblioteca/modulo-<nome>.md` (modelo em `docs/_templates/`), não
  README na pasta ([[documentacao]]).
