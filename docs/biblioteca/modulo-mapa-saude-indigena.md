---
tipo: modulo
area: modulo
atualizado: 2026-11-19
---

# Módulo: Mapa da Saúde Indígena

O mapa da área Saúde Indígena em React, em `src/modulos/mapa-saude-indigena/`, desenhado pela aba
Mapa (`src/modulos/mapa/`, rota `/saude-indigena/mapa[/<dsei>]`) com o estado da Visão geral. O legado não desenha mais mapa nenhum. O de Projetos é
o módulo irmão ([[modulo-mapa-de-projetos]]), com as mesmas regras: reaproveita daqui o painel do
mapa nacional, `leaflet.ts` (leque, enquadramento), a legenda flutuante, a tela cheia e `.mapa-si-*`.
Tipos e fronteiras dos dados (e o que saiu do legado): [[mapa-saude-indigena-contratos]].

## Controles e tela cheia

- Os controles (Brasil, Tela cheia) ficam no cabeçalho, acima do mapa e da lista lateral. Na aba o
  mapa é a página e não se recolhe ("Recolher mapa", `recolher.tsx`, ficou só no de Projetos). Em
  tela cheia, o painel cobre o shell, mantém "Sair da tela cheia" visível e bloqueia a rolagem até
  sair (botão ou Esc). A legenda começa recolhida.
- **Não há editor de coordenadas neste mapa.** Os pontos vêm do SIGEPSI e se corrigem lá. O editor
  comum ([[coordenadas]]) é só do mapa de Projetos. `TopoDoMapa` e `classesDoPainel`
  (`painel-do-mapa.tsx`) aceitam `modo` opcional.
- **Dicas e popups.** `criarMapa` liga `manterDicasDentroDoMapa` (`src/lib/mapas/dica-dentro-do-mapa.ts`):
  perto da borda a dica troca de direção, com largura máxima relativa ao mapa (`.dica-no-mapa`);
  o popup tem `autoPan` com folga, `keepInView` e tamanhos relativos ao mapa.

## Onde fica

- `mapa-saude-indigena.tsx` (`<MapaSaudeIndigena>`: estado, contas memorizadas, um mapa principal
  de cada vez), `mapa-nacional.tsx` (bolhas, CASAIs nacionais, leque, "Territórios por vagas") e `mapa-do-dsei.tsx` (unidades agrupadas
  por proximidade + leque, sede, vínculos externos, filtros por tipo, Terras Indígenas e povos).
- Peças comuns aos dois mapas: `leaflet.ts`, `painel-do-mapa.tsx`, `legenda.tsx`
  (`<LegendaFlutuante>`), `tela-cheia.tsx` (`travarRolagemDaPagina` é contada: tela cheia e edição
  de Projetos), `usar-ultimo.ts`.
- `processos-do-dsei.tsx` — o cartão "Processos seletivos" do DSEI aberto (editais abertos, vagas,
  contratadas, em seleção, ociosas e aguardando chamada), pelas contas da Visão geral
  (`processosDoDsei`, `src/lib/mapas/mapa-saude-indigena/processos-do-dsei.ts`). "Abrir na Visão
  geral" chama `aoAbrirNaVisaoGeral` com as unidades do DSEI; a aba põe o filtro Unidade e abre a
  Visão geral. Não depende do SIGEPSI.
