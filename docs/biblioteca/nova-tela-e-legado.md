---
tipo: regra
area: front
atualizado: 2026-11-17
---

# Nova tela e código legado

Tela ou feature nova é **React**: módulo em `src/modulos/<nome>/`, tela de página inteira como
rota, visual com `src/ui/` e tokens, lógica pura em `src/lib/` com teste. O legado é o código
antigo, sem React, em `src/modules/` (o do `index.html`; `src/analises/` já foi esvaziada e
removida): ele **só encolhe**, conversa com o React por estado externo e eventos e sai inteiro
quando a mudança que o substitui é confirmada. Detalhes em
[docs/arquitetura-react.md](../arquitetura-react.md), "Como criar um módulo novo" e "Como montar".

## A pasta da tela nova

```
src/modulos/<nome>/
  <nome>.tsx      componente da tela + criar<Nome>() ({ conteudo, nome, render() }), rota em src/app/telas.tsx
  estado.ts       store sem React: obter(), assinar(ouvinte) e as ações (RPC)
  consultas.ts    (opcional) as RPCs do módulo, se o estado ficar grande
  <nome>.css      (opcional) só o que é desta tela; o resto vem de src/ui/
src/lib/<nome>.ts               regras puras
tests/modulos/<nome>.test.ts    teste do componente (sem JSX, com act)
tests/<nome>.test.ts            teste das regras de src/lib/
```

Nomes em português, arquivo em kebab-case, componente em PascalCase. Modelos de tela de página
inteira: `src/modulos/recursos/`, `selecao/`, `entrevistas/`, `analises/`. A nota da tela é
`docs/biblioteca/modulo-<nome>.md`, a partir de `docs/_templates/modulo.md` ([[documentacao]]).

## Como entra no app

- O módulo exporta `criar<Nome>(opcoes)`, sem DOM, que devolve `{ estado, nome, conteudo,
  render() }` (`nome` aparece no console se a tela quebrar; `render()` roda a cada abertura).
- A tela entra em `src/app/telas.tsx` (`registrarTelasDoApp`: `criar` no pacote principal ou
  `carregar: () => import(…)` sob demanda) e em `src/lib/navegacao/rotas.ts` (view, caminho, título). A rota
  desenha a `<section id="page-<view>">`, põe a tela num `ErrorBoundary` e a mantém montada.
- Quem precisa de outra tela usa o registro (`carregarTela(view)`, `src/app/registro-das-telas.ts`),
  nunca `window`. Título e área ficam no cabeçalho; a tela não repete. Área de
  `usarAreaAtual()`/`obterDadosDoMonitoramento()`, tema de `usarTemaEscuro()` (`src/app/tema.ts`).
- **Seção de Configurações** (modelos `src/modulos/acessos/` e `src/modulos/modulos/`): rota
  `/administracao/configuracoes/<seção>`, registrada como `secao:<id>`, com `confirmarSaida()`
  para rascunho ([[modulo-configuracoes]]).
- Parte fixa do app (cabeçalho, topo, overlay) é filha da casca (`src/app/casca/`); pedaço React
  dentro de DOM feito à mão entra por `abrirPortalAvulso` (`src/app/portais-avulsos.tsx`). **Nada
  de `createRoot` novo.**
- Página nova ou área nova no menu: `src/lib/navegacao/menu-lateral.ts` ([[modulo-barra-lateral]]); quem vê,
  `src/lib/access-roles.ts` ([[modulo-acessos]]).

## Regras do componente

- `estado` não importa React (o legado também pode importá-lo); o que é só da tela (filtro, aba,
  página, rascunho) é estado do componente.
- RPC nova ou mudada → `src/lib/rpc-contrato.ts` ([[rpc-e-contrato]]).
- `StrictMode` ligado: efeito tem de limpar o que instala.
- Sem `innerHTML` e sem `dangerouslySetInnerHTML`: texto vai como filho.
- Modal em React é sempre `<Modal>` (portal): um modal dentro da `<section>` sumiria com a página
  escondida.
- Campo cujo texto não é o valor (número, lista separada por `;`) usa `CampoEditavel`
  (`src/modulos/aprovados/partes.tsx`): amarrar o `value` ao valor lido apaga o que a pessoa digita.
- Tabela nova avisa `agsus:content-updated` depois de desenhar: é o que põe os rótulos do modo
  cartão (`src/app/casca/tabelas-em-cartoes.ts`, ≤ 900px; [[acessibilidade-e-mobile]]).
- Handler de navegação chama `window.navigate` **na hora do clique** (não guarde a referência na
  montagem): é o `navigate` do legado, que pergunta às Configurações antes de sair.
