const BRAZIL_VIEW_BOUNDS = [
  [-34.9, -74.2],
  [6.4, -33.7],
];

// Mantém o Brasil como enquadramento inicial, mas permite afastar e navegar
// pelo contexto geográfico da América do Sul.
const SOUTH_AMERICA_MAX_BOUNDS = [
  [-58.5, -84.5],
  [15.5, -27.0],
];

const DEFAULT_MAP_OPTIONS = {
  maxBoundsViscosity: 0.82,
  worldCopyJump: false,
  zoomSnap: 0.25,
  zoomDelta: 0.5,
  wheelPxPerZoomLevel: 72,
  scrollWheelZoom: true,
  doubleClickZoom: true,
  touchZoom: true,
  boxZoom: true,
  keyboard: true,
  keyboardPanDelta: 80,
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
      keepBuffer: 2,
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
      maxBoundsViscosity:
        options.maxBoundsViscosity ?? DEFAULT_MAP_OPTIONS.maxBoundsViscosity,
      worldCopyJump: false,
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
  const originalSetMinZoom = map.setMinZoom?.bind(map);

  map.__agsusMapGuarded = true;
  map.__agsusOverviewMode = true;

  // O código legado recalcula limites muito justos ao redor do Brasil. Aqui
  // mantemos um limite único da América do Sul para permitir contexto regional.
  map.setMaxBounds = function setGuardedMaxBounds() {
    return originalSetMaxBounds(maxBounds);
  };

  if (originalSetMinZoom) {
    map.setMinZoom = function setGuardedMinZoom(value) {
      const requested = Number(value);
      const allowed = Number.isFinite(requested) ? Math.min(requested, 3) : 3;
      return originalSetMinZoom(allowed);
    };
    originalSetMinZoom(3);
  }

  // O limite abaixo vale apenas para enquadramentos automáticos. O overview do
  // Brasil não passa de zoom 3: em cards baixos/largos, zoom 4 cortava o país no
  // primeiro quadro. Seleções e filtros continuam podendo aproximar mais.
  map.fitBounds = function fitGuardedBounds(bounds, options = {}) {
    const limited = limitBounds(L, bounds, maxBounds);
    const overview = isBrazilOverviewBounds(L, limited);
    map.__agsusOverviewMode = overview;
    const requestedMax = Number(options.maxZoom);
    const maxZoom = overview
      ? Math.min(Number.isFinite(requestedMax) ? requestedMax : 3, 3)
      : Number.isFinite(requestedMax)
        ? requestedMax
        : 8;
    return originalFitBounds(limited, {
      padding: overview ? [20, 20] : [24, 24],
      animate: false,
      ...options,
      maxZoom,
    });
  };

  if (originalFlyToBounds) {
    map.flyToBounds = function flyToGuardedBounds(bounds, options = {}) {
      const limited = limitBounds(L, bounds, maxBounds);
      const overview = isBrazilOverviewBounds(L, limited);
      map.__agsusOverviewMode = overview;
      return originalFlyToBounds(limited, {
        padding: overview ? [20, 20] : [32, 32],
        duration: 0.35,
        ...options,
        maxZoom: overview ? 3 : (options.maxZoom ?? 9),
      });
    };
  }

  if (originalFlyTo) {
    map.flyTo = function flyToGuardedCenter(center, zoom, options = {}) {
      map.__agsusOverviewMode = false;
      return originalFlyTo(
        clampLatLng(L, center, maxBounds),
        clampZoom(map, zoom),
        {
          duration: 0.35,
          ...options,
        },
      );
    };
  }

  map.setView = function setGuardedView(center, zoom, options = {}) {
    map.__agsusOverviewMode = false;
    return originalSetView(
      clampLatLng(L, center, maxBounds),
      clampZoom(map, zoom),
      options,
    );
  };

  if (originalPanTo) {
    map.panTo = function panToGuardedCenter(center, options = {}) {
      return originalPanTo(clampLatLng(L, center, maxBounds), {
        animate: false,
        ...options,
      });
    };
  }

  enhanceMapAccessibility(L, map);

  map.whenReady(() => {
    originalSetMaxBounds(maxBounds);
    originalSetMinZoom?.(3);
    map.__agsusOverviewMode = true;
    originalFitBounds(viewBounds, {
      padding: [20, 20],
      maxZoom: 3,
      animate: false,
    });
    ensureFullManualZoomRange(map);
    addScaleControl(L, map);
    stabilizeMap(map, maxBounds);
    window.setTimeout(() => stabilizeMap(map, maxBounds), 180);
    window.setTimeout(() => stabilizeMap(map, maxBounds), 600);
  });

  // Quando o card ganha a dimensão final, recalcula o overview. Antes havia
  // apenas invalidateSize(), mantendo o zoom calculado para uma dimensão antiga.
  map.on("resize", () => {
    stabilizeMap(map, maxBounds);
    /*
      A bandeira sozinha não basta: o zoom por pinça no telemóvel não passa por
      `setView` nem por `flyTo`, então ela continuaria `true` depois de a pessoa
      aproximar. Um `resize` seguinte — rodar o aparelho, abrir a barra lateral,
      entrar em ecrã inteiro — devolveria o mapa ao Brasil, descartando o que ela
      tinha enquadrado.

      O zoom corrente é a prova: só reenquadra quem ainda está na visão geral.
    */
    const aindaEmOverview =
      map.__agsusOverviewMode && Number(map.getZoom?.() ?? 0) <= 3;
    if (!aindaEmOverview) return;
    window.requestAnimationFrame(() => {
      try {
        originalFitBounds(viewBounds, {
          padding: [20, 20],
          maxZoom: 3,
          animate: false,
        });
      } catch (error) {
        console.warn("Nao foi possivel reenquadrar o Brasil:", error);
      }
    });
  });
  map.on("drag move zoomend moveend layeradd", () =>
    stabilizeMap(map, maxBounds),
  );
}

