const BRAZIL_VIEW_BOUNDS = [
  [-34.9, -74.2],
  [6.4, -33.7]
];

const BRAZIL_MAX_BOUNDS = [
  [-37.2, -78.5],
  [8.5, -29.0]
];

const DEFAULT_MAP_OPTIONS = {
  maxBoundsViscosity: 1,
  worldCopyJump: false,
  zoomSnap: 0.25,
  zoomDelta: 0.5,
  wheelPxPerZoomLevel: 90
};

let installed = false;

export function installLeafletMapGuard() {
  if (installed) return true;

  const L = window.L;
  if (!L?.map || !L.latLngBounds) return false;
  if (L.__agsusMapGuardInstalled) {
    installed = true;
    return true;
  }

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

  L.__agsusMapGuardInstalled = true;
  installed = true;
  return true;
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

  map.__agsusMapGuarded = true;

  map.setMaxBounds = function setGuardedMaxBounds(bounds) {
    if (!bounds) {
      const result = originalSetMaxBounds(null);
      scheduleBoundsRestore(L, map, originalSetMaxBounds);
      return result;
    }

    return originalSetMaxBounds(limitBounds(L, bounds, maxBounds));
  };

  map.fitBounds = function fitGuardedBounds(bounds, options = {}) {
    return originalFitBounds(limitBounds(L, bounds, maxBounds), {
      maxZoom: 7,
      animate: false,
      ...options
    });
  };

  if (originalFlyToBounds) {
    map.flyToBounds = function flyToGuardedBounds(bounds, options = {}) {
      return originalFlyToBounds(limitBounds(L, bounds, maxBounds), {
        maxZoom: 7,
        ...options
      });
    };
  }

  if (originalFlyTo) {
    map.flyTo = function flyToGuardedCenter(center, zoom, options = {}) {
      const safeCenter = clampLatLng(L, center, maxBounds);
      const safeZoom = Math.max(map.getMinZoom?.() ?? 3, Math.min(Number(zoom ?? map.getZoom()), 9));
      return originalFlyTo(safeCenter, safeZoom, options);
    };
  }

  map.setView = function setGuardedView(center, zoom, options = {}) {
    const safeCenter = clampLatLng(L, center, maxBounds);
    const safeZoom = Math.max(map.getMinZoom?.() ?? 3, Math.min(Number(zoom ?? map.getZoom()), 9));
    return originalSetView(safeCenter, safeZoom, options);
  };

  map.whenReady(() => {
    originalSetMaxBounds(maxBounds);
    map.fitBounds(viewBounds, { padding: [18, 18], animate: false });
    setTimeout(() => {
      try {
        map.invalidateSize({ animate: false, pan: false });
        map.panInsideBounds(maxBounds, { animate: false });
      } catch (error) {
        console.warn("Nao foi possivel estabilizar o mapa:", error);
      }
    }, 120);
  });

  map.on("dragend zoomend moveend resize", () => {
    try {
      map.panInsideBounds(maxBounds, { animate: false });
    } catch (error) {
      console.warn("Nao foi possivel manter o mapa nos limites do Brasil:", error);
    }
  });
}

function scheduleBoundsRestore(L, map, originalSetMaxBounds) {
  window.clearTimeout(map.__agsusBoundsRestoreTimer);
  map.__agsusBoundsRestoreTimer = window.setTimeout(() => {
    try {
      originalSetMaxBounds(toMaxBounds(L));
      map.panInsideBounds(toMaxBounds(L), { animate: false });
    } catch (error) {
      console.warn("Nao foi possivel restaurar os limites do mapa:", error);
    }
  }, 80);
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

installLeafletMapGuard();
