/*
  A CAMADA DE TERRAS INDÍGENAS (e a abrangência dos DSEIs) nos mapas da Saúde
  Indígena (`#map` e `#detailMap`).

  Instalada por `carregarLeaflet` (src/modulos/mapa-saude-indigena/carregar-leaflet.ts)
  depois das outras guardas: envolve `L.map` e enfeita cada mapa com esses ids.
  Aqui fica só o que mexe no Leaflet (painéis, camadas, o botão); o que é
  conta ou texto — catálogo, nomes e povos, geometria, fases e estilos,
  preferências guardadas — é puro e mora em src/lib/terras-indigenas/.
*/
import type { PosicaoDoLeaflet } from "../modulos/mapa-saude-indigena/tipos-do-leaflet.ts";
import type {
  CaixaDaTerra,
  ColecaoDeTerras,
  EstiloDoTraco,
  FeatureDaTerra,
  LimitesDoMapa,
  PontoProjetado,
  PosicaoGeoJson,
  ResumoDaTerra,
  UnidadeDoDsei,
} from "../lib/terras-indigenas/tipos.ts";
import {
  CATALOGO_DE_TERRAS_EM_ESTUDO,
  FUNAI_PROXY_WMS,
  FUNAI_TERRITORIES_LAYER,
  carregarCatalogo,
  catalogoParaOZoom,
  funaiDseiUrl,
  funaiEstudoUrl,
  funaiViewportUrl,
  obterCatalogo,
} from "../lib/terras-indigenas/catalogo.ts";
import {
  AVISO_DO_SIMBOLO,
  dseiFeatureMatches,
  dseiFeatureName,
  escaparHtml,
  rotuloDaTerraIndigena,
  tooltipDaTerraEmEstudo,
  tooltipDaTerraIndigena,
  tooltipDoDsei,
} from "../lib/terras-indigenas/textos.ts";
import {
  caixaDoMapa,
  resumoDasTerras,
  rotulosSemColisao,
  tamanhoNaTelaEmPixels,
  terraPertenceAoDsei,
  terraPrecisaDeSimbolo,
  terrasNoEnquadramento,
} from "../lib/terras-indigenas/geometria.ts";
import {
  COR_EM_PROCESSO,
  FASES_DAS_TERRAS,
  FILTRO_DO_RASTER,
  ZOOM_DO_PAIS,
  dseiStyle,
  estiloDoSimbolo,
  faseDaLegenda,
  faseDaTerra,
  raioDoSimbolo,
  terrasDasFasesVisiveis,
  vectorStyle,
} from "../lib/terras-indigenas/fases-e-estilos.ts";
import {
  readStoredFases,
  readStoredVisibility,
  storeFases,
  storeVisibility,
} from "../lib/terras-indigenas/preferencias.ts";
import {
  EVENTO_DO_FUNDO,
  MODO_SIMPLES,
  modoDesejadoDoFundo,
} from "./map-base-layer-switcher.ts";

// Quem importava tudo desta camada continua a importar daqui.
export * from "../lib/terras-indigenas/catalogo.ts";
export * from "../lib/terras-indigenas/textos.ts";
export * from "../lib/terras-indigenas/geometria.ts";
export {
  FASES_DAS_TERRAS,
  ZOOM_DO_PAIS,
  estiloDaFase,
  estiloDoSimbolo,
  faseDaLegenda,
  faseDaTerra,
  raioDoSimbolo,
  terrasDasFasesVisiveis,
} from "../lib/terras-indigenas/fases-e-estilos.ts";
export { lerFasesOcultas } from "../lib/terras-indigenas/preferencias.ts";

declare global {
  interface Window {
    L?: unknown;
  }
}

/*
  Disparado no mapa sempre que muda o que as terras mostram — o interruptor
  geral ou uma fase. O botão e a legenda escutam o mesmo evento e por isso não
  podem discordar entre si.
*/
export const EVENTO_DAS_TERRAS = "agsus:terras-mudaram";

const VECTOR_REFRESH_DELAY_MS = 220;

/*
  Acima disto o mapa deixa de ganhar com os rótulos e passa a perder: nomes
  sobrepostos escondem o traçado das próprias terras e as unidades de saúde.
  Numa vista de DSEI as terras cabem bem abaixo do limite; numa vista ampla do
  Amazonas não cabem, e aí o nome volta a ser só no ponteiro.
*/
const LIMITE_DE_ROTULOS_NO_MAPA = 40;

/* O pedaço do Leaflet que a camada usa (vem do CDN como `window.L`, sem tipos). */

/** `L.latLngBounds`, com o que a camada lê dele. */
interface LimitesLeaflet extends LimitesDoMapa {
  isValid?(): boolean;
  getCenter(): PosicaoDoLeaflet;
  getNorthEast(): PosicaoDoLeaflet;
  getSouthWest(): PosicaoDoLeaflet;
}

type EstiloPorFeature = (feature: FeatureDaTerra) => EstiloDoTraco;

interface CamadaLeaflet {
  addTo(mapa: MapaDasTerrasIndigenas): unknown;
}

