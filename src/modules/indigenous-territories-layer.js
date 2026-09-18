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

/*
  Acima disto o mapa deixa de ganhar com os rótulos e passa a perder: nomes
  sobrepostos escondem o traçado das próprias terras e as unidades de saúde.
  Numa vista de DSEI as terras cabem bem abaixo do limite; numa vista ampla do
  Amazonas não cabem, e aí o nome volta a ser só no ponteiro.
*/
const LIMITE_DE_ROTULOS_NO_MAPA = 40;

let installed = false;
let dseiFeaturesPromise = null;

export function isHealthMapElementId(value) {
  const id = typeof value === "string" ? value : String(value?.id || "");
  return id === "map" || id === "detailMap";
}

/*
  `terrai_nome` é o nome que a Funai publica hoje em `Funai:tis_poligonais`.
  Consultado o DescribeFeatureType do GeoServer, os atributos são: gid,
  terrai_codigo, terrai_nome, etnia_nome, municipio_nome, uf_sigla,
  superficie_perimetro_ha, fase_ti, modalidade_ti, reestudo_ti, cr,
  faixa_fronteira, undadm_codigo, undadm_nome, undadm_sigla, the_geom,
  dominio_uniao, data_atualizacao, epsg.

  A lista abaixo começava em `terrai_nom` — sem o "e" final, como o shapefile
  trunca — e nenhum dos outros nomes existe na camada. O resultado era string
  vazia para todo polígono, e o tooltip da Terra Indígena nunca aparecia. Os
  nomes antigos ficam como reserva, caso a Funai republique com o esquema de
  shapefile.
*/
export function funaiFeatureName(properties = {}) {
  return String(
    properties.terrai_nome ||
      properties.terrai_nom ||
      properties.terra_nome ||
      properties.ti_nome ||
      properties.nome ||
      properties.name ||
      "",
  ).trim();
}

/*
  Quem olha o mapa do DSEI quer saber que povos ele atende — não o nome
  cartorial do polígono. A Funai declara isso em `etnia_nome`, num só campo de
  texto e com separador inconsistente: "Pataxó, Pataxo Há-Há-Há" numa linha,
  "Guaraní e Kaingang e Xetá" noutra. Os dois casos são reais e foram vistos na
  camada publicada.

  Nada é inferido: se o campo vier vazio, a lista vem vazia e o mapa não afirma
  povo nenhum.
*/
export function povosDaTerraIndigena(properties = {}) {
  const bruto = String(
    properties.etnia_nome || properties.etnias || properties.etnia || "",
  );

  const vistos = new Set();
  const povos = [];
  for (const parte of bruto.split(/\s*(?:,|;|\/|\se\s)\s*/i)) {
    const nome = parte.trim();
    if (!nome) continue;
    const chave = nome.toLocaleLowerCase("pt-BR");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    povos.push(nome);
  }
  return povos;
}

const escaparHtml = (valor) =>
  String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/*
  O povo vem primeiro e em destaque; a Terra Indígena, que é o recorte
  fundiário, vem abaixo. Sem `etnia_nome` o polígono continua identificado pelo
  nome da terra — é melhor do que não dizer nada, e não inventa atendimento.
*/
export function tooltipDaTerraIndigena(properties = {}) {
  const povos = povosDaTerraIndigena(properties);
  const nome = funaiFeatureName(properties);
  const uf = String(properties?.uf_sigla || "").trim();

  const linhas = [];
  if (povos.length) {
    linhas.push(
      `<b>${escaparHtml(povos.length === 1 ? "Povo" : "Povos")}: ${escaparHtml(povos.join(", "))}</b>`,
    );
  }
  if (nome) {
    linhas.push(
      `${povos.length ? "" : "<b>"}Terra Indígena ${escaparHtml(nome)}${povos.length ? "" : "</b>"}`,
    );
  }
  if (uf) linhas.push(escaparHtml(uf));

  return linhas.join("<br>");
}

