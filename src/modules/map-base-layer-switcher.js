import { envolverFabricaDoLeaflet } from "../lib/fabrica-do-leaflet.js";
import { AVISO_DO_SATELITE, tetoDoSatelite } from "../lib/mapa-vetorial.js";
import {
  azulejoDoRecuo,
  podeRecuar,
  semAzulejoDeAviso,
} from "../lib/recuo-de-azulejo.js";
import { carregarMaplibre, criarCamadaVetorial } from "./mapa-vetorial.js";

const STORAGE_KEY = "agsus_map_base_layer_v1";
const MODE_MAP = "map";
const MODE_SATELLITE = "satellite";
// A camada vetorial não é "map" de propósito: o raster do OSM continua a ser o
// fundo "map" guardado, para onde se volta se o vetorial falhar.
const KIND_VETORIAL = "vetorial";
const SATELLITE_ERROR_LIMIT = 4;

/*
  O SATÉLITE COM NOMES — o "híbrido" do Google

  Duas camadas de referência da Esri, transparentes, por cima da foto: os
  nomes de lugares e as ruas. Os lugares existem até ao zoom 19 em todo o lado;
  as ruas, em Canarana, só até ao 17 — por isso também elas recuam.
*/
const ROTULOS_DE_LUGARES_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const ROTULOS_DE_RUAS_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}";
const PAINEL_DOS_ROTULOS = "agsus-rotulos-do-satelite";

// Faixa pedida para o workspace cartográfico:
// - zoom 4.5: limite de afastamento nacional, régua na faixa de 500 km;
// - zoom 19: aproximação na faixa de dezenas de metros.
export const MAP_MIN_ZOOM = 4.5;
export const MAP_MAX_ZOOM = 19;
const SATELLITE_MAX_NATIVE_ZOOM = 19;

const SATELLITE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_ATTRIBUTION =
  "Tiles © Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

const CARTOGRAPHIC_HOSTS = ["tile.openstreetmap.org", "basemaps.cartocdn.com"];

let installed = false;

export function addResilientBaseLayer(L, map) {
  enhanceMap(L, map);
  const layer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: MAP_MAX_ZOOM,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    crossOrigin: true,
    updateWhenIdle: false,
    keepBuffer: 3,
  });
  layer.__agsusBaseMapKind = MODE_MAP;
  let errors = 0;
  layer.on("tileload", () => {
    if (!map.hasLayer(layer)) return;
    errors = 0;
    map.__agsusFailedBaseModes.delete(MODE_MAP);
  });
  layer.on("tileerror", () => {
    if (!map.hasLayer(layer) || map.__agsusBaseMapMode !== MODE_MAP) return;
    errors += 1;
    if (errors < SATELLITE_ERROR_LIMIT) return;
    map.__agsusFailedBaseModes.add(MODE_MAP);
    if (!map.__agsusFailedBaseModes.has(MODE_SATELLITE)) {
      setBaseMapMode(L, map, MODE_SATELLITE);
    }
  });
  return layer.addTo(map);
}

export function installMapBaseLayerSwitcher() {
  if (installed) return true;

  const L = window.L;
  if (!L?.map || !L.tileLayer || !L.control || !L.DomUtil || !L.DomEvent)
    return false;
  if (L.__agsusBaseLayerSwitcherInstalled) {
    installed = true;
    return true;
  }

  const guardedTileLayer = L.tileLayer;
  // `envolverFabricaDoLeaflet` preserva o que está pendurado na fábrica —
  // nomeadamente `L.tileLayer.wms`. Ver `src/lib/fabrica-do-leaflet.js`.
  L.tileLayer = envolverFabricaDoLeaflet(
    guardedTileLayer,
    function agsusTaggedTileLayer(urlTemplate, options = {}) {
      const kind = classifyBaseLayerUrl(urlTemplate);
      const tileOptions = normalizeTileZoomOptions(kind, options);
      const layer = guardedTileLayer.call(this, urlTemplate, tileOptions);
      layer.__agsusTileUrlTemplate = String(urlTemplate || "");
      layer.__agsusBaseMapKind = kind;
      return layer;
    },
  );

  const guardedMap = L.map;
  L.map = function agsusMapWithBaseLayerSwitcher(element, options = {}) {
    const map = guardedMap.call(
      this,
      element,
      normalizeMapZoomOptions(element, options),
    );
    enforceMapZoomRange(map, element);
    enhanceMap(L, map);
    return map;
  };

  L.__agsusBaseLayerSwitcherInstalled = true;
  installed = true;
  return true;
}