/** Um polígono do GeoJSON (a terra ou o DSEI), já desenhado. */
interface CamadaDaFeature extends CamadaLeaflet {
  feature?: FeatureDaTerra;
  on(evento: string, ouvinte: () => void): unknown;
  setStyle(estilo: Partial<EstiloDoTraco>): unknown;
  bindTooltip(conteudo: string, opcoes?: object): unknown;
  getBounds?(): LimitesLeaflet;
}

interface CamadaGeoJson extends CamadaLeaflet {
  clearLayers(): void;
  addData(dados: ColecaoDeTerras): unknown;
  setStyle?(estilo: EstiloPorFeature): unknown;
  eachLayer?(ouvinte: (camada: CamadaDaFeature) => void): unknown;
  getBounds?(): LimitesLeaflet;
}

interface OpcoesDoGeoJson {
  pane: string;
  interactive: boolean;
  style: EstiloPorFeature;
  onEachFeature: (feature: FeatureDaTerra, layer: CamadaDaFeature) => void;
}

/** O círculo da terra pequena demais, ou da terra em estudo. */
interface MarcaCircular extends CamadaLeaflet {
  bindTooltip(conteudo: string, opcoes?: object): unknown;
  setRadius?(raio: number): unknown;
  setStyle?(estilo: EstiloDoTraco): unknown;
  __agsusFase?: string;
}

interface GrupoDeCamadas<C extends CamadaLeaflet> extends CamadaLeaflet {
  clearLayers(): void;
  addLayer(camada: C): unknown;
  getLayers(): C[];
  eachLayer?(ouvinte: (camada: C) => void): unknown;
}

type PosicaoDoMarcador = readonly [number, number] | PosicaoDoLeaflet;

interface ControleLeaflet {
  onAdd?: () => HTMLElement;
  addTo(mapa: MapaDasTerrasIndigenas): unknown;
}

type FabricaDoMapa = (
  this: unknown,
  elemento: unknown,
  opcoes?: object,
) => MapaDasTerrasIndigenas;

interface LeafletDasTerras {
  map: FabricaDoMapa;
  tileLayer: { wms(url: string, opcoes: object): CamadaLeaflet };
  geoJSON(dados: readonly unknown[], opcoes: OpcoesDoGeoJson): CamadaGeoJson;
  layerGroup<C extends CamadaLeaflet>(
    camadas: C[],
    opcoes?: object,
  ): GrupoDeCamadas<C>;
  circleMarker(posicao: PosicaoDoMarcador, opcoes: object): MarcaCircular;
  marker(posicao: PosicaoDoMarcador, opcoes: object): CamadaLeaflet;
  divIcon(opcoes: {
    className: string;
    html: string;
    iconSize: [number, number];
  }): object;
  control(opcoes: { position: string }): ControleLeaflet;
  DomUtil: {
    create<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      classe: string,
      pai?: HTMLElement,
    ): HTMLElementTagNameMap[K];
  };
  DomEvent: {
    disableClickPropagation(elemento: HTMLElement): unknown;
    disableScrollPropagation(elemento: HTMLElement): unknown;
  };
  __agsusIndigenousTerritoriesInstalled?: boolean;
}

/** O mapa do Leaflet, com o que esta camada lhe pendura (`__agsus*`). */
export interface MapaDasTerrasIndigenas {
  on(evento: string, ouvinte: () => void): unknown;
  getContainer?(): HTMLElement;
  getPane?(nome: string): HTMLElement | undefined;
  createPane?(nome: string): HTMLElement;
  hasLayer(camada: CamadaLeaflet): boolean;
  removeLayer(camada: CamadaLeaflet): unknown;
  getZoom?(): number;
  getBounds?(): LimitesDoMapa;
  latLngToLayerPoint(posicao: PosicaoDoLeaflet): PontoProjetado;
  fire?(evento: string, dados?: object): unknown;
  fitBounds?(limites: [number, number][], opcoes?: object): unknown;
  whenReady?(ouvinte: () => void): unknown;
  /** Do seletor Mapa/Satélite: o fundo que vale agora. */
  __agsusBaseMapMode?: string;

  __agsusIndigenousTerritoriesReady?: boolean;
  __agsusIndigenousTerritoriesVisible?: boolean;
  __agsusIndigenousTerritoriesLayer?: CamadaLeaflet;
  __agsusIndigenousTerritoriesVectorLayer?: CamadaGeoJson;
  __agsusIndigenousTerritoriesLabelsLayer?: GrupoDeCamadas<CamadaLeaflet>;
  __agsusIndigenousTerritoriesSymbolsLayer?: GrupoDeCamadas<MarcaCircular>;
  __agsusIndigenousTerritoriesControl?: ControleLeaflet;
  __agsusTerrasEmEstudoLayer?: GrupoDeCamadas<MarcaCircular>;
  __agsusDseiCoverageLayer?: CamadaGeoJson;
  __agsusDseiCoverageBounds?: LimitesLeaflet | null;
  __agsusAoMudarTerras?: ((lista: ResumoDaTerra[]) => void) | null;
  __agsusSetDseiCoverage?(
    nome?: string,
    unidades?: readonly UnidadeDoDsei[],
    ufs?: readonly unknown[],
  ): void;
  __agsusEnquadrarTerra?(
    nome: unknown,
    caixa: CaixaDaTerra | null | undefined,
  ): boolean;
  __agsusSuspenderCamadasIndigenas?(suspender: boolean): void;
  __agsusDefinirTerrasVisiveis?(visivel: boolean): void;
  __agsusAlternarFaseDaTerra?(fase: string): boolean;
  __agsusFaseDaTerraVisivel?(fase: string): boolean;
}

