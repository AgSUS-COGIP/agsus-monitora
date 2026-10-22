/** Contratos mínimos usados pela integração dos módulos TS com o Leaflet do app. */
export type CoordenadasDoMapa = [latitude: number, longitude: number];
export interface MapaNacional {
  invalidateSize?(opcoes?: object): unknown;
  getZoom(): number;
  setView(
    coordenadas: CoordenadasDoMapa,
    zoom: number,
    opcoes: { animate: boolean },
  ): unknown;
  getContainer?(): HTMLElement;
}
export interface MarcadorDoMapa {
  openPopup?(): void;
}
