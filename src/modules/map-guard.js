const BRAZIL_VIEW_BOUNDS = [
  [-34.9, -74.2],
  [6.4, -33.7]
];

const BRAZIL_MAX_BOUNDS = [
  [-37.2, -78.5],
  [8.7, -29.0]
];

const DEFAULT_MAP_OPTIONS = {
  maxBoundsViscosity: 1,
  worldCopyJump: false,
  zoomSnap: 0.25,
  zoomDelta: 0.5,
  wheelPxPerZoomLevel: 100
};

let installed = false;

export function installLeafletMapGuard() {
  if (installed) return true;

  const L = window.L;
  if (!L?.map || !L.latLngBounds || !L.tileLayer) return false;
  if (L.__agsusMapGuardInstalled) {
    installed = true;
    return true;
  }

  installTileLayerGuard(L);
  installMapGuard(L);

  L.__agsusMapGuardInstalled = true;
  installed = true;
  return true;
}

function installTileLayerGuard(L) {
  if (L.__agsusTileLayerGuardInstalled) return;

  const originalTileLayer = L.tileLayer;

  L.tileLayer = function guardedTileLayer(urlTemplate, options = {}) {
    return originalTileLayer.call(this, urlTemplate, {
      ...options,
      bounds: toMaxBounds(L),
      noWrap: true,
      updateWhenIdle: true,
      keepBuffer: 2
    });
  };

  L.__agsusTileLayerGuardInstalled = true;
}

function installMapGuard(L) {
  if (L.__agsusMapFactoryGuardInstalled) return;

  const originalMap = L.map;

  L.map = function guardedLeafletMap(element, options = {}) {
    const map = originalMap.call(this, element, {
      ...DEFAULT_MAP_OPTIONS,
      ...options,
      maxBounds: toMaxBounds(L),
      maxBoundsViscosity: 1,
      worldCopyJump: false
    });

    hardenMapInstance(L, map);
    return map;
  };

  L.__agsusMapFactoryGuardInstalled = true;
}

function hardenMapInstance(L, map) {
  if (!map || map.__agsusMapGuarded) return;

  const maxBounds = toMaxBounds(L);
  const viewBounds = toViewBounds(L);
  const originalSetMaxBounds = map.setMaxBounds.bind(map);
  const originalFitBounds = map.fitBounds.bind(map);
  const originalFlyToBounds = map.flyToBounds?.bind(map);
  const originalFlyTo = map.flyTo?.bind(map);
  const originalSetView = map.setView.bind(map);
  const originalPanTo = map.panTo?.bind(map);

  map.__agsusMapGuarded = true;

  map.setMaxBounds = function setGuardedMaxBounds(bounds) {
    const nextBounds = bounds ? limitBounds(L, bounds, maxBounds) : maxBounds;
    return originalSetMaxBounds(nextBounds);
  };

  map.fitBounds = function fitGuardedBounds(bounds, options = {}) {
    return originalFitBounds(limitBounds(L, bounds, maxBounds), {
      padding: [24, 24],
      maxZoom: 7,
      animate: false,
      ...options
    });
  };

  if (originalFlyToBounds) {
    map.flyToBounds = function flyToGuardedBounds(bounds, options = {}) {
      return originalFlyToBounds(limitBounds(L, bounds, maxBounds), {
        padding: [32, 32],
        maxZoom: 7,
        duration: 0.35,
        ...options
      });
    };
  }

  if (originalFlyTo) {
    map.flyTo = function flyToGuardedCenter(center, zoom, options = {}) {
      return originalFlyTo(clampLatLng(L, center, maxBounds), clampZoom(map, zoom), {
        duration: 0.35,
        ...options
      });
    };
  }

  map.setView = function setGuardedView(center, zoom, options = {}) {
    return originalSetView(clampLatLng(L, center, maxBounds), clampZoom(map, zoom), options);
  };

  if (originalPanTo) {
    map.panTo = function panToGuardedCenter(center, options = {}) {
      return originalPanTo(clampLatLng(L, center, maxBounds), {
        animate: false,
        ...options
      });
    };
  }

  map.whenReady(() => {
    originalSetMaxBounds(maxBounds);
    originalFitBounds(viewBounds, { padding: [20, 20], animate: false });
    stabilizeMap(map, maxBounds);
    window.setTimeout(() => stabilizeMap(map, maxBounds), 180);
    window.setTimeout(() => stabilizeMap(map, maxBounds), 600);
  });

  map.on("drag move zoomend moveend resize layeradd", () => stabilizeMap(map, maxBounds));
}

function stabilizeMap(map, maxBounds) {
  window.clearTimeout(map.__agsusStabilizeTimer);
  map.__agsusStabilizeTimer = window.setTimeout(() => {
    try {
      map.invalidateSize({ animate: false, pan: false });
      map.panInsideBounds(maxBounds, { animate: false });
      map.setMaxBounds(maxBounds);
    } catch (error) {
      console.warn("Nao foi possivel estabilizar o mapa:", error);
    }
  }, 40);
}

function toViewBounds(L) {
  return L.latLngBounds(BRAZIL_VIEW_BOUNDS);
}

function toMaxBounds(L) {
  return L.latLngBounds(BRAZIL_MAX_BOUNDS);
}

function limitBounds(L, bounds, maxBounds) {
  const incoming = L.latLngBounds(bounds);
  const south = Math.max(incoming.getSouth(), maxBounds.getSouth());
  const west = Math.max(incoming.getWest(), maxBounds.getWest());
  const north = Math.min(incoming.getNorth(), maxBounds.getNorth());
  const east = Math.min(incoming.getEast(), maxBounds.getEast());

  if (south >= north || west >= east) return maxBounds;
  return L.latLngBounds([south, west], [north, east]);
}

function clampLatLng(L, center, maxBounds) {
  const point = Array.isArray(center) ? L.latLng(center[0], center[1]) : L.latLng(center);
  return L.latLng(
    Math.max(maxBounds.getSouth(), Math.min(maxBounds.getNorth(), point.lat)),
    Math.max(maxBounds.getWest(), Math.min(maxBounds.getEast(), point.lng))
  );
}

function clampZoom(map, zoom) {
  const value = Number(zoom ?? map.getZoom?.() ?? 4);
  const min = Number(map.getMinZoom?.() ?? 3);
  return Math.max(min, Math.min(value, 9));
}

installLeafletMapGuard();
