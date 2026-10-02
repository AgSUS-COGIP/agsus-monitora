# `src/modulos/mapa-saude-indigena/` — Mapa da Saúde Indígena

O mapa da Visão geral da área Saúde Indígena em React (Etapa 5, a parte "mapas"), ligado na Visão
geral (`src/modulos/visao-geral/`) e lendo o estado dela. O legado não desenha mais mapa da Saúde
Indígena; só o de Projetos (municípios das vagas) continua legado.

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
(componente, Leaflet falso em `tests/modulos/leaflet-falso.js`); a ligação com o estado em
`tests/modulos/visao-geral.test.js`; dicas e popups em `tests/dica-dentro-do-mapa.test.js`.

## Ligação na Visão geral

Ligado em `src/modulos/visao-geral/visao-geral.jsx` (`MapaDaSaudeIndigena`), só quando a área é a
Saúde Indígena (`mapaDaVisaoGeral(area) === MAPA_DOS_DSEIS`). Lê o MESMO estado da Visão geral
(`src/modulos/visao-geral/estado.js`) e pede a ele:

```jsx
<MapaSaudeIndigena
  lmap={e.mapa.lmap} // TB_CONFIG_MAPA_SAUDE_INDIG, chave "lmap" (com as Lotações)
  redeCnes={e.mapa.redeCnes} // chave "rede_cnes"
  linhas={e.filtradas} // editais da área recortados (filtros + busca + DSEI)
  filtroAtivo={e.temRecorte}
  dseiSelecionado={e.dsei.chave} // chave normalizada (chaveDoDsei)
  carregando={!e.mapa.lmap}
  aoEscolherDsei={(d) => estado.definirDsei(d.k, d.n)} // bolha ou ranking
  aoSairDoDsei={estado.tirarDsei} // trilho "Brasil"
  aoFiltrarPorBusca={estado.definirBusca} // CASAI nacional: "CASAI <cidade>"
/>
```

- **Dados.** `loadMapaConfig` (legado) continua lendo a tabela — ela faz parte da cópia da sessão
  e da recarga — e publica `estado.definirDadosDoMapa({ lmap, redeCnes })`.
- **DSEI.** `definirDsei` guarda `chaveDoDsei(chave)`; o recorte compara com
  `chaveDoDsei(linha.unidade)`. O chip "DSEI X ×" e o trilho "Brasil" chamam `tirarDsei` (os
  filtros ficam); "Limpar tudo", a busca global (`localizar`) e a troca de área tiram o DSEI.
- **Ciclo de vida.** Trocar de área desmonta o componente e o `remove` do Leaflet (StrictMode limpo).

**Ids.** Os contêineres dos mapas recebem `id="map"` (nacional) e `id="detailMap"` (DSEI)
(`idDoMapaNacional`/`idDoMapaDoDsei`), porque `indigenous-territories-layer.js` e
`map-base-layer-switcher.js` só enfeitam mapas com esses ids (Terras Indígenas, abrangência,
Mapa/Satélite). A marcação antiga saiu do `index.html`: nenhum outro `#map`/`#detailMap` na página.
O mapa de Projetos (legado) usa `#mapaDosProjetos`. O `map-guard.js` e o `map-zoom-range.js` valem
para qualquer mapa. Ganchos da camada de terras usados (todos opcionais): `__agsusSetDseiCoverage`,
`__agsusAoMudarTerras`, `__agsusEnquadrarTerra`, `__agsusDseiCoverageBounds`,
`agsus:dsei-coverage-ready`, `__agsusDseiCoverageLayer`, `__agsusFaseDaTerraVisivel`,
`__agsusAlternarFaseDaTerra`, `agsus:terras-mudaram`, `__agsusSuspenderCamadasIndigenas`.

**Projetos/SEDE.** O componente é só da Saúde Indígena. Em Projetos a Visão geral mostra o bloco
legado do `index.html` (`#mapaDaVisaoGeral`: `criarMapaDosMunicipios` e `desenharMunicipiosDaArea`
em `src/modules/municipios-da-visao-geral.js`); na SEDE, nenhum.

**Dicas e popups.** `criarMapa` liga `manterDicasDentroDoMapa` (`src/lib/dica-dentro-do-mapa.js`,
também no mapa de Projetos): a dica que abre perto da borda troca de direção (em cima → embaixo →
o lado com mais espaço) em vez de sair do contêiner, tem largura máxima relativa ao mapa e quebra
na palavra (`.dica-no-mapa`, `src/ui/ui.css`); o popup tem `autoPan` com folga para os controles,
`keepInView` e `maxWidth`/`maxHeight` relativos ao tamanho do mapa (celular e mapa do DSEI).

### O que saiu do legado na ligação

- `index.html`: o bloco do mapa da Saúde Indígena inteiro (os dois `section.health-map-pane`,
  `#map`, `#detailMap`, listas, filtros, vínculos externos, legendas). Ficou só o de Projetos.
- `legacy-app.js`: `LMAP`, `REDE_CNES`, `UF_GEO`, `BR_OUTLINE` (a cópia única é
  `src/lib/mapa-saude-indigena/contornos.js`), `initLeaflet`, `initDetailLeaflet`, `drawDSEIBubbles`,
  `drawCasai`, `renderDetailMap`, `detailRecordsForDsei`, `renderPainelNacional`, o leque, o calor, os
  vínculos externos, `resetDetailMap`, `voltarAoBrasil`, `syncMapLevelUI`, o código morto
  (`drawPolos`, `drawRedeAssistencial`, `polosCorrigidosPorCnes`…), `dseiSelecionado`,
  `applyFilters`/`aoMudarRecorte` e o `ligarMapa` do estado. Ficou o mapa de Projetos (`renderMap`,
  `desenharMunicipiosNoMapa`, `scheduleMapResize`) e `loadMapaConfig`, que publica no estado.
- `src/modules/`: `vinculos-territoriais.js`, `controles-do-mapa.js`, `legenda-das-terras.js`,
  `health-map-immersive-workspace.js`.
- CSS: `health-map-size-tuning.css`, `health-map-immersive-workspace.css`,
  `health-map-contrast.css`, `legenda-das-terras.css` (os `--terra-*` foram para `tokens.css`), as
  regras do mapa da Saúde Indígena em `health-map-workspace.css` e os `#map` de `app.css`,
  `visual-polish.css`, `mobile-app.css` e `system-ui-fixes.css` (pegariam o `#map` do componente).
- Testes que liam o texto do legado: migrados para as regras de `src/lib/mapa-saude-indigena/` ou
  para o componente; os dos módulos apagados saíram com eles.

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
- O DSEI ativo é verde com borda amarela, como a legenda diz (`CORES_DO_MAPA`). O legado pintava
  de azul por cima, com o `health-map-contrast.css` (que saiu), e a legenda dele dizia verde.
- Dicas que não saem do mapa perto da borda; popups que cabem no celular.
