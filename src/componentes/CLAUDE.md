# `src/componentes/` — componentes React

O front está migrando para **um único app React** (alvo, regras e ordem em
`docs/arquitetura-react.md`). Todas as telas são módulos do app em `src/modulos/` (Editais,
Cronograma, Aprovados, Recursos, Entrevistas, Análises, Seleção, Classificação, Configurações, Acessos,
Módulos e abas…). Aqui fica só a moldura: barra lateral, busca global (Ctrl+K), Status das
atualizações e os dados compartilhados do monitoramento. Toda tela monta por
`montarModulo` (`src/app/`) e usa os componentes visuais de
`src/ui/`; as pastas daqui mudam para `src/modulos/<nome>/` módulo a módulo. JavaScript com JSX
(`.jsx`) e migração gradual para TypeScript (`.tsx`); Status das atualizações já está
migrado em `saude-das-cargas/`; barra lateral, Busca global, dados compartilhados e hook de área atual também estão em TypeScript. Contratos e
limites estão nos READMEs das pastas e em seus `tipos.ts`. Nomes em português,
arquivo em kebab-case, componente em PascalCase.

## Mapa

```
icone.jsx                    <Icone nome="…"> — Lucide, do mesmo registro de src/modules/icones.js
modal.jsx                    só reexporta o <Modal> de src/ui/modal.jsx (importe de src/ui/ no código novo)
busca-global/                busca Ctrl+K (montarBuscaGlobal); a escolha vai ao legado por evento
multi-select-busca.jsx       <MultiSelectBusca>: seleção múltipla com busca, controlada (o único do app)
dados-do-monitoramento.ts    linhas de TB_MONITORAMENTO_INDIGENA e catálogo TD_UNIDADE que o legado
                             carrega e publica aqui (loadData / loadUnidades), e a área atual
                             (definida pelo menu; linhasDaArea, soDosEditais); sem React
usar-area-atual.ts           hook: a área atual, as linhas dela e os ids dos editais (Editais,
                             Cronograma e Lista de aprovados recortam por eles)
barra-lateral/
  barra-lateral.tsx          <BarraLateral> e montarBarraLateral() (chamada em src/main.js)
  estado.ts                  estado externo da barra (sem React): o legado empurra, a barra lê
  menu-de-areas.tsx          áreas (acordeão; recolhida, painel flutuante) e itens
  alca-de-recolher.tsx       o botão único de recolher: na marca (> 900px) ou no cabeçalho (portal)
  rodape.tsx                 seletor Claro/Escuro, Sair e versão
  usar-ambiente.ts           hooks do que o legado controla: classe de body e largura (o tema é src/app/tema.js)
```

Lógica pura fica em `src/lib/`: `menu-lateral.ts` (barra), `busca-global.ts` (busca) e
`linhas-do-monitoramento.ts` (validação dos dados compartilhados). CSS: `src/styles/barra-lateral.css`,
`platform-shell.css` (barra) e `multi-select-busca.css`. Editais, Cronograma e Lista de aprovados
moram em `src/modulos/editais/`, `cronograma/` e `aprovados/` (componentes, CSS e testes lá).

## Como o legado fala com um componente

- **Página inteira** (Núcleo, calendário, aprovados): o componente monta dentro da `<section class="page">`
  de sempre, que fica vazia no `index.html`. O legado continua dono da classe `.active` e chama o
  controlador que `montar…()` devolve (`render()` ao navegar; `openImportModal(id, rótulo)` pelo
  botão da tabela do Núcleo). Os dados e as ações moram no `estado.js` da pasta, sem React; o que
  é só da tela (filtros, página, aba, rascunho) é estado do componente e sobrevive a trocar de página.
- **O perfil é relido a cada `render()`**: as permissões mudam sem aviso do legado.
- **Dado que o legado carrega e o React lê** (linhas do monitoramento, unidades) passa por
  `dados-do-monitoramento.ts`: o legado publica, o componente assina. O Núcleo não relê a view.

- **Nunca pelo DOM do componente.** O legado empurra dados para o estado externo
  (`barra-lateral/estado.ts`: `atualizarMenuLateral`, `marcarItemAtivoNoMenu`) e o componente lê com
  `useSyncExternalStore`. O arquivo de estado não importa React, então o legado pode importá-lo.
- **O que o componente não percebe sozinho chega por evento** em `document`
  (`src/lib/eventos-da-barra-lateral.js`): barra recolhida/expandida, tema trocado. Nada de
  `MutationObserver`.
- **O componente avisa por evento** quando o DOM dele mudou (`agsus:menu-lateral-atualizado`) — o
  menu inferior do celular, ainda sem framework, espelha a partir daí.
- **O DOM continua sendo contrato** enquanto houver consumidor legado: `#nav [data-view]`,
  `data-area`, `data-rotulo`, `data-icone`, `aria-current`, `#sideLogo`, `#sidebarLogoutBtn.side-logout`,
  `#globalSidebarToggle`. Não renomeie sem procurar quem lê.
- **Folhas do legado:** o `src` de `#sideLogo` (de `sidebar-branding.js`) e o texto de
  `#sidebarVersion` (de `applyConfigToUi`) são escritos pelo legado. O React só cria esses nós e não
  passa prop que mude — senão desfaria o que o legado escreveu. Migre o dono junto quando for mexer.

## Regras

- Página migrada e confirmada pelo usuário: o código antigo sai inteiro (módulo,
  marcação do `index.html`, testes antigos). Ver "Código legado" em `../../CLAUDE.md`.

- Handler de navegação chama `window.navigate` **na hora do clique** (não guarde a referência na
  montagem): é o `navigate` do legado, que pergunta às Configurações antes de sair.
- Monte sempre por `montarModulo` (`src/app/montar-modulo.jsx`: StrictMode + ErrorBoundary); passe
  `{ flushSync: true }` quando código legado precisar do DOM logo depois (ver `montarBarraLateral`).
- Visual novo vem de `src/ui/` (Topo, Filtros, Kpi, CardDeGrafico, TabelaInfinita, Gaveta, Modal,
  Aviso, Campo, Selo…), só com tokens; não recrie em cada tela. Sem textos genéricos (ver o CLAUDE.md raiz).
- `StrictMode` ligado: efeito tem de limpar o que instala.
- Sem `innerHTML` e sem `dangerouslySetInnerHTML`: texto vai como filho.
- Modal em React é sempre `<Modal>` (portal): um modal dentro da `<section>` sumiria com a página
  escondida — o de listas do edital abre a partir do Núcleo.
- Campo cujo texto não é o valor (número, lista separada por `;`) usa `CampoEditavel`
  (`src/modulos/aprovados/partes.jsx`): amarrar o `value` ao valor lido apaga o que a pessoa digita.
- Tabela nova avisa `agsus:content-updated` depois de desenhar: é o que põe os rótulos do modo
  cartão (`src/modules/mobile-table-cards.js`, ≤ 900px).
- Teste em `tests/componentes/` (`.test.js`, sem JSX, com `act`) — modelo em
  `tests/componentes/barra-lateral.test.js`; interações em `tests/componentes/interacoes.js`.
