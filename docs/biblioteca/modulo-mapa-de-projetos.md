---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Mapa de Projetos

O mapa da Visão geral da área Projetos (cartão "Municípios das vagas", com a lista "Municípios por
vagas" ao lado), em `src/modulos/mapa-de-projetos/`. Tem **as mesmas regras do mapa da Saúde
Indígena** ([[modulo-mapa-saude-indigena]]) e usa as mesmas peças: muda o que vai no mapa e na lista.

## Arquivos

- `mapa-de-projetos.tsx` — `<MapaDeProjetos area carregador carregadoEm linhas filtroAtivo>`: um
  ponto por lugar na cor do projeto, com as peças comuns (`painel-do-mapa.tsx`, `leaflet.ts`).
- `lista.tsx` — "Municípios por vagas" (`ListaDoMapa` comum, linhas no formato de "Territórios por
  vagas"), filtro "Projeto" e "Agrupar por projeto".
- `balao.ts` — dica e popup do lugar em DOM seguro (projeto, edital, vagas, lotações, contagens).
- `editor-de-coordenadas.tsx` — "Coordenadas" (admin global e Gestor): o editor comum com os
  lugares das vagas, as regras de `src/lib/coordenadas-dos-projetos.ts` e as RPCs
  `*_coordenada_mapa_projetos` (migration `20261002190000`).
- `carregador.ts` — RPC `listar_municipios_das_vagas_da_area`, um pedido por área, cache de 5 min,
  e a escolha da lista (sobrevive à troca de área).
- `mapa-de-projetos.css` — cores dos projetos (`--series-1…6`), filtro e grupos; o resto é `.mapa-si-*`.

## Regras comuns aos dois mapas (e onde estão)

- Criação, Brasil inicial, fundo com recurso, contornos UF/BR, observador de tamanho:
  `usarMapaDoBrasil` → `criarMapaDoBrasil` (`painel-do-mapa.tsx`, `leaflet.ts`).
- Limites, zoom (4,5 a 19, em quartos), viscosidade, teclado, régua: `criarMapa`, que liga a
  guarda do mapa (`opcoesDoMapa` e `protegerMapa`, `src/modulos/mapa-saude-indigena/guarda-do-mapa.ts`).
- Enquadramento: `enquadramentoDoRecorte` — sem filtro, o Brasil; com filtro, zoom 7 num ponto só
  ou a caixa (padding 60, maxZoom 7) (`src/lib/enquadramento-do-brasil.ts`, `enquadrar`).
- Reenquadra ao aparecer ou mudar de tamanho até a pessoa mexer; "Brasil" volta a acompanhar
  (`pegar`/`soltar` em `criarMapaDoBrasil`).
- Topo: título, contagem, "Coordenadas", "Brasil", "Tela cheia" (`TopoDoMapa`).
- Tela cheia (Esc sai) e modo de edição: `usarTelaCheia` (`tela-cheia.tsx`), `usarModoDeEdicao`.
- Mapa/Satélite: `map-base-layer-switcher.ts` (ids `map`, `detailMap`, `mapaDosProjetos`).
- Bolha: `raioDaBolha` (raiz do valor, 5 a 15 px, escala do conjunto inteiro: filtrar não muda o
  tamanho) e `OPACIDADE_DA_BOLHA` (0,7), em `src/lib/mapa-render.ts`.
- Bolhas no mesmo pixel: leque com traço até o ponto real (`criarLeque`, `leaflet.ts`).
- Dica e popup: `ligarDicaEPopup`, `manterDicasDentroDoMapa`/`opcoesDoPopup`
  (`src/lib/dica-dentro-do-mapa.ts`).
- Legenda: `LegendaFlutuante` (começa recolhida, `legenda.tsx`).
- Lista lateral: total, esqueleto, vazio em uma linha; id `<mapa>-painel-lateral` (`ListaDoMapa`).
- Filtros da Visão geral: as linhas recortadas e `temRecorte` da página.
- Celular e tema escuro: o CSS `.mapa-si-*` (`mapa-saude-indigena.css`).

## Diferenças de propósito (mesma mecânica)

- **A bolha.** Saúde Indígena: DSEI (tamanho = população, cor = tem processo no recorte) e CASAI
  nacional. Projetos: lugar das vagas (tamanho = vagas, cor = projeto; tracejado = mais de um).
- **O clique.** Na Saúde Indígena abre o DSEI. Projetos não tem nível abaixo do lugar: a bolha
  abre o popup e a linha da lista aproxima (zoom ≥ 7) e abre o popup.
- **A dica.** A bolha do DSEI só tem dica; o lugar de Projetos tem dica e popup iguais.
- **Filtro próprio.** "Projeto" conta como filtro para o enquadramento; "Agrupar" não reenquadra.
- **Recorte.** `lugaresDoRecorte` fica com o lugar que tem algum edital do recorte (pelo id da
  linha do monitoramento ou pelo número do edital), só com esses editais (projetos e vagas
  publicadas recontados); as contagens das análises (candidatos, aprovados) são do lugar e ficam.
- **Dados.** A Saúde Indígena recebe o `lmap`/`rede_cnes` que o legado publica; Projetos busca pela
  RPC no carregador (estados "indisponível" e erro próprios). Terras Indígenas e abrangência só na
  Saúde Indígena; sem volta animada.

## Ligação na Visão geral

`<MapaDeProjetos area={e.area} carregador={…} carregadoEm={e.carregadoEm} linhas={e.filtradas}
filtroAtivo={e.temRecorte}>`. O carregador é criado por `montarVisaoGeral` (um por montagem). O
pedido só sai depois da primeira carga da página (`carregadoEm`, com sessão); Atualizar dados pede
de novo e o cache decide. Lógica pura em `src/lib/visao-geral-da-area.ts` (projetos, recorte,
pontos, grupos, resumo do popup) e `src/lib/coordenadas-dos-municipios.ts`.

Saiu do legado: `municipios-da-visao-geral.js`, o bloco `#mapaDaVisaoGeral`/
`#reservaDoMapaDaVisaoGeral` do `index.html`, `renderMap`, `desenharMunicipiosNoMapa`,
`scheduleMapResize` e o carregador do `legacy-app.js`, `health-map-workspace.css`,
`health-reference-kpis.css` e os `#mapaDosProjetos` de `app.css` e `mobile-app.css`.

## TypeScript e fronteiras

Mapa, lista, balões, carregador e integração do editor em TypeScript; contratos em `tipos.ts`;
contrato mínimo do mapa em `src/lib/tipos-do-mapa.ts` (não cobre toda a API do Leaflet). A
resposta da RPC entra como `unknown`: a normalização verifica listas e registros, aceita nomes em
texto e números finitos ou textos numéricos, aplica padrões e descarta linhas sem município nem
UF; `origens` fica como lista de `unknown`. Não audita nomes geográficos nem garante posição
dentro do Brasil. Coordenada ausente permite a referência local para respostas antigas;
coordenada nula do banco mantém o lugar sem ponto. Permissões e RPCs de gravação não mudaram.

Testes: `tests/visao-geral-da-area.test.js`, `tests/enquadramento-do-brasil.test.js`,
`tests/modulos/mapa-de-projetos.test.js`, `tests/modulos/visao-geral.test.js`,
`tests/municipios-da-resposta.test.js` e `tests/tipos/mapa-de-projetos.tsx`. Para quem usa:
`docs/aya/regras-dos-mapas.md`.

## Relacionadas

- [[modulo-mapa-saude-indigena]] · [[modulo-editor-de-coordenadas]] · [[modulo-visao-geral]]
- [[mapas-e-leaflet]] — fábrica e guardas · [[coordenadas]] — origem dos pontos
- [regras-dos-mapas](../aya/regras-dos-mapas.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)
