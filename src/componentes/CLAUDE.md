# `src/componentes/` — componentes React

O front está migrando para React **por componente**. Já migraram a barra lateral, o Núcleo
(Editais, com o formulário e o cronograma), o Calendário de Editais e a Lista de Aprovados (com a
convocação e os modais); o resto continua em `src/modules/` até migrar. JavaScript com JSX (`.jsx`), sem TypeScript. Nomes em
português, arquivo em kebab-case, componente em PascalCase.

## Mapa

```
icone.jsx                    <Icone nome="…"> — Lucide, do mesmo registro de src/modules/icones.js
modal.jsx                    <Modal>: portal no body, Esc, clique no fundo, foco preso e devolvido
multi-select-busca.jsx       <MultiSelectBusca>: seleção múltipla com busca, controlada (o único do app)
dados-do-monitoramento.js    linhas de TB_MONITORAMENTO_INDIGENA e catálogo TD_UNIDADE que o legado
                             carrega e publica aqui (loadData / loadUnidades), e a área atual
                             (definida pelo menu; linhasDaArea, soDosEditais); sem React
usar-area-atual.js           hook: a área atual, as linhas dela e os ids dos editais (Editais,
                             Cronograma e Lista de aprovados recortam por eles)
barra-lateral/
  barra-lateral.jsx          <BarraLateral> e montarBarraLateral() (chamada em src/main.js)
  estado.js                  estado externo da barra (sem React): o legado empurra, a barra lê
  menu-de-areas.jsx          áreas (acordeão; recolhida, painel flutuante) e itens
  alca-de-recolher.jsx       o botão único de recolher: na marca (> 900px) ou no cabeçalho (portal)
  rodape.jsx                 seletor Claro/Escuro, Sair e versão
  usar-ambiente.js           hooks do que o legado controla: classe de body, largura, tema
nucleo/                      a página #page-nucleo (Editais da Equipe Núcleo)
  nucleo.jsx                 <Nucleo> (tabela e busca) e montarNucleo() → window.nucleoController
  estado.js                  resumo dos cronogramas, filtro dos indicadores, modal aberto, reinício
                             na troca de usuário e o salvamento governado; sem React
  resumo.js                  cache do get_nucleo_cronograma_resumo (30 s, uma carga por vez)
  painel-operacional.jsx     "Cronogramas e alertas": indicadores que filtram a tabela
  modal-do-edital.jsx        formulário do edital (unidades USI × CORES, indicadores automáticos)
  editor-de-cronograma.jsx   etapas, modelo padrão, datas em lote, cópia de outro edital, validação,
                             status excepcional, motivo e histórico
  modal-linha-do-tempo.jsx   consulta do cronograma, só leitura
calendario-editais/          a página #page-calendario (só leitura dos cronogramas do Núcleo)
  calendario-editais.jsx     <CalendarioEditais> e montarCalendarioEditais() → window.calendarioEditaisController
  estado.js                  etapas carregadas (1 + N RPCs, cache de 60 s); sem React
  partes.jsx                 grade do mês, linha de etapa, linha do tempo, popup do dia
lista-aprovados/             a página #page-approved e os seus modais
  lista-aprovados.jsx        <ListaAprovados> e montarListaAprovados() → window.aprovadosController
  estado.js                  candidatos, listas, configuração de convocação, modal aberto e as ações
                             que escrevem no banco (RPC e Storage); sem React
  aba-aprovados.jsx          KPIs, filtros e tabela paginada
  aba-convocacao.jsx         ordem de convocação por vaga
  modais.jsx                 status do candidato e inclusão sub judice
  modal-listas-do-edital.jsx XLSX da lista (importar, situação, remover) + aba de convocação
  formulario-de-convocacao.jsx  modelo de regras e vagas imediatas do edital (rascunho local)
  editor-de-modelo.jsx       categorias, percentuais, arredondamento e cascata
  partes.jsx                 KPI, selo de status, ação de status, paginação, CampoEditavel
```

Lógica pura fica em `src/lib/`: `menu-lateral.js` (barra), `editais-do-nucleo.js` e
`cronograma-do-edital.js` (Núcleo), `calendario-editais.js` (calendário),
`lista-aprovados-rules.js`, `lista-convocacao-rules.js` e `configuracao-de-convocacao.js`
(aprovados). CSS: `src/styles/barra-lateral.css` e `platform-shell.css` (barra);
`calendario-editais.css`, `lista-aprovados.css`, `lista-convocacao.css` e `multi-select-busca.css`
(páginas — as classes e os ids são os de antes da migração).

## Como o legado fala com um componente

- **Página inteira** (Núcleo, calendário, aprovados): o componente monta dentro da `<section class="page">`
  de sempre, que fica vazia no `index.html`. O legado continua dono da classe `.active` e chama o
  controlador que `montar…()` devolve (`render()` ao navegar; `openImportModal(id, rótulo)` pelo
  botão da tabela do Núcleo). Os dados e as ações moram no `estado.js` da pasta, sem React; o que
  é só da tela (filtros, página, aba, rascunho) é estado do componente e sobrevive a trocar de página.
- **O perfil é relido a cada `render()`**: as permissões mudam sem aviso do legado.
- **Dado que o legado carrega e o React lê** (linhas do monitoramento, unidades) passa por
  `dados-do-monitoramento.js`: o legado publica, o componente assina. O Núcleo não relê a view.

- **Nunca pelo DOM do componente.** O legado empurra dados para o estado externo
  (`barra-lateral/estado.js`: `atualizarMenuLateral`, `marcarItemAtivoNoMenu`) e o componente lê com
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

- Página migrada e confirmada pelo usuário: o código antigo sai inteiro (módulo, trecho do
  `legacy-app.js`, marcação do `index.html`, testes antigos). Ver "Código legado" em `../../CLAUDE.md`.

- Handler de navegação chama `window.navigate` **na hora do clique**: `config-governance.js` e
  `nielsen-shell-ux.js` embrulham essa função.
- Monte com `flushSync` quando código legado precisar do DOM logo depois (ver `montarBarraLateral`).
- `StrictMode` ligado: efeito tem de limpar o que instala.
- Sem `innerHTML` e sem `dangerouslySetInnerHTML`: texto vai como filho.
- Modal em React é sempre `<Modal>` (portal): um modal dentro da `<section>` sumiria com a página
  escondida — o de listas do edital abre a partir do Núcleo.
- Campo cujo texto não é o valor (número, lista separada por `;`) usa `CampoEditavel`
  (`lista-aprovados/partes.jsx`): amarrar o `value` ao valor lido apaga o que a pessoa digita.
- Tabela nova avisa `agsus:content-updated` depois de desenhar: é o que põe os rótulos do modo
  cartão (`src/modules/mobile-table-cards.js`, ≤ 900px).
- Teste em `tests/componentes/` (`.test.js`, sem JSX, com `act`) — modelo em
  `tests/componentes/barra-lateral.test.js`; interações em `tests/componentes/interacoes.js`.