function healthMapElementId(element) {
  if (typeof element === "string") return element;
  return String(element?.id || "");
}

function isHealthMapElement(element) {
  const id = healthMapElementId(element);
  return id === "map" || id === "detailMap";
}

export function normalizeMapZoomOptions(element, options = {}) {
  if (!isHealthMapElement(element)) return { ...options };
  return {
    ...options,
    minZoom: MAP_MIN_ZOOM,
    maxZoom: MAP_MAX_ZOOM,
  };
}

function enforceMapZoomRange(map, element) {
  if (!map || !isHealthMapElement(element)) return;
  map.setMinZoom?.(MAP_MIN_ZOOM);
  map.setMaxZoom?.(MAP_MAX_ZOOM);
}

function normalizeTileZoomOptions(kind, options = {}) {
  if (!kind) return { ...options };

  const nativeZoom = Number(options.maxNativeZoom ?? options.maxZoom);
  const normalized = {
    ...options,
    maxZoom: MAP_MAX_ZOOM,
  };

  // O OSM usado pelo legado entrega tiles nativos até 18. No nível 19 o Leaflet
  // pode ampliar o último tile nativo em vez de deixar o fundo vazio.
  if (
    Number.isFinite(nativeZoom) &&
    nativeZoom > 0 &&
    nativeZoom < MAP_MAX_ZOOM
  ) {
    normalized.maxNativeZoom = nativeZoom;
  }

  return normalized;
}

export function classifyBaseLayerUrl(urlTemplate) {
  const url = String(urlTemplate || "").toLowerCase();
  if (url.includes("world_imagery/mapserver")) return MODE_SATELLITE;
  if (CARTOGRAPHIC_HOSTS.some((host) => url.includes(host))) return MODE_MAP;
  return null;
}

function enhanceMap(L, map) {
  if (!map || map.__agsusBaseLayerSwitcherReady) return;
  map.__agsusBaseLayerSwitcherReady = true;
  map.__agsusBaseMapMode = MODE_MAP;
  map.__agsusDesiredBaseMapMode = readStoredMode();
  map.__agsusStoredMapLayers = [];
  map.__agsusSatelliteLayer = null;
  map.__agsusSatelliteErrors = 0;
  map.__agsusFailedBaseModes = new Set();
  map.__agsusSwitchingBaseLayer = false;

  map.on("layeradd", (event) => {
    const layer = event?.layer;
    if (!layer || map.__agsusSwitchingBaseLayer) return;

    if (layer.__agsusBaseMapKind === MODE_MAP) {
      rememberMapLayer(map, layer);
      if (map.__agsusDesiredBaseMapMode === MODE_SATELLITE) {
        queueMicrotask(() => setBaseMapMode(L, map, MODE_SATELLITE));
      } else if (vetorialPronto(map)) {
        // O raster fica guardado como reserva; com o vetorial à vista, sai.
        queueMicrotask(() => aplicarFundoDoMapa(map));
      }
    }
  });

  addSwitcherControl(L, map);
  map.on("moveend", () => talvezSoltarTetoAoArrastar(map));

  map.whenReady(() => {
    queueMicrotask(() => {
      findLayers(map, MODE_MAP).forEach((layer) =>
        rememberMapLayer(map, layer),
      );
      if (map.__agsusDesiredBaseMapMode === MODE_SATELLITE) {
        setBaseMapMode(L, map, MODE_SATELLITE);
      } else {
        syncControl(map);
      }
      if (isHealthMapElement(map.getContainer?.())) iniciarMapaVetorial(L, map);
    });
  });
}

/*
  O FUNDO "MAPA" PASSA A SER VETORIAL — ver `src/lib/mapa-vetorial.js`

  O vetorial entra por baixo do raster do OSM enquanto carrega; quando o
  MapLibre avisa que desenhou (`load`), o raster sai. Assim nunca há um
  instante de mapa vazio, e se o vetorial falhar o raster nunca saiu.
*/
function vetorialPronto(map) {
  return Boolean(
    map.__agsusVectorLayer?.estaPronta?.() && !map.__agsusVectorFailed,
  );
}

