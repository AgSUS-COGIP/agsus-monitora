# `src/modulos/mapa-de-projetos/` — Mapa de Projetos

O mapa da Visão geral da área Projetos (cartão "Municípios das vagas", com a lista "Municípios por
vagas" ao lado). Tem **as mesmas regras do mapa da Saúde Indígena** (`src/modulos/mapa-saude-indigena/`)
e usa as mesmas peças: o que muda é o que vai no mapa e na lista.

```
mapa-de-projetos.tsx   <MapaDeProjetos area carregador carregadoEm linhas filtroAtivo>: um ponto por lugar
                       na cor do projeto, montado com as peças comuns (painel-do-mapa.tsx, leaflet.js)
lista.tsx              "Municípios por vagas" (ListaDoMapa comum, linhas no formato de "Territórios por
                       vagas"), filtro "Projeto" e "Agrupar por projeto"
balao.ts               dica e popup do lugar em DOM seguro (projeto, edital, vagas, lotações, contagens)
editor-de-coordenadas.tsx  "Coordenadas" (admin global e Gestor): o editor comum com os lugares das vagas,
                       as regras de src/lib/coordenadas-dos-projetos.js e as RPCs *_coordenada_mapa_projetos
                       (migration 20261002190000)
carregador.ts          RPC listar_municipios_das_vagas_da_area, um pedido por área, cache de 5 min, e a
                       escolha da lista (sobrevive à troca de área)
mapa-de-projetos.css   cores dos projetos (--series-1…6), filtro e grupos; o resto é o .mapa-si-*
```

## As regras, lado a lado com a Saúde Indígena

| Regra                                                                                      | Como é (nos dois mapas)                                                                                           | Onde                                                              |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Criação, Brasil inicial, fundo com recurso, contornos UF/BR, observador de tamanho         | `usarMapaDoBrasil` → `criarMapaDoBrasil`                                                                          | `mapa-saude-indigena/painel-do-mapa.tsx`, `leaflet.js`            |
| Limites, zoom mín./máx., viscosidade, teclado, régua                                       | `criarMapa` (minZoom 4, maxZoom 18, zoomSnap 0,25) + `map-guard.js` / `map-zoom-range.js` globais                 | `leaflet.js`, `src/modules/`                                      |
| Enquadramento                                                                              | `enquadramentoDoRecorte`: sem filtro o Brasil; com filtro, zoom 7 num ponto só ou a caixa (padding 60, maxZoom 7) | `src/lib/enquadramento-do-brasil.js`, `enquadrar` em `leaflet.js` |
| Reenquadrar ao aparecer / mudar de tamanho até a pessoa mexer; "Brasil" volta a acompanhar | `pegar`/`soltar`                                                                                                  | `criarMapaDoBrasil`                                               |
| Topo: título, contagem, "Coordenadas", "Brasil", "Tela cheia"                              | `TopoDoMapa`                                                                                                      | `painel-do-mapa.tsx`                                              |
| Tela cheia (Esc sai) e modo de edição de coordenadas                                       | `usarTelaCheia`, `usarModoDeEdicao`                                                                               | `tela-cheia.tsx`, `editor-de-coordenadas/`                        |
| Mapa/Satélite                                                                              | `map-base-layer-switcher.js` (ids `map`, `detailMap`, `mapaDosProjetos`)                                          | `src/modules/`                                                    |
| Tamanho da bolha                                                                           | `raioDaBolha` (raiz do valor, 5 a 15 px), escala do conjunto inteiro: filtrar não muda o tamanho                  | `src/lib/mapa-render.js`                                          |
| Opacidade                                                                                  | `OPACIDADE_DA_BOLHA` (0,7)                                                                                        | `src/lib/mapa-render.js`                                          |
| Bolhas no mesmo pixel                                                                      | leque com traço até o ponto real (`criarLeque`)                                                                   | `leaflet.js`                                                      |
| Dica e popup                                                                               | `ligarDicaEPopup` + `manterDicasDentroDoMapa`/`opcoesDoPopup`                                                     | `leaflet.js`, `src/lib/dica-dentro-do-mapa.js`                    |
| Legenda                                                                                    | `LegendaFlutuante` (começa recolhida)                                                                             | `legenda.tsx`                                                     |
| Lista lateral: total, esqueleto, vazio em uma linha; id `<mapa>-painel-lateral`            | `ListaDoMapa`                                                                                                     | `painel-do-mapa.tsx`                                              |
| Filtros da Visão geral                                                                     | as linhas recortadas e `temRecorte` da página                                                                     | `visao-geral.jsx`                                                 |
| Celular, tema escuro                                                                       | o CSS `.mapa-si-*`                                                                                                | `mapa-saude-indigena.css`                                         |

**Diferenças de propósito** (de negócio, com a mesma mecânica):

- **O que é a bolha.** Saúde Indígena: DSEI (tamanho = população, cor = tem processo no recorte) e
  CASAI nacional. Projetos: lugar das vagas (tamanho = vagas, cor = projeto; tracejado = mais de um
  projeto).
- **O clique.** Na Saúde Indígena a bolha (e a linha da lista) abre o DSEI: recorta a página e troca
  para o mapa do distrito. Projetos não tem nível abaixo do lugar: a bolha abre o popup e a linha da
  lista aproxima (zoom ≥ 7) e abre o popup.
- **A dica.** A bolha do DSEI só tem dica (o clique abre o distrito); o lugar de Projetos tem dica e
  popup com o mesmo conteúdo.
- **Filtro próprio.** Projetos tem "Projeto" e "Agrupar por projeto" na lista; o "Projeto" conta
  como filtro para o enquadramento. "Agrupar" não reenquadra.
- **Recorte.** Na Saúde Indígena as contagens do DSEI vêm das linhas recortadas. Em Projetos
  (`lugaresDoRecorte`) fica o lugar com algum edital do recorte — pelo id da linha do monitoramento
  ou pelo número do edital —, só com esses editais (projetos e vagas publicadas recontados); as
  contagens das análises (candidatos, aprovados) são do lugar e ficam.
- **Dados.** A Saúde Indígena recebe o `lmap`/`rede_cnes` que o legado publica; Projetos busca pela
  RPC no carregador (estados "indisponível" e erro próprios). Terras Indígenas e abrangência só na
  Saúde Indígena; sem volta animada (não há DSEI de onde voltar).

## Ligação na Visão geral

`visao-geral.jsx`: `<MapaDeProjetos area={e.area} carregador={…} carregadoEm={e.carregadoEm}
linhas={e.filtradas} filtroAtivo={e.temRecorte}>`. O carregador é criado por `montarVisaoGeral` (um
por montagem). O pedido só sai depois da primeira carga da página (`carregadoEm`, com sessão);
Atualizar dados pede de novo e o cache decide. Lógica pura em `src/lib/visao-geral-da-area.ts`
(projetos, recorte, pontos, grupos, resumo do popup) e `src/lib/coordenadas-dos-municipios.js`.

Testes: `tests/visao-geral-da-area.test.js` (regras e recorte), `tests/enquadramento-do-brasil.test.js`
(enquadramento comum), `tests/modulos/mapa-de-projetos.test.js` (componente, carregador, recorte,
leque) e `tests/modulos/visao-geral.test.js` (filtros da página no mapa). Explicações para a Aya:
`docs/aya/regras-dos-mapas.md`.

O que saiu do legado: `src/modules/municipios-da-visao-geral.js`, o bloco
`#mapaDaVisaoGeral`/`#reservaDoMapaDaVisaoGeral` do `index.html`, `renderMap`,
`desenharMunicipiosNoMapa`, `scheduleMapResize` e o carregador do `legacy-app.js`,
`health-map-workspace.css`, `health-reference-kpis.css` e os `#mapaDosProjetos` de `app.css` e
`mobile-app.css`.

## TypeScript e fronteiras

O módulo está em TypeScript: mapa, lista, balões, carregador com cache e escolha,
e integração do editor. Os contratos estão em `tipos.ts`; as regras de recorte,
projetos, pontos e resumo estão em `src/lib/visao-geral-da-area.ts`.

A resposta da RPC entra como `unknown`. A normalização verifica listas e registros,
aceita nomes em texto e números finitos ou textos numéricos, aplica valores padrão
e descarta linhas sem município nem UF. Objetos e listas não viram nomes ou números.
Editais, lotações e projetos são normalizados; `origens` permanece uma lista de
valores `unknown`. A normalização não audita nomes geográficos nem garante uma
posição dentro do Brasil. Coordenada ausente continua permitindo a referência local
para respostas antigas; coordenada nula do banco mantém o lugar sem ponto.

O editor compartilhado e o modo de edição estão em TypeScript (contratos e limites em
`../editor-de-coordenadas/README.md`). O painel, a lista, os controles, a legenda, a tela cheia e os hooks compartilhados
também estão em TypeScript. A fábrica do Leaflet segue em JavaScript, com contratos
JSDoc nas integrações utilizadas aqui. As regras de correção em
`src/lib/coordenadas-dos-projetos.js` também seguem compartilhadas em JavaScript.
O contrato mínimo do mapa fica em `src/lib/tipos-do-mapa.ts`; ele não cobre toda
a API do Leaflet. As permissões e RPCs de gravação continuam as mesmas.

`tests/tipos/mapa-de-projetos.tsx` verifica contratos e rejeições esperadas no
typecheck. `tests/municipios-da-resposta.test.js` cobre dados malformados e a
distinção entre coordenada antiga, nula e cadastrada, além dos testes de interação
e regras já listados acima.
