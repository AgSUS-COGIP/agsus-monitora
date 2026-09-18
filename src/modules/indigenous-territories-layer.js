const STORAGE_KEY = "agsus_map_terras_indigenas_v1";

export const FUNAI_TERRITORIES_WMS =
  "https://geoserver.funai.gov.br/geoserver/Funai/wms";
export const FUNAI_TERRITORIES_WFS =
  "https://geoserver.funai.gov.br/geoserver/Funai/ows";
export const FUNAI_TERRITORIES_LAYER = "Funai:tis_poligonais";

export const FUNAI_PROXY_WMS = "/api/funai-wms";
export const FUNAI_PROXY_GEOJSON = "/api/funai-geodata";

const VECTOR_MIN_ZOOM = 7;
const VECTOR_MAX_FEATURES = 250;
const VECTOR_REFRESH_DELAY_MS = 220;

let installed = false;
let dseiFeaturesPromise = null;

export function isHealthMapElementId(value) {
  const id = typeof value === "string" ? value : String(value?.id || "");
  return id === "map" || id === "detailMap";
}

export function funaiFeatureName(properties = {}) {
  return String(
    properties.terrai_nom ||
      properties.terra_nome ||
      properties.ti_nome ||
      properties.nome ||
      properties.name ||
      "",
  ).trim();
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\bDSEI\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function dseiFeatureName(properties = {}) {
  const preferred = [
    "dsei",
    "nome_dsei",
    "nom_dsei",
    "dsei_nome",
    "ds_nome",
    "nome",
    "name",
  ];
  for (const key of preferred) {
    const value = String(properties?.[key] || "").trim();
    if (value) return value;
  }

  for (const [key, raw] of Object.entries(properties || {})) {
    if (!/(dsei|nome|name)/i.test(key)) continue;
    const value = String(raw || "").trim();
    if (value) return value;
  }
  return "";
}

export function dseiFeatureMatches(feature, dseiName) {
  const target = normalizeText(dseiName);
  if (!target) return false;

  const properties = feature?.properties || {};
  const candidates = new Set(
    [
      dseiFeatureName(properties),
      ...Object.entries(properties)
        .filter(
          ([key, value]) => /(dsei|nome|name)/i.test(key) && value != null,
        )
        .map(([, value]) => String(value)),
    ]
      .map(normalizeText)
      .filter(Boolean),
  );

  for (const candidate of candidates) {
    if (candidate === target) return true;
    if (
      candidate.length >= 6 &&
      target.length >= 6 &&
      (candidate.includes(target) || target.includes(candidate))
    ) {
      return true;
    }
  }
  return false;
}

export function funaiViewportUrl(bounds) {
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

export function funaiDseiUrl() {
  return `${FUNAI_PROXY_GEOJSON}?dataset=dsei`;
}

function supportsHover() {
  try {
    return window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches;
  } catch {
    return false;
  }
}

async function loadDseiFeatures() {
  if (dseiFeaturesPromise) return dseiFeaturesPromise;
  dseiFeaturesPromise = fetch(funaiDseiUrl(), {
    cache: "force-cache",
    headers: { Accept: "application/geo+json,application/json" },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`FUNAI DSEI HTTP ${response.status}`);
      const geojson = await response.json();
      if (!Array.isArray(geojson?.features))
        throw new Error("GeoJSON de DSEI inválido");
      return geojson;
    })
    .catch((error) => {
      dseiFeaturesPromise = null;
      throw error;
    });
  return dseiFeaturesPromise;
}

export function installIndigenousTerritoriesLayer() {
  if (installed) return true;
  const L = window.L;
  if (!L?.map || !L.tileLayer?.wms || !L.control || !L.DomUtil || !L.DomEvent)
    return false;
  if (L.__agsusIndigenousTerritoriesInstalled) {
    installed = true;
    return true;
  }

  const originalMap = L.map;
  L.map = function agsusMapWithIndigenousTerritories(element, options = {}) {
    const map = originalMap.call(this, element, options);
    if (isHealthMapElementId(element)) enhanceMap(L, map);
    return map;
  };

  L.__agsusIndigenousTerritoriesInstalled = true;
  installed = true;
  return true;
}

function enhanceMap(L, map) {
  if (!map || map.__agsusIndigenousTerritoriesReady) return;
  map.__agsusIndigenousTerritoriesReady = true;

  const mapElementId = String(map.getContainer?.()?.id || "");

  const rasterPaneName = "agsus-indigenous-territories";
  const rasterPane =
    map.getPane?.(rasterPaneName) || map.createPane?.(rasterPaneName);
  if (rasterPane?.style) {
    rasterPane.style.zIndex = "250";
    rasterPane.style.pointerEvents = "none";
  }

  const dseiPaneName = "agsus-dsei-coverage";
  const dseiPane =
    map.getPane?.(dseiPaneName) || map.createPane?.(dseiPaneName);
  if (dseiPane?.style) {
    dseiPane.style.zIndex = "253";
    dseiPane.style.pointerEvents = supportsHover() ? "auto" : "none";
  }

  const vectorPaneName = "agsus-indigenous-territories-vector";
  const vectorPane =
    map.getPane?.(vectorPaneName) || map.createPane?.(vectorPaneName);
  if (vectorPane?.style) {
    vectorPane.style.zIndex = "255";
    vectorPane.style.pointerEvents = supportsHover() ? "auto" : "none";
  }

  /*
    O GeoServer oficial da Funai bloqueia requisições de navegador com Origin.
    O raster e o WFS passam por endpoints same-origin estreitos e allowlisted.
    Assim a camada nacional deixa de depender de CORS, sem copiar a base oficial
    para dentro do repositório.
  */
  const rasterLayer = L.tileLayer.wms(FUNAI_PROXY_WMS, {
    layers: FUNAI_TERRITORIES_LAYER,
    format: "image/png",
    transparent: true,
    version: "1.1.1",
    opacity: 0.34,
    pane: rasterPaneName,
    attribution: "Terras Indígenas: Funai",
    updateWhenIdle: false,
    keepBuffer: 3,
    detectRetina: true,
  });
  rasterLayer.__agsusOverlayKind = "indigenous-territories";
  map.__agsusIndigenousTerritoriesLayer = rasterLayer;

  const vectorLayer = L.geoJSON([], {
    pane: vectorPaneName,
    interactive: supportsHover(),
    style: () => vectorStyle(map),
    onEachFeature: (feature, layer) => {
      if (!supportsHover()) return;
      const nome = funaiFeatureName(feature?.properties);
      if (!nome) return;
      layer.bindTooltip(nome, {
        sticky: true,
        direction: "top",
        className: "agsus-ti-tooltip",
      });
    },
  });
  map.__agsusIndigenousTerritoriesVectorLayer = vectorLayer;

  let selectedDsei = "";
  let dseiGeojson = null;
  const dseiLayer = L.geoJSON([], {
    pane: dseiPaneName,
    interactive: supportsHover(),
    style: (feature) => dseiStyle(mapElementId, feature, selectedDsei),
    onEachFeature: (feature, layer) => {
      if (!supportsHover()) return;
      const nome = dseiFeatureName(feature?.properties);
      if (!nome) return;
      layer.bindTooltip(`DSEI ${nome}`, {
        sticky: true,
        direction: "top",
        className: "agsus-dsei-tooltip",
      });
    },
  });
  map.__agsusDseiCoverageLayer = dseiLayer;

  const renderDseiCoverage = () => {
    if (!dseiGeojson?.features) return;
    dseiLayer.clearLayers();

    let features = dseiGeojson.features;
    if (mapElementId === "detailMap") {
      features = selectedDsei
        ? features.filter((feature) =>
            dseiFeatureMatches(feature, selectedDsei),
          )
        : [];
    }

    dseiLayer.addData({ type: "FeatureCollection", features });
    dseiLayer.setStyle?.((feature) =>
      dseiStyle(mapElementId, feature, selectedDsei),
    );
    if (features.length && !map.hasLayer(dseiLayer)) dseiLayer.addTo(map);
    if (!features.length && map.hasLayer(dseiLayer)) map.removeLayer(dseiLayer);

    if (mapElementId === "detailMap") {
      const bounds = features.length ? dseiLayer.getBounds?.() : null;
      map.__agsusDseiCoverageBounds =
        bounds?.isValid?.() === true ? bounds : null;
      if (map.__agsusDseiCoverageBounds) {
        map.fire?.("agsus:dsei-coverage-ready", {
          dsei: selectedDsei,
          bounds: map.__agsusDseiCoverageBounds,
        });
      }
    }
  };

  const ensureDseiCoverage = async () => {
    try {
      dseiGeojson = dseiGeojson || (await loadDseiFeatures());
      renderDseiCoverage();
    } catch (error) {
      console.warn(
        "Abrangência oficial dos DSEIs indisponível no momento.",
        error,
      );
    }
  };

  map.__agsusSetDseiCoverage = (name = "") => {
    selectedDsei = String(name || "").trim();
    if (!selectedDsei) map.__agsusDseiCoverageBounds = null;
    if (dseiGeojson) renderDseiCoverage();
    else void ensureDseiCoverage();
  };

  if (mapElementId === "map") map.whenReady?.(() => void ensureDseiCoverage());

  let requestController = null;
  let refreshTimer = 0;
  let lastViewportKey = "";

  const visible = () => map.__agsusIndigenousTerritoriesVisible !== false;

  const useRasterFallback = () => {
    if (!visible()) return;
    if (!map.hasLayer(rasterLayer)) rasterLayer.addTo(map);
  };

  const clearVector = () => {
    vectorLayer.clearLayers();
    if (map.hasLayer(vectorLayer)) map.removeLayer(vectorLayer);
  };

  const refreshVector = async () => {
    if (!visible()) return;
    const zoom = Number(map.getZoom?.());
    if (!Number.isFinite(zoom) || zoom < VECTOR_MIN_ZOOM) {
      clearVector();
      useRasterFallback();
      return;
    }

    const bounds = map.getBounds?.();
    const url = funaiViewportUrl(bounds);
    if (!url) return;
    const key = `${zoom.toFixed(1)}|${url}`;
    if (key === lastViewportKey) return;
    lastViewportKey = key;

    requestController?.abort?.();
    requestController = new AbortController();
    try {
      const response = await fetch(url, {
        signal: requestController.signal,
        cache: "force-cache",
        headers: { Accept: "application/geo+json,application/json" },
      });
      if (!response.ok) throw new Error(`FUNAI WFS HTTP ${response.status}`);
      const geojson = await response.json();
      if (!Array.isArray(geojson?.features))
        throw new Error("GeoJSON inválido");

      vectorLayer.clearLayers();
      vectorLayer.addData(geojson);
      vectorLayer.setStyle?.(() => vectorStyle(map));
      if (!map.hasLayer(vectorLayer)) vectorLayer.addTo(map);
      if (map.hasLayer(rasterLayer)) map.removeLayer(rasterLayer);
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn(
        "Camada vetorial de Terras Indígenas indisponível; usando WMS da Funai.",
        error,
      );
      clearVector();
      useRasterFallback();
    }
  };

  const scheduleRefresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshVector, VECTOR_REFRESH_DELAY_MS);
  };

  map.on("moveend zoomend", scheduleRefresh);
  map.getContainer?.().addEventListener("agsus:map-base-layer-changed", () => {
    vectorLayer.setStyle?.(() => vectorStyle(map));
    dseiLayer.setStyle?.((feature) =>
      dseiStyle(mapElementId, feature, selectedDsei),
    );
  });

  const desired = readStoredVisibility();
  map.__agsusIndigenousTerritoriesVisible = desired;
  if (desired) {
    rasterLayer.addTo(map);
    map.whenReady?.(scheduleRefresh);
  }
  addControl(L, map, rasterLayer, vectorLayer, desired, scheduleRefresh);
}