function iniciarMapaVetorial(L, map) {
  if (map.__agsusVectorLayer || map.__agsusVectorFailed) return;
  carregarMaplibre()
    .then((maplibregl) => {
      const camada = criarCamadaVetorial(L, maplibregl, {
        aoFicarPronto: () => {
          if (map.__agsusBaseMapMode === MODE_MAP) aplicarFundoDoMapa(map);
        },
        aoFalhar: (erro) => {
          map.__agsusVectorFailed = true;
          console.warn(
            "Mapa vetorial indisponível; fica o OpenStreetMap em imagem.",
            erro,
          );
          if (map.__agsusBaseMapMode === MODE_MAP) aplicarFundoDoMapa(map);
        },
      });
      camada.__agsusBaseMapKind = KIND_VETORIAL;
      map.__agsusVectorLayer = camada;
      if (map.__agsusBaseMapMode === MODE_MAP) aplicarFundoDoMapa(map);
    })
    .catch((erro) => {
      map.__agsusVectorFailed = true;
      console.warn(
        "MapLibre indisponível; fica o OpenStreetMap em imagem.",
        erro,
      );
    });
}

/*
  O fundo do modo Mapa, numa função só: o vetorial se estiver pronto; o raster
  guardado enquanto não estiver, ou se tiver falhado.
*/
function aplicarFundoDoMapa(map) {
  const vetorial = map.__agsusVectorLayer;
  const jaTroca = map.__agsusSwitchingBaseLayer;
  map.__agsusSwitchingBaseLayer = true;
  try {
    if (vetorial && !map.__agsusVectorFailed) {
      if (!map.hasLayer(vetorial)) vetorial.addTo(map);
    } else if (vetorial && map.hasLayer(vetorial)) {
      map.removeLayer(vetorial);
    }
    if (vetorialPronto(map)) {
      findLayers(map, MODE_MAP).forEach((layer) => map.removeLayer(layer));
      return;
    }
    map.__agsusStoredMapLayers.forEach((layer) => {
      if (!map.hasLayer(layer)) layer.addTo(map);
    });
  } finally {
    map.__agsusSwitchingBaseLayer = jaTroca;
  }
}

function addSwitcherControl(L, map) {
  if (map.__agsusBaseLayerControl) return;

  const control = L.control({ position: "topleft" });
  control.onAdd = () => {
    const container = L.DomUtil.create(
      "div",
      "leaflet-control agsus-basemap-switcher",
    );
    container.setAttribute("role", "group");
    container.setAttribute("aria-label", "Camada de fundo do mapa");

    const mapButton = createButton(L, MODE_MAP, "Mapa");
    const satelliteButton = createButton(L, MODE_SATELLITE, "Satélite");
    container.append(mapButton, satelliteButton);

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    mapButton.addEventListener("click", () => {
      map.__agsusDesiredBaseMapMode = MODE_MAP;
      setBaseMapMode(L, map, MODE_MAP, { persist: true });
    });
    satelliteButton.addEventListener("click", () => {
      map.__agsusDesiredBaseMapMode = MODE_SATELLITE;
      setBaseMapMode(L, map, MODE_SATELLITE, { persist: true });
    });

    map.__agsusBaseLayerControlElement = container;
    syncControl(map);
    return container;
  };

  control.addTo(map);
  map.__agsusBaseLayerControl = control;
}

function createButton(L, mode, label) {
  const button = L.DomUtil.create("button", "agsus-basemap-switcher__button");
  button.type = "button";
  button.dataset.mapMode = mode;
  button.textContent = label;
  button.setAttribute("aria-pressed", "false");
  return button;
}

