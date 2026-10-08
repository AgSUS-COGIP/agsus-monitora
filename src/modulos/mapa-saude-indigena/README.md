# `src/modulos/mapa-saude-indigena/` — Mapa da Saúde Indígena

O mapa da Visão geral da área Saúde Indígena em React (Etapa 5, a parte "mapas"), ligado na Visão
geral (`src/modulos/visao-geral/`) e lendo o estado dela. O legado não desenha mais mapa nenhum: o
de Projetos é o módulo irmão `src/modulos/mapa-de-projetos/` (ver "Projetos/SEDE"), com as
mesmas regras: reaproveita daqui o painel do mapa nacional (`painel-do-mapa.tsx`), `leaflet.js`
(leque, enquadramento), a legenda flutuante, a tela cheia e o CSS `.mapa-si-*`.

Os controles ficam no cabeçalho, acima do mapa e da lista lateral. Em tela cheia,
o painel cobre o shell, mantém o botão "Sair da tela cheia" visível e bloqueia a
rolagem da página até sair (pelo botão ou Esc). O editor de coordenadas, restrito
ao administrador global e ao Gestor, abre o **modo de edição**
(`src/modulos/editor-de-coordenadas/modo-de-edicao.tsx`): o painel cobre a página como a
tela cheia, o mapa ocupa o corpo inteiro e o editor flutua à direita (no celular, numa
folha embaixo, com o mapa em ≥ 55% da altura), recolhível ("Recolher editor" deixa uma
faixa); o enquadramento do ponto desconta o painel (`folgaDoEnquadramento`, paddings do
Leaflet). "Voltar à lista", "Coordenadas" ou Esc voltam ao layout de sempre
(`--mapa-si-altura` não muda). Testes em `tests/modulos/modo-de-edicao.test.js`. Ele tem a fila de pontos (busca e
"Só pendentes", com as pendências da auditoria), "Conferido", as sugestões de
posição e o histórico com "Desfazer" — RPCs de
`supabase/migrations/20261002160000_conferir_coordenadas_mapa.sql`, regras em
`src/lib/coordenadas-do-mapa.ts`, testes em `tests/coordenadas-do-mapa.test.js` e
`tests/modulos/editor-de-coordenadas.test.js`. O editor, a fila, as sugestões e o histórico
são comuns aos dois mapas (`src/modulos/editor-de-coordenadas/`, regras comuns em
`src/lib/editor-de-coordenadas.ts`); aqui fica só `editor-de-coordenadas.tsx`, que liga o
editor comum aos pontos, às regras e às RPCs deste mapa. O de Projetos faz o mesmo em
`src/modulos/mapa-de-projetos/editor-de-coordenadas.tsx`.

```
mapa-saude-indigena.jsx   <MapaSaudeIndigena>: estado da tela (tela cheia), contas memorizadas,
                          um mapa principal de cada vez
mapa-nacional.jsx         visão nacional: bolhas dos DSEIs, CASAIs nacionais, leque, enquadramento,
                          "Territórios por vagas", Brasil/Tela cheia, legenda flutuante
mapa-do-dsei.jsx          território do DSEI: unidades (agrupamento por proximidade + leque), sede,
                          vínculos externos, filtros por tipo, lista de unidades, Terras Indígenas e povos
legenda.tsx               <Forma>, <LegendaFlutuante> (recolhível; também a de Projetos), legenda
                          nacional, legenda do DSEI, fases das terras
leaflet.js                fábrica do mapa (criarMapa, criarMapaDoBrasil), Brasil, fundo com recurso,
                          contornos, enquadrar (regra do recorte), criarLeque, ícones/popup/dica em DOM
                          seguro (os dois mapas)
painel-do-mapa.tsx        peças do mapa nacional comuns a este e ao de Projetos: usarMapaDoBrasil,
                          TopoDoMapa (Coordenadas, Brasil, Tela cheia), MolduraDoMapa, ListaDoMapa,
                          propsDoEditor
tela-cheia.tsx            usarTelaCheia: estado, botão "Tela cheia"/"Sair da tela cheia" e Esc (os dois mapas);
                          travarRolagemDaPagina (contada: tela cheia e modo de edição)
volta-ao-brasil.ts        usarVoltaDoDsei (a saída do DSEI, venha de onde vier) e usarEscParaVoltar
usar-ultimo.ts            ref com a última função do pai (ouvintes do Leaflet sem redesenhar)
editor-de-coordenadas.tsx o editor comum (só admin global) com os pontos do lmap/rede_cnes e as RPCs
                          *_coordenada_mapa_saude_indigena (FONTE_DA_SAUDE_INDIGENA)
mapa-saude-indigena.css   só o que é deste bloco (tokens); card/título/vazio de src/ui/
```

