import { BRASIL_BOUNDS, NAVEGACAO_BOUNDS } from "../lib/brasil-bounds.js";

/*
  Os limites agora vêm do contorno real do país, não de um retângulo estimado.
  Ver `src/lib/brasil-bounds.js` para a medição e para o que a diferença custava.
*/
const BRAZIL_VIEW_BOUNDS = BRASIL_BOUNDS;

// Mantém o Brasil como enquadramento inicial, mas permite navegar pelo contexto
// geográfico da América do Sul sem criar cópias laterais do mapa.
const SOUTH_AMERICA_MAX_BOUNDS = NAVEGACAO_BOUNDS;
const HEALTH_MAP_MIN_ZOOM = 4.5;
const HEALTH_MAP_OVERVIEW_MAX_ZOOM = 4.5;

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

  /*
    O recorte dos azulejos era a origem do vazio dentro do card.

    `bounds: toMaxBounds(L)` mandava o Leaflet não pedir azulejo nenhum fora de
    NAVEGACAO_BOUNDS, que tem 57.5° de longitude. Só que o enquadramento do
    Brasil é decidido pela latitude: 39.0° em 480 px dão zoom 3.75, e a esse
    zoom cabem 9.57 px por grau. Um card de 1642 px precisa então de 171.6° de
    longitude — 114° para os quais, por causa do recorte, não existia azulejo.
    Medido no protótipo: **33% da área do card tinha mapa**; os outros 67%
    eram o fundo cinzento do container.

    Era esse vazio que a regra `max-width: altura * 1.25` tentava esconder
    encolhendo o `#detailMap` — e que, ao encolher, virava faixa branca do card.

    `noWrap: true` continua a impedir as cópias laterais do mundo, que é o que
    o recorte defendia de facto. O que se perde é só o recorte do desenho; quem
    limita a navegação continua a ser o `maxBounds` do mapa, intacto logo
    abaixo.
  */
  L.tileLayer = function guardedTileLayer(urlTemplate, options = {}) {
    return originalTileLayer.call(this, urlTemplate, {
      ...options,
      noWrap: true,
      updateWhenIdle: true,
      keepBuffer: 2,
    });
  };

  /*
    A FÁBRICA DO LEAFLET NÃO É SÓ UMA FUNÇÃO.

    `L.tileLayer` carrega `L.tileLayer.wms` pendurado nela. Substituir a função
    por um invólucro sem copiar o que estava pendurado apagava o `.wms` do
    namespace — silenciosamente, porque nada aqui o usa.

    Quem usava era a camada de Terras Indígenas: `installIndigenousTerritoriesLayer`
    verifica `L.tileLayer?.wms` antes de se instalar, e devolvia false. O efeito
    era a camada inteira nunca chegar a existir em produção — sem polígono, sem
    rótulo, sem botão e sem erro no console. Foram três correções de aparência
    publicadas sobre código que não corria.

    O `.wms` é copiado tal e qual, sem invólucro: a camada WMS da Funai declara
    `updateWhenIdle: false` e `keepBuffer: 3` de propósito, e envolvê-la aqui
    sobreporia ambos.
  */
  Object.assign(L.tileLayer, originalTileLayer);

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

  map.setMaxBounds = function setGuardedMaxBounds() {
    return originalSetMaxBounds(maxBounds);
  };

  if (originalSetMinZoom) {
    map.setMinZoom = function setGuardedMinZoom(value) {
      const requested = Number(value);
      const allowed = Number.isFinite(requested)
        ? Math.max(requested, HEALTH_MAP_MIN_ZOOM)
        : HEALTH_MAP_MIN_ZOOM;
      return originalSetMinZoom(allowed);
    };
    originalSetMinZoom(HEALTH_MAP_MIN_ZOOM);
  }

  /*
    No overview, quem decide o zoom é o tamanho REAL do card. O limite fixo em 3
    deixava Brasil pequeno e desperdiçava quase metade da área útil em monitores
    largos. Depois de invalidateSize(), fitBounds pode usar até zoom 4 e ocupar o
    espaço disponível sem recortar o país. Seleções territoriais continuam livres
    para aproximar além disso.
  */
  /*
    A bandeira é gravada DEPOIS do enquadramento, e isso não é estilo.

    O `fitBounds` do Leaflet termina chamando `this.setView(...)` — que aqui é o
    `setGuardedView` logo abaixo, e que zera `__agsusOverviewMode` para detectar
    quando a pessoa move o mapa. Gravando antes, todo `fitBounds` ligava a
    bandeira e o próprio `fitBounds` a desligava em seguida: ela era **sempre**
    falsa. Com isso `emOverview()` nunca era verdadeiro, o `ResizeObserver` se
    desconectava na primeira observação e o mapa nunca voltava a enquadrar
    depois de o card mudar de largura — o Brasil ficava encostado à esquerda com
    um vazio à direita.
  */
  map.fitBounds = function fitGuardedBounds(bounds, options = {}) {
    const limited = limitBounds(L, bounds, maxBounds);
    const overview = isBrazilOverviewBounds(L, limited);
    const requestedMax = Number(options.maxZoom);
    const maxZoom = overview
      ? Math.min(
          Number.isFinite(requestedMax)
            ? requestedMax
            : HEALTH_MAP_OVERVIEW_MAX_ZOOM,
          HEALTH_MAP_OVERVIEW_MAX_ZOOM,
        )
      : Number.isFinite(requestedMax)
        ? requestedMax
        : 8;
    const resultado = originalFitBounds(limited, {
      padding: overview ? [10, 10] : [24, 24],
      animate: false,
      ...options,
      maxZoom,
    });
    map.__agsusOverviewMode = overview;
    return resultado;
  };

  if (originalFlyToBounds) {
    map.flyToBounds = function flyToGuardedBounds(bounds, options = {}) {
      const limited = limitBounds(L, bounds, maxBounds);
      const overview = isBrazilOverviewBounds(L, limited);
      /* Mesma razão do `fitBounds`: a animação termina em `setView`. */
      window.setTimeout(() => {
        map.__agsusOverviewMode = overview;
      }, 0);
      return originalFlyToBounds(limited, {
        padding: overview ? [10, 10] : [32, 32],
        duration: 0.35,
        ...options,
        maxZoom: overview
          ? Math.min(
              options.maxZoom ?? HEALTH_MAP_OVERVIEW_MAX_ZOOM,
              HEALTH_MAP_OVERVIEW_MAX_ZOOM,
            )
          : (options.maxZoom ?? 9),
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

  const fitBrazilOverview = () => {
    try {
      map.invalidateSize({ animate: false, pan: false });
      originalFitBounds(viewBounds, {
        padding: [10, 10],
        maxZoom: HEALTH_MAP_OVERVIEW_MAX_ZOOM,
        animate: false,
      });
      /* Depois do fit, pela mesma razão explicada em `fitGuardedBounds`. */
      map.__agsusOverviewMode = true;
    } catch (error) {
      console.warn("Nao foi possivel reenquadrar o Brasil:", error);
    }
  };

  /*
    Um dono só para o enquadramento inicial.

    Antes havia disparos a esmo: um em `whenReady`, outro em 120 ms, outro em
    420 ms, mais o `resize`. Nenhum sabia se o card já tinha chegado ao tamanho
    final — os prazos eram chutes, e quando o card demorava mais que 420 ms o
    mapa ficava enquadrado para uma medida que já não existia.

    Quem sabe o tamanho final é o próprio elemento. O `ResizeObserver` observa o
    container e reenquadra quando as medidas param de mudar; enquanto estiver em
    overview e ninguém tiver aproximado, o enquadramento acompanha. Ao primeiro
    gesto de zoom da pessoa, `__agsusOverviewMode` cai e o observador se cala.
  */
  map.whenReady(() => {
    originalSetMaxBounds(maxBounds);
    originalSetMinZoom?.(HEALTH_MAP_MIN_ZOOM);
    fitBrazilOverview();
    ensureFullManualZoomRange(map);
    addScaleControl(L, map);
    stabilizeMap(map, maxBounds);
    observarTamanhoDoCard(map, fitBrazilOverview);
  });

  // Se o card muda de tamanho ainda em overview, recalcula com o tamanho final.
  // Se a pessoa já aproximou o mapa, o enquadramento manual é preservado.
  map.on("resize", () => {
    stabilizeMap(map, maxBounds);
    if (!emOverview(map)) return;
    window.requestAnimationFrame(fitBrazilOverview);
  });
  map.on("drag move zoomend moveend layeradd", () =>
    stabilizeMap(map, maxBounds),
  );
}

/*
  Overview é estado derivado, não guardado: a bandeira sozinha mentiria depois de
  um zoom por pinça, que não passa por `setView` nem por `flyTo`. O zoom corrente
  é a prova.
*/
function emOverview(map) {
  return (
    Boolean(map.__agsusOverviewMode) &&
    Number(map.getZoom?.() ?? 0) <= HEALTH_MAP_OVERVIEW_MAX_ZOOM
  );
}

function observarTamanhoDoCard(map, reenquadrar) {
  const container = map.getContainer?.();
  if (!container || typeof ResizeObserver === "undefined") return;

  let ultimaLargura = 0;
  let ultimaAltura = 0;
  let pendente = 0;

  const observador = new ResizeObserver((entradas) => {
    const caixa = entradas[entradas.length - 1]?.contentRect;
    if (!caixa || caixa.width === 0 || caixa.height === 0) return;
    if (caixa.width === ultimaLargura && caixa.height === ultimaAltura) return;
    ultimaLargura = caixa.width;
    ultimaAltura = caixa.height;

    if (!emOverview(map)) {
      observador.disconnect();
      return;
    }

    // Reenquadra só depois de as medidas assentarem, para não fazer o trabalho
    // uma vez por quadro durante uma animação de layout.
    window.clearTimeout(pendente);
    pendente = window.setTimeout(reenquadrar, 60);
  });

  observador.observe(container);
  map.__agsusResizeObserver = observador;
  map.on("unload", () => {
    window.clearTimeout(pendente);
    observador.disconnect();
  });
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
        padding: [10, 10],
        maxZoom: HEALTH_MAP_OVERVIEW_MAX_ZOOM,
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
