---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Mapa da Saúde Indígena

O mapa da Visão geral da área Saúde Indígena em React, em `src/modulos/mapa-saude-indigena/`,
ligado na Visão geral e lendo o estado dela. O legado não desenha mais mapa nenhum. O de Projetos é
o módulo irmão ([[modulo-mapa-de-projetos]]), com as mesmas regras: reaproveita daqui o painel do
mapa nacional, `leaflet.ts` (leque, enquadramento), a legenda flutuante, a tela cheia e `.mapa-si-*`.

Sub-notas: [[mapa-saude-indigena-modo-dseis]] (terceiro fundo, "Mapa DSEIs"),
[[mapa-saude-indigena-volta-ao-brasil]] (sair do DSEI, Esc e foco),
[[mapa-saude-indigena-legado]] (o que saiu e o que mudou) e
[[mapa-saude-indigena-contratos]] (TypeScript e fronteiras dos dados).

## Controles, tela cheia e edição

- Os controles ficam no cabeçalho, acima do mapa e da lista lateral. Em tela cheia, o painel cobre
  o shell, mantém "Sair da tela cheia" visível e bloqueia a rolagem até sair (botão ou Esc).
- O editor de coordenadas (admin global e Gestor) abre o **modo de edição**
  (`src/modulos/editor-de-coordenadas/modo-de-edicao.tsx`): o painel cobre a página, o mapa ocupa o
  corpo e o editor flutua à direita (no celular, numa folha embaixo, com o mapa em ≥ 55% da
  altura), recolhível; o enquadramento do ponto desconta o painel (`folgaDoEnquadramento`).
  "Voltar à lista", "Coordenadas" ou Esc voltam ao layout (`--mapa-si-altura` não muda).
- Fila de pontos (busca, "Só pendentes" com as pendências da auditoria), "Conferido", sugestões e
  histórico com "Desfazer": RPCs da migration `20261002160000_conferir_coordenadas_mapa`, regras em
  `src/lib/coordenadas-do-mapa.ts`. O editor é comum ([[modulo-editor-de-coordenadas]]); aqui fica
  só `editor-de-coordenadas.tsx`, com os pontos do `lmap`/`rede_cnes` e as RPCs
  `*_coordenada_mapa_saude_indigena` (`FONTE_DA_SAUDE_INDIGENA`).

## Arquivos

- `mapa-saude-indigena.tsx` — `<MapaSaudeIndigena>`: estado da tela, contas memorizadas, um mapa
  principal de cada vez.
- `mapa-nacional.tsx` — bolhas dos DSEIs, CASAIs nacionais, leque, enquadramento, "Territórios por
  vagas", Brasil/Recolher mapa/Tela cheia (recolher.tsx; a escolha em
  `src/lib/mapa-recolhido.ts`, no localStorage), legenda flutuante.
- `mapa-do-dsei.tsx` — território do DSEI: unidades (agrupamento por proximidade + leque), sede,
  vínculos externos, filtros por tipo, lista de unidades, Terras Indígenas e povos.
- `legenda.tsx` — `<Forma>`, `<LegendaFlutuante>` (recolhível; também a de Projetos), legendas
  nacional e do DSEI, fases das terras.
- `leaflet.ts` — fábrica (`criarMapa`, `criarMapaDoBrasil`), fundo com recurso, contornos,
  `enquadrar`, `criarLeque`, ícones/popup/dica em DOM seguro (os dois mapas).
- `painel-do-mapa.tsx` — peças comuns: `usarMapaDoBrasil`, `TopoDoMapa`, `MolduraDoMapa`,
  `ListaDoMapa`, `propsDoEditor`.
- `tela-cheia.tsx` — `usarTelaCheia` e `travarRolagemDaPagina` (contada: tela cheia e edição).
- `ordem-da-lista.tsx` — "Ordenar" (Vagas, A–Z, Nº do DSEI, % preenchidas, Ociosas), escolha
  guardada no navegador; regras em `src/lib/mapa-saude-indigena/ordem-dos-territorios.ts`.
- `volta-ao-brasil.ts` (`usarVoltaDoDsei`, `usarEscParaVoltar`), `usar-ultimo.ts` (ref com a
  última função do pai), `mapa-simples.tsx` e `mapa-saude-indigena.css` (só tokens).

