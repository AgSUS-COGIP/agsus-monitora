/*
  Um Leaflet falso para o jsdom (que não tem layout nem SVG de verdade): guarda
  os mapas, as camadas e as chamadas para o teste conferir, e projeta latlng em
  pixels com uma conta simples (10 px por grau).
*/

function emissor(alvo) {
  const ouvintes = new Map();
  alvo.on = (eventos, fn) => {
    for (const e of String(eventos).split(/\s+/)) {
      if (!ouvintes.has(e)) ouvintes.set(e, new Set());
      ouvintes.get(e).add(fn);
    }
    return alvo;
  };
  alvo.off = (eventos, fn) => {
    for (const e of String(eventos).split(/\s+/)) ouvintes.get(e)?.delete(fn);
    return alvo;
  };
  alvo.fire = (evento, dados = {}) => {
    for (const fn of [...(ouvintes.get(evento) || [])])
      fn({ type: evento, ...dados });
    return alvo;
  };
  alvo.ouvintes = (evento) => ouvintes.get(evento)?.size || 0;
  return alvo;
}

const ponto = (x, y) => ({
  x,
  y,
  add: (outro) => ponto(x + outro.x, y + outro.y),
});

function camada(tipo, latlng, opcoes = {}) {
  const c = emissor({ tipo, latlng, opcoes, mapa: null });
  c.addTo = (alvo) => {
    alvo.addLayer(c);
    return c;
  };
  c.bindTooltip = (conteudo, opcoesDaDica) => {
    c.dica = conteudo;
    c.opcoesDaDica = opcoesDaDica;
    return c;
  };
  c.bindPopup = (conteudo, opcoesDoPopup) => {
    c.popup = conteudo;
    c.opcoesDoPopup = opcoesDoPopup;
    return c;
  };
  c.closeTooltip = () => c;
  c.openPopup = () => {
    c.popupAberto = true;
    return c;
  };
  c.isPopupOpen = () => Boolean(c.popupAberto);
  c.setLatLng = (novo) => {
    c.latlng = novo;
    return c;
  };
  c.bringToFront = () => c;
  return c;
}

function grupo() {
  const g = camada("grupo");
  g.camadas = new Set();
  g.addLayer = (filha) => {
    g.camadas.add(filha);
    return g;
  };
  g.removeLayer = (filha) => {
    g.camadas.delete(filha);
    return g;
  };
  g.hasLayer = (filha) => g.camadas.has(filha);
  g.clearLayers = () => {
    g.camadas.clear();
    return g;
  };
  g.getLayers = () => [...g.camadas];
  return g;
}

export function criarLeafletFalso({ aoCriarMapa } = {}) {
  const mapas = [];

  function map(elemento, opcoes) {
    if (elemento._leaflet_id)
      throw new Error("Map container is already initialized.");
    elemento._leaflet_id = mapas.length + 1;
    const m = emissor({
      elemento,
      opcoes,
      removido: false,
      chamadas: [],
      zoom: 5,
      camadas: new Set(),
    });
    const registrar =
      (nome, efeito) =>
      (...args) => {
        m.chamadas.push([nome, ...args]);
        efeito?.(...args);
        return m;
      };
    m.fitBounds = registrar("fitBounds");
    m.setView = registrar("setView", (_c, z) => {
      if (Number.isFinite(z)) m.zoom = z;
    });
    m.flyTo = registrar("flyTo", (_c, z) => {
      if (Number.isFinite(z)) m.zoom = z;
    });
    m.flyToBounds = registrar("flyToBounds");
    m.panInside = registrar("panInside");
    m.stop = registrar("stop");
    m.invalidateSize = registrar("invalidateSize");
    m.getZoom = () => m.zoom;
    // Centro fixo (o meio do Brasil): o editor põe ali o pin de um lugar sem coordenada.
    m.getCenter = () => [-15, -50];
    m.getContainer = () => elemento;
    m.addLayer = (c) => {
      m.camadas.add(c);
      c.mapa = m;
      return m;
    };
    m.removeLayer = (c) => {
      m.camadas.delete(c);
      return m;
    };
    m.hasLayer = (c) => m.camadas.has(c);
    m.latLngToLayerPoint = ([lat, lon]) => ponto(lon * 10, -lat * 10);
    m.layerPointToLatLng = (p) => [-p.y / 10, p.x / 10];
    m.remove = () => {
      m.removido = true;
      m.fire("unload");
      delete elemento._leaflet_id;
      return m;
    };
    mapas.push(m);
    aoCriarMapa?.(m);
    return m;
  }

  const L = {
    map,
    layerGroup: grupo,
    circleMarker: (latlng, opcoes) => camada("circleMarker", latlng, opcoes),
    marker: (latlng, opcoes) => camada("marker", latlng, opcoes),
    polyline: (pontos, opcoes) => camada("polyline", pontos, opcoes),
    geoJSON: (dados, opcoes) => camada("geoJSON", dados, opcoes),
    tileLayer: (url, opcoes) => camada("tileLayer", url, opcoes),
    divIcon: (opcoes) => ({ ...opcoes }),
    point: ponto,
    latLngBounds: (a, b) => ({
      pontos: b ? [a, b] : a,
      isValid: () => true,
    }),
  };

  /* As camadas filhas (desenhadas) de todos os grupos de um mapa. */
  const desenhadas = (m, tipo) =>
    [...m.camadas]
      .flatMap((c) => (c.tipo === "grupo" ? c.getLayers() : [c]))
      .filter((c) => !tipo || c.tipo === tipo);

  return {
    L,
    mapas,
    vivos: () => mapas.filter((m) => !m.removido),
    desenhadas,
  };
}