function vectorStyle(map) {
  const satellite = map?.__agsusBaseMapMode === "satellite";
  return {
    color: satellite ? "#ff4d3d" : "#0f766e",
    weight: satellite ? 2.4 : 2,
    opacity: 0.96,
    dashArray: satellite ? "5 4" : null,
    fillColor: satellite ? "#ef4444" : "#14b8a6",
    fillOpacity: satellite ? 0.1 : 0.08,
  };
}

function dseiStyle(mapElementId, feature, selectedDsei) {
  const selected =
    Boolean(selectedDsei) && dseiFeatureMatches(feature, selectedDsei);
  if (mapElementId === "detailMap") {
    return {
      color: "#0b5fa5",
      weight: 3,
      opacity: 0.96,
      fillColor: "#38bdf8",
      fillOpacity: 0.08,
    };
  }

  return {
    color: selected ? "#0b5fa5" : "#2563eb",
    weight: selected ? 2.8 : 1.1,
    opacity: selected ? 0.96 : 0.5,
    fillColor: selected ? "#38bdf8" : "#60a5fa",
    fillOpacity: selected ? 0.08 : 0.015,
  };
}

function addControl(
  L,
  map,
  rasterLayer,
  vectorLayer,
  initialVisible,
  scheduleRefresh,
) {
  if (map.__agsusIndigenousTerritoriesControl) return;
  const control = L.control({ position: "topright" });
  control.onAdd = () => {
    const container = L.DomUtil.create(
      "div",
      "leaflet-control agsus-indigenous-territories-control",
    );
    const button = L.DomUtil.create(
      "button",
      "agsus-indigenous-territories-control__button",
      container,
    );
    button.type = "button";
    button.innerHTML =
      '<span class="agsus-indigenous-territories-control__swatch" aria-hidden="true"></span><span>Terras Indígenas</span>';
    button.title = "Mostrar ou ocultar Terras Indígenas (Funai)";
    button.setAttribute("aria-label", button.title);

    const sync = () => {
      const current = map.__agsusIndigenousTerritoriesVisible !== false;
      button.classList.toggle("is-active", current);
      button.setAttribute("aria-pressed", current ? "true" : "false");
      container.dataset.visible = current ? "true" : "false";
    };

    button.addEventListener("click", () => {
      const next = !(map.__agsusIndigenousTerritoriesVisible !== false);
      map.__agsusIndigenousTerritoriesVisible = next;
      if (!next) {
        map.removeLayer(rasterLayer);
        map.removeLayer(vectorLayer);
      } else {
        rasterLayer.addTo(map);
        scheduleRefresh();
      }
      storeVisibility(next);
      sync();
    });

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    button.setAttribute("aria-pressed", initialVisible ? "true" : "false");
    sync();
    return container;
  };
  control.addTo(map);
  map.__agsusIndigenousTerritoriesControl = control;
}

function readStoredVisibility() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value == null ? true : value !== "0";
  } catch {
    return true;
  }
}

function storeVisibility(visible) {
  try {
    localStorage.setItem(STORAGE_KEY, visible ? "1" : "0");
  } catch {
    // O mapa continua funcional mesmo sem armazenamento local.
  }
}
