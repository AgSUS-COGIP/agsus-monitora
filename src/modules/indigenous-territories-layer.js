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

/*
  TERRAS PEQUENAS DEMAIS PARA SEREM VISTAS

  Aumentar o preenchimento resolvia terras grandes. No DSEI Alagoas e Sergipe
  não resolvia nada, e a razão é aritmética: no zoom em que cabe o distrito
  inteiro, 1 pixel vale 600 metros. Medidas as 21 terras desse enquadramento,
  a maior — Pankararé, 25,6 km — dá 43 px, e a menor — uma das Xucuru-Kariri,
  800 m — dá 1,4 px. Catorze das 21 ficam abaixo de 20 px. Nenhuma opacidade
  faz uma mancha de três pixels ler-se como área.

  Abaixo deste limiar a terra ganha um símbolo de posição no centro. É prática
  cartográfica corrente: à escala pequena, a área vira ponto. O símbolo diz
  onde a terra está; a partir daí o zoom mostra o limite verdadeiro, e o
  tooltip avisa que o círculo não é o limite — para ninguém o ler como tal.
*/
const SIMBOLO_ABAIXO_DE_PX = 20;
const RAIO_DO_SIMBOLO_PX = 8;

export const AVISO_DO_SIMBOLO =
  "<i>Área pequena nesta escala — o círculo marca a posição, não o limite</i>";

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
  Quanto ocupa a terra no ecrã, em pixels, na sua maior dimensão. `projetar`
  é a projeção do mapa; separá-la daqui é o que torna isto verificável sem
  Leaflet nem navegador.
*/
export function tamanhoNaTelaEmPixels(limites, projetar) {
  const ne = projetar(limites.getNorthEast());
  const sw = projetar(limites.getSouthWest());
  if (![ne?.x, ne?.y, sw?.x, sw?.y].every(Number.isFinite)) return 0;
  return Math.max(Math.abs(ne.x - sw.x), Math.abs(ne.y - sw.y));
}

