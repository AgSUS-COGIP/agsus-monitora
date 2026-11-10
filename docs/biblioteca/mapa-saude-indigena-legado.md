---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Mapa da Saúde Indígena: o que saiu do legado e o que mudou

Registro da migração do mapa para React ([[modulo-mapa-saude-indigena]], Etapa 5 da
[[arquitetura-do-front]], a parte "mapas"). Serve para não recriar o que saiu.

## O que saiu do legado

- `index.html`: o bloco do mapa da Saúde Indígena inteiro (os dois `section.health-map-pane`,
  `#map`, `#detailMap`, listas, filtros, vínculos externos, legendas).
- `legacy-app.js`: `LMAP`, `REDE_CNES`, `UF_GEO`, `BR_OUTLINE` (a cópia única é
  `src/lib/mapa-saude-indigena/contornos`), `initLeaflet`, `initDetailLeaflet`, `drawDSEIBubbles`,
  `drawCasai`, `renderDetailMap`, `detailRecordsForDsei`, `renderPainelNacional`, o leque, o calor,
  os vínculos externos, `resetDetailMap`, `voltarAoBrasil`, `syncMapLevelUI`, o código morto
  (`drawPolos`, `drawRedeAssistencial`, `polosCorrigidosPorCnes`…), `dseiSelecionado`,
  `applyFilters`/`aoMudarRecorte` e o `ligarMapa` do estado. O mapa de Projetos (`renderMap`,
  `desenharMunicipiosNoMapa`, `scheduleMapResize`) saiu depois, na parte 3
  ([[modulo-mapa-de-projetos]]); ficou `loadMapaConfig`, que publica no estado.
- `src/modules/`: `vinculos-territoriais.js`, `controles-do-mapa.js`, `legenda-das-terras.js`,
  `health-map-immersive-workspace.js`.
- CSS: `health-map-size-tuning.css`, `health-map-immersive-workspace.css`,
  `health-map-contrast.css`, `legenda-das-terras.css` (os `--terra-*` foram para `tokens.css`), as
  regras do mapa em `health-map-workspace.css` e os `#map` de `app.css`, `visual-polish.css`,
  `mobile-app.css` e `system-ui-fixes.css` (pegariam o `#map` do componente).
- Testes que liam o texto do legado: migrados para as regras de `src/lib/mapa-saude-indigena/` ou
  para o componente; os dos módulos apagados saíram com eles.

## O que mudou em relação ao legado

- Controles Brasil e Tela cheia no cabeçalho do painel, não dentro do mapa; "Tela cheia" é do
  componente (Esc sai).
- Sem o modo Calor (saiu em 02/10/2026, a pedido da gestão): a bolha só diz se há edital no recorte.
- Lista de unidades com a forma do tipo (a mesma da legenda) em vez do ícone Font Awesome.
- Sem textos de ajuda: rodapé "Escolha um DSEI…", "clique para abrir o território" e os avisos ao
  voltar ao Brasil foram para a Aya; estados vazios em uma linha ([[textos-da-interface]]).
- O DSEI fecha por "← Voltar ao Brasil" (botão primário no topo do painel; o trilho
  "Brasil › DSEI" saiu) ou por Esc ([[mapa-saude-indigena-volta-ao-brasil]]).
- O DSEI ativo é verde com borda amarela, como a legenda diz (`CORES_DO_MAPA`). O legado pintava de
  azul por cima, com o `health-map-contrast.css` (que saiu), e a legenda dele dizia verde.
- Dicas que não saem do mapa perto da borda; popups que cabem no celular.
- A legenda começa recolhida.

## Relacionadas

- [[codigo-legado]] — a regra de apagar o que a migração substituiu
- [[modulo-mapa-saude-indigena]] — o mapa de hoje
- [[mapa-saude-indigena-volta-ao-brasil]] — o voo de volta e o enquadramento
