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
export interface CamadaLeaflet {
  addTo(alvo: MapaNacional | CamadaDoMapa): CamadaLeaflet;
}
export interface CamadaDeFundo extends CamadaLeaflet {
  on?(evento: string, ouvinte: () => void): unknown;
  addTo(alvo: MapaNacional | CamadaDoMapa): CamadaDeFundo;
}
export interface MarcadorIndigena extends CamadaLeaflet {
  bindPopup(conteudo: HTMLElement, opcoes?: object): MarcadorIndigena;
  bindTooltip(conteudo: HTMLElement, opcoes?: object): MarcadorIndigena;
  on(evento: string, ouvinte: () => void): MarcadorIndigena;
  closeTooltip(): unknown;
  isPopupOpen?(): boolean;
  openPopup?(): void;
  setLatLng(posicao: CoordenadasDoMapa | PosicaoDoLeaflet): unknown;
  bringToFront?(): void;
}
export interface CamadaDoMapa extends CamadaLeaflet {
  addTo(mapa: MapaNacional): CamadaDoMapa;
  clearLayers(): void;
  addLayer(camada: CamadaLeaflet): unknown;
  removeLayer(camada: CamadaLeaflet): unknown;
  hasLayer(camada: CamadaLeaflet): boolean;
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
  flyToBounds(limites: LimitesDoLeaflet, opcoes?: object): unknown;
  invalidateSize(opcoes?: object): unknown;
  removeLayer(camada: CamadaLeaflet): unknown;
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
  tileLayer(url: string, opcoes?: object): CamadaDeFundo;
  TileLayer?: {
    extend(opcoes: object): new (url: string, opcoes: object) => CamadaDeFundo;
  };
  geoJSON?(dados: unknown, opcoes?: object): CamadaLeaflet;
  divIcon(opcoes: {
    className: string;
    html: HTMLElement;
    iconSize: CoordenadasDoMapa;
    iconAnchor: CoordenadasDoMapa;
  }): object;
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
  latLngBounds(
    sulOeste: readonly [number, number],
    norteLeste: readonly [number, number],
  ): LimitesDoLeaflet;
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
    "tileLayer",
    "divIcon",
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