function setBaseMapMode(L, map, requestedMode, { persist = false } = {}) {
  const mode = requestedMode === MODE_SATELLITE ? MODE_SATELLITE : MODE_MAP;
  if (!map || map.__agsusSwitchingBaseLayer) return false;

  if (mode === MODE_SATELLITE) {
    const currentMapLayers = findLayers(map, MODE_MAP);
    currentMapLayers.forEach((layer) => rememberMapLayer(map, layer));
    if (!map.__agsusStoredMapLayers.length) return false;
  }

  map.__agsusSwitchingBaseLayer = true;
  try {
    if (mode === MODE_SATELLITE) {
      findLayers(map, MODE_MAP).forEach((layer) => map.removeLayer(layer));
      if (map.__agsusVectorLayer && map.hasLayer(map.__agsusVectorLayer)) {
        map.removeLayer(map.__agsusVectorLayer);
      }
      const satelliteLayer = getSatelliteLayer(L, map);
      if (!map.hasLayer(satelliteLayer)) satelliteLayer.addTo(map);
      satelliteLayer.bringToBack?.();
      const rotulos = getRotulosDoSatelite(L, map);
      if (!map.hasLayer(rotulos)) rotulos.addTo(map);
    } else {
      if (
        map.__agsusSatelliteLayer &&
        map.hasLayer(map.__agsusSatelliteLayer)
      ) {
        map.removeLayer(map.__agsusSatelliteLayer);
      }
      if (
        map.__agsusSatelliteLabels &&
        map.hasLayer(map.__agsusSatelliteLabels)
      ) {
        map.removeLayer(map.__agsusSatelliteLabels);
      }
      soltarTetoDoSatelite(map);
      aplicarFundoDoMapa(map);
    }

    map.__agsusBaseMapMode = mode;
    map.__agsusDesiredBaseMapMode = mode;
    if (persist) storeMode(mode);
    syncControl(map);
    dispatchModeChange(map, mode);
    return true;
  } finally {
    map.__agsusSwitchingBaseLayer = false;
  }
}

/*
  A CAMADA DE SATÉLITE QUE NÃO QUEBRA AO APROXIMAR

  Ver `src/lib/recuo-de-azulejo.js`: acima do zoom 17, nos territórios
  indígenas, a Esri não tem foto e devolvia um aviso em forma de imagem.

  O recuo tem de acontecer DENTRO do azulejo, antes de o erro chegar ao
  Leaflet: esta camada conta `tileerror` e, ao quarto, troca o satélite pelo
  mapa comum (`SATELLITE_ERROR_LIMIT`). Com `blankTile=false` cada azulejo em
  falta é um 404 — sem o recuo, aproximar no Xingu desligaria o satélite.

  Por isso cada azulejo é uma caixa com `overflow: hidden` e a imagem dentro:
  quando o nível pedido falha, a imagem passa a ser a do nível de cima,
  ampliada e deslocada até o quadrante certo. Só se o recuo inteiro falhar é
  que o erro sobe.
*/
export function criarCamadaComRecuo(L, url, options) {
  const Camada = L.TileLayer.extend({
    createTile(coords, done) {
      const tamanho = this.getTileSize();
      const caixa = document.createElement("div");
      caixa.style.overflow = "hidden";
      // O Leaflet lê `complete` para decidir se aborta o azulejo ao mudar de zoom.
      caixa.complete = false;

      const img = document.createElement("img");
      img.alt = "";
      img.setAttribute("role", "presentation");
      img.style.display = "block";
      img.style.maxWidth = "none";
      img.style.maxHeight = "none";
      if (this.options.crossOrigin || this.options.crossOrigin === "") {
        img.crossOrigin =
          this.options.crossOrigin === true ? "" : this.options.crossOrigin;
      }

      let niveis = 0;
      const pedir = () => {
        const alvo = azulejoDoRecuo(coords, niveis);
        img.style.width = `${tamanho.x * alvo.escala}px`;
        img.style.height = `${tamanho.y * alvo.escala}px`;
        img.style.transform = niveis
          ? `translate(${-alvo.dx * tamanho.x}px, ${-alvo.dy * tamanho.y}px)`
          : "";
        img.src = semAzulejoDeAviso(
          L.Util.template(
            this._url,
            L.Util.extend({ s: "" }, this.options, {
              x: alvo.x,
              y: alvo.y,
              z: alvo.z,
            }),
          ),
        );
      };

      img.onload = () => {
        caixa.complete = true;
        // Quantos níveis este azulejo teve de subir: é daí que sai o teto do zoom.
        this.__agsusRecuos.set(`${coords.x}:${coords.y}:${coords.z}`, niveis);
        done(null, caixa);
      };
      img.onerror = () => {
        if (podeRecuar(coords, niveis, this.options.minZoom ?? 0)) {
          niveis += 1;
          pedir();
          return;
        }
        caixa.complete = true;
        done(new Error("Azulejo de satélite sem imagem"), caixa);
      };

      caixa.appendChild(img);
      pedir();
      return caixa;
    },

    // O Leaflet cancela o pedido pondo `src` vazio no azulejo; aqui ele é a caixa.
    _removeTile(key) {
      this.__agsusRecuos.delete(key);
      const img = this._tiles[key]?.el?.firstChild;
      if (img?.tagName === "IMG") {
        img.onload = null;
        img.onerror = null;
        img.src = L.Util.emptyImageUrl;
      }
      return L.TileLayer.prototype._removeTile.call(this, key);
    },
  });
  const camada = new Camada(url, options);
  camada.__agsusRecuos = new Map();
  /*
    A etiqueta de tipo sai do endereço, como no `L.tileLayer` embrulhado. Sem
    isto o recurso de satélite do `legacy-app` — que passou a ser esta camada —
    deixava de ser reconhecido como satélite pelo seletor.
  */
  camada.__agsusTileUrlTemplate = String(url || "");
  camada.__agsusBaseMapKind = classifyBaseLayerUrl(url);
  return camada;
}

