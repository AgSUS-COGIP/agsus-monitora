# `src/modulos/mapa-saude-indigena/` — Mapa da Saúde Indígena

O mapa da Visão geral da área Saúde Indígena em React (Etapa 5, a parte "mapas"). Peça
independente, **ainda não ligada**: o legado (`legacy-app.js` + `#map`/`#detailMap` do
`index.html`) continua desenhando o mapa até a ligação, feita depois que a parte não-mapa da
Visão geral (`src/modulos/visao-geral/`) entrar.

```
mapa-saude-indigena.jsx   <MapaSaudeIndigena>: estado da tela (calor, tela cheia), contas memorizadas,
                          um mapa principal de cada vez
mapa-nacional.jsx         visão nacional: bolhas dos DSEIs, CASAIs nacionais, leque, enquadramento,
                          "Territórios por vagas", Brasil/Calor/Tela cheia, legenda flutuante
mapa-do-dsei.jsx          território do DSEI: unidades (agrupamento por proximidade + leque), sede,
                          vínculos externos, filtros por tipo, lista de unidades, Terras Indígenas e povos
legenda.jsx               <Forma>, legenda nacional (recolhível), legenda do DSEI, fases das terras
leaflet.js                fábrica do mapa, fundo com recurso, contornos, ícones/popup/dica em DOM seguro
usar-ultimo.js            ref com a última função do pai (ouvintes do Leaflet sem redesenhar)
mapa-saude-indigena.css   só o que é deste bloco (tokens); card/título/vazio de src/ui/
```

Regras puras: `src/lib/mapa-saude-indigena/` — `chaves.js` (chave do DSEI), `formas.js` (formas,
cores, tipos, faixas do calor), `mapa-nacional.js` (contagens, bolhas, CASAIs nacionais,
territórios por vagas, enquadramento, dicas/popups), `mapa-do-dsei.js` (pontos do DSEI com a
prioridade lmap → reconciliação → rede_cnes, vínculo, tipos, resumo da dica, enquadramentos,
popups), `contornos.js` (UF_GEO e BR_OUTLINE). Explicações para a Aya:
`docs/aya/regras-do-mapa-saude-indigena.md`. Testes: `tests/mapa-saude-indigena.test.js` (regras,
com fixture real das Lotações de `public/data`) e `tests/modulos/mapa-saude-indigena.test.js`
(componente, Leaflet falso em `tests/modulos/leaflet-falso.js`).

## Contrato para ligar na Visão geral

```jsx
import { MapaSaudeIndigena } from "../mapa-saude-indigena/mapa-saude-indigena.jsx";
// CSS: import "./modulos/mapa-saude-indigena/mapa-saude-indigena.css" em src/main.js, depois de ui.css

<MapaSaudeIndigena
  lmap={lmap}                    // payload da chave "lmap"
  redeCnes={redeCnes}            // payload da chave "rede_cnes"
  linhas={linhasDoRecorte}       // editais da área já recortados (filtros + busca + DSEI)
  filtroAtivo={haFiltroAtivo}    // hasActiveFilter(): filtro, busca ou DSEI
  dseiSelecionado={dsei?.k}      // controlado: chave `k` do lmap (ou o nome; compara por chaveDoDsei)
  carregando={!lmap}
  aoEscolherDsei={(d) => …}      // bolha ou linha do ranking: o pai recorta a página pelo DSEI
  aoSairDoDsei={() => …}         // trilho "Brasil": o pai tira só o DSEI do recorte
  aoFiltrarPorBusca={(t) => …}   // CASAI nacional: busca "CASAI <cidade>"
  aoEscolherUnidade={(r) => …}   // opcional: unidade da lista (o mapa já voa até ela)
  tema="escuro" | "claro"        // opcional; sem ele segue usarTemaEscuro()
/>
```

