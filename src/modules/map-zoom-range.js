const MIN_ZOOM = 4;
const MAX_ZOOM = 19;

let installed = false;

export function installMapZoomRange() {
  if (installed) return true;

  const L = window.L;
  if (!L?.map || !L?.tileLayer) return false;
  if (L.__agsusZoomRangeInstalled) {
    installed = true;
    return true;
  }

  const originalMap = L.map;
  L.map = function agsusMapWithZoomRange(element, options = {}) {
    return originalMap.call(this, element, {
      ...options,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    });
  };

  const originalTileLayer = L.tileLayer;
  L.tileLayer = function agsusTileLayerWithZoomRange(
    urlTemplate,
    options = {},
  ) {
    return originalTileLayer.call(this, urlTemplate, {
      ...options,
      maxZoom: Math.max(Number(options.maxZoom) || 0, MAX_ZOOM),
    });
  };

  L.__agsusZoomRangeInstalled = true;
  installed = true;
  return true;
}

export const MAP_MIN_ZOOM = MIN_ZOOM;
export const MAP_MAX_ZOOM = MAX_ZOOM;
