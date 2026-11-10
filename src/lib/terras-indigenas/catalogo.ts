import type { ColecaoDeTerras, LimitesDoMapa } from "./tipos.ts";

export const FUNAI_TERRITORIES_LAYER = "Funai:tis_poligonais";

export const FUNAI_PROXY_WMS = "/api/funai-wms";
export const FUNAI_PROXY_GEOJSON = "/api/funai-geodata";

/*
  O pane dos contornos dos DSEIs da camada de Terras Indígenas. No Mapa DSEIs,
  que pinta os mesmos contornos por conta própria, a camada o esconde.
*/
export const PANE_DA_ABRANGENCIA_DOS_DSEIS = "agsus-dsei-coverage";

/*
  O CATÁLOGO LOCAL, E POR QUE ELE EXISTE

  O mapa pedia a geometria à Funai a cada movimento. O enquadramento vira um
  bbox de floats crus, dois arrastos seguidos nunca partilham URL, e por isso
  nenhuma cache acertava. Medido contra o GeoServer:

      um enquadramento (250 polígonos no máximo)   677 ms   23 terras   1,22 MB
      o mesmo enquadramento, um pixel ao lado      507 ms   23 terras   1,22 MB

  Meio segundo por arrasto, e 1,22 MB para desenhar 23 terras.

  `scripts/compilar-terras-indigenas.mjs` traz as 665 de uma vez, simplifica a
  111 metros e guarda 2,2 MB — 0,61 MB comprimido, menos de metade do que
  custava UM enquadramento. Carrega-se uma vez, fica em memória, e a partir daí
  enquadrar, filtrar por distrito e limpar o filtro não tocam na rede.

  Isto também remove um teto que estragava o filtro: com o distrito aberto
  pedia-se o enquadramento inteiro limitado a 250 polígonos e só depois se
  descartava o que não era dali — gastando o teto com terras a deitar fora.
  Agora filtra-se primeiro, sobre as 665.

  A Funai continua a ser a fonte, e continua a ser o recurso quando o catálogo
  não carrega.
*/
export const CATALOGO_DE_TERRAS = "/data/terras-indigenas.json";

/*
  O CATÁLOGO LARGO, E POR QUE SÃO DOIS

  A visão nacional desenhava o raster da Funai — uma imagem só, recolorida por
  inteiro. Uma imagem não sabe distinguir fase: a legenda prometia terra
  homologada, terra em processo e terra em estudo, e o mapa do Brasil mostrava
  tudo da mesma cor.

  O piso de zoom que mandava no raster existia porque, antes do catálogo, pedir
  a geometria abaixo dele traria o país inteiro da Funai. Esse motivo morreu: o
  catálogo JÁ é o país inteiro, e está em memória.

  O que sobra é o custo de desenhar. No zoom 4 um pixel vale ~9,8 km, e os
  113.864 vértices do catálogo fino desenham detalhe que o ecrã não resolve
  enquanto o Leaflet paga por cada um. O largo, simplificado a 1113 metros —
  pouco mais de um décimo de pixel nessa escala —, tem 17.598 vértices e 0,43 MB.

  Carrega primeiro, e é o que a visão nacional usa.
*/
export const CATALOGO_DE_TERRAS_LARGO = "/data/terras-indigenas-largo.json";

/*
  Onde se troca um pelo outro. A 1113 metros de tolerância, o desvio passa a
  valer um pixel por volta do zoom 7 — que é também onde se deixa de ver o país
  e se passa a ver um distrito.
*/
export const ZOOM_DO_CATALOGO_FINO = 7;

export function catalogoParaOZoom(zoom: unknown): string {
  return Number(zoom) >= ZOOM_DO_CATALOGO_FINO
    ? CATALOGO_DE_TERRAS
    : CATALOGO_DE_TERRAS_LARGO;
}
export const CATALOGO_DE_TERRAS_EM_ESTUDO =
  "/data/terras-indigenas-em-estudo.json";

/** O `fetch` (ou um falso, nos testes). */
export type BuscarCatalogo = (
  url: string,
  opcoes: RequestInit,
) => Promise<{
  ok?: boolean;
  status?: number;
  json(): Promise<unknown>;
} | null>;

function ehColecao(corpo: unknown): corpo is ColecaoDeTerras {
  return Array.isArray(
    corpo && typeof corpo === "object" ? Reflect.get(corpo, "features") : null,
  );
}

/*
  Um pedido só por catálogo, para a aplicação inteira: o mapa nacional e o do
  território partilham as mesmas promessas. Falha guarda `null` e não volta a
  tentar em cascata — quem chamar a seguir recebe o mesmo `null` e usa o recurso.
*/
const catalogosEmCurso = new Map<string, Promise<ColecaoDeTerras | null>>();

export function carregarCatalogo(
  url: string,
  buscar?: BuscarCatalogo,
): Promise<ColecaoDeTerras | null> {
  const fonte: unknown =
    typeof buscar === "function" ? buscar : globalThis.fetch;
  if (typeof fonte !== "function") return Promise.resolve(null);
  const pedir = fonte as BuscarCatalogo;
  // `Promise.resolve().then` porque um fetch que ATIRA — em vez de rejeitar —
  // escapava ao catch abaixo e partia o mapa em vez de cair no recurso.
  return Promise.resolve()
    .then(() =>
      pedir(url, {
        cache: "force-cache",
        headers: { Accept: "application/geo+json,application/json" },
      }),
    )
    .then((resposta) => {
      if (!resposta?.ok) throw new Error(`HTTP ${resposta?.status}`);
      return resposta.json();
    })
    .then((corpo) => (ehColecao(corpo) ? corpo : null))
    .catch((erro: unknown) => {
      console.warn("Catálogo de Terras Indígenas indisponível.", erro);
      return null;
    });
}

export function obterCatalogo(
  url: string,
  buscar?: BuscarCatalogo,
): Promise<ColecaoDeTerras | null> {
  let pedido = catalogosEmCurso.get(url);
  if (!pedido) {
    pedido = carregarCatalogo(url, buscar);
    catalogosEmCurso.set(url, pedido);
  }
  return pedido;
}

const VECTOR_MAX_FEATURES = 250;

export function funaiViewportUrl(
  bounds: LimitesDoMapa | null | undefined,
): string {
  const west = Number(bounds?.getWest?.());
  const south = Number(bounds?.getSouth?.());
  const east = Number(bounds?.getEast?.());
  const north = Number(bounds?.getNorth?.());
  if (![west, south, east, north].every(Number.isFinite)) return "";

  const params = new URLSearchParams({
    dataset: "territories",
    maxFeatures: String(VECTOR_MAX_FEATURES),
    bbox: [west, south, east, north].join(","),
  });
  return `${FUNAI_PROXY_GEOJSON}?${params.toString()}`;
}

export function funaiEstudoUrl(): string {
  return `${FUNAI_PROXY_GEOJSON}?dataset=estudo`;
}
