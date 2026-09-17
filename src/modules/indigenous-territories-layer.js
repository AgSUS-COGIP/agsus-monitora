const STORAGE_KEY = "agsus_map_terras_indigenas_v1";

export const FUNAI_TERRITORIES_WMS =
  "https://geoserver.funai.gov.br/geoserver/Funai/wms";
export const FUNAI_TERRITORIES_LAYER = "Funai:tis_poligonais";

let installed = false;

export function isHealthMapElementId(value) {
  const id = typeof value === "string" ? value : String(value?.id || "");
  return id === "map" || id === "detailMap";
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

  const paneName = "agsus-indigenous-territories";
  const pane = map.getPane?.(paneName) || map.createPane?.(paneName);
  if (pane?.style) {
    pane.style.zIndex = "250";
    pane.style.pointerEvents = "none";
  }

  const layer = L.tileLayer.wms(FUNAI_TERRITORIES_WMS, {
    layers: FUNAI_TERRITORIES_LAYER,
    format: "image/png",
    transparent: true,
    version: "1.1.1",
    opacity: 0.38,
    pane: paneName,
    attribution: "Terras Indígenas: Funai",
    crossOrigin: true,
    updateWhenIdle: true,
    keepBuffer: 2,
  });
  layer.__agsusOverlayKind = "indigenous-territories";
  map.__agsusIndigenousTerritoriesLayer = layer;

  const desired = readStoredVisibility();
  if (desired) layer.addTo(map);
  addControl(L, map, layer, desired);
}

function addControl(L, map, layer, initialVisible) {
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
      const visible = map.hasLayer(layer);
      button.classList.toggle("is-active", visible);
      button.setAttribute("aria-pressed", visible ? "true" : "false");
      container.dataset.visible = visible ? "true" : "false";
    };

    button.addEventListener("click", () => {
      const visible = map.hasLayer(layer);
      if (visible) map.removeLayer(layer);
      else layer.addTo(map);
      storeVisibility(!visible);
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