| Prop / evento       | De onde vem hoje no legado                                                                                                                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lmap`, `redeCnes`  | `loadMapaConfig` lê `TB_CONFIG_MAPA_SAUDE_INDIG` (chaves `lmap`, `rede_cnes`) pelo cliente decorado por `lotacoes-geograficas-transport.js`, que mescla as Lotações (`applyLotacoesGeograficas`). Ao ligar: a mesma consulta no `estado.js` da Visão geral (ou o legado publica). |
| `linhas`            | `filtered` de `applyFilters` (área atual + `filterState` + busca + `dseiSelecionado`)                                                                                                                                                                                             |
| `filtroAtivo`       | `hasActiveFilter()`                                                                                                                                                                                                                                                               |
| `dseiSelecionado`   | `dseiSelecionado`/`dseiSelecionadoNome` (`entrarNoTerritorio`/`sairDoTerritorio`); trocar de área sai do DSEI                                                                                                                                                                     |
| `aoEscolherDsei`    | `entrarNoTerritorio(d)`: guarda o DSEI e chama `applyFilters()` (a tabela e os KPIs passam a ser só dele)                                                                                                                                                                         |
| `aoSairDoDsei`      | `resetDetailMap()`/`voltarAoBrasil()`: tira o DSEI, mantém os filtros; a pílula "DSEI X ×" também chama                                                                                                                                                                           |
| `aoFiltrarPorBusca` | clique da CASAI nacional: `#tableSearch = "CASAI " + cidade` e `applyFilters()`                                                                                                                                                                                                   |

**Ids.** Os contêineres dos mapas recebem `id="map"` (nacional) e `id="detailMap"` (DSEI)
(`idDoMapaNacional`/`idDoMapaDoDsei`), porque `indigenous-territories-layer.js` e
`map-base-layer-switcher.js` só enfeitam mapas com esses ids (Terras Indígenas, abrangência,
Mapa/Satélite). Por isso **a marcação antiga sai do `index.html` na mesma mudança** — dois `#map`
na página quebram as camadas. O `map-guard.js` e o `map-zoom-range.js` valem para qualquer mapa.
Ganchos da camada de terras usados (todos opcionais): `__agsusSetDseiCoverage`,
`__agsusAoMudarTerras`, `__agsusEnquadrarTerra`, `__agsusDseiCoverageBounds`,
`agsus:dsei-coverage-ready`, `__agsusDseiCoverageLayer`, `__agsusFaseDaTerraVisivel`,
`__agsusAlternarFaseDaTerra`, `agsus:terras-mudaram`, `__agsusSuspenderCamadasIndigenas`.

**Projetos/SEDE.** O componente é só da Saúde Indígena: na área Projetos a Visão geral monta o
mapa de municípios (outro trabalho), na SEDE nenhum. Não há mais `__agsusSuspenderCamadasIndigenas(true)`
num mapa compartilhado — cada área tem o seu.

### O que substituir no legado, na ligação

- `index.html`: o bloco `.health-map-workspace` inteiro (os dois `section.health-map-pane`, `#map`,
  `#detailMap`, `#brasilDseiList`, `#masterMapCount`, `#detailUnitList`, `#detailTerraList`,
  `#detailFiltros`, `#detailExternal*`, `#detailMapReset`, `#mapLegend*`, a legenda do detalhe).