Regras puras: `src/lib/mapa-saude-indigena/` — `chaves.js` (chave do DSEI), `formas.js` (formas,
cores, tipos), `mapa-nacional.js` (contagens, bolhas, CASAIs nacionais,
territórios por vagas, enquadramento, dicas/popups), `mapa-do-dsei.js` (pontos do DSEI com a
prioridade lmap → reconciliação → rede_cnes, vínculo, tipos, resumo da dica, enquadramentos,
popups), `contornos.js` (UF_GEO e BR_OUTLINE). Explicações para a Aya:
`docs/aya/regras-do-mapa-saude-indigena.md`. Testes: `tests/mapa-saude-indigena.test.js` (regras,
com fixture real das Lotações de `public/data`) e `tests/modulos/mapa-saude-indigena.test.js`
(componente, Leaflet falso em `tests/modulos/leaflet-falso.js`); a ligação com o estado em
`tests/modulos/visao-geral.test.js`; dicas e popups em `tests/dica-dentro-do-mapa.test.js`.

## Ligação na Visão geral

Ligado em `src/modulos/visao-geral/visao-geral.tsx` (`MapaDaSaudeIndigena`), só quando a área é a
Saúde Indígena (`mapaDaVisaoGeral(area) === MAPA_DOS_DSEIS`). Lê o MESMO estado da Visão geral
(`src/modulos/visao-geral/estado.ts`) e pede a ele:

```jsx
<MapaSaudeIndigena
  lmap={e.mapa.lmap} // TB_CONFIG_MAPA_SAUDE_INDIG, chave "lmap" (com as Lotações)
  redeCnes={e.mapa.redeCnes} // chave "rede_cnes"
  linhas={e.filtradas} // editais da área recortados (filtros + busca + DSEI)
  filtroAtivo={e.temRecorte}
  dseiSelecionado={e.dsei.chave} // chave normalizada (chaveDoDsei)
  carregando={!e.mapa.lmap}
  aoEscolherDsei={(d) => estado.definirDsei(d.k, d.n)} // bolha ou ranking
  aoSairDoDsei={estado.tirarDsei} // "← Voltar ao Brasil" ou Esc
  aoFiltrarPorBusca={estado.definirBusca} // CASAI nacional: "CASAI <cidade>"
/>
```

- **Dados.** `loadMapaConfig` (legado) continua lendo a tabela — ela faz parte da cópia da sessão
  e da recarga — e publica `estado.definirDadosDoMapa({ lmap, redeCnes })`.
- **DSEI.** `definirDsei` guarda `chaveDoDsei(chave)`; o recorte compara com
  `chaveDoDsei(linha.unidade)`. O chip "DSEI X ×" e o "← Voltar ao Brasil" (ou Esc) chamam
  `tirarDsei` (os filtros ficam); "Limpar tudo", a busca global (`localizar`) e a troca de área tiram o DSEI.
- **Ciclo de vida.** Trocar de área desmonta o componente e o `remove` do Leaflet (StrictMode limpo).

**Ids.** Os contêineres dos mapas recebem `id="map"` (nacional) e `id="detailMap"` (DSEI)
(`idDoMapaNacional`/`idDoMapaDoDsei`), porque `indigenous-territories-layer.js` e
`map-base-layer-switcher.js` só enfeitam mapas com esses ids (Terras Indígenas, abrangência,
Mapa/Satélite). A marcação antiga saiu do `index.html`: nenhum outro `#map`/`#detailMap` na página.
O mapa de Projetos usa `#mapaDosProjetos` (só o Mapa/Satélite o enfeita). O `map-guard.js` e o `map-zoom-range.js` valem
para qualquer mapa. Ganchos da camada de terras usados (todos opcionais): `__agsusSetDseiCoverage`,
`__agsusAoMudarTerras`, `__agsusEnquadrarTerra`, `__agsusDseiCoverageBounds`,
`agsus:dsei-coverage-ready`, `__agsusDseiCoverageLayer`, `__agsusFaseDaTerraVisivel`,
`__agsusAlternarFaseDaTerra`, `agsus:terras-mudaram`, `__agsusSuspenderCamadasIndigenas`.

**Projetos/SEDE.** Este componente é só da Saúde Indígena. Em Projetos a Visão geral mostra
`<MapaDeProjetos>` (`src/modulos/mapa-de-projetos/`); na SEDE, nenhum mapa.

Ele tem as mesmas regras deste e usa as mesmas peças (`painel-do-mapa.tsx`, `leaflet.js`,
`legenda.tsx`, `tela-cheia.tsx`, o CSS `.mapa-si-*`); a tabela das regras lado a lado e as
diferenças de propósito estão em `src/modulos/mapa-de-projetos/README.md`.

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
  `desenharMunicipiosNoMapa`, `scheduleMapResize`; saiu na parte 3) e `loadMapaConfig`, que publica no
  estado.
- `src/modules/`: `vinculos-territoriais.js`, `controles-do-mapa.js`, `legenda-das-terras.js`,
  `health-map-immersive-workspace.js`.
- CSS: `health-map-size-tuning.css`, `health-map-immersive-workspace.css`,
  `health-map-contrast.css`, `legenda-das-terras.css` (os `--terra-*` foram para `tokens.css`), as
  regras do mapa da Saúde Indígena em `health-map-workspace.css` e os `#map` de `app.css`,
  `visual-polish.css`, `mobile-app.css` e `system-ui-fixes.css` (pegariam o `#map` do componente).