/* O mesmo teste de antes: sem `map`, `tileLayer.wms`, `control` e o DOM do Leaflet, não instala. */
function ehLeafletDasTerras(valor: unknown): valor is LeafletDasTerras {
  if (!valor || typeof valor !== "object") return false;
  const tileLayer: unknown = Reflect.get(valor, "tileLayer");
  return Boolean(
    Reflect.get(valor, "map") &&
    tileLayer &&
    (typeof tileLayer === "object" || typeof tileLayer === "function") &&
    Reflect.get(tileLayer, "wms") &&
    Reflect.get(valor, "control") &&
    Reflect.get(valor, "DomUtil") &&
    Reflect.get(valor, "DomEvent"),
  );
}

let installed = false;
let dseiFeaturesPromise: Promise<ColecaoDeTerras | null> | null = null;

export function isHealthMapElementId(value: unknown): boolean {
  const id =
    typeof value === "string"
      ? value
      : String(
          (value && typeof value === "object"
            ? Reflect.get(value, "id")
            : "") || "",
        );
  return id === "map" || id === "detailMap";
}

function supportsHover(): boolean {
  try {
    return (
      window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches ===
      true
    );
  } catch {
    return false;
  }
}

function ehCancelamento(erro: unknown): boolean {
  return (
    Boolean(erro) &&
    typeof erro === "object" &&
    Reflect.get(erro as object, "name") === "AbortError"
  );
}

function ehColecao(corpo: unknown): corpo is ColecaoDeTerras {
  return Array.isArray(
    corpo && typeof corpo === "object" ? Reflect.get(corpo, "features") : null,
  );
}

/*
  A FALHA TAMBÉM SE GUARDA

  A Funai deixou de publicar `areas_dsei`, e o proxy responde 502. Em caso de
  falha a promessa voltava a `null`, e cada DSEI aberto pedia outra vez: no
  painel, um 502 a cada clique, cada um uma chamada à função da Vercel.

  Agora a resposta — boa ou má — vale para a página inteira. Não se desliga o
  pedido de vez: se a Funai voltar a publicar a camada, o próximo carregamento
  desenha-a sem mudar uma linha.
*/
async function loadDseiFeatures(): Promise<ColecaoDeTerras | null> {
  if (dseiFeaturesPromise) return dseiFeaturesPromise;
  dseiFeaturesPromise = fetch(funaiDseiUrl(), {
    cache: "force-cache",
    headers: { Accept: "application/geo+json,application/json" },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`FUNAI DSEI HTTP ${response.status}`);
      const geojson: unknown = await response.json();
      if (!ehColecao(geojson)) throw new Error("GeoJSON de DSEI inválido");
      return geojson;
    })
    .catch((error: unknown) => {
      console.warn(
        "Abrangência oficial dos DSEIs indisponível na Funai; não se tenta de novo até recarregar.",
        error,
      );
      return null;
    });
  return dseiFeaturesPromise;
}

