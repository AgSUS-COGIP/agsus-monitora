---
tipo: regra
area: front
atualizado: 2026-11-10
---

# Como o legado fala com um componente React

Enquanto houver código em `src/modules/`, ele conversa com os componentes React **por estado
externo e eventos, nunca pelo DOM do componente**. Vem do antigo `src/componentes/CLAUDE.md`.

## Regras

- **Página inteira** (Núcleo, calendário, aprovados): o componente monta dentro da
  `<section class="page">` de sempre, que a casca (`src/app/casca/`) desenha vazia. O legado
  continua dono da classe `.active` e chama o controlador que `montar…()` devolve (`render()` ao
  navegar; `openImportModal(id, rótulo)` pelo botão da tabela do Núcleo). Os dados e as ações
  moram no estado da pasta, sem React; o que é só da tela (filtros, página, aba, rascunho) é estado
  do componente e sobrevive a trocar de página.
- **O perfil é relido a cada `render()`**: as permissões mudam sem aviso do legado.
- **Dado que o legado carrega e o React lê** (linhas do monitoramento, unidades) passa por
  `src/componentes/dados-do-monitoramento.ts`: o legado publica (`loadData` / `loadUnidades`), o
  componente assina. O Núcleo não relê a view. **Sob demanda:** só as páginas de
  `src/lib/telas-com-linhas.ts` (via `src/app/pagina-aberta.ts`) ou `usarLinhasDoMonitoramento`
  fazem a carga lê-las.
- **Nunca pelo DOM do componente.** O legado empurra dados para o estado externo
  (`src/componentes/barra-lateral/estado.ts`: `atualizarMenuLateral`, `marcarItemAtivoNoMenu`) e o
  componente lê com `useSyncExternalStore`. O arquivo de estado não importa React, então o legado
  pode importá-lo.
- **O que o componente não percebe sozinho chega por evento** em `document`
  (`src/lib/eventos-da-barra-lateral.ts`): barra recolhida/expandida, tema trocado. Outros eventos
  do contrato: `agsus:filtros-alterados` (filtros do mapa), `agsus:busca-global-escolhida`,
  `agsus:content-updated`. Nada de `MutationObserver`.
- **O DOM continua sendo contrato** enquanto houver consumidor legado: `#nav [data-view]`,
  `data-area`, `data-rotulo`, `data-icone`, `aria-current`, `#sideLogo`,
  `#sidebarLogoutBtn.side-logout`, `#globalSidebarToggle`. Não renomeie sem procurar quem lê.
- **Folha do legado:** o texto de `#sidebarVersion` (de `applyConfigToUi`) é escrito pelo legado.
  O React só cria o nó e não passa prop que mude, senão desfaria o que o legado escreveu. Migre o
  dono junto quando for mexer. A logo (`#sideLogo`) é do React: lê `barra-lateral/marca.ts`.
- **Sessão ↔ sistema:** o legado registra os ganchos do contrato da sessão (`src/app/sessao.ts`,
  `src/app/sistema.ts`); as funções em `window` que restam são desse contrato
  ([docs/arquitetura-react.md](../arquitetura-react.md), "Sessão ↔ sistema").
- Nenhum remendo: nada de `window.navigate = …`/`window.saveAdminSettings = …` por outro módulo
  ([[regras-do-codigo]]).

## Relacionadas

- [[arquitetura-do-front]] — o alvo
- [[codigo-legado]] — quando o legado sai
- [[modulo-barra-lateral]] — o exemplo mais completo do contrato
- [[modulo-busca-global]] — a escolha vai ao legado por evento
