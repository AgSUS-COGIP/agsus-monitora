import type { CoordenadasDoMapa } from "../../lib/tipos-do-mapa.ts";
import type { CaixaDaTerra } from "../../lib/mapa-saude-indigena/tipos.ts";
import type { MapaNacional } from "../../lib/tipos-do-mapa.ts";

export interface LimitesDoLeaflet {
  isValid?(): boolean;
}
export interface PontoNaTela {
  x: number;
  y: number;
  add(ponto: PontoNaTela): PontoNaTela;
}
export interface PosicaoDoLeaflet {
  lat: number;
  lng: number;
}
export interface MarcadorIndigena {
  bindTooltip(conteudo: HTMLElement, opcoes?: object): MarcadorIndigena;
  on(evento: string, ouvinte: () => void): MarcadorIndigena;
}
export interface CamadaDoMapa {
  addTo(mapa: MapaNacional): CamadaDoMapa;
  clearLayers(): void;
  addLayer(marcador: MarcadorIndigena): unknown;
}
export interface MetodosDoMapaIndigena {
  on(
    evento: string,
    ouvinte: (evento?: { bounds?: LimitesDoLeaflet }) => void,
  ): unknown;
  off(
    evento: string,
    ouvinte: (evento?: { bounds?: LimitesDoLeaflet }) => void,
  ): unknown;
  stop?(): void;
  fitBounds(limites: LimitesDoLeaflet, opcoes?: object): unknown;
  flyTo(coordenadas: CoordenadasDoMapa, zoom: number, opcoes?: object): unknown;
  latLngToLayerPoint(coordenadas: CoordenadasDoMapa): PontoNaTela;
  layerPointToLatLng(ponto: PontoNaTela): PosicaoDoLeaflet;
  __agsusSuspenderCamadasIndigenas?(suspender: boolean): void;
  __agsusDseiCoverageLayer?: { getLayers?(): unknown[] };
  __agsusDseiCoverageBounds?: LimitesDoLeaflet;
  __agsusAoMudarTerras?: ((lista: unknown) => void) | null;
  __agsusSetDseiCoverage?(
    nome: string,
    pontos?: { lat: number; lon: number }[],
    ufs?: string[],
  ): void;
  __agsusEnquadrarTerra?(nome: string, caixa: CaixaDaTerra): void;
}
/** Apenas os métodos usados pelas telas; o namespace original não é alterado. */
export interface LeafletDoMapa {
  map(
    elemento: HTMLElement,
    opcoes?: object,
  ): import("./tipos-do-painel.ts").MapaDoPainel;
  layerGroup(): CamadaDoMapa;
  marker(
    posicao: CoordenadasDoMapa | PosicaoDoLeaflet,
    opcoes?: object,
  ): MarcadorIndigena;
  circleMarker(posicao: CoordenadasDoMapa, opcoes?: object): MarcadorIndigena;
  polyline(
    posicoes: (CoordenadasDoMapa | PosicaoDoLeaflet)[],
    opcoes?: object,
  ): MarcadorIndigena;
  point(x: number, y: number): PontoNaTela;
  latLngBounds(pontos: CoordenadasDoMapa[]): LimitesDoLeaflet;
}

export function leafletDoMapa(valor: unknown): LeafletDoMapa | null {
  if (!valor || typeof valor !== "object") return null;
  const metodos = [
    "map",
    "layerGroup",
    "marker",
    "circleMarker",
    "polyline",
    "point",
    "latLngBounds",
  ];
  return metodos.every(
    (chave) =>
      chave in valor && typeof Reflect.get(valor, chave) === "function",
  )
    ? (valor as LeafletDoMapa)
    : null;
}

export interface LequeDoMapa {
  adicionar(
    marcador: MarcadorIndigena,
    latitude: number,
    longitude: number,
  ): void;
  limpar(): void;
  aplicar(): void;
  parar(): void;
}
