# Arquitetura React do MONITORA

Status: **aprovada em 01/10/2026**. Etapa 1 (Fundação) feita; as demais, abaixo, em ordem.
Complementa `docs/arquitetura.md` (banco, áreas e permissões).

## Para onde o sistema vai

Um único app React, uma página, rotas por área.

```
src/
  app/        entrada única, rotas, layout (menu + topo + Aya), login, ErrorBoundary
  ui/         componentes visuais padrão (o design system)
  modulos/    um por tela: componentes + estado.js + consultas (RPC)
  lib/        regras puras, testadas
  legado/     o que ainda não migrou (encolhe até sumir)
```

## Regras

1. **Um visual só.** Toda tela monta com `src/ui/` e os tokens de `src/styles/tokens.css`. KPI
   é card compacto (`Kpi` em `GradeDeKpis`, ~78px de altura), não faixa sem card.
2. **Um padrão de dados só**, o que as telas React já usam: `estado.js` por módulo (store fora do
   React, com `obter()` e `assinar(ouvinte)`, lido com `useSyncExternalStore`), RPC pelo cliente
   Supabase único (`getSupabaseClient()`, contrato em `src/lib/rpc-contrato.js`), regras em
   `src/lib/`. Sem biblioteca nova de estado ou de dados.
3. **Isolamento.** Cada módulo monta dentro de um `ErrorBoundary` (via `montarModulo`): erro numa
   tela mostra um aviso curto com "Tentar de novo" e não derruba o resto.
4. **Texto.** Sem texto genérico ou explicativo na interface (quem explica é a Aya); sem selo
   "Somente consulta" (quem só lê não vê os controles de edição); a data da última carga
   aparece discreta e uma vez só (`.status-discreto`, no `TopoDoPainel`).
5. **Nada novo no legado.** Arquivo novo em `src/modules/` ou `src/analises/` quebra o
   `npm run check:architecture` (`scripts/check-legado-so-encolhe.mjs`). Editar e apagar podem.

## Ordem das etapas

| Etapa | O quê                                                                                |
| ----- | ------------------------------------------------------------------------------------ |
| 1     | **Fundação (feita):** `src/app/`, `src/ui/`, pastas `modulos/` e `legado/`, checagem |
| 2     | Entrevistas, Recursos e Seleção saem do iframe e viram módulos/rotas                 |
| 3     | Configurações restantes (as seções legadas de `config-*.js`)                         |
| 4     | Análises (`analises.html` + `src/analises/`)                                         |
| 5     | Visão geral: primeiro o que não é mapa, depois os mapas                              |
| 6     | Login e entrada; fim do `legacy-app.js`                                              |
| 7     | Aya                                                                                  |

A mudança de pasta acontece **módulo a módulo**, na etapa de cada um — mover tudo de uma vez
gera conflito com quem está trabalhando em paralelo.

## Onde está cada coisa hoje → para onde vai

