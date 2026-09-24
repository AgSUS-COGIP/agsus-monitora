# `src/componentes/` — componentes React

O front está migrando para React **por componente**. O primeiro foi a barra lateral; o resto
continua em `src/modules/` até migrar. JavaScript com JSX (`.jsx`), sem TypeScript. Nomes em
português, arquivo em kebab-case, componente em PascalCase.

## Mapa

```
icone.jsx                    <Icone nome="…"> — Lucide, do mesmo registro de src/modules/icones.js
barra-lateral/
  barra-lateral.jsx          <BarraLateral> e montarBarraLateral() (chamada em src/main.js)
  estado.js                  estado externo da barra (sem React): o legado empurra, a barra lê
  menu-de-areas.jsx          áreas (acordeão; recolhida, painel flutuante) e itens
  alca-de-recolher.jsx       o botão único de recolher: na marca (> 900px) ou no cabeçalho (portal)
  rodape.jsx                 seletor Claro/Escuro, Sair e versão
  usar-ambiente.js           hooks do que o legado controla: classe de body, largura, tema
```

Lógica pura (catálogo de áreas, árvore por permissão, página ativa, estado do painel flutuante)
fica em `src/lib/menu-lateral.js`. CSS: `src/styles/barra-lateral.css` (peças) e
`platform-shell.css` (contêiner e tokens `--menu-*`).

## Como o legado fala com um componente

- **Nunca pelo DOM do componente.** O legado empurra dados para o estado externo
  (`barra-lateral/estado.js`: `atualizarMenuLateral`, `marcarItemAtivoNoMenu`) e o componente lê com
  `useSyncExternalStore`. O arquivo de estado não importa React, então o legado pode importá-lo.
- **O que o componente não percebe sozinho chega por evento** em `document`
  (`src/lib/eventos-da-barra-lateral.js`): barra recolhida/expandida, tema trocado. Nada de
  `MutationObserver`.
- **O componente avisa por evento** quando o DOM dele mudou (`agsus:menu-lateral-atualizado`) — o
  menu inferior do celular, ainda sem framework, espelha a partir daí.
- **O DOM continua sendo contrato** enquanto houver consumidor legado: `#nav [data-view]`,
  `data-rotulo`, `data-icone`, `aria-current`, `#sideLogo`, `#sidebarLogoutBtn.side-logout`,
  `#globalSidebarToggle`. Não renomeie sem procurar quem lê.
- **Folhas do legado:** o `src` de `#sideLogo` (de `sidebar-branding.js`) e o texto de
  `#sidebarVersion` (de `applyConfigToUi`) são escritos pelo legado. O React só cria esses nós e não
  passa prop que mude — senão desfaria o que o legado escreveu. Migre o dono junto quando for mexer.

## Regras

- Handler de navegação chama `window.navigate` **na hora do clique**: `config-governance.js` e
  `nielsen-shell-ux.js` embrulham essa função.
- Monte com `flushSync` quando código legado precisar do DOM logo depois (ver `montarBarraLateral`).
- `StrictMode` ligado: efeito tem de limpar o que instala.
- Sem `innerHTML` e sem `dangerouslySetInnerHTML`: texto vai como filho.
- Teste em `tests/componentes/` (`.test.js`, sem JSX, com `act`) — modelo em
  `tests/componentes/barra-lateral.test.js`.