export function installIndigenousTerritoriesLayer(): boolean {
  if (installed) return true;
  const L = window.L;
  if (!ehLeafletDasTerras(L)) return false;
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

function enhanceMap(L: LeafletDasTerras, map: MapaDasTerrasIndigenas) {
  if (!map || map.__agsusIndigenousTerritoriesReady) return;
  map.__agsusIndigenousTerritoriesReady = true;

  const mapElementId = String(map.getContainer?.()?.id || "");
  /*
    Suspensas = a Visão geral mostra outra área (Projetos): o mapa nacional é o
    mesmo, mas sem nada da Saúde Indígena — nem terras, nem abrangência dos
    DSEIs. Diferente de desligar pelo botão, não se guarda: voltar à Saúde
    Indígena devolve o que a pessoa tinha. Ver `__agsusSuspenderCamadasIndigenas`.
  */
  let suspensas = false;
  /*
    Removido = o mapa saiu da página. Os da Saúde Indígena são React: o do
    DSEI é destruído ao voltar ao Brasil, os dois ao trocar de área (e o
    StrictMode monta, desmonta e monta de novo). O que chega depois —
    catálogo, abrangência, terras em estudo, o redesenho agendado — não toca
    num mapa removido (o Leaflet quebraria sem os painéis).
  */
  let removido = false;
  map.on("unload", () => {
    removido = true;
    clearTimeout(refreshTimer);
    clearTimeout(fimDoDestaque);
    requestController?.abort();
  });

  const rasterPaneName = "agsus-indigenous-territories";
  const rasterPane =
    map.getPane?.(rasterPaneName) || map.createPane?.(rasterPaneName);
  if (rasterPane?.style) {
    rasterPane.style.zIndex = "250";
    rasterPane.style.pointerEvents = "none";
    // O raster vem verde da Funai. Ver o comentário de FILTRO_DO_RASTER.
    rasterPane.style.filter = FILTRO_DO_RASTER;
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
  Reflect.set(rasterLayer, "__agsusOverlayKind", "indigenous-territories");
  map.__agsusIndigenousTerritoriesLayer = rasterLayer;

  const vectorLayer = L.geoJSON([], {
    pane: vectorPaneName,
    interactive: supportsHover(),
    style: (feature) => vectorStyle(map, feature),
    onEachFeature: (feature, layer) => {
      if (!supportsHover()) return;
      destacarAoPassar(feature, layer);
      const texto = tooltipDaTerraIndigena(feature?.properties);
      if (!texto) return;
      layer.bindTooltip(texto, {
        sticky: true,
        direction: "top",
        className: "agsus-ti-tooltip",
      });
    },
  });

  /*
    Passar o mouse numa terra engrossa o traço DELA — o limite da terra, não
    uma caixa em volta. Antes, o único retorno visual era o anel de foco do
    navegador, que num <path> SVG é um retângulo (ver
    indigenous-territories-layer.css). Ao sair, volta ao estilo da camada,
    respeitando o destaque temporário da terra escolhida na lista.
  */
  function destacarAoPassar(feature: FeatureDaTerra, layer: CamadaDaFeature) {
    layer.on("mouseover", () => {
      const base = estiloComDestaque(feature);
      layer.setStyle({
        weight: base.weight + 2,
        fillOpacity: Math.max(base.fillOpacity ?? 0, 0.4),
      });
    });
    layer.on("mouseout", () => layer.setStyle(estiloComDestaque(feature)));
  }
  map.__agsusIndigenousTerritoriesVectorLayer = vectorLayer;

  const rotulosLayer = L.layerGroup<CamadaLeaflet>([], {
    pane: rotulosPaneName,
  });
  map.__agsusIndigenousTerritoriesLabelsLayer = rotulosLayer;

  const simbolosLayer = L.layerGroup<MarcaCircular>([], {
    pane: vectorPaneName,
  });
  map.__agsusIndigenousTerritoriesSymbolsLayer = simbolosLayer;

  /*
    As terras em estudo são 163 pontos no país e não mudam com o enquadramento:
    carregam-se uma vez, ficam em memória, e cada mapa desenha as suas.
  */
  const estudoLayer = L.layerGroup<MarcaCircular>([], { pane: vectorPaneName });
  map.__agsusTerrasEmEstudoLayer = estudoLayer;
  let estudoGeojson: ColecaoDeTerras | null = null;

  // As fases que a legenda escondeu. Ver `alternarFase`, no fim deste bloco.
  const fasesOcultas = readStoredFases();

  /*
    A cor das provisórias: sem limite publicado, é a menos definitiva. Oco,
    porque não há área e o desenho não pode sugerir uma; tracejado de perto e
    liso no país, onde a 3 px o tracejado já não se vê.
  */
  const estiloDoEstudo = (): EstiloDoTraco => ({
    color: COR_EM_PROCESSO,
    weight: Number(map.getZoom?.()) < ZOOM_DO_PAIS ? 1.2 : 2.2,
    opacity: 1,
    fill: false,
    dashArray: Number(map.getZoom?.()) < ZOOM_DO_PAIS ? null : "4 3",
  });

  /* A terra em estudo é um ponto (`Point`) da Funai: [longitude, latitude]. */
  const pontoDoEstudo = (f: FeatureDaTerra) =>
    f.geometry?.coordinates as PosicaoGeoJson | undefined;

  const desenharEstudo = () => {
    if (removido) return;
    estudoLayer.clearLayers();
    if (
      !estudoGeojson?.features ||
      !visible() ||
      fasesOcultas.has("em_estudo")
    ) {
      if (map.hasLayer(estudoLayer)) map.removeLayer(estudoLayer);
      return;
    }

    const doDistrito = unidadesDoDsei.length
      ? estudoGeojson.features.filter((f) =>
          terraPertenceAoDsei(
            {
              ...f,
              geometry: {
                type: "Polygon",
                coordinates: [[pontoDoEstudo(f) || [0, 0]]],
              },
            },
            unidadesDoDsei,
            ufsDoDsei,
          ),
        )
      : estudoGeojson.features;

    for (const f of doDistrito) {
      const [lon, lat] = pontoDoEstudo(f) || [];
      if (
        typeof lat !== "number" ||
        typeof lon !== "number" ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      )
        continue;
      const marca = L.circleMarker([lat, lon], {
        pane: vectorPaneName,
        radius: raioDoSimbolo(Number(map.getZoom?.())),
        interactive: supportsHover(),
        ...estiloDoEstudo(),
      });
      if (supportsHover()) {
        marca.bindTooltip(tooltipDaTerraEmEstudo(f.properties), {
          direction: "top",
          className: "agsus-ti-tooltip",
        });
      }
      estudoLayer.addLayer(marca);
    }

    if (estudoLayer.getLayers().length && !map.hasLayer(estudoLayer)) {
      estudoLayer.addTo(map);
    }
  };

  const carregarEstudo = async () => {
    if (estudoGeojson) return desenharEstudo();
    // O catálogo local primeiro; a Funai fica como recurso.
    estudoGeojson =
      (await carregarCatalogo(CATALOGO_DE_TERRAS_EM_ESTUDO)) ||
      (await carregarCatalogo(funaiEstudoUrl()));
    if (!estudoGeojson) {
      // A ausência é honesta: sem esta camada o mapa continua correto, só menos
      // completo. Não se inventa ponto nenhum.
      return;
    }
    desenharEstudo();
  };

  const limparRotulos = () => {
    rotulosLayer.clearLayers();
    if (map.hasLayer(rotulosLayer)) map.removeLayer(rotulosLayer);
    simbolosLayer.clearLayers();
    if (map.hasLayer(simbolosLayer)) map.removeLayer(simbolosLayer);
  };

  let selectedDsei = "";
  let dseiGeojson: ColecaoDeTerras | null = null;
  let unidadesDoDsei: readonly UnidadeDoDsei[] = [];
  let ufsDoDsei: readonly unknown[] = [];
  const dseiLayer = L.geoJSON([], {
    pane: dseiPaneName,
    interactive: supportsHover(),
    style: (feature) => dseiStyle(mapElementId, feature, selectedDsei),
    onEachFeature: (feature, layer) => {
      if (!supportsHover()) return;
      const nome = dseiFeatureName(feature?.properties);
      if (!nome) return;
      layer.bindTooltip(tooltipDoDsei(nome), {
        sticky: true,
        direction: "top",
        className: "agsus-dsei-tooltip",
      });
    },
  });
  map.__agsusDseiCoverageLayer = dseiLayer;

  const renderDseiCoverage = () => {
    if (removido) return;
    if (!dseiGeojson?.features) return;
    dseiLayer.clearLayers();
    if (suspensas) {
      if (map.hasLayer(dseiLayer)) map.removeLayer(dseiLayer);
      return;
    }

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
    void carregarEstudo();
    scheduleRefresh();
  };

  if (mapElementId === "map") {
    map.whenReady?.(() => {
      void ensureDseiCoverage();
      void carregarEstudo();
    });
  }

  let requestController: AbortController | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let lastViewportKey = "";

  const visible = () =>
    !removido &&
    !suspensas &&
    map.__agsusIndigenousTerritoriesVisible !== false;

  const recorrerAoRaster = () => {
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
  const desenharApoios = (quantidade: number) => {
    limparRotulos();
    const comRotulo = quantidade <= LIMITE_DE_ROTULOS_NO_MAPA;
    const projetar = (ponto: PosicaoDoLeaflet): PontoProjetado | undefined =>
      map.latLngToLayerPoint(ponto);
    const candidatos: {
      x: number | undefined;
      y: number | undefined;
      centro: PosicaoDoLeaflet;
      texto: string;
      peso: number;
    }[] = [];

    vectorLayer.eachLayer?.((camada) => {
      const propriedades = camada?.feature?.properties;
      const limites = camada.getBounds?.();
      if (!limites?.isValid?.()) return;
      const centro = limites.getCenter();

      if (terraPrecisaDeSimbolo(tamanhoNaTelaEmPixels(limites, projetar))) {
        const fase = faseDaTerra(propriedades);
        const simbolo = L.circleMarker(centro, {
          pane: vectorPaneName,
          radius: raioDoSimbolo(Number(map.getZoom?.())),
          interactive: supportsHover(),
          ...estiloDoSimbolo(map, fase),
        });
        simbolo.__agsusFase = fase;
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
      NÃO HÁ MAIS PISO DE ZOOM.

      Havia um, de 7, e abaixo dele o raster da Funai tomava conta. A razão era
      que, sem catálogo, pedir a geometria nessa escala traria o país inteiro —
      e essa razão morreu quando o catálogo chegou: ele JÁ é o país inteiro.

      O que ficava no lugar era pior do que lento: o raster é uma imagem só,
      recolorida por inteiro, e não sabe distinguir fase. A legenda prometia
      três coisas e o mapa nacional mostrava uma. Agora quem desenha é sempre o
      vetorial — largo abaixo do zoom 7, fino a partir dele — e o raster passa a
      ser só o recurso de quando o catálogo não carrega.
    */
    if (!Number.isFinite(zoom)) {
      clearVector();
      recorrerAoRaster();
      return;
    }

    const bounds = map.getBounds?.();
    const caixa = caixaDoMapa(bounds);
    if (!caixa) return;

    /*
      A chave mudou de propósito. Antes era a URL do pedido — floats crus, nunca
      repetidos, o que forçava um pedido novo a cada pixel arrastado. Agora é o
      enquadramento arredondado mais o distrito aberto: arrastos pequenos dentro
      da mesma casa decimal não redesenham nada, e mudar de distrito redesenha
      sempre, mesmo sem mexer a câmara.
    */
    const urlDoCatalogo = catalogoParaOZoom(zoom);

    /*
      O catálogo entra na chave: cruzar o zoom 7 troca de ficheiro, e sem isso o
      mapa ficaria com o traçado largo depois de aproximar.
    */
    const key = [
      urlDoCatalogo,
      zoom.toFixed(1),
      caixa.oeste.toFixed(2),
      caixa.sul.toFixed(2),
      caixa.leste.toFixed(2),
      caixa.norte.toFixed(2),
      selectedDsei || "",
      // Esconder uma fase na legenda muda o desenho sem mexer a câmara.
      [...fasesOcultas].sort().join(","),
    ].join("|");
    if (key === lastViewportKey) return;
    lastViewportKey = key;

    const catalogo = await obterCatalogo(urlDoCatalogo);
    const doEnquadramento = catalogo
      ? terrasNoEnquadramento(catalogo.features, caixa)
      : await terrasDaFunai(bounds);
    // Desligadas ou suspensas enquanto o catálogo chegava: não desenha.
    if (!visible()) return;
    if (!doEnquadramento) {
      clearVector();
      recorrerAoRaster();
      return;
    }

    /*
      Com um DSEI aberto, só entram as terras que tocam a abrangência dele. Sem
      isso o mapa da Bahia mostrava Xerente e Xacriabá, que são de outros
      distritos, e quem olhava não tinha como saber a diferença.
    */
    const doDistrito = unidadesDoDsei.length
      ? doEnquadramento.filter((f) =>
          terraPertenceAoDsei(f, unidadesDoDsei, ufsDoDsei),
        )
      : doEnquadramento;

    /*
      A LISTA É DO DISTRITO, O DESENHO É DO ENQUADRAMENTO

      A lista saía de `doDistrito`, que já passou pelo recorte do ecrã. Quem
      aproximasse o mapa num posto de saúde via "Terras Indígenas e povos: 0"
      num distrito que tem dezenas delas — o painel respondia à pergunta
      "o que cabe no ecrã", e a pergunta é "o que este DSEI atende".

      O recorte do enquadramento continua a existir, e tem de continuar: são
      665 terras, e o Leaflet paga por cada traçado. Mas ele é sobre o desenho,
      não sobre a lista.
    */
    if (catalogo) {
      const doDistritoInteiro = unidadesDoDsei.length
        ? catalogo.features.filter((f) =>
            terraPertenceAoDsei(f, unidadesDoDsei, ufsDoDsei),
          )
        : doDistrito;
      map.__agsusAoMudarTerras?.(resumoDasTerras(doDistritoInteiro));
    }

    /*
      Os interruptores da legenda recortam o DESENHO, não a lista: a lista
      responde "que terras este DSEI atende", e esconder as regularizadas no
      mapa para ver as que estão em processo não muda essa resposta.
    */
    const desenhadas = terrasDasFasesVisiveis(doDistrito, fasesOcultas);

    vectorLayer.clearLayers();
    vectorLayer.addData({ type: "FeatureCollection", features: desenhadas });
    vectorLayer.setStyle?.((feature) => estiloComDestaque(feature));
    if (!map.hasLayer(vectorLayer)) vectorLayer.addTo(map);
    if (map.hasLayer(rasterLayer)) map.removeLayer(rasterLayer);
    desenharApoios(desenhadas.length);
  };

  /*
    A terra escolhida na lista do painel. O mapa vai até ela e ela engrossa o
    traço por alguns segundos — sem isso, num distrito com trinta terras
    vizinhas, enquadrar não diz qual das trinta é a que se pediu.
  */
  let terraEmDestaque = "";
  let fimDoDestaque: ReturnType<typeof setTimeout> | undefined;
  const estiloComDestaque = (feature: FeatureDaTerra) => {
    const base = vectorStyle(map, feature);
    if (!terraEmDestaque) return base;
    const nome = String(feature?.properties?.terrai_nome ?? "").trim();
    if (nome !== terraEmDestaque) return base;
    return {
      ...base,
      weight: base.weight + 2.5,
      fillOpacity: Math.max(base.fillOpacity, 0.4),
    };
  };

  map.__agsusEnquadrarTerra = (nome, caixa) => {
    const alvo = String(nome ?? "").trim();
    if (!alvo || !caixa) return false;
    const { oeste, sul, leste, norte } = caixa;
    if (![oeste, sul, leste, norte].every(Number.isFinite)) return false;
    // Esconder a fase da terra pedida seria enquadrar um vazio.
    if (!visible()) definirVisibilidade(true);
    terraEmDestaque = alvo;
    clearTimeout(fimDoDestaque);
    fimDoDestaque = setTimeout(() => {
      terraEmDestaque = "";
      vectorLayer.setStyle?.((feature) => estiloComDestaque(feature));
    }, 4000);
    map.fitBounds?.(
      [
        [sul, oeste],
        [norte, leste],
      ],
      { padding: [40, 40], maxZoom: 11 },
    );
    vectorLayer.setStyle?.((feature) => estiloComDestaque(feature));
    return true;
  };

  /*
    O caminho antigo, agora só como recurso: se o catálogo local não carregar,
    volta-se a pedir à Funai por enquadramento. Devolve `null` quando também
    isso falha, e aí o raster toma conta.
  */
  const terrasDaFunai = async (
    bounds: LimitesDoMapa | undefined,
  ): Promise<FeatureDaTerra[] | null> => {
    const url = funaiViewportUrl(bounds);
    if (!url) return null;
    requestController?.abort();
    requestController = new AbortController();
    try {
      const response = await fetch(url, {
        signal: requestController.signal,
        cache: "force-cache",
        headers: { Accept: "application/geo+json,application/json" },
      });
      if (!response.ok) throw new Error(`FUNAI WFS HTTP ${response.status}`);
      const geojson: unknown = await response.json();
      if (!ehColecao(geojson)) throw new Error("GeoJSON inválido");
      return geojson.features;
    } catch (error) {
      if (ehCancelamento(error)) return null;
      console.warn(
        "Camada vetorial de Terras Indígenas indisponível; usando WMS da Funai.",
        error,
      );
      return null;
    }
  };

  const scheduleRefresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(
      () => void refreshVector(),
      VECTOR_REFRESH_DELAY_MS,
    );
  };

  map.on("moveend zoomend", scheduleRefresh);
  // As terras em estudo não se redesenham com o enquadramento: ajustam-se.
  map.on("zoomend", () => {
    const raio = raioDoSimbolo(Number(map.getZoom?.()));
    estudoLayer.eachLayer?.((marca) => {
      marca.setRadius?.(raio);
      marca.setStyle?.(estiloDoEstudo());
    });
  });
  /*
    AS TERRAS NO "MAPA DSEIs" — a regra mora aqui, não no componente

    No Mapa DSEIs (map-base-layer-switcher.ts) as terras começam
    desligadas, sem mudar a preferência guardada; o botão liga e desliga só
    enquanto ele durar; ao sair, volta o que a pessoa tinha no Mapa/Satélite.
    Antes quem desligava era um efeito do React, que só soube do modo depois
    de o mapa nascer e de cada troca avisada: as terras e o botão podiam ficar
    em desacordo com o fundo (terras por cima dos DSEIs chapados, botão
    "desligado" com terras no Mapa). Agora a camada lê o modo pedido ao nascer
    e segue o aviso de troca do seletor, no mesmo instante.
  */
  let noMapaSimples = modoDesejadoDoFundo(map) === MODO_SIMPLES;
  map.getContainer?.().addEventListener(EVENTO_DO_FUNDO, (evento) => {
    const simples =
      (evento as CustomEvent<{ mode?: unknown }>).detail?.mode === MODO_SIMPLES;
    if (simples !== noMapaSimples) {
      noMapaSimples = simples;
      aplicarVisibilidade(simples ? false : readStoredVisibility());
    }
    vectorLayer.setStyle?.((feature) => estiloComDestaque(feature));
    simbolosLayer.eachLayer?.((simbolo) =>
      simbolo.setStyle?.(estiloDoSimbolo(map, simbolo.__agsusFase)),
    );
    dseiLayer.setStyle?.((feature) =>
      dseiStyle(mapElementId, feature, selectedDsei),
    );
  });

  const avisar = () =>
    map.fire?.(EVENTO_DAS_TERRAS, {
      visivel: visible(),
      fasesOcultas: [...fasesOcultas],
    });

  /*
    O INTERRUPTOR GERAL — tudo o que é terra sai ou volta junto

    São cinco camadas: o raster de recurso, o vetorial, os símbolos das terras
    pequenas, os rótulos e os círculos das terras em estudo. O botão antigo
    tirava as duas primeiras e deixava as outras três no mapa.

    Zerar `lastViewportKey` é o que faz o vetorial voltar sem ninguém arrastar
    o mapa: sem isso o `refreshVector` achava "mesmo enquadramento, nada a
    fazer" e o botão acendia sobre um mapa vazio.
  */
  const aplicarVisibilidade = (proxima: boolean) => {
    const alvo = Boolean(proxima);
    map.__agsusIndigenousTerritoriesVisible = alvo;
    lastViewportKey = "";
    if (!alvo) {
      if (map.hasLayer(rasterLayer)) map.removeLayer(rasterLayer);
      clearVector();
      estudoLayer.clearLayers();
      if (map.hasLayer(estudoLayer)) map.removeLayer(estudoLayer);
    } else {
      // O raster não entra aqui: só `recorrerAoRaster`, se o catálogo falhar.
      scheduleRefresh();
      desenharEstudo();
    }
    avisar();
  };

  /* O botão e a legenda: no Mapa DSEIs a escolha vale só enquanto ele durar. */
  const definirVisibilidade = (proxima: boolean) => {
    aplicarVisibilidade(proxima);
    if (!noMapaSimples) storeVisibility(Boolean(proxima));
  };

  /*
    UM INTERRUPTOR POR FASE

    Pedido de quem usa: esconder as terras já regularizadas e ficar só com as
    que estão em processo — são essas que ainda podem mudar de limite, e as
    que pedem atenção de quem planeia atendimento.

    Ligar uma fase com a camada inteira desligada liga a camada: quem clica
    em "em processo" quer ver as terras em processo, não um interruptor que
    muda de estado sobre um mapa vazio.
  */
  const alternarFase = (fase: string) => {
    if (!FASES_DAS_TERRAS.some((f) => f.fase === fase)) return false;
    if (!visible()) {
      fasesOcultas.delete(fase);
      storeFases(fasesOcultas);
      definirVisibilidade(true);
      return true;
    }
    if (fasesOcultas.has(fase)) fasesOcultas.delete(fase);
    else fasesOcultas.add(fase);
    storeFases(fasesOcultas);
    lastViewportKey = "";
    scheduleRefresh();
    desenharEstudo();
    avisar();
    return true;
  };

  /*
    SUSPENDER — tira as terras, as em estudo e a abrangência dos DSEIs sem
    mexer na preferência guardada. Voltar (`false`) redesenha o que estava.
    O mapa nacional da Saúde Indígena (React) chama com `false` ao nascer; o
    de Projetos é outro mapa (`#mapaDosProjetos`), sem camadas indígenas.
  */
  map.__agsusSuspenderCamadasIndigenas = (suspender) => {
    const alvo = Boolean(suspender);
    if (alvo === suspensas) return;
    suspensas = alvo;
    lastViewportKey = "";
    if (alvo) {
      if (map.hasLayer(rasterLayer)) map.removeLayer(rasterLayer);
      clearVector();
      estudoLayer.clearLayers();
      if (map.hasLayer(estudoLayer)) map.removeLayer(estudoLayer);
    } else {
      scheduleRefresh();
      desenharEstudo();
    }
    renderDseiCoverage();
    avisar();
  };

  map.__agsusDefinirTerrasVisiveis = definirVisibilidade;
  map.__agsusAlternarFaseDaTerra = alternarFase;
  map.__agsusFaseDaTerraVisivel = (fase) =>
    visible() && !fasesOcultas.has(faseDaLegenda(fase));

  /*
    O RASTER DA FUNAI ERA BAIXADO SEM NUNCA APARECER

    Entrava no mapa ao iniciar e a cada vez que as terras eram religadas, "até
    o vetorial carregar" — e o vetorial vem do catálogo local em 40 a 200 ms.
    Nesse intervalo o Leaflet já tinha pedido o país inteiro em tiles: medido
    no painel, 91 pedidos a `/api/funai-wms`, 40 s de rede somados, cada um uma
    chamada à função da Vercel, para uma imagem que era tirada do mapa antes de
    se ver.

    O raster passa a ser o que diz ser: o recurso de quando o catálogo e a Funai
    falham. Só `recorrerAoRaster` o põe no mapa.
  */
  const desired = noMapaSimples ? false : readStoredVisibility();
  map.__agsusIndigenousTerritoriesVisible = desired;
  if (desired) map.whenReady?.(scheduleRefresh);
  addControl(L, map, desired, definirVisibilidade);
}

/*
  O botão não liga nem desliga camada nenhuma por conta própria. Chama
  `definirVisibilidade`, a mesma função que a legenda usa — antes ele tirava do
  mapa o raster e o vetorial e deixava para trás os círculos das terras em
  estudo, os símbolos e os rótulos, e quem desligava as terras continuava a
  ver terras.
*/
function addControl(
  L: LeafletDasTerras,
  map: MapaDasTerrasIndigenas,
  initialVisible: boolean,
  definirVisibilidade: (visivel: boolean) => void,
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
    // A amostra da cor e o nome, montados pelo DOM (sem `innerHTML`).
    const amostra = document.createElement("span");
    amostra.className = "agsus-indigenous-territories-control__swatch";
    amostra.setAttribute("aria-hidden", "true");
    const nome = document.createElement("span");
    nome.textContent = "Terras Indígenas";
    button.append(amostra, nome);
    button.title = "Mostrar ou ocultar Terras Indígenas (Funai)";
    button.setAttribute("aria-label", button.title);

    const sync = () => {
      const current = map.__agsusIndigenousTerritoriesVisible !== false;
      button.classList.toggle("is-active", current);
      button.setAttribute("aria-pressed", current ? "true" : "false");
      container.dataset.visible = current ? "true" : "false";
    };

    button.addEventListener("click", () => {
      definirVisibilidade(!(map.__agsusIndigenousTerritoriesVisible !== false));
    });
    map.on(EVENTO_DAS_TERRAS, sync);

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    button.setAttribute("aria-pressed", initialVisible ? "true" : "false");
    sync();
    return container;
  };
  control.addTo(map);
  map.__agsusIndigenousTerritoriesControl = control;
}