Regras puras em `src/lib/mapa-saude-indigena/`: `chaves` (chave do DSEI), `formas` (formas, cores,
tipos), `mapa-nacional` (contagens, bolhas, CASAIs, territórios por vagas, enquadramento,
dicas/popups), `mapa-do-dsei` (prioridade lmap → reconciliação → rede_cnes, vínculo, tipos,
enquadramentos) e `contornos` (`UF_GEO`, `BR_OUTLINE`). Para quem usa:
`docs/aya/regras-do-mapa-saude-indigena.md`.

## Ligação na Visão geral

Em `src/modulos/visao-geral/visao-geral.tsx` (`MapaDaSaudeIndigena`), só quando a área é a Saúde
Indígena (`mapaDaVisaoGeral(area) === MAPA_DOS_DSEIS`). Lê o MESMO estado
(`src/modulos/visao-geral/estado.ts`). Props: `lmap` (`TB_CONFIG_MAPA_SAUDE_INDIG`, chave "lmap",
com as Lotações), `redeCnes` (chave "rede_cnes"), `linhas` (editais recortados), `filtroAtivo`,
`dseiSelecionado` (chave normalizada), `carregando`, `aoEscolherDsei` (`estado.definirDsei`),
`aoSairDoDsei` (`estado.tirarDsei`) e `aoFiltrarPorBusca` (CASAI nacional: "CASAI <cidade>").

- **Dados.** `loadMapaConfig` (legado) lê a tabela (faz parte da cópia da sessão e da recarga) e
  publica `estado.definirDadosDoMapa({ lmap, redeCnes })`.
- **DSEI.** `definirDsei` guarda `chaveDoDsei(chave)`; o recorte compara com
  `chaveDoDsei(linha.unidade)`. O chip "DSEI X ×", "← Voltar ao Brasil" e Esc chamam `tirarDsei`
  (os filtros ficam); "Limpar tudo", a busca global e a troca de área tiram o DSEI.
- **Ciclo de vida.** Trocar de área desmonta o componente e o `remove` do Leaflet (StrictMode limpo).
- **Ids.** `id="map"` (nacional) e `id="detailMap"` (DSEI), porque
  `indigenous-territories-layer.ts` e `map-base-layer-switcher.ts` só enfeitam esses ids; nenhum
  outro `#map`/`#detailMap` na página. Projetos usa `#mapaDosProjetos`. Ganchos (opcionais) da
  camada de terras: `__agsusSetDseiCoverage`, `__agsusAoMudarTerras`, `__agsusEnquadrarTerra`,
  `__agsusDseiCoverageBounds`, `agsus:dsei-coverage-ready`, `__agsusDseiCoverageLayer`,
  `__agsusFaseDaTerraVisivel`, `__agsusAlternarFaseDaTerra`, `agsus:terras-mudaram`,
  `__agsusSuspenderCamadasIndigenas`.
- **Projetos/SEDE.** Em Projetos, `<MapaDeProjetos>`; na SEDE, nenhum mapa.
- **Dicas e popups.** `criarMapa` liga `manterDicasDentroDoMapa` (`src/lib/dica-dentro-do-mapa.ts`):
  perto da borda a dica troca de direção, com largura máxima relativa ao mapa (`.dica-no-mapa`);
  o popup tem `autoPan` com folga, `keepInView` e tamanhos relativos ao mapa.

Testes: `tests/mapa-saude-indigena.test.js` (fixture real das Lotações),
`tests/modulos/mapa-saude-indigena.test.js` (Leaflet falso em `tests/modulos/leaflet-falso.js`),
`tests/modulos/visao-geral.test.js`, `tests/dica-dentro-do-mapa.test.js`,
`tests/coordenadas-do-mapa.test.js`, `tests/modulos/editor-de-coordenadas.test.js` e
`tests/modulos/modo-de-edicao.test.js`.

## Relacionadas

- [[modulo-visao-geral]] · [[mapas-e-leaflet]] · [[terras-indigenas]] · [[coordenadas]]
- [regras-do-mapa-saude-indigena](../aya/regras-do-mapa-saude-indigena.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)
- [regras-dos-mapas](../aya/regras-dos-mapas.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)