/*
  Os nomes por cima da foto. Num painel próprio, acima das terras indígenas e
  abaixo dos marcadores, e sem eventos de ponteiro: um nome não pode roubar o
  clique de um polo base.
*/
function getRotulosDoSatelite(L, map) {
  if (map.__agsusSatelliteLabels) return map.__agsusSatelliteLabels;
  const painel =
    map.getPane?.(PAINEL_DOS_ROTULOS) || map.createPane?.(PAINEL_DOS_ROTULOS);
  if (painel?.style) {
    painel.style.zIndex = "257";
    painel.style.pointerEvents = "none";
  }
  const comum = {
    pane: PAINEL_DOS_ROTULOS,
    maxZoom: MAP_MAX_ZOOM,
    maxNativeZoom: SATELLITE_MAX_NATIVE_ZOOM,
    crossOrigin: true,
    updateWhenIdle: false,
    keepBuffer: 2,
  };
  const grupo = L.layerGroup([
    criarCamadaComRecuo(L, ROTULOS_DE_RUAS_URL, comum),
    criarCamadaComRecuo(L, ROTULOS_DE_LUGARES_URL, comum),
  ]);
  map.__agsusSatelliteLabels = grupo;
  return grupo;
}

/*
  O TETO DO ZOOM ONDE A FOTO ACABA — ver `tetoDoSatelite`

  Depois de carregar os azulejos à vista, olha-se o menor recuo entre eles. Se
  até o melhor subiu dois níveis, não há foto mais detalhada na tela: o zoom
  máximo desce para um nível acima da foto, e um aviso diz porquê e o que
  fazer. Em Maceió há foto até 19 e nada acontece.

  O teto solta-se ao voltar para o Mapa, e ao arrastar para longe — noutro
  sítio pode haver foto melhor, e só se sabe tentando.
*/
function avaliarDetalheDoSatelite(map, layer) {
  if (map.__agsusBaseMapMode !== MODE_SATELLITE) return;
  const zoomDosAzulejos = Math.min(
    Math.round(map.getZoom()),
    SATELLITE_MAX_NATIVE_ZOOM,
  );
  const recuos = [...layer.__agsusRecuos]
    .filter(([chave]) => chave.endsWith(`:${zoomDosAzulejos}`))
    .map(([, niveis]) => niveis);
  if (!recuos.length) return;
  const teto = tetoDoSatelite(zoomDosAzulejos, Math.min(...recuos));
  if (teto == null) return;
  map.__agsusTetoDoSatelite = { zoom: teto, centro: map.getCenter() };
  map.setMaxZoom(teto);
  mostrarAvisoDoSatelite(map);
}

function soltarTetoDoSatelite(map) {
  if (!map.__agsusTetoDoSatelite) return;
  map.__agsusTetoDoSatelite = null;
  map.setMaxZoom(MAP_MAX_ZOOM);
  map.__agsusAvisoDoSatelite?.remove();
}

function talvezSoltarTetoAoArrastar(map) {
  const teto = map.__agsusTetoDoSatelite;
  if (!teto || map.__agsusBaseMapMode !== MODE_SATELLITE) return;
  const tamanho = map.getSize();
  const deslocado = map
    .latLngToContainerPoint(teto.centro)
    .distanceTo(tamanho.divideBy(2));
  if (deslocado > Math.min(tamanho.x, tamanho.y) / 2) soltarTetoDoSatelite(map);
}