| Hoje                                                                                                                                                                                  | Alvo                                                      | Quando     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------- |
| `src/app/` (`montar-modulo.jsx`, `ErrorBoundary.jsx`)                                                                                                                                 | fica                                                      | —          |
| `src/ui/` (design system)                                                                                                                                                             | fica                                                      | —          |
| `src/componentes/modal.jsx` (só reexporta `src/ui/modal.jsx`)                                                                                                                         | sai quando ninguém importar daqui                         | ao tocar   |
| `src/componentes/icone.jsx`, `multi-select-busca.jsx`                                                                                                                                 | `src/ui/`                                                 | ao tocar   |
| `src/componentes/entrevistas/`, `recursos/`, `selecao/` + `src/entrevistas/`, `src/recursos/`, `src/selecao/` (`main.jsx`, CSS) + `entrevistas.html`, `recursos.html`, `selecao.html` | `src/modulos/entrevistas/`, `recursos/`, `selecao/`       | 2          |
| `src/modules/pagina-do-painel.js` (o iframe dos painéis)                                                                                                                              | sai (vira rota)                                           | 2          |
| `src/componentes/configuracoes/`, `acessos/`, `modulos/`, `saude-das-cargas/` + `src/modules/config-*.js`                                                                             | `src/modulos/configuracoes/`                              | 3          |
| `src/analises/` + `analises.html`                                                                                                                                                     | `src/modulos/analises/`                                   | 4          |
| `src/componentes/nucleo/`, `calendario-editais/`, `lista-aprovados/`                                                                                                                  | `src/modulos/editais/`, `cronograma/`, `aprovados/`       | ao tocar   |
| `src/modules/map-*`, `health-*`, `indigenous-*`, trechos do `legacy-app.js` (dashboard)                                                                                               | `src/modulos/visao-geral/`                                | 5          |
| `src/main.js`, `index.html`, `src/componentes/barra-lateral/`, `dados-do-monitoramento.js`, `usar-area-atual.js`                                                                      | `src/app/` (entrada, layout, área atual)                  | 6          |
| `src/modules/legacy-app.js`, `auth-*`, `access-*`, login do `index.html`                                                                                                              | `src/app/` (login); o resto sai                           | 6          |
| `src/modules/aya-*`                                                                                                                                                                   | `src/app/` (Aya no layout)                                | 7          |
| `src/lib/`                                                                                                                                                                            | fica                                                      | —          |
| `src/styles/tokens.css`                                                                                                                                                               | fica; os outros CSS vão com o módulo ou saem com o legado | cada etapa |

`src/modules/` e `src/analises/` **são** o legado de hoje. `src/legado/` fica vazio por enquanto:
só recebe código antigo numa mudança em bloco combinada antes (ver `src/legado/README.md`).

## Como criar um módulo novo

```
src/modulos/<nome>/
  <nome>.jsx      componente da tela + montar<Nome>(), que chama montarModulo
  estado.js       store sem React: obter(), assinar(ouvinte) e as ações (RPC)
  consultas.js    (opcional) as RPCs do módulo, se o estado.js ficar grande
  <nome>.css      (opcional) só o que é desta tela; o resto vem de src/ui/
src/lib/<nome>.js           regras puras
tests/modulos/<nome>.test.js  teste do componente (sem JSX, com act)
tests/<nome>.test.js          teste das regras de src/lib/
```

- `estado.js` não importa React (o legado também pode importá-lo). Componente lê com
  `useSyncExternalStore(estado.assinar, estado.obter)`; o que é só da tela (filtro, aba, página)
  é estado do componente.
- RPC nova ou mudada → `src/lib/rpc-contrato.js` (`npm run check:rpc-contract` quebra o build).
- Sem `innerHTML`/`dangerouslySetInnerHTML`; texto vai como filho.
- `StrictMode` está ligado: efeito tem de limpar o que instala.

## Como montar

```jsx
import { montarModulo } from "../../app/montar-modulo.jsx";

export function montarTela({
  elemento = document.getElementById("telaApp"),
  supabase,
} = {}) {
  const estado = criarEstadoDaTela({ supabase });
  const { raiz, desmontar } = montarModulo(elemento, <Tela estado={estado} />, {
    nome: "a tela X", // aparece no console se o módulo quebrar
    flushSync: false, // true quando o código seguinte precisa do DOM do módulo já desenhado
  });
  return { estado, raiz, desmontar, render: () => estado.carregar() };
}
```

`montarModulo(elemento, <Componente/>, { flushSync, nome })` = `createRoot` + `StrictMode` +
`ErrorBoundary`; devolve `{ raiz, desmontar }`. Todas as ilhas React de hoje (as de `src/main.js`
e as entradas `src/entrevistas|recursos|selecao/main.jsx`) montam por ele. Usam `flushSync`: a
barra lateral (o legado lê `#nav` logo depois) e os três painéis (saem com o skeleton desenhado).

## Como usar `ui/`

Importe do índice: `import { Kpi, GradeDeKpis, Aviso } from "../../ui/index.js";`. O `ui.css` é
importado uma vez no ponto de entrada (`src/main.js` e os `main.jsx` dos painéis), depois do CSS
de `src/analises/` e antes do CSS próprio do painel.