export function terraPrecisaDeSimbolo(tamanhoEmPixels) {
  return Number(tamanhoEmPixels) < SIMBOLO_ABAIXO_DE_PX;
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

/*
  QUE TERRAS SÃO DESTE DSEI

  O mapa do DSEI Bahia mostrava Xerente, Ava-Canoeiro e Xacriabá. Nenhuma é da
  Bahia: a camada pedia à Funai tudo o que cabia no enquadramento e desenhava
  tudo, sem perguntar se o distrito aberto tinha alguma relação com aquilo.
  Quem abria um DSEI via o vizinho junto.

  O CAMINHO QUE NÃO EXISTE MAIS

  O natural seria cruzar com a abrangência oficial do DSEI. A Funai deixou de
  publicá-la: o GetCapabilities do GeoServer lista hoje `tis_poligonais`,
  `tis_pontos`, `tis_cr`, `aldeias_pontos` e mais três — nenhuma de DSEI. O
  pedido a `Funai:areas_dsei` responde "Feature type unknown", e é por isso que
  `/api/funai-geodata?dataset=dsei` devolve 502 em produção.

  O QUE SE USA EM VEZ DISSO, E QUANTO ISSO VALE

  As unidades de saúde do próprio distrito, que o MONITORA já conhece. Uma
  terra é deste DSEI se ele tem unidade dentro dela, ou unidade perto dela.

  A primeira metade é observação. A segunda é inferência, e foi medida antes de
  ser usada: das 665 terras do país, 239 têm alguma unidade dentro; em 227
  delas — 95% — a unidade mais próxima do centro da terra é do mesmo DSEI que
  tem unidade lá dentro. É essa concordância que autoriza a segunda regra a
  estender a primeira.

  O raio é 50 km. A distância de uma terra à unidade mais próxima tem mediana
  de 17 km e terceiro quartil de 40 km; 50 km cobre a folga sem puxar terras
  do distrito vizinho. Xerente fica a mais de 500 km de qualquer unidade da
  Bahia, e sai.

  Isto é atribuição inferida, não cadastro. Se a Funai voltar a publicar a
  abrangência, é esta função que deve ser substituída por ela.
*/
export const RAIO_DE_ATENDIMENTO_KM = 50;

const RAIO_DA_TERRA_KM = 6371;

function distanciaEmKm(latA, lonA, latB, lonB) {
  const rad = (grau) => (grau * Math.PI) / 180;
  const dLat = rad(latB - latA);
  const dLon = rad(lonB - lonA);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(latA)) * Math.cos(rad(latB)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_DA_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function caixaDeCoordenadas(poligonos) {
  let oeste = 180;
  let leste = -180;
  let sul = 90;
  let norte = -90;
  for (const poligono of poligonos || []) {
    for (const [x, y] of poligono[0] || []) {
      if (x < oeste) oeste = x;
      if (x > leste) leste = x;
      if (y < sul) sul = y;
      if (y > norte) norte = y;
    }
  }
  return { oeste, leste, sul, norte };
}

export function poligonosDaFeature(feature) {
  const tipo = feature?.geometry?.type;
  if (tipo === "Polygon") return [feature.geometry.coordinates];
  if (tipo === "MultiPolygon") return feature.geometry.coordinates;
  return [];
}

function pontoEmAnel(ponto, anel) {
  const [x, y] = ponto;
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

export function pontoEmPoligonos(ponto, poligonos) {
  return (poligonos || []).some(
    (poligono) =>
      pontoEmAnel(ponto, poligono[0] || []) &&
      !poligono.slice(1).some((buraco) => pontoEmAnel(ponto, buraco)),
  );
}

export function terraPertenceAoDsei(
  terra,
  unidadesDoDsei,
  ufsDoDsei = [],
  raioKm = RAIO_DE_ATENDIMENTO_KM,
) {
  const unidades = (unidadesDoDsei || []).filter(
    (u) => Number.isFinite(Number(u?.lat)) && Number.isFinite(Number(u?.lon)),
  );
  // Sem unidades não se filtra: é a visão nacional, ou um distrito sem dados.
  if (!unidades.length) return true;

  const poligonos = poligonosDaFeature(terra);
  if (!poligonos.length) return false;

  /*
    A UF É UM SEGUNDO CRIVO, E SEM ELE O RAIO VAZA.

    O raio de 50 km em volta de cada unidade não conhece fronteira. No DSEI
    Bahia entravam 8 terras de outros estados, puxadas por unidades do São
    Francisco que estão mesmo a menos de 50 km de terras de Pernambuco. Medido
    sobre os dados reais: 41 terras estranhas, em 16 distritos.

    O distrito declara as UFs que atende, e a Funai declara a UF de cada terra.
    Quando os dois dizem, e não se cruzam, a terra não é daqui — por mais perto
    que esteja. Uma terra que atravessa estados traz as duas siglas
    ("AM,PA" e mais treze combinações na camada), e basta uma bater.

    Sem UF declarada de um dos lados, o crivo não se aplica: ausência de dado
    não é motivo para esconder.
  */
  const ufs = new Set(
    (ufsDoDsei || [])
      .map((u) =>
        String(u || "")
          .trim()
          .toUpperCase(),
      )
      .filter(Boolean),
  );
  if (ufs.size) {
    const daTerra = String(terra?.properties?.uf_sigla || "")
      .toUpperCase()
      .split(/[^A-Z]+/)
      .filter(Boolean);
    if (daTerra.length && !daTerra.some((u) => ufs.has(u))) return false;
  }

  const caixa = caixaDeCoordenadas(poligonos);
  // Um grau de latitude são cerca de 111 km; a folga em graus sobredimensiona
  // de propósito, porque a caixa só serve para descartar o que está longe.
  const folga = raioKm / 111;

  for (const unidade of unidades) {
    const lat = Number(unidade.lat);
    const lon = Number(unidade.lon);
    if (
      lon < caixa.oeste - folga ||
      lon > caixa.leste + folga ||
      lat < caixa.sul - folga ||
      lat > caixa.norte + folga
    ) {
      continue;
    }
    if (pontoEmPoligonos([lon, lat], poligonos)) return true;
    if (
      distanciaEmKm(
        lat,
        lon,
        (caixa.sul + caixa.norte) / 2,
        (caixa.oeste + caixa.leste) / 2,
      ) <= raioKm
    ) {
      return true;
    }
  }
  return false;
}

/*
  Rótulos que não se pisam.

  No DSEI Bahia os nomes saíam uns por cima dos outros — "Tuxá", "Pankarú" e
  "Kiriri" sobrepostos no mesmo punhado de pixels, ilegíveis os três. A terra
  maior fica com o rótulo; as que caem perto demais dele ficam sem, e continuam
  a ter o nome no ponteiro.

  Trabalha em pixels de ecrã porque é isso que decide a leitura, e recebe as
  posições já projetadas para poder ser verificada sem mapa nenhum.
*/
export const DISTANCIA_MINIMA_ENTRE_ROTULOS_PX = 64;

export function rotulosSemColisao(
  candidatos,
  distanciaMinima = DISTANCIA_MINIMA_ENTRE_ROTULOS_PX,
) {
  const aceites = [];
  const ordenados = [...(candidatos || [])].sort(
    (a, b) => (b.peso ?? 0) - (a.peso ?? 0),
  );
  for (const candidato of ordenados) {
    const { x, y } = candidato;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const colide = aceites.some(
      (aceite) => Math.hypot(aceite.x - x, aceite.y - y) < distanciaMinima,
    );
    if (!colide) aceites.push(candidato);
  }
  return aceites;
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

  const simbolosLayer = L.layerGroup([], { pane: vectorPaneName });
  map.__agsusIndigenousTerritoriesSymbolsLayer = simbolosLayer;

  const limparRotulos = () => {
    rotulosLayer.clearLayers();
    if (map.hasLayer(rotulosLayer)) map.removeLayer(rotulosLayer);
    simbolosLayer.clearLayers();
    if (map.hasLayer(simbolosLayer)) map.removeLayer(simbolosLayer);
  };

  let selectedDsei = "";
  let dseiGeojson = null;
  let unidadesDoDsei = [];
  let ufsDoDsei = [];
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

  /*
    `unidades` são os pontos de saúde do distrito aberto — polos, UBSI, CASAI.
    É com eles que se decide que Terras Indígenas pertencem a este DSEI, já que
    a Funai deixou de publicar a abrangência. Quem chama passa o que já tem em
    mãos; sem lista, não se filtra nada.
  */
  map.__agsusSetDseiCoverage = (name = "", unidades = [], ufs = []) => {
    selectedDsei = String(name || "").trim();
    unidadesDoDsei = selectedDsei && Array.isArray(unidades) ? unidades : [];
    ufsDoDsei = selectedDsei && Array.isArray(ufs) ? ufs : [];
    // O enquadramento não mudou, mas o conjunto de terras a mostrar mudou.
    lastViewportKey = "";
    if (!selectedDsei) map.__agsusDseiCoverageBounds = null;
    if (dseiGeojson) renderDseiCoverage();
    else void ensureDseiCoverage();
    scheduleRefresh();
  };

  if (mapElementId === "map") map.whenReady?.(() => void ensureDseiCoverage());

  let requestController = null;
  let refreshTimer = 0;
  let lastViewportKey = "";

  const visible = () => map.__agsusIndigenousTerritoriesVisible !== false;

  const useRasterFallback = () => {
    if (!visible()) return;
    /*
      O raster da Funai é uma imagem do país inteiro: não sabe o que é deste
      distrito e o que é do vizinho. Com um DSEI aberto ele desfaria o filtro
      que acabámos de aplicar às terras, e voltaria a pintar Xerente no mapa da
      Bahia. Antes nada: a ausência é honesta, a imagem errada não.
    */
    if (unidadesDoDsei.length) {
      if (map.hasLayer(rasterLayer)) map.removeLayer(rasterLayer);
      return;
    }
    if (!map.hasLayer(rasterLayer)) rasterLayer.addTo(map);
  };

  const clearVector = () => {
    vectorLayer.clearLayers();
    if (map.hasLayer(vectorLayer)) map.removeLayer(vectorLayer);
    limparRotulos();
  };

  /*
    Uma passagem por todas as terras desenhadas, que decide duas coisas.

    O SÍMBOLO, para a terra pequena demais para se ver nesta escala. Medido em
    pixels no ecrã, não em quilómetros: o que decide se uma área se lê é o
    tamanho que ela tem no monitor, e isso muda a cada zoom.

    O RÓTULO, que não vai como tooltip do polígono — o polígono já usa o seu
    tooltip para o detalhe no ponteiro, e um layer do Leaflet só tem um. Vai
    como marcador sem interação, numa camada acima do traçado e abaixo das
    unidades de saúde.
  */
  const desenharApoios = (quantidade) => {
    limparRotulos();
    const comRotulo = quantidade <= LIMITE_DE_ROTULOS_NO_MAPA;
    const projetar = (ponto) => map.latLngToLayerPoint(ponto);
    const candidatos = [];

    vectorLayer.eachLayer?.((camada) => {
      const propriedades = camada?.feature?.properties;
      const limites = camada.getBounds?.();
      if (!limites?.isValid?.()) return;
      const centro = limites.getCenter();

      if (terraPrecisaDeSimbolo(tamanhoNaTelaEmPixels(limites, projetar))) {
        const simbolo = L.circleMarker(centro, {
          pane: vectorPaneName,
          radius: RAIO_DO_SIMBOLO_PX,
          interactive: supportsHover(),
          ...estiloDoSimbolo(map),
        });
        if (supportsHover()) {
          const detalhe = tooltipDaTerraIndigena(propriedades);
          if (detalhe) {
            simbolo.bindTooltip(`${detalhe}<br>${AVISO_DO_SIMBOLO}`, {
              direction: "top",
              className: "agsus-ti-tooltip",
            });
          }
        }
        simbolosLayer.addLayer(simbolo);
      }

      if (!comRotulo) return;
      const texto = rotuloDaTerraIndigena(propriedades);
      if (!texto) return;
      const ponto = projetar(centro);
      candidatos.push({
        x: ponto?.x,
        y: ponto?.y,
        centro,
        texto,
        // A terra maior ganha o rótulo quando dois disputam o mesmo espaço.
        peso: tamanhoNaTelaEmPixels(limites, projetar),
      });
    });

    for (const rotulo of rotulosSemColisao(candidatos)) {
      rotulosLayer.addLayer(
        L.marker(rotulo.centro, {
          pane: rotulosPaneName,
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "agsus-ti-rotulo",
            html: `<span class="agsus-ti-rotulo__texto">${escaparHtml(rotulo.texto)}</span>`,
            iconSize: [0, 0],
          }),
        }),
      );
    }

    if (simbolosLayer.getLayers().length && !map.hasLayer(simbolosLayer)) {
      simbolosLayer.addTo(map);
    }
    if (rotulosLayer.getLayers().length && !map.hasLayer(rotulosLayer)) {
      rotulosLayer.addTo(map);
    }
  };

  const refreshVector = async () => {
    if (!visible()) return;
    const zoom = Number(map.getZoom?.());

    /*
      COM UM DISTRITO ABERTO NÃO HÁ PISO DE ZOOM.

      O piso de 7 existe para a visão nacional: abaixo dele o pedido à Funai
      traria o país inteiro, e por isso o raster toma conta. Mas ao abrir um
      DSEI o raster foi desligado — ele é uma imagem do Brasil todo e não sabe
      o que é deste distrito.

      As duas regras juntas produziam o pior dos casos: Ceará e Maranhão são
      largos e abrem abaixo do zoom 7, logo o vetorial não carregava e o raster
      estava desligado. Não se desenhava terra nenhuma. Foi regressão
      introduzida ao filtrar as terras por distrito.

      Com distrito aberto o pedido é seguro: o enquadramento é o do distrito,
      o pedido continua limitado a 250 polígonos, e o que volta ainda passa
      pelo filtro das unidades e da UF.
    */
    const piso = unidadesDoDsei.length ? 0 : VECTOR_MIN_ZOOM;
    if (!Number.isFinite(zoom) || zoom < piso) {
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

      /*
        Com um DSEI aberto, só entram as terras que tocam a abrangência dele.
        Sem isso o mapa da Bahia mostrava Xerente e Xacriabá, que são de outros
        distritos, e quem olhava não tinha como saber a diferença.
      */
      const doDistrito = unidadesDoDsei.length
        ? geojson.features.filter((f) =>
            terraPertenceAoDsei(f, unidadesDoDsei, ufsDoDsei),
          )
        : geojson.features;

      vectorLayer.clearLayers();
      vectorLayer.addData({ type: "FeatureCollection", features: doDistrito });
      vectorLayer.setStyle?.(() => vectorStyle(map));
      if (!map.hasLayer(vectorLayer)) vectorLayer.addTo(map);
      if (map.hasLayer(rasterLayer)) map.removeLayer(rasterLayer);
      desenharApoios(doDistrito.length);
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
    simbolosLayer.eachLayer?.((simbolo) =>
      simbolo.setStyle?.(estiloDoSimbolo(map)),
    );
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
/*
  UMA COR SÓ PARA A TERRA INDÍGENA, NOS DOIS MAPAS BASE

  A camada tinha duas cores: verde-azulada sobre o mapa comum e vermelha sobre
  satélite. Só que a cor vermelha vivia apenas no desenho vetorial, e o
  vetorial só existe a partir do zoom 7. Na visão nacional quem desenha é o
  raster WMS da Funai — e o raster vem com a simbologia dela, que é verde.

  O resultado era o botão "Terras Indígenas" e a legenda a mostrarem um
  quadrado vermelho enquanto o mapa desenhava verde. Legenda que não descreve
  o desenho é pior do que legenda nenhuma: ensina a procurar a coisa errada.

  Não dá para alinhar pelo vermelho. O WMS da Funai publica dois estilos para
  `tis_poligonais` — `terras_indigenas` e `polygon` — e nenhum é vermelho.
  Alinha-se pelo verde, que é o que a fonte desenha.

  O contraste sobre satélite passa a vir do traço, não da cor: mais grosso e
  com o preenchimento mais discreto, para não tapar a imagem que se foi ver.
*/
const COR_DA_TERRA = "#0b6b5f";
const PREENCHIMENTO_DA_TERRA = "#14b8a6";

function estiloDoSimbolo(map) {
  const satellite = map?.__agsusBaseMapMode === "satellite";
  return {
    color: COR_DA_TERRA,
    weight: satellite ? 2.8 : 2.2,
    opacity: 1,
    fillColor: PREENCHIMENTO_DA_TERRA,
    fillOpacity: 0.45,
  };
}

function vectorStyle(map) {
  const satellite = map?.__agsusBaseMapMode === "satellite";
  return {
    color: COR_DA_TERRA,
    weight: satellite ? 3.2 : 2.4,
    opacity: 1,
    fillColor: PREENCHIMENTO_DA_TERRA,
    fillOpacity: satellite ? 0.18 : 0.26,
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