- `territorio-do-dsei.tsx` + `territorio.ts` — acesso (dos pontos, da `/todas`), território e
  CNES do SIGEPSI (`/api/territorio-dos-dseis`, pedido uma vez a cada 10 min; o mapa não espera
  por ele). Com o
  DSEI aberto: o cartão "Território" (população, aldeias, terras) ao lado do de processos
  (`.mapa-si-dsei-cartoes`), o meio de acesso e o CNES em cada unidade da lista lateral e a tabela
  "Unidades" (filtros Meio de acesso e Área de floresta, exportável pelo padrão do #904). No
  Brasil: "Acesso e vagas ociosas", os DSEIs com unidade no filtro e as ociosas deles. As contas
  ficam em `src/lib/mapas/mapa-saude-indigena/territorio-na-tela.ts`; fonte negada é "Dado do
  SIGEPSI indisponível", nunca zero. Sem a prop `territorio`, nada disso aparece.
- `ordem-da-lista.tsx` — "Ordenar" (Vagas, A–Z, Nº do DSEI, % preenchidas, Ociosas), escolha
  guardada no navegador; regras em `src/lib/mapas/mapa-saude-indigena/ordem-dos-territorios.ts`.
- Regras puras em `src/lib/mapas/mapa-saude-indigena/` (`chaves`, `formas`, `contagem-por-dsei`
  (editais, vagas, contratadas e ociosas por DSEI, também do cartão da Visão geral), `aba-do-mapa`
  (o DSEI no endereço e o resumo do cartão), `mapa-nacional`,
  `mapa-do-dsei`, `localizacoes-do-sigepsi`, `contornos` com `UF_GEO` e `BR_OUTLINE`). CSS em
  `mapa-saude-indigena.css`, só tokens.

## A aba Mapa

`src/modulos/mapa/mapa.tsx` (`criarMapa`, `<TelaDoMapa>`), sob demanda (`src/app/telas.tsx`), com o
Leaflet carregado pela própria tela (`carregarLeaflet`; falhou, `ErroAoCarregar`). Aba só da Saúde
Indígena, ordem 2, recurso `dashboard` (a permissão da Visão geral): `ABAS_DO_MENU` e a migration
`20261118160000_aba_mapa_na_saude_indigena.sql`. Fora da Saúde Indígena a tela mostra um aviso.

- **Dados.** As linhas e o `lmap` são os do estado da Visão geral (`estadoDaVisaoGeral`): mesmas
  contas, com o desconto das reabertas pelo acompanhamento. Com o Mapa aberto, `pagina-aberta.ts`
  chama `definirLidaPeloMapa(true)` (o estado calcula e pede o acompanhamento sem montar a Visão
  geral) e a carga lê as linhas (`mapa` em `telas-com-linhas.ts`). Aberto antes da Visão geral,
  `criarMapa` entrega ao estado a busca do acompanhamento. O mapa recebe `linhasDaArea` (a área
  inteira, sem os filtros da Visão geral) e `filtroAtivo` falso.
- **DSEI no endereço.** `/saude-indigena/mapa/yanomami`: o DSEI é um filtro da tela que mora no
  caminho (`campoNoCaminho: "dsei"` em `src/lib/navegacao/rotas.ts`; `buscaDoEndereco` e
  `enderecoComBusca` em `src/app/filtros-no-endereco.ts` o tratam como `?dsei=` para
  `usarLojaNaUrl`). O pedaço é `dseiNoEndereco(chave)`; de volta, `chaveDoDseiNoEndereco` (a chave
  de `chaveDoDsei`). Abrir um DSEI empilha no histórico; "← Voltar ao Brasil" e Esc tiram o DSEI do
  endereço; o voltar do navegador volta ao Brasil. A loja do DSEI é da tela; `render()` (a cada
  abertura) relê o endereço, e é assim que o cartão da Visão geral abre o Mapa num DSEI
  (`guardarFiltrosDaTela("mapa", "dsei=…")` e `navigate("mapa")`).
- **Indicadores do topo pelo recorte** (como no Mapa dos DSEIs do SIGEPSI). `indicadoresDoRecorte`
  (`src/lib/mapas/mapa-saude-indigena/indicadores-do-recorte.ts`) segue o seletor: Brasil (DSEIs,
  CASAIs nacionais, pontos, editais, vagas, contratadas), DSEI (população, pontos, municípios dos
  pontos, editais, vagas, contratadas) ou CASAI (editais, vagas, contratadas, ociosas). Embaixo, a barra "das vagas preenchidas"
  (contratadas ÷ vagas, cor de `situacaoDoPreenchimento`). A aba Mapa espera o desconto das
  reabertas (`aguardandoVagas`) antes de desenhar.
- **Rede por tipo e busca de ponto** (também do SIGEPSI). No Brasil e no DSEI, o resumo mostra a
  "Rede de saúde indígena" por tipo (`redePorTipo`, os mesmos pontos que o mapa desenha) e o total.
  No mapa do DSEI, "Buscar ponto pelo nome ou município" (`buscarNaLista`, sem acento nem caixa)
  recorta só a lista; trocar de DSEI começa sem termo.
- **CASAI nacional.** O losango (`aoFiltrarPorBusca`) põe "CASAI <cidade>" na busca da Visão geral e
  abre a Visão geral. No seletor "DSEI / CASAI" elas ficam no grupo "CASAIs nacionais": escolher
  uma (`aoEscolherCasai`) põe `casai-<chave>` no mesmo pedaço do endereço
  (`/saude-indigena/mapa/casai-df`; `casaiNoEndereco`, `chaveDaCasaiNoEndereco`, e
  `chaveDoDseiNoEndereco` ignora esse prefixo). Com a CASAI aberta (`casaiSelecionada`), o mapa
  nacional enquadra nela e aparecem o painel (município, UF, "Voltar ao Brasil") e o cartão de
  processos, pela chave dos editais da CASAI (`chaveDosEditaisDaCasai`: o nome ou a cidade).
- **Na Visão geral** fica o cartão (`src/modulos/visao-geral/cartao-do-mapa.tsx`): DSEIs com edital
  (de 34), o de mais ociosas e o menos preenchido (`resumoDoMapa`), e "Abrir no mapa". O recorte
  por DSEI da Visão geral (`definirDsei`, chip "DSEI") saiu com o mapa: um DSEI ali é o filtro
  Unidade.

- **Ciclo de vida.** Trocar de área desmonta o componente e o `remove` do Leaflet (StrictMode
  limpo). O mapa do DSEI é criado ao abrir o distrito e destruído ao sair.
- **Ids.** `id="map"` (nacional) e `id="detailMap"` (DSEI), porque
  `indigenous-territories-layer.ts` e `map-base-layer-switcher.ts` só enfeitam esses ids; nenhum
  outro `#map`/`#detailMap` na página. Projetos usa `#mapaDosProjetos`. Ganchos (opcionais) da
  camada de terras: `__agsusSetDseiCoverage`, `__agsusAoMudarTerras`, `__agsusEnquadrarTerra`,
  `__agsusDseiCoverageBounds`, `agsus:dsei-coverage-ready`, `__agsusDseiCoverageLayer`,
  `__agsusFaseDaTerraVisivel`, `__agsusAlternarFaseDaTerra`, `agsus:terras-mudaram`,
  `__agsusSuspenderCamadasIndigenas`.

## De onde vêm os dados

- **Banco.** `carregarMapa` (`src/app/carga.ts`, RPC `listar_mapa_da_saude_indigena`) lê a tabela
  (faz parte da cópia da sessão e da recarga) e publica `estado.definirDadosDoMapa`. Do `lmap` o
  mapa lê só, de cada DSEI, o nome bem grafado (`n`), a população (`pop`, tamanho da bolha) e as
  UFs administrativas (`ufs`/`sedeuf`, o vínculo externo). Não há mais `rede_cnes` no front.
- **SIGEPSI, a única fonte dos pontos.** `MapaSaudeIndigenaComSigepsi` (`mapa-com-sigepsi.tsx`, no
  pedaço do mapa baixado sob demanda, fora da entrada) pede `/api/dseis` ([[deploy-e-vercel]]) por
  `usarLocalizacoesDoSigepsi` (`localizacoes.ts`, um pedido a cada 10 min para a página).
  `aplicarLocalizacoes` monta a lista de DSEIs com a do SIGEPSI: DSEI só do banco não aparece; DSEI
  só do SIGEPSI aparece (nome de `NO_DSEI`, UF da sede); do `lmap` vêm só nome, população e UFs.
  Do SIGEPSI vêm a sede (`lat`/`lon`, onde fica a bolha nacional), os polos base, a ROTA, as CASAIs
  e as unidades de lotação.
- **Acesso das unidades.** Meio de acesso, acessibilidade, urbano/rural e floresta vêm da mesma
  `/todas` (`localizacoesPorDsei`), nos polos; as regras de leitura ficam em
  `src/lib/mapas/mapa-saude-indigena/territorio-do-sigepsi.ts`.
- **Território e CNES do SIGEPSI.** `/api/territorio-dos-dseis` ([[deploy-e-vercel]]) lê
  `/territorio` e `/rede`, cada fonte com o próprio `ok`; o casamento por nome do CNES com a
  unidade (`cnesDaUnidade`) e da chave do DSEI (`casarChaveDoDsei`) ficam no mesmo arquivo. Em
  19/11/2026 as duas rotas respondem 401 ao token (falta a liberação do SIGEPSI). Fonte negada é
  "Dado do SIGEPSI indisponível", nunca zero.
- `TP_UNIDADE`: POLO BASE e ROTA → `polo`; CASAI → `casai`; SEDE → a sede; UNIDADE DE LOTAÇÃO →
  `unidade` (ou polo/CASAI, se o nome disser), desenhada pelo nome (UBSI ou Unidade). UF dos pontos
  pelo CEP; sem CEP (39 de 568 em 17/11/2026, 22 no Yanomami), o ponto não herda a UF da sede: o
  vínculo fica não classificado e a dica avisa.
- **CASAIs nacionais.** Localizações 131 (CASAI DF) e 132 (CASAI São Paulo)
  (`CODIGOS_DAS_CASAIS_NACIONAIS`); `casaisNacionaisDoSigepsi` as entrega como `casaisNacionais`
  (o losango do mapa nacional) e elas não viram DSEI.
- **Sem plano B.** Se o SIGEPSI não responde (ou no servidor local, sem `/api`), o mapa mostra
  "Não foi possível carregar o mapa da Saúde Indígena: o SIGEPSI não respondeu" com "Tentar
  novamente" (`ErroAoCarregar`). Enquanto não responde, fica em "carregando"; a lista do banco não
  é usada no lugar.
- **Migrations** (aplicar depois da publicação):
  `supabase/migrations/20261117150000_tirar_do_mapa_as_casais_que_vem_do_sigepsi.sql` e
  `20261117180000_tirar_do_banco_os_pontos_do_mapa_que_vem_do_sigepsi.sql`. O `lmap` fica só com
  `k`, `n`, `pop`, `ufs` e `sedeuf`; a linha `rede_cnes` e as pendências de
  `private."TB_PENDENCIA_COORDENADA_MAPA"` saem (cópias `*_backup_20261117_*`).

## Modo "Mapa DSEIs"

Terceiro botão do seletor do fundo, só no `#map` (`map-base-layer-switcher.ts`: `MODO_SIMPLES`,
`aceitaMapaSimples`, `adicionarCamadaDeFundo`).

- Nenhum azulejo (nem ao abrir a página já nesse modo), contêiner com `map-simple-mode` e o fundo
  liso do CSS. `mapa-simples.tsx` desenha a silhueta do Brasil e os 34 DSEIs (pane
  `agsus-mapa-simples`, abaixo das Terras Indígenas) com o número no meio.
- Legenda aberta com "Colorir por" (`% preenchidas`, `Vagas ociosas`, `Cor do DSEI`, lembrado em
  `agsus_mapa_simples_colorir_v1`) e o interruptor "Sedes e CASAIs" (desligados de início).
- As Terras Indígenas desligam ao entrar, sem mudar a preferência guardada, e voltam ao sair; a
  regra mora na camada (`indigenous-territories-layer.ts`, que segue o aviso do seletor).
- A lista mostra o número do DSEI; foco/mouse na linha realça o polígono na hora. O mouse no
  polígono acende a linha só depois de parar nele (`ESPERA_DO_REALCE_NA_LISTA`, 150 ms) e nunca
  rola, reordena nem remonta a lista (só a classe `is-realce` muda). O clique abre o DSEI.
- Numeração: `src/lib/mapas/mapa-saude-indigena/dseis-oficiais.ts` (34 nomes oficiais em ordem
  alfabética, como o mapa institucional da AgSUS). Regras (faixas, sem dado, dica):
  `mapa-simples.ts`; os números são os de "Territórios por vagas", sem consulta nova. Cores:
  tokens `--mapa-simples-*` em `src/styles/tokens.css`.
- **Contornos**: `public/data/contornos-dos-dseis.json` (~324 KB, carregado só nesse modo, uma vez),
  gerado por `scripts/compilar-contornos-dos-dseis.mjs` a partir do shapefile **Funai `areas_dsei`**,
  na cópia de **20/04/2022 do Internet Archive**. A Funai tirou a camada do GeoServer, e o proxy
  deixou de oferecer `dataset=dsei` em 10/11/2026 (#715). A camada é a abrangência com atendimento,
  não uma partição do país: parte do território fica só com a silhueta do Brasil.
- O mesmo arquivo serve à camada de Terras Indígenas ([[mapas-e-leaflet]]): traço leve no mapa
  nacional ("abrangência oficial do DSEI") e o contorno e o enquadramento do distrito aberto. No
  Mapa DSEIs a camada esconde esse traço (pane `PANE_DA_ABRANGENCIA_DOS_DSEIS`) para não sair em
  dobro.

## A volta ao Brasil

`volta-ao-brasil.ts` (`usarVoltaDoDsei`, `usarEscParaVoltar`).

- Ao sair do DSEI ("← Voltar ao Brasil", Esc, o voltar do navegador),
  `usarVoltaDoDsei` entrega ao mapa nacional `{ k, lat, lon, focar, vez }`. O mapa parte da sede do
  distrito (zoom 7, sem animar) e voa em 0,8 s (`DURACAO_DA_VOLTA_AO_BRASIL`) até o Brasil
  (`voarAoBrasil`, `maxZoom` `ZOOM_NACIONAL` 4.5; a guarda desce o mínimo se a altura não couber)
  ou, se ficaram filtros, até o recorte. Com `prefers-reduced-motion: reduce`, enquadra sem animar.
  Durante o voo, o "apareceu" do ResizeObserver não reenquadra por cima.
- **Foco.** Pelo botão ou Esc (`focar`), o foco vai à linha do DSEI em "Territórios por vagas"
  (`data-dsei`) ou, se ela não estiver na lista, ao mapa. Pelo voltar do navegador, fica onde está.
- **Esc.** Ligado só com DSEI aberto, na captura do `document`; volta com o foco no mapa ou no
  `body` (nunca num campo, numa janela, no painel da Aya ou com modal aberto). Na tela cheia, o
  primeiro Esc volta ao Brasil (`preventDefault`) e `usarTelaCheia`, que ignora Esc já usado
  (`defaultPrevented`), só sai no segundo.
- **Enquadramento do Brasil.** Por `BRASIL_BOUNDS` (contorno real, não o retângulo antigo que
  cortava a ponta leste), com folga da maior bolha (raio + traço + 12 px) e zoom mínimo que desce
  em quartos até o país caber (`src/lib/mapas/enquadramento-do-brasil.ts`, também da guarda do mapa). Os
  mapas React têm `enquadramentoProprio` (a guarda não reenquadra por cima) e reenquadram ao mudar
  de tamanho até a pessoa mexer (`criarMapaDoBrasil`).

## Testes

`tests/mapas-e-visao-geral.test.js` (bloco `mapa-saude-indigena`) (fixture real das Lotações),
`tests/mapas-e-visao-geral.test.js` (bloco `coordenadas-so-do-sigepsi`), `tests/demais-regras.test.ts` (blocos `lib/localizacoes-do-sigepsi`, `lib/territorio-do-sigepsi` e `lib/territorio-na-tela`),
`tests/casca-sessao-e-interface-na-tela.test.js` (bloco `modulos/mapa-saude-indigena`) (Leaflet falso em `tests/modulos/leaflet-falso.js`),
`tests/casca-com-modulo-simulado-na-tela.test.ts` (bloco `modulos/mapa`: a aba e o DSEI no endereço), `tests/demais-telas-na-tela.test.ts` (bloco `modulos/cartao-do-mapa`), `tests/demais-regras.test.ts` (blocos `lib/aba-do-mapa` e `lib/processos-do-dsei`), `tests/repositorio-e-banco.test.ts` (bloco `aba-mapa-no-banco`: migration, ensaio e rollback), `tests/casca-sessao-e-interface.test.js` (bloco `rotas`), `tests/mapas-e-visao-geral-na-tela.test.js` (bloco `dica-dentro-do-mapa`),
`tests/mapas-e-visao-geral-na-tela.test.js` (bloco `modulos/modo-de-edicao`) (hoje só Projetos) e, do Mapa DSEIs,
`tests/mapas-e-visao-geral.test.js` (bloco `mapa-simples`), `tests/mapas-e-visao-geral-na-tela.test.js` (bloco `map-base-layer-simples`) e
`tests/mapas-e-visao-geral-na-tela.test.js` (bloco `modulos/mapa-simples`).

## Relacionadas

- [[modulo-visao-geral]] — guarda o estado que o mapa lê e mostra o cartão do mapa
- [[modulo-mapa-de-projetos]] — o mapa irmão, que reaproveita as peças daqui
- [[mapa-saude-indigena-contratos]] — tipos, fronteiras dos dados e o que saiu do legado
- [[mapas-e-leaflet]] — a fábrica do Leaflet, as guardas e a camada de Terras Indígenas
- [[coordenadas]] — por que os pontos vêm só do SIGEPSI
- [[acessibilidade-e-mobile]] — foco, Esc e movimento reduzido
- [[design-e-tokens]] — os tokens `--mapa-simples-*`
- [regras-do-mapa-saude-indigena](../aya/regras-do-mapa-saude-indigena.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)
- [regras-dos-mapas](../aya/regras-dos-mapas.md) — o que a Aya responde sobre os mapas
