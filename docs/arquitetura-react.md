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
| 2     | Entrevistas, Recursos e Seleção saem do iframe (**feita**)                           |
| 3     | Configurações: todas as seções já são React; falta mudar para `src/modulos/`         |
| 4     | Análises (**feita**: `src/modulos/analises/`)                                        |
| 5     | Visão geral: primeiro o que não é mapa, depois os mapas                              |
| 6     | Login e entrada; fim do `legacy-app.js`                                              |
| 7     | Aya                                                                                  |

A mudança de pasta acontece **módulo a módulo**, na etapa de cada um — mover tudo de uma vez
gera conflito com quem está trabalhando em paralelo.

## Onde está cada coisa hoje → para onde vai

| Hoje                                                                                                             | Alvo                                                      | Quando     |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------- |
| `src/app/` (`montar-modulo.jsx`, `ErrorBoundary.jsx`)                                                            | fica                                                      | —          |
| `src/ui/` (design system)                                                                                        | fica                                                      | —          |
| `src/componentes/modal.jsx` (só reexporta `src/ui/modal.jsx`)                                                    | sai quando ninguém importar daqui                         | ao tocar   |
| `src/componentes/icone.jsx`, `multi-select-busca.jsx`                                                            | `src/ui/`                                                 | ao tocar   |
| `src/componentes/configuracoes/`, `acessos/`, `modulos/`, `saude-das-cargas/` + `src/modules/config-secoes.js`   | `src/modulos/configuracoes/`                              | 3          |
| `src/componentes/nucleo/`, `calendario-editais/`, `lista-aprovados/`                                             | `src/modulos/editais/`, `cronograma/`, `aprovados/`       | ao tocar   |
| `src/modules/map-*`, `health-*`, `indigenous-*`, trechos do `legacy-app.js` (dashboard)                          | `src/modulos/visao-geral/`                                | 5          |
| `src/main.js`, `index.html`, `src/componentes/barra-lateral/`, `dados-do-monitoramento.js`, `usar-area-atual.js` | `src/app/` (entrada, layout, área atual)                  | 6          |
| `src/modules/legacy-app.js`, `auth-*`, `access-*`, login do `index.html`                                         | `src/app/` (login); o resto sai                           | 6          |
| `src/modules/aya-*`                                                                                              | `src/app/` (Aya no layout)                                | 7          |
| `src/lib/`                                                                                                       | fica                                                      | —          |
| `src/styles/tokens.css`                                                                                          | fica; os outros CSS vão com o módulo ou saem com o legado | cada etapa |

`src/modules/` **é** o legado de hoje (`src/analises/` ficou só com o `CLAUDE.md`: o painel de
Análises e o CSS do quadro saíram). `src/legado/` fica vazio por enquanto:
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
`ErrorBoundary`; devolve `{ raiz, desmontar }`. Todas as ilhas React de hoje (as de `src/main.js`)
montam por ele. Usa `flushSync` a barra lateral (o legado lê `#nav` logo depois).

**Tela de página inteira** (modelos: `src/modulos/recursos/`, `src/modulos/selecao/`, `src/modulos/entrevistas/`, esta com visões num `Segmentado` no topo, e `src/modulos/analises/`): monta na `<section id="page-<view>">`
vazia do `index.html`, sem pedir nada ao banco; `src/main.js` guarda o controlador em `window`
(`recursosController`) e o legado chama `render()` ao navegar (tabela `TELAS_REACT` do `navigate`).
A área vem de `usarAreaAtual()`/`obterDadosDoMonitoramento()`, o tema de `usarTemaEscuro()`
(`src/app/tema.js`), o aviso de `window.monitoraToast` (passado na montagem). O título e a área
ficam no cabeçalho do app (`setPageTitle`); a tela não repete.

## Como usar `ui/`

Importe do índice: `import { Kpi, GradeDeKpis, Aviso } from "../../ui/index.js";`. O `ui.css` é
importado uma vez no ponto de entrada (`src/main.js`); o CSS próprio de um módulo de
`src/modulos/` entra no `src/main.js` logo depois.

Os componentes emitem só classes `.ui-*` (prefixo para não colidir com `.panel`,
`.kpi`, `.card`… de `app.css`) e nenhum id fixo. Peças de layout em CSS, sem componente:
`.ui-tela` (raiz da tela), `.ui-card`, `.ui-titulo`, `.ui-linha-de-cards` (dois cards lado a lado),
`.ui-pilha` (card com título e lista embaixo),
`.ui-grade-de-campos`, `.ui-acoes`, `.ui-gaveta-contexto`, `.ui-gaveta-corpo`, `.ui-gaveta-rodape`,
`.ui-texto-principal`/`.ui-texto-secundario` (célula), `.ui-secao-texto`/`.ui-secao-vazio`,
`.ui-esqueleto` (skeleton) e `.btn.small`/`.btn.danger` dentro de `.ui-tela`/`.ui-gaveta`.

