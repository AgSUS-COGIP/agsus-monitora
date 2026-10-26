import { envolverFabricaDoLeaflet } from "../lib/fabrica-do-leaflet.ts";

/*
  O Leaflet vem do CDN como `window.L`, sem tipos instalados: este arquivo
  declara só o que usa dele.
*/
declare global {
  interface Window {
    L?: unknown;
  }
}

type OpcoesDaFabrica = { maxZoom?: unknown; [opcao: string]: unknown };

type FabricaDoLeaflet = (
  this: unknown,
  primeiro: unknown,
  opcoes?: OpcoesDaFabrica,
) => unknown;

interface LeafletDoZoom {
  map?: FabricaDoLeaflet;
  tileLayer?: FabricaDoLeaflet;
  __agsusZoomRangeInstalled?: boolean;
}

const MIN_ZOOM = 4;
const MAX_ZOOM = 19;

let installed = false;

export function installMapZoomRange(): boolean {
  if (installed) return true;

  const L = window.L as LeafletDoZoom | undefined;
  if (!L?.map || !L?.tileLayer) return false;
  if (L.__agsusZoomRangeInstalled) {
    installed = true;
    return true;
  }

  const originalMap = L.map;
  L.map = function agsusMapWithZoomRange(
    this: unknown,
    element: unknown,
    options: OpcoesDaFabrica = {},
  ) {
    return originalMap.call(this, element, {
      ...options,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    });
  };

  const originalTileLayer = L.tileLayer;
  // `envolverFabricaDoLeaflet` preserva o que está pendurado na fábrica —
  // nomeadamente `L.tileLayer.wms`. Ver `src/lib/fabrica-do-leaflet.ts`.
  L.tileLayer = envolverFabricaDoLeaflet(
    originalTileLayer,
    function agsusTileLayerWithZoomRange(
      this: unknown,
      urlTemplate: unknown,
      options: OpcoesDaFabrica = {},
    ) {
      return originalTileLayer.call(this, urlTemplate, {
        ...options,
        maxZoom: Math.max(Number(options.maxZoom) || 0, MAX_ZOOM),
      });
    },
  );

  L.__agsusZoomRangeInstalled = true;
  installed = true;
  return true;
}