function enhanceMapAccessibility(L, map) {
  const container = map.getContainer?.();
  if (!container) return;

  container.tabIndex = 0;
  container.setAttribute("role", "application");
  container.setAttribute(
    "aria-label",
    "Mapa da Saúde Indígena com foco inicial no Brasil e navegação permitida pela América do Sul. Use os botões mais e menos, a roda do mouse, duplo clique, gesto de pinça ou as teclas mais e menos para controlar o zoom.",
  );
  container.title =
    "Brasil em destaque. Afaste o zoom para consultar o contexto da América do Sul.";

  // Mantém os recursos explicitamente habilitados mesmo em navegadores/dispositivos
  // que inicializam algum handler como desativado.
  map.scrollWheelZoom?.enable?.();
  map.doubleClickZoom?.enable?.();
  map.touchZoom?.enable?.();
  map.boxZoom?.enable?.();
  map.keyboard?.enable?.();

  container.addEventListener("keydown", (event) => {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      map.zoomIn(1);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      map.zoomOut(1);
    } else if (event.key === "0") {
      event.preventDefault();
      map.fitBounds(toViewBounds(L), {
        padding: [20, 20],
        maxZoom: 3,
        animate: false,
      });
    }
  });
}

function ensureFullManualZoomRange(map) {
  const configuredMax = Number(map.options?.maxZoom);
  const layerMax = getLayerMaxZoom(map);
  const maxZoom = Number.isFinite(layerMax)
    ? layerMax
    : Number.isFinite(configuredMax)
      ? configuredMax
      : 18;

  map.setMaxZoom?.(Math.max(18, maxZoom));
}

function getLayerMaxZoom(map) {
  let maxZoom = Number.NaN;
  map.eachLayer?.((layer) => {
    const value = Number(layer?.options?.maxZoom);
    if (Number.isFinite(value)) {
      maxZoom = Number.isFinite(maxZoom) ? Math.max(maxZoom, value) : value;
    }
  });
  return maxZoom;
}

function addScaleControl(L, map) {
  if (map.__agsusScaleControlAdded || !L.control?.scale) return;
  L.control
    .scale({
      position: "bottomright",
      imperial: false,
      metric: true,
      maxWidth: 130,
    })
    .addTo(map);
  map.__agsusScaleControlAdded = true;
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
  return L.latLngBounds(SOUTH_AMERICA_MAX_BOUNDS);
}

function isBrazilOverviewBounds(L, bounds) {
  const incoming = L.latLngBounds(bounds);
  const latSpan = incoming.getNorth() - incoming.getSouth();
  const lngSpan = incoming.getEast() - incoming.getWest();
  return latSpan >= 30 && lngSpan >= 30;
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
  const point = Array.isArray(center)
    ? L.latLng(center[0], center[1])
    : L.latLng(center);
  return L.latLng(
    Math.max(maxBounds.getSouth(), Math.min(maxBounds.getNorth(), point.lat)),
    Math.max(maxBounds.getWest(), Math.min(maxBounds.getEast(), point.lng)),
  );
}

function clampZoom(map, zoom) {
  const value = Number(zoom ?? map.getZoom?.() ?? 4);
  const min = Number(map.getMinZoom?.() ?? 3);
  const configuredMax = Number(
    map.getMaxZoom?.() ?? map.options?.maxZoom ?? 18,
  );
  const max = Number.isFinite(configuredMax) ? Math.max(configuredMax, 18) : 18;
  return Math.max(min, Math.min(value, max));
}

installLeafletMapGuard();
