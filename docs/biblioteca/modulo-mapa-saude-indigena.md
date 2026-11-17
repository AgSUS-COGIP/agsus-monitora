---
tipo: modulo
area: modulo
atualizado: 2026-11-17
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

## Controles e tela cheia

- Os controles ficam no cabeçalho, acima do mapa e da lista lateral. Em tela cheia, o painel cobre
  o shell, mantém "Sair da tela cheia" visível e bloqueia a rolagem até sair (botão ou Esc).
- **Não há editor de coordenadas neste mapa.** Os pontos vêm do SIGEPSI e se corrigem lá. O editor
  de coordenadas comum ([[modulo-editor-de-coordenadas]]) é só do mapa de Projetos.
  `TopoDoMapa` e `classesDoPainel` (`painel-do-mapa.tsx`) aceitam `modo` opcional.

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
  `ListaDoMapa`, `propsDoEditor` (esta, para o mapa de Projetos).
- `localizacoes.ts` — `usarLocalizacoesDoSigepsi` (o pedido a `/api/dseis`) e `aplicarLocalizacoes`;
  as regras puras ficam em `src/lib/mapa-saude-indigena/localizacoes-do-sigepsi.ts`.
- `tela-cheia.tsx` — `usarTelaCheia` e `travarRolagemDaPagina` (contada: tela cheia e edição de
  Projetos).
- `ordem-da-lista.tsx` — "Ordenar" (Vagas, A–Z, Nº do DSEI, % preenchidas, Ociosas), escolha
  guardada no navegador; regras em `src/lib/mapa-saude-indigena/ordem-dos-territorios.ts`.
- `volta-ao-brasil.ts` (`usarVoltaDoDsei`, `usarEscParaVoltar`), `usar-ultimo.ts` (ref com a
  última função do pai), `mapa-simples.tsx` e `mapa-saude-indigena.css` (só tokens).

Regras puras em `src/lib/mapa-saude-indigena/`: `chaves` (chave do DSEI), `formas` (formas, cores,
tipos), `mapa-nacional` (contagens, bolhas, CASAIs, territórios por vagas, enquadramento,
dicas/popups), `mapa-do-dsei` (pontos do SIGEPSI, vínculo, tipos, enquadramentos), `localizacoes-do-sigepsi`
(a API do SIGEPSI virando DSEIs, sedes, polos, CASAIs e unidades) e `contornos` (`UF_GEO`, `BR_OUTLINE`). Para quem usa:
`docs/aya/regras-do-mapa-saude-indigena.md`.

## Ligação na Visão geral

Em `src/modulos/visao-geral/visao-geral.tsx` (`MapaDaSaudeIndigena`), só quando a área é a Saúde
Indígena (`mapaDaVisaoGeral(area) === MAPA_DOS_DSEIS`). Lê o MESMO estado
(`src/modulos/visao-geral/estado.ts`). Props: `lmap` (`TB_CONFIG_MAPA_SAUDE_INDIG`, chave "lmap"),
`casaisNacionais` (as CASAIs nacionais do SIGEPSI, para o losango do mapa nacional), `linhas`
(editais recortados), `filtroAtivo`, `dseiSelecionado` (chave normalizada), `carregando`,
`aoEscolherDsei` (`estado.definirDsei`), `aoSairDoDsei` (`estado.tirarDsei`) e `aoFiltrarPorBusca`
(CASAI nacional: "CASAI <cidade>").

- **Dados do banco.** `carregarMapa` (`src/app/carga.ts`, RPC `listar_mapa_da_saude_indigena`) lê a
  tabela (faz parte da cópia da sessão e da recarga) e publica `estado.definirDadosDoMapa`. Do
  `lmap` o mapa lê só, de cada DSEI, o nome bem grafado (`n`), a população (`pop`, tamanho da
  bolha) e as UFs administrativas (`ufs`/`sedeuf`, o vínculo externo). Não há mais `rede_cnes`
  (estabelecimentos do CNES) no front.
- **SIGEPSI, a única fonte dos pontos.** `MapaSaudeIndigenaComSigepsi` (`mapa-com-sigepsi.tsx`,
  no pedaço do mapa baixado sob demanda, fora da entrada; a Visão geral só passa o `lmap`) pede
  `/api/dseis` ([[funcoes-da-vercel]]) por `usarLocalizacoesDoSigepsi` (`localizacoes.ts`, um pedido a cada
  10 min para a página). `aplicarLocalizacoes` monta a lista de DSEIs com a do SIGEPSI: DSEI só do
  banco não aparece; DSEI só do SIGEPSI aparece (nome legível de `NO_DSEI`, UF da sede); do DSEI de
  mesma chave no `lmap` vêm só nome, população e UFs administrativas. Do SIGEPSI vêm a sede (`lat`/`lon`,
  onde fica a bolha nacional, município e UF), os polos base, a ROTA (como polo), as CASAIs e as
  unidades de lotação. `TP_UNIDADE`: POLO BASE e ROTA → `polo`; CASAI → `casai`; SEDE → a sede;
  UNIDADE DE LOTAÇÃO → `unidade` (ou polo/CASAI, se o nome disser), desenhada pelo nome (UBSI ou
  Unidade). UF dos pontos pelo CEP.
- **CASAIs nacionais.** São as localizações 131 (CASAI DF) e 132 (CASAI São Paulo)
  (`CODIGOS_DAS_CASAIS_NACIONAIS`); `casaisNacionaisDoSigepsi` as entrega como `casaisNacionais`
  (o losango do mapa nacional) e elas não viram DSEI.
- **Sem plano B.** Se o SIGEPSI não responde (ou no servidor local, sem `/api`), o mapa mostra
  o erro "Não foi possível carregar o mapa da Saúde Indígena: o SIGEPSI não respondeu" com
  "Tentar novamente" (`ErroAoCarregar`, em `mapa-com-sigepsi.tsx`). Enquanto não responde, o mapa fica em
  "carregando"; a lista do banco não é usada no lugar.
- **Corrigir um ponto é no SIGEPSI.** Não há botão "Coordenadas" nem reconciliação com o CNES neste
  mapa.
- **Migrations** (aplicar depois da publicação):
  `supabase/migrations/20261117150000_tirar_do_mapa_as_casais_que_vem_do_sigepsi.sql` e
  `20261117180000_tirar_do_banco_os_pontos_do_mapa_que_vem_do_sigepsi.sql`. O `lmap` fica só com
  `k`, `n`, `pop`, `ufs` e `sedeuf` por DSEI; a linha `rede_cnes` e as pendências de
  `private."TB_PENDENCIA_COORDENADA_MAPA"` saem (cópias `*_backup_20261117_*`). Ficam o histórico
  `private."TH_COORDENADA_MAPA_SAUDE_INDIG"` e o catálogo `TD_UNIDADE`.
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
`tests/coordenadas-so-do-sigepsi.test.js`, `tests/lib/localizacoes-do-sigepsi.test.ts`,
`tests/modulos/mapa-saude-indigena.test.js` (Leaflet falso em `tests/modulos/leaflet-falso.js`),
`tests/modulos/visao-geral.test.js`, `tests/dica-dentro-do-mapa.test.js` e
`tests/modulos/modo-de-edicao.test.js` (o modo de edição, hoje só de Projetos).

## Relacionadas

- [[modulo-visao-geral]] · [[mapas-e-leaflet]] · [[terras-indigenas]] · [[coordenadas]]
- [regras-do-mapa-saude-indigena](../aya/regras-do-mapa-saude-indigena.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)
- [regras-dos-mapas](../aya/regras-dos-mapas.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)
