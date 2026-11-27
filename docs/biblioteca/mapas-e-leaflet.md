---
tipo: guia
area: front
atualizado: 2026-11-26
---

# Mapas e Leaflet

O MONITORA tem dois mapas, os dois em Leaflet e em TypeScript, ligados na Visão geral da área: o da
Saúde Indígena (nacional e por DSEI, [[modulo-mapa-saude-indigena]]) e o de Projetos
([[modulo-mapa-de-projetos]]). **Esta nota vale para os dois**: a fábrica, as guardas, o fundo e as
formas são comuns. Só a camada de Terras Indígenas é exclusiva da Saúde Indígena. O que a pessoa vê
(Mapa e Satélite, marcadores, lista de unidades) é explicado pela Aya, em
`docs/aya/regras-dos-mapas.md` e `docs/aya/regras-do-mapa-saude-indigena.md`.

## Onde fica

- `src/lib/mapas/fabrica-do-leaflet.ts` — **único lugar que cria mapa Leaflet**; as guardas preservam o
  namespace `L`.
- `src/modulos/mapa-saude-indigena/leaflet.ts` — a integração comum (criação, fundo com recurso,
  tamanho, contornos, enquadramento, leque, ícones e balões), com contratos em
  `tipos-do-leaflet.ts`; a base compartilhada (painel, legenda, tela cheia, retorno ao Brasil e
  hooks) também mora em `src/modulos/mapa-saude-indigena/` ([[mapa-saude-indigena-contratos]]).
- `src/lib/mapas/mapa-render.ts`, `src/lib/mapas/brasil-bounds.ts` (enquadramento pelo contorno real do
  Brasil), `src/lib/mapas/mapa-saude-indigena/*.ts` (contagens, bolhas, CASAIs, unidades, vínculos,
  enquadramentos, formas e cores).
- `src/modulos/mapa-saude-indigena/guarda-do-mapa.ts` — a guarda que `criarMapa` liga em cada
  mapa: limites da América do Sul, zoom de 4,5 a 19, zoom mínimo que acompanha a moldura, régua,
  teclado (+, −, 0) e os azulejos sem cópias do mundo (`OPCOES_DOS_AZULEJOS`). Não envolve
  `L.map` nem `L.tileLayer`.
- Ainda no legado, envolvendo o Leaflet quando ele chega (`carregar-leaflet.ts`): o seletor
  Mapa/Satélite `src/modules/map-base-layer-switcher.ts` e a camada de Terras Indígenas (abaixo).
- `src/lib/mapas/filtros-do-mapa.ts` — a regra dos filtros da página do mapa: comparação sem acento,
  opções sem duplicata, poda até estabilizar. A Visão geral guarda o estado e delega para cá;
  avisa pelo evento `agsus:filtros-alterados`.
- Editor de coordenadas (só o mapa de Projetos): [[coordenadas]].

## Regras de comportamento

- **A forma é a informação, a cor é reforço:** estrela = sede do DSEI, círculo = polo base, casa =
  CASAI, cruz = UBSI, losango = outra unidade de saúde (formas e cores em
  `src/lib/mapas/mapa-saude-indigena/formas.ts`). A legenda desenha as mesmas formas.
- Enquadramento inicial pelo contorno real do Brasil; arrastar não sai para o oceano aberto nem
  cria cópias laterais do mundo. Zoom de 4.5 a 19 (`MAP_MIN_ZOOM`/`MAP_MAX_ZOOM`).
- Escolha Mapa/Satélite guardada no navegador (`agsus_map_base_layer_v1`), uma para o app inteiro,
  aplicada quando cada mapa é criado.
- Fundo com recurso (`adicionarFundo`, `leaflet.ts`): OpenStreetMap e, com quatro azulejos
  seguidos falhando, o satélite da Esri. A CARTO saiu: sem chave, devolve 200 com o azulejo "API
  KEY REQUIRED" e nunca falha. O seletor também troca sozinho de modo com quatro falhas seguidas
  (`SATELLITE_ERROR_LIMIT`); um azulejo que carrega zera a contagem. Mapa cinza nas duas camadas =
  rede ou acesso aos fornecedores, não dados.