/*
  O rótulo desenhado sobre o polígono, ao contrário do tooltip, compete por
  espaço com tudo o resto no mapa. Leva o povo — que é o que se quer ver — e
  cala o resto. Com muitos povos na mesma terra, dois e a contagem do que
  sobra; escrever cinco nomes numa linha ocuparia meio estado.
*/
export function rotuloDaTerraIndigena(properties = {}) {
  const povos = povosDaTerraIndigena(properties);
  if (!povos.length) return funaiFeatureName(properties);
  if (povos.length <= 2) return povos.join(", ");
  return `${povos.slice(0, 2).join(", ")} +${povos.length - 2}`;
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
    Os rótulos ficam acima do traçado das terras e abaixo dos marcadores das
    unidades — o painel do MONITORA é de saúde, e um nome de povo não pode
    tapar um polo base. Sem eventos de ponteiro: o rótulo não intercepta nem o
    clique no marcador nem o hover no polígono que ele cobre.
  */
  const rotulosPaneName = "agsus-indigenous-territories-labels";
  const rotulosPane =
    map.getPane?.(rotulosPaneName) || map.createPane?.(rotulosPaneName);
  if (rotulosPane?.style) {
    rotulosPane.style.zIndex = "256";
    rotulosPane.style.pointerEvents = "none";
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
    // Abaixo do zoom 7 este raster é a única representação das terras. Em 0.34
    // ele lia-se como sombra do mapa base; acompanha o destaque do vetorial.
    opacity: 0.52,
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
      const texto = tooltipDaTerraIndigena(feature?.properties);
      if (!texto) return;
      layer.bindTooltip(texto, {
        sticky: true,
        direction: "top",
        className: "agsus-ti-tooltip",
      });
    },
  });
  map.__agsusIndigenousTerritoriesVectorLayer = vectorLayer;

  const rotulosLayer = L.layerGroup([], { pane: rotulosPaneName });
  map.__agsusIndigenousTerritoriesLabelsLayer = rotulosLayer;
  const limparRotulos = () => {
    rotulosLayer.clearLayers();
    if (map.hasLayer(rotulosLayer)) map.removeLayer(rotulosLayer);
  };

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
    limparRotulos();
  };

  /*
    O rótulo não vai como tooltip do polígono: o polígono já usa o seu tooltip
    para o detalhe no ponteiro, e um layer do Leaflet só tem um. Vai como
    marcador sem interação, no centro da caixa da terra, numa camada própria
    acima do traçado e abaixo das unidades de saúde.
  */
  const desenharRotulos = (quantidade) => {
    limparRotulos();
    if (quantidade > LIMITE_DE_ROTULOS_NO_MAPA) return;

    vectorLayer.eachLayer?.((camada) => {
      const texto = rotuloDaTerraIndigena(camada?.feature?.properties);
      if (!texto) return;
      const centro = camada.getBounds?.()?.getCenter?.();
      if (!centro) return;
      rotulosLayer.addLayer(
        L.marker(centro, {
          pane: rotulosPaneName,
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "agsus-ti-rotulo",
            html: `<span class="agsus-ti-rotulo__texto">${escaparHtml(texto)}</span>`,
            iconSize: [0, 0],
          }),
        }),
      );
    });

    if (!map.hasLayer(rotulosLayer)) rotulosLayer.addTo(map);
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
      desenharRotulos(geojson.features.length);
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
  addControl(L, map, rasterLayer, vectorLayer, desired, scheduleRefresh, () => {
    limparRotulos();
    lastViewportKey = "";
  });
}

/*
  DESTAQUE DAS TERRAS INDÍGENAS

  O preenchimento era 0.08 sobre o mapa base. O polígono estava lá e era
  desenhado, mas na prática desaparecia contra o relevo e as áreas verdes do
  próprio mapa — quem abria um DSEI não via terra indígena nenhuma.

  Sobre o mapa comum o preenchimento sobe para 0.26 e o traço engrossa: a
  terra passa a ler-se como área, não como risco. Sobre satélite continua
  contido, em 0.16 — ali o preenchimento tapa a imagem, que é justamente o que
  se foi ver, e o traço tracejado já separa o polígono do terreno.

  Nada disto cobre os marcadores das unidades: as terras ficam no z-index 255 e
  os marcadores do Leaflet em 600.
*/
function vectorStyle(map) {
  const satellite = map?.__agsusBaseMapMode === "satellite";
  return {
    color: satellite ? "#ff4d3d" : "#0b6b5f",
    weight: satellite ? 2.6 : 2.4,
    opacity: 1,
    dashArray: satellite ? "5 4" : null,
    fillColor: satellite ? "#ef4444" : "#14b8a6",
    fillOpacity: satellite ? 0.16 : 0.26,
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
  aoOcultar,
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
      /*
        `aoOcultar` também zera a chave do último enquadramento. Sem isso,
        reativar a camada sem mexer no mapa caía no atalho de "mesmo
        enquadramento, nada a fazer" do `refreshVector`: o botão acendia e os
        polígonos não voltavam até alguém arrastar o mapa.
      */
      aoOcultar?.();
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