| Componente                       | API (uma linha)                                                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TopoDoPainel`                   | `{ titulo, subtitulo, visoes?, status, escuro, aoTema, aoTelaCheia, aoAtualizar, atualizarDesativado?, aoExportar?, exportarDesativado?, children? }` — sem `aoExportar` não há Exportar; filhos são botões extras |
| `usarAlturaDoTopo(ref)`          | publica a altura do `.topbar` em `--topbar-height`                                                                                                                                                                 |
| `PainelDeFiltros`                | `{ idDoTitulo, className?, recolhivel = true, quantos, aoLimpar, aoRecolher?(recolhido), children }` — "Refinar resultados" com resumo, recolher e Limpar tudo                                                     |
| `ChipsDeFiltro` / `ChipDeFiltro` | `{ children }` / `{ rotulo, aoTirar, children }` — filtros aplicados                                                                                                                                               |
| `Kpi`                            | `{ cor?, rotulo, valor, chave, titulo?, ativo?, aoClicar? }` — com `aoClicar` vira botão (filtro com `ativo`, atalho sem)                                                                                          |
| `GradeDeKpis`                    | `{ id?, className?, rotulo, children }`                                                                                                                                                                            |
| `CardDeGrafico`                  | `{ titulo, altura?, className?, elemento = "article", children }` — sem sobretítulo nem dica                                                                                                                       |
| `TabelaInfinita`                 | `{ idDoTitulo, titulo, busca: { placeholder, rotulo }, carregado, itens, filtrarPelaBusca, colunas, classeDaTabela?, linha(item), informacao(quantos \| null), total, vazio }` — 50 por vez, mais 50 ao rolar      |
| `Gaveta`                         | `{ id, tituloId, aoFechar, fecharAoClicarFora?, className?, cartaoClassName?, sobretitulo?, titulo, resumo?, rotuloDoFechar, children }`                                                                           |
| `TopoDaGaveta`                   | `{ sobretitulo?, titulo, tituloId, resumo?, aoFechar, rotuloDoFechar }` — quando o topo fica dentro de um `<form>`                                                                                                 |
| `Modal`                          | `{ id, rotuloId, aoFechar, fecharAoClicarFora?, className?, cartaoClassName?, children }` — portal, Esc, foco preso                                                                                                |
| `Aviso`                          | `{ tom? ("info" \| "warning" \| "danger"), papel?, como = "div", className?, children }`                                                                                                                           |
| `Campo`                          | `{ rotulo, erro?, dica?, obrigatorio?, largo?, children }` — liga o rótulo ao 1º controle                                                                                                                          |
| `Selo`                           | `{ tom = "neutro", titulo?, className?, children }` — `.badge`                                                                                                                                                     |
| `EstadoVazio` / `Carregando`     | `{ className = "empty", children }`                                                                                                                                                                                |
| `classes(...)`                   | junta classes ignorando as vazias                                                                                                                                                                                  |

Componente entra em `ui/` quando **duas telas ou mais** repetem a mesma peça; o que é de uma tela
só fica no módulo.

### O que os painéis ainda tiram de `src/analises/*.css`

As peças de estrutura (`.topbar`, `.kpis`/`.kpi`, `.filter-panel`, `.chips`/`.chip-filter`,
`.panel`, `.chart-wrap`, `.oper-grid`, `.table-card`/`.table-wrap`, `.attention-list`,
`.analises-drawer*`, `.kv`, `.badge`, `.empty`, o skeleton `body.analises-is-loading` e a faixa
`.analises-infinite-status`) ainda vêm de `analises.css`, `analises-layout-modern.css`,
`analises-painel.css`, `analises-esqueleto.css`, `analises-infinite-table.css` e
`analises-responsive-fixes.css`, que o painel legado de Análises também usa. Elas passam para
`ui.css` (em tokens) quando a Etapa 2 tirar os painéis do iframe; o legado de Análises mantém a
cópia dele até a Etapa 4.