function mostrarAvisoDoSatelite(map) {
  const recipiente = map.getContainer?.();
  if (!recipiente) return;
  let aviso = map.__agsusAvisoDoSatelite;
  if (!aviso) {
    aviso = recipiente.ownerDocument.createElement("div");
    aviso.className = "agsus-aviso-do-satelite";
    aviso.setAttribute("role", "status");
    aviso.textContent = AVISO_DO_SATELITE;
    map.__agsusAvisoDoSatelite = aviso;
  }
  if (!aviso.isConnected) recipiente.append(aviso);
  clearTimeout(map.__agsusRelogioDoAviso);
  map.__agsusRelogioDoAviso = setTimeout(() => aviso.remove(), 6000);
}

function getSatelliteLayer(L, map) {
  if (map.__agsusSatelliteLayer) return map.__agsusSatelliteLayer;

  const layer = criarCamadaComRecuo(L, SATELLITE_URL, {
    maxZoom: MAP_MAX_ZOOM,
    maxNativeZoom: SATELLITE_MAX_NATIVE_ZOOM,
    attribution: SATELLITE_ATTRIBUTION,
    crossOrigin: true,
    updateWhenIdle: false,
    keepBuffer: 3,
  });
  layer.__agsusBaseMapKind = MODE_SATELLITE;

  // Todos os azulejos à vista carregados: há foto mais detalhada aqui, ou não?
  layer.on("load", () => avaliarDetalheDoSatelite(map, layer));

  layer.on("tileload", () => {
    if (!map.hasLayer(layer)) return;
    map.__agsusSatelliteErrors = 0;
    map.__agsusFailedBaseModes.delete(MODE_SATELLITE);
    map.getContainer?.().classList.remove("map-satellite-fallback");
  });

  layer.on("tileerror", () => {
    if (!map.hasLayer(layer)) return;
    map.__agsusSatelliteErrors += 1;
    if (
      map.__agsusSatelliteErrors < SATELLITE_ERROR_LIMIT ||
      map.__agsusBaseMapMode !== MODE_SATELLITE
    )
      return;

    map.__agsusFailedBaseModes.add(MODE_SATELLITE);
    map.getContainer?.().classList.add("map-satellite-fallback");
    if (map.__agsusFailedBaseModes.has(MODE_MAP)) return;
    map.__agsusDesiredBaseMapMode = MODE_MAP;
    setBaseMapMode(L, map, MODE_MAP, { persist: true });
    dispatchFallback(map);
  });

  map.__agsusSatelliteLayer = layer;
  return layer;
}

function rememberMapLayer(map, layer) {
  if (!layer || layer.__agsusBaseMapKind !== MODE_MAP) return;
  if (!map.__agsusStoredMapLayers.includes(layer)) {
    map.__agsusStoredMapLayers.push(layer);
  }
}

function findLayers(map, kind) {
  const layers = [];
  map.eachLayer?.((layer) => {
    if (layer?.__agsusBaseMapKind === kind) layers.push(layer);
  });
  return layers;
}

function syncControl(map) {
  const root = map.__agsusBaseLayerControlElement;
  if (!root) return;
  root.querySelectorAll("[data-map-mode]").forEach((button) => {
    const active = button.dataset.mapMode === map.__agsusBaseMapMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function dispatchModeChange(map, mode) {
  map
    .getContainer?.()
    .classList.toggle("map-satellite-mode", mode === MODE_SATELLITE);
  map.getContainer?.().dispatchEvent(
    new CustomEvent("agsus:map-base-layer-changed", {
      bubbles: true,
      detail: { mode },
    }),
  );
}

function dispatchFallback(map) {
  map.getContainer?.().dispatchEvent(
    new CustomEvent("agsus:map-satellite-fallback", {
      bubbles: true,
      detail: { mode: MODE_MAP, reason: "tileerror" },
    }),
  );
}

function readStoredMode() {
  try {
    return localStorage.getItem(STORAGE_KEY) === MODE_SATELLITE
      ? MODE_SATELLITE
      : MODE_MAP;
  } catch {
    return MODE_MAP;
  }
}

function storeMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // A preferência é opcional; o mapa continua funcional sem storage.
  }
}