- Em aberto: se os termos do ArcGIS World Imagery permitem o uso como base, se vale ter chave da
  CARTO e se o OpenStreetMap continua primário (a política dele desaconselha tráfego de aplicação).
- **Mapa escondido não faz conta com medida 0** (`guarda-do-mapa.ts`): as telas visitadas ficam
  montadas e escondidas, e o Leaflet que enquadra ou voa num contêiner de largura 0 dá
  "Invalid LatLng object: (NaN, NaN)". Os mapas nascem com `trackResize: false`; a guarda remede
  por `ResizeObserver` só com medida real (uma vez ao voltar a aparecer) e, sem medida,
  `fitBounds`/`flyTo`/`flyToBounds` só guardam o centro, sem animação. Quem reenquadra ao
  aparecer é o componente (`observarTamanho`).
- **Os pontos da Saúde Indígena vêm só do SIGEPSI; os de Projetos, do banco** ([[coordenadas]]).
- Cores de série dos projetos: `--series-*` ([[design-e-tokens]]).

## Terras Indígenas (camada da Funai)

Só no mapa da Saúde Indígena (`#map` e `#detailMap`); o de Projetos (`#mapaDosProjetos`) não tem
camadas indígenas. A geometria vem da Funai, compilada num arquivo que o mapa carrega uma vez só.

- `src/modules/indigenous-territories-layer.ts` — a camada (41 KB, legado em TypeScript; **não ler
  por inteiro**); as partes puras estão em `src/lib/mapas/terras-indigenas/` (`catalogo.ts`,
  `fases-e-estilos.ts`, `geometria.ts`, `preferencias.ts`, `textos.ts`, `tipos.ts`).
- `scripts/compilar-terras-indigenas.mjs` gera `public/data/terras-indigenas*.json`;
  `scripts/compilar-contornos-dos-dseis.mjs` gera `public/data/contornos-dos-dseis.json`
  (shapefile Funai `areas_dsei`), usado pela abrangência dos DSEIs e pelo modo "Mapa DSEIs"
  ([[modulo-mapa-saude-indigena]]). Arquivos gerados: regenere, não edite.
- `api/funai-geodata.ts` (GeoServer OWS) e `api/funai-wms.ts` (WMS, camada `Funai:tis_poligonais`):
  proxies da Funai, com a origem validada ([[deploy-e-vercel]]).
- **Por que compilar.** O mapa pedia a geometria à Funai a cada movimento, e nenhuma cache acertava
  (cada enquadramento é um bbox diferente): ~0,5–0,7 s e 1,2 MB por arrasto para desenhar 23
  terras. O país inteiro são 665 terras e 1.835.560 vértices (47 MB), detalhe que a tela não
  distingue. Simplificado com Douglas-Peucker a 0,001° (111 m), ficam 113.864 vértices, 2,17 MB
  (0,61 MB comprimido): menos que um enquadramento, com as 665 terras. Detalhes no comentário de
  topo do script.
- Terras Indígenas têm cores de domínio (não de paleta). O servidor serve `/data/*.json` (o antigo
  Laravel não servia, e as camadas quebravam). Nada em `public/` que não deva ser publicado.

## Relacionadas

- [[modulo-mapa-saude-indigena]] e [[modulo-mapa-de-projetos]] — os dois mapas
- [[mapa-saude-indigena-contratos]] — os contratos da integração com o Leaflet
- [[modulo-visao-geral]] — onde os mapas aparecem
- [[coordenadas]] — de onde vêm os pontos e o editor de Projetos
- [[acessibilidade-e-mobile]] — formas, não só cores
- [[ci-e-qualidade]] — os scripts geradores
- [regras-dos-mapas](../aya/regras-dos-mapas.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)