- Componente entra em `src/ui/` quando duas telas ou mais repetem a mesma peça
  ([[componentes-padrao]]).

## O legado só encolhe

- **Nada novo em `src/modules/` nem em `src/analises/`.** `scripts/check-legado-so-encolhe.mjs`
  quebra o build e o CI com arquivo novo ali. Editar e apagar podem.
- **Sem JavaScript escrito à mão**: a pasta é só TypeScript, fora o gerado da Aya
  (`aya-conhecimento-gerado.js`). Qualquer `.js`/`.jsx` ali quebra o build (nem editar um antigo):
  módulo que precise mudar vira `.ts`.
- Os módulos são features de UI sem framework, instaladas por `src/main.ts` (a ordem importa).
  Grupos: `aya-*` (assistente) · `map-*`, `indigenous-*` (seletor de fundo e Terras Indígenas) ·
  `icones.ts` (registro único de ícones Lucide, usado também pelo React; [[componentes-padrao]]).
- Quem ainda mexe ali: sem `innerHTML` cru (`src/lib/seguranca/sanitize.ts`); nenhum `MutationObserver`
  novo; dados só por RPC; marcação nova segue os componentes do Design System (seção 11: `.btn`,
  `.card`, `.table-card`, `.modal`) em vez de inventar classe; teste em `tests/` ou
  `tests/modules/`.
- O legado fica onde está: não se move para outra pasta aos poucos, porque mover arquivo gera
  conflito com quem trabalha em paralelo. Uma pasta própria para ele só nasce numa mudança em
  bloco, combinada antes.

## Como o legado fala com o React

Por **estado externo e eventos, nunca pelo DOM do componente** (vem do antigo
`src/componentes/CLAUDE.md`).

- **Página inteira** (Núcleo, calendário, aprovados): o componente monta dentro da
  `<section class="page">` de sempre, que a casca (`src/app/casca/`) desenha vazia. O legado
  continua dono da classe `.active` e chama o controlador que `montar…()` devolve (`render()` ao
  navegar; `openImportModal(id, rótulo)` pelo botão da tabela do Núcleo). O que é só da tela
  sobrevive a trocar de página.
- **O perfil é relido a cada `render()`**: as permissões mudam sem aviso do legado.
- **Dado que o legado carrega e o React lê** (linhas do monitoramento, unidades) passa por
  `src/componentes/dados-do-monitoramento.ts`: o legado publica (`loadData` / `loadUnidades`), o
  componente assina. O Núcleo não relê a view. Sob demanda: só as páginas de
  `src/lib/navegacao/telas-com-linhas.ts` (via `src/app/pagina-aberta.ts`) ou `usarLinhasDoMonitoramento`
  fazem a carga lê-las ([[arquitetura-do-front]]).
- O legado empurra dados para o estado externo (`src/componentes/barra-lateral/estado.ts`:
  `atualizarMenuLateral`, `marcarItemAtivoNoMenu`) e o componente lê com `useSyncExternalStore`.
- **O que o componente não percebe sozinho chega por evento** em `document`
  (`src/lib/navegacao/eventos-da-barra-lateral.ts`): barra recolhida/expandida, tema trocado. Outros eventos
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

## Ao migrar uma tela

1. Levante tudo o que a tela antiga faz (checklist).
2. Cumpra cada item com testes.
3. Confira no navegador.
4. Só então apague o legado. Remendos existentes (`*-fix`, `post-N…`) se absorvem na fonte e se
   apagam.

## O legado sai quando a mudança é confirmada

O sistema ainda está em desenvolvimento: não há camada de compatibilidade "por via das dúvidas".
Quando o usuário confirmar que uma mudança está ok (por exemplo, uma página migrada para React),
**remova todo o código legado que ela substituiu**:

- módulos de `src/modules/`, marcação do `index.html` e funções expostas em `window` que só o
  código antigo usava;
- CSS sem seletor vivo, testes do comportamento antigo e arquivos ou pastas sem uso (build antigo,
  workflow temporário, protótipo abandonado);
- as referências nos docs, nas notas e nos `CLAUDE.md`.

Antes de apagar, confirme com `grep` que nada mais usa; depois, rode os testes afetados e o
`npm run build`. O histórico do git guarda o que saiu.

## Relacionadas

- [[arquitetura-do-front]] — o alvo, a raiz única e as rotas
- [[componentes-padrao]] — os componentes de `src/ui/` e os ícones
- [[regras-do-codigo]] — remendos, `src/lib/` e TypeScript
- [[modulo-barra-lateral]] — o exemplo mais completo do contrato com o legado
- [[testes]] — como testar componente React sem JSX
- [[mapa-do-repositorio]] — arquivos do legado que não se leem inteiros