- Testes que liam o texto do legado: migrados para as regras de `src/lib/mapa-saude-indigena/` ou
  para o componente; os dos módulos apagados saíram com eles.

## O que mudou em relação ao legado

- Controles Brasil e Tela cheia no cabeçalho do painel, não dentro do mapa; "Tela cheia" é do
  componente (Esc sai).
- Sem o modo Calor (saiu em 02/10/2026, a pedido da gestão): a bolha só diz se há edital no recorte.
- Lista de unidades com a forma do tipo (a mesma da legenda) em vez do ícone Font Awesome.
- Sem textos de ajuda: rodapé "Escolha um DSEI…", "clique para abrir o território" e os avisos ao
  voltar ao Brasil foram para a Aya; estados vazios em uma linha.
- O DSEI fecha por "← Voltar ao Brasil" (botão primário no topo do painel; o trilho "Brasil › DSEI"
  saiu) ou por Esc.

## A volta ao Brasil

Ao sair do DSEI — "← Voltar ao Brasil", Esc, o chip "DSEI" da Visão geral, "Limpar tudo" —
`usarVoltaDoDsei` entrega ao mapa nacional `{ k, lat, lon, focar, vez }`, que parte da sede do
distrito (zoom 7, sem animar) e voa em 0,8 s (`DURACAO_DA_VOLTA_AO_BRASIL`) até o enquadramento:
o Brasil por `voarAoBrasil` (folga das bolhas, `maxZoom` ZOOM_NACIONAL 4.5, e o `map-guard` desce
o mínimo se a altura atual não couber) ou, se ficaram filtros, a caixa/ponto do recorte. Com
`prefers-reduced-motion: reduce`, enquadra sem animação. Durante o voo, o "apareceu" do
ResizeObserver não reenquadra por cima.

- **Foco.** Pelo botão ou Esc (`focar`), o foco vai à linha do DSEI em "Territórios por vagas"
  (`data-dsei`) ou, se ela não estiver na lista, ao mapa. Pelo chip da página, fica onde está.
- **Esc.** Ligado só com DSEI aberto, na captura do `document`; volta com o foco no mapa ou no
  `body` (nunca num campo, numa janela, no painel da Aya ou com um modal aberto). Na tela cheia, o
  primeiro Esc volta ao Brasil (`preventDefault`) e o `usarTelaCheia`, que ignora Esc já usado
  (`defaultPrevented`), só sai no segundo.
- Enquadramento do Brasil por `BRASIL_BOUNDS` (contorno real), como o `map-guard`, em vez do
  retângulo antigo que cortava a ponta leste.
- O mapa do DSEI é criado ao abrir o distrito e destruído ao sair (antes ficava montado escondido).
- O DSEI ativo é verde com borda amarela, como a legenda diz (`CORES_DO_MAPA`). O legado pintava
  de azul por cima, com o `health-map-contrast.css` (que saiu), e a legenda dele dizia verde.
- Dicas que não saem do mapa perto da borda; popups que cabem no celular.
- Enquadramento do Brasil com folga da maior bolha (raio + traço + 12 px) e zoom mínimo que desce
  em quartos até o país caber (`src/lib/enquadramento-do-brasil.js`, usado pelo `map-guard`); os
  mapas React têm `enquadramentoProprio` (o guarda não reenquadra por cima) e reenquadram ao
  mudar de tamanho até a pessoa mexer (`criarMapaDoBrasil`). A legenda começa recolhida.

## Base compartilhada em TypeScript

Painel, lista lateral, controles, legenda, tela cheia, retorno ao Brasil e o hook
`usarUltimo` estão em TypeScript. Os contratos estão em `tipos-do-painel.ts`;
formas e cores estão em `src/lib/mapa-saude-indigena/formas.ts`. O painel preserva
o tipo das camadas próprias de cada mapa. A legenda das Terras Indígenas descreve
a ponte opcional com a camada existente: sem ela, os controles ficam desabilitados;
os ouvintes são retirados ao desmontar.

A fábrica e as operações do Leaflet (`leaflet.js`), as telas nacional/DSEI e os
dados geográficos ainda permanecem em JavaScript. A fábrica declara em JSDoc o
resultado utilizado pelo painel; essa anotação não valida dados externos nem
cobre toda a API do Leaflet. Esta entrega não muda contratos de RPC ou dados
geográficos. Ciclo de vida, StrictMode, legendas, Escape, foco, tela cheia e modo de
edição são cobertos pelos testes dos dois mapas; contratos adicionais estão em
`tests/tipos/base-dos-mapas.tsx`.

O adaptador do editor e as regras específicas de coordenadas estão em TypeScript.
O catálogo editável recebe dados externos como `unknown`, ignora entradas inválidas
e preserva os índices, nomes e códigos usados para conferir o alvo no banco.
Posições vazias ou inválidas permanecem nulas. A exibição principal do mapa e o
conteúdo geográfico completo continuam em JavaScript.
