/*
  Os tipos da camada de Terras Indígenas (src/modules/indigenous-territories-layer.ts)
  e das funções puras dela, nesta pasta. Os dados vêm de GeoJSON — o catálogo
  local (`public/data/terras-indigenas*.json`) ou a Funai, pelo proxy — e por
  isso as propriedades são abertas: a Funai já trocou o nome de campo uma vez
  (`terrai_nom` → `terrai_nome`), e o código lê o que estiver lá.
*/
import type { CaixaDaTerra } from "../mapa-saude-indigena/tipos.ts";

export type { CaixaDaTerra };

/** Longitude e latitude, na ordem do GeoJSON. */
export type PosicaoGeoJson = readonly number[];
export type AnelGeoJson = readonly PosicaoGeoJson[];
/** O primeiro anel é o contorno; os outros, buracos. */
export type PoligonoGeoJson = readonly AnelGeoJson[];

export type GeometriaDaTerra =
  | { type: "Polygon"; coordinates: PoligonoGeoJson }
  | { type: "MultiPolygon"; coordinates: readonly PoligonoGeoJson[] }
  | { type: "Point"; coordinates: PosicaoGeoJson };

/** Atributos de `Funai:tis_poligonais`, do catálogo ou da abrangência dos DSEIs. */
export interface PropriedadesDaTerra {
  [campo: string]: unknown;
  terrai_nome?: unknown;
  etnia_nome?: unknown;
  uf_sigla?: unknown;
  fase_ti?: unknown;
}

export interface FeatureDaTerra {
  type?: string;
  properties?: PropriedadesDaTerra | null;
  geometry?: GeometriaDaTerra | null;
}

export interface ColecaoDeTerras {
  type?: string;
  features: FeatureDaTerra[];
}

/** Ponto de saúde do DSEI aberto (polo, UBSI, CASAI). */
export interface UnidadeDoDsei {
  lat?: unknown;
  lon?: unknown;
}

/** O que o Leaflet chama de LatLngBounds, só com o que a camada lê. */
export interface LimitesDoMapa {
  getWest?(): number;
  getEast?(): number;
  getSouth?(): number;
  getNorth?(): number;
}

export interface PontoProjetado {
  x: number;
  y: number;
}

/** Uma terra na lista do painel: polígonos colapsados pelo nome. */
export interface ResumoDaTerra {
  nome: string;
  povos: string[];
  ufs: string[];
  fase: string;
  caixa: CaixaDaTerra | null;
}

export type FaseDaTerra =
  "definitiva" | "em_processo" | "em_estudo" | "desconhecida";

/** Estilo de traço do Leaflet (Path options). */
export interface EstiloDoTraco {
  color: string;
  weight: number;
  opacity?: number;
  dashArray?: string | null;
  fill?: boolean;
  fillColor?: string;
  fillOpacity?: number;
}