| Componente                           | API (uma linha)                                                                                                                                                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TopoDoPainel`                       | `{ visoes?, status, aoAtualizar, atualizarDesativado?, aoExportar?, exportarDesativado?, children? }` — sem título, tema nem tela cheia (são do app); filhos são botões extras                                                                                                                          |
| `PainelDeFiltros`                    | `{ idDoTitulo, className?, recolhivel = true, quantos, escopo = "Todos", podeLimpar?, aoLimpar, aoRecolher?(recolhido), children }` — "Refinar resultados" com resumo, recolher e Limpar tudo                                                                                                           |
| `ChipsDeFiltro` / `ChipDeFiltro`     | `{ children }` / `{ rotulo, aoTirar, children }` — filtros aplicados                                                                                                                                                                                                                                    |
| `Kpi`                                | `{ cor?, tom?, icone?, rotulo, valor, chave, titulo?, ativo?, aoClicar?, carregando? }` — card de 78px, tile do ícone no tom; com `aoClicar` vira botão (filtro com `ativo`, atalho sem); `carregando` = skeleton                                                                                       |
| `GradeDeKpis`                        | `{ id?, className?, rotulo, children }`                                                                                                                                                                                                                                                                 |
| `CardDeGrafico`                      | `{ titulo, altura? ("short", "alto"), carregando?, className?, elemento = "article", children }` — sem sobretítulo nem dica                                                                                                                                                                             |
| `Grafico` / `paletaDosGraficos`      | `{ tipo, montar() → { data, options }, dependencias, rotulo, id?, plugins? }` — Chart.js criado uma vez e atualizado; `paletaDosGraficos(escuro, reserva)` lê as cores dos tokens                                                                                                                       |
| `TabelaInfinita`                     | `{ idDoTitulo, titulo, busca: { placeholder, rotulo, valor?, aoMudar? }, carregado, itens, filtrarPelaBusca, colunas, classeDaTabela?, linha(item), informacao(quantos \| null), total, vazio }` — 50 por vez, mais 50 ao rolar ou no "Carregar mais"; busca controlável; avisa `agsus:content-updated` |
| `Gaveta`                             | `{ id, tituloId, aoFechar, fecharAoClicarFora?, className?, cartaoClassName?, sobretitulo?, titulo, resumo?, rotuloDoFechar, children }` — encostada à direita                                                                                                                                          |
| `TopoDaGaveta`                       | `{ sobretitulo?, titulo, tituloId, resumo?, aoFechar, rotuloDoFechar }` — quando o topo fica dentro de um `<form>`; `usarClassesDaGaveta()` dá as classes do fundo e do cartão para um `<Modal>` direto                                                                                                 |
| `Secao` / `Kv` / `GradeDeKv`         | `{ icone, titulo, secao, children }` / `{ rotulo, children }` (vazio vira "—") / `{ className?, rotulo?, children }` — o detalhe na gaveta                                                                                                                                                              |
| `Modal`                              | `{ id, rotuloId, aoFechar, fecharAoClicarFora?, className?, cartaoClassName?, children }` — portal, Esc, foco preso                                                                                                                                                                                     |
| `Aviso`                              | `{ tom? ("info" \| "warning" \| "danger"), papel?, como = "div", className?, children }`                                                                                                                                                                                                                |
| `Campo`                              | `{ rotulo, erro?, dica?, obrigatorio?, largo?, idDoControle?, children }` — liga o rótulo ao 1º controle (ou ao `idDoControle`)                                                                                                                                                                         |
| `Selo`                               | `{ tom = "neutro" ("aprovado", "reprovado", "pendente", "revisar"), titulo?, className?, children }`                                                                                                                                                                                                    |
| `EstadoVazio` / `Carregando`         | `{ className?, children }` — `.ui-vazio`                                                                                                                                                                                                                                                                |
| `Segmentado`                         | `{ rotulo, opcoes: [{ valor, rotulo, icone? }], valor, aoMudar, desabilitado?, className? }` — radiogroup, setas ← → movem a escolha (visões de Entrevistas no topo, escala, comparecimento)                                                                                                            |
| `LinhaDoRecorte` / `MarcasDoRecorte` | `{ ativos?: [[campo, rótulo, valor]], texto?, children? }` — "Recorte ativo: …" ou "Sem filtros" (`textoDoRecorte(ativos)`; `texto` troca a frase); filhos abaixo / `{ marcas: [{ chave, tom?, icone?, texto }] }` — as marcas (sucesso, alerta, neutro)                                                |
| `ListaDePendencias`                  | `{ itens: [{ chave, titulo, detalhe, tom? ("alerta" \| "perigo"), ativo?, aoClicar }], carregando?, vazio }` — botões que filtram (`ativo` → `aria-pressed`) ou abrem uma lista; skeleton                                                                                                               |
| `MaisOpcoes`                         | `{ id, aberto, aoAlternar, quantos?, titulo, children }` — botão "Mais opções" com a contagem e o bloco dos filtros adicionais (controlado)                                                                                                                                                             |
| `classes(...)`                       | junta classes ignorando as vazias                                                                                                                                                                                                                                                                       |

Componente entra em `ui/` quando **duas telas ou mais** repetem a mesma peça; o que é de uma tela
só fica no módulo.

O modo "no quadro" (`<PainelNoQuadro>`, a marcação do antigo painel de análises para as telas que
rodavam em iframe) saiu com a Seleção, a última delas, ao fim da Etapa 2 — junto com o CSS que
sobrava em `src/analises/` e `src/modules/pagina-do-painel.js`. Nenhuma tela do app abre mais em
iframe; só os painéis externos (`TB_PAINEL_EXTERNO`) continuam no quadro.