- `legacy-app.js` (removíveis, depois de `grep`): `LMAP`/`REDE_CNES` (passam ao estado da Visão
  geral), `UF_GEO`, `BR_OUTLINE` (importar de `src/lib/mapa-saude-indigena/contornos.js` se ainda
  houver uso), `_unpackEstab`, as variáveis `_leaflet`, `_layer*`, `_detail*`, `_marcadoresDsei`,
  `_tracosDoLeque`, `_mapResizeObservers`, `_heatMode`, `_ptsZoom`, `_saBounds`, `_homeFlyTimer`,
  `_suppressAutoFit`, `_lastMapAutoFitKey`, `_BRASIL_VIEW`, `_detailTiposOcultos`,
  `_resumoDaRedePorDsei`; as funções `addResilientMapTiles`, `observeLeafletSize`,
  `setBrazilMaxBounds`, `flyToBrasil`, `toggleHeatMap`, `rebuildDseiIndex`/`DSEI_BY_K`, `mapNameKey`,
  `_wordContains`, `_strongNameMatch`, `findCnesPoloRecord`, `polosCorrigidosPorCnes`, `procCounts`,
  `heatColor`, `initLeaflet`, `initDetailLeaflet`, `drawDetailBrazilBase`, `detailUnitType`,
  `TIPO_SEDE`/`TIPO_POLO`/`TIPO_CASAI`, `detailRecordsForDsei`, `_tiposDoTerritorio`,
  `renderDetailTerraList`, `renderDetailUnitList`, `renderDetailFiltros`, `renderDetailMap`,
  `enquadrarDetalhe`, `atualizarChipDeVinculos`, `toggleVinculosExternos`,
  `definirSelecaoDoMapaDetalhado`, `resetDetailMap`, `scheduleMapResize`, `drawBrasilOutline`,
  `renderPainelNacional`, `corDoTracoDoLeque`, `aplicarLequeDosDsei`, `drawDSEIBubbles`, `drawCasai`,
  `_spread`, `drawRedeAssistencial`, `drawPolos`, `esquecerResumoDaRede`, `resumoDaRedeDoDsei`,
  `mapVoltar`, `syncMapLevelUI`; a parte Saúde Indígena de `renderMap` e `voltarAoBrasil`;
  `resetDetailMap`/`toggleVinculosExternos` do `Object.assign(window, …)`. Ficam (são da página):
  `dseiKey` (ou trocar por `chaveDoDsei`), `dseiSelecionado`, `entrarNoTerritorio`/`sairDoTerritorio`
  reduzidos a estado + `applyFilters`, `chaveDeRenderDoMapa`, `loadMapaConfig` (até o estado da
  Visão geral ler a tabela).
  **Já é código morto hoje:** `drawPolos`, `drawRedeAssistencial`, `polosCorrigidosPorCnes`,
  `findCnesPoloRecord`, `_spread`, `_layerPolos`/`_layerUbsi`/`_layerCasaiLocal` e o ramo
  "Polos base do DSEI" de `syncMapLevelUI` (nada chama `drawPolos`).
- `src/modules/` que saem com o legado do mapa: `vinculos-territoriais.js`
  (e `aplicarLegendaDoMapaDetalhado` no `src/main.js`), `controles-do-mapa.js`,
  `legenda-das-terras.js`, `health-map-immersive-workspace.js` (tela cheia agora é do componente) e o
  trecho `#map` de `health-dashboard-refinements.js`. Ficam: `indigenous-territories-layer.js`,
  `map-guard.js`, `map-base-layer-switcher.js`, `map-zoom-range.js`, `lotacoes-geograficas-transport.js`.
- CSS que perde seletor: `health-map-workspace.css` (as regras `.health-map-*`, `.mapa-marcador*`),
  `health-map-size-tuning.css`, `health-map-immersive-workspace.css`, o trecho `#map` de
  `health-map-contrast.css`, `legenda-das-terras.css` (levar os três `--terra-*` para `tokens.css`
  ou para o CSS do módulo).
- Testes que leem o texto do legado do mapa (`enquadramento-do-mapa`, `pos159-regressoes`,
  `sede-do-dsei-e-casai`, `controles-do-mapa`, `legenda-das-terras`, `vinculo-territorial`,
  `contagem-da-dica-do-dsei`…): migrar o que valer para os testes deste módulo e apagar o resto.
  As conferências "igual ao legado" de `tests/mapa-saude-indigena.test.js` se desligam sozinhas
  quando a cópia do legado sumir.

## O que mudou em relação ao legado

- Controles Brasil, Calor e Tela cheia no cabeçalho do painel, não dentro do mapa; "Tela cheia" é do
  componente (Esc sai).
- Com Calor ligado, a legenda mostra as faixas de ociosidade (antes não mudava).
- Lista de unidades com a forma do tipo (a mesma da legenda) em vez do ícone Font Awesome.
- Sem textos de ajuda: rodapé "Escolha um DSEI…", "clique para abrir o território" e os avisos ao
  ligar o calor ou voltar ao Brasil foram para a Aya; estados vazios em uma linha.
- O DSEI fecha pelo trilho "Brasil" (o botão duplicado "Voltar à visão nacional" saiu).
- Enquadramento do Brasil por `BRASIL_BOUNDS` (contorno real), como o `map-guard`, em vez do
  retângulo antigo que cortava a ponta leste.
- O mapa do DSEI é criado ao abrir o distrito e destruído ao sair (antes ficava montado escondido).
