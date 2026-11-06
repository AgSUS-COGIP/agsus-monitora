import { envolverFabricaDoLeaflet } from "../lib/fabrica-do-leaflet.ts";
import {
  azulejoDoRecuo,
  podeRecuar,
  semAzulejoDeAviso,
  type CoordenadasDoAzulejo,
} from "../lib/recuo-de-azulejo.ts";
import type { CamadaDeFundo } from "../modulos/mapa-saude-indigena/tipos-do-leaflet.ts";

/*
  O SELETOR MAPA | SATÉLITE

  Envolve `L.map` e `L.tileLayer` quando o Leaflet chega
  (src/modulos/mapa-saude-indigena/carregar-leaflet.ts, depois de
  `map-guard.ts`): cada camada de azulejos sai etiquetada com o tipo de fundo
  (`__agsusBaseMapKind`) e cada mapa ganha o controle "Mapa | Satélite" no
  canto do Leaflet. Vale para os três mapas da Visão geral (`map`,
  `detailMap` e `mapaDosProjetos`).

  O controle é um `L.control`, não React: mora no canto de controles que o
  Leaflet cria e gere (posição, cliques que não arrastam o mapa), igual nos
  três mapas. A troca é só de camadas de azulejos: pontos, polígonos e
  rótulos ficam onde estão.

  O mapa nacional da Saúde Indígena (`#map`) tem um terceiro botão, "Mapa
  simples": tira todos os azulejos (nenhum é baixado), marca o contêiner com
  `map-simple-mode` (o fundo liso vem do CSS) e avisa pelo mesmo evento
  `agsus:map-base-layer-changed`; os 34 DSEIs chapados são desenhados pelo
  componente (src/modulos/mapa-saude-indigena/mapa-simples.tsx). Os outros
  mapas não oferecem o modo e leem a escolha guardada como "Mapa".

  O Leaflet vem do CDN como `window.L`, sem tipos instalados: este arquivo
  declara só o que usa dele.
*/

export type ModoDoFundo = "map" | "satellite" | "simple";

interface EventoDoMapa {
  layer?: CamadaDoFundo;
}

interface CamadaDoFundo {
  __agsusBaseMapKind?: ModoDoFundo | null;
  __agsusTileUrlTemplate?: string;
  on(evento: string, ouvinte: () => void): unknown;
  addTo(mapa: MapaComSeletor): CamadaDoFundo;
  bringToBack?(): unknown;
}

interface ControleDoLeaflet {
  onAdd?: () => HTMLElement;
  addTo(mapa: MapaComSeletor): unknown;
}

/* O que o seletor guarda no próprio mapa (os campos `__agsus*`). */
interface EstadoDoSeletor {
  __agsusBaseLayerSwitcherReady?: boolean;
  __agsusBaseMapMode: ModoDoFundo;
  __agsusDesiredBaseMapMode: ModoDoFundo;
  __agsusStoredMapLayers: CamadaDoFundo[];
  __agsusSatelliteLayer: CamadaDoFundo | null;
  __agsusSatelliteErrors: number;
  __agsusFailedBaseModes: Set<ModoDoFundo>;
  __agsusSwitchingBaseLayer: boolean;
  __agsusBaseLayerControl?: ControleDoLeaflet;
  __agsusBaseLayerControlElement?: HTMLElement;
}

export interface MapaComSeletor extends Partial<EstadoDoSeletor> {
  on(evento: string, ouvinte: (evento?: EventoDoMapa) => void): unknown;
  whenReady(ouvinte: () => void): unknown;
  hasLayer(camada: unknown): boolean;
  removeLayer(camada: unknown): unknown;
  eachLayer?(
    ouvinte: (camada: CamadaDoFundo | null | undefined) => void,
  ): unknown;
  getContainer?(): HTMLElement;
  setMinZoom?(zoom: number): unknown;
  setMaxZoom?(zoom: number): unknown;
}

/* O mapa depois de `enhanceMap`: todos os campos do seletor existem. */
type MapaPronto = MapaComSeletor & EstadoDoSeletor;

type OpcoesDaCamada = {
  maxZoom?: unknown;
  maxNativeZoom?: unknown;
  minZoom?: number;
  crossOrigin?: boolean | string;
  [opcao: string]: unknown;
};

type ElementoDoMapa = string | { id?: unknown } | null | undefined;

/* O `this` dos métodos de uma camada criada por `L.TileLayer.extend`. */
interface CamadaDeAzulejos {
  _url: string;
  _tiles: Record<
    string,
    { el?: { firstChild?: ChildNode | null } } | undefined
  >;
  options: OpcoesDaCamada;
  getTileSize(): { x: number; y: number };
}

interface UtilDoLeaflet {
  template(url: string, dados: object): string;
  extend(destino: object, ...origens: object[]): object;
  emptyImageUrl: string;
}

interface ClasseDeAzulejos {
  extend(
    metodos: object,
  ): new (url: string, opcoes: OpcoesDaCamada) => CamadaDoFundo;
  prototype: { _removeTile(this: unknown, chave: string): unknown };
}

/** O que este arquivo usa de `window.L`. */
export interface LeafletDoSeletor {
  map: (
    this: unknown,
    elemento: ElementoDoMapa,
    opcoes?: OpcoesDaCamada,
  ) => MapaComSeletor;
  tileLayer: (
    this: unknown,
    url: string,
    opcoes?: OpcoesDaCamada,
  ) => CamadaDoFundo;
  control: (opcoes: { position: string }) => ControleDoLeaflet;
  DomUtil: { create(tag: string, classe: string): HTMLElement };
  DomEvent: {
    disableClickPropagation(elemento: HTMLElement): unknown;
    disableScrollPropagation(elemento: HTMLElement): unknown;
  };
  TileLayer: ClasseDeAzulejos;
  Util: UtilDoLeaflet;
  __agsusBaseLayerSwitcherInstalled?: boolean;
}

/* A caixa de cada azulejo de satélite: o Leaflet lê `complete` para abortar. */
type CaixaDoAzulejo = HTMLDivElement & { complete?: boolean };

const STORAGE_KEY = "agsus_map_base_layer_v1";
const MODE_MAP: ModoDoFundo = "map";
const MODE_SATELLITE: ModoDoFundo = "satellite";
export const MODO_SIMPLES: ModoDoFundo = "simple";
const SATELLITE_ERROR_LIMIT = 4;

/* O aviso de troca de fundo (sobe do contêiner do mapa): `detail.mode`. */
export const EVENTO_DO_FUNDO = "agsus:map-base-layer-changed";
const CLASSE_DO_MAPA_SIMPLES = "map-simple-mode";

/* Só o mapa nacional da Saúde Indígena tem o "Mapa DSEIs". */
export function aceitaMapaSimples(map: Pick<MapaComSeletor, "getContainer">) {
  return map.getContainer?.()?.id === "map";
}

/* O modo que o mapa vai mostrar (ou já mostra): o pedido ao seletor. */
export function modoDesejadoDoFundo(mapa: object | null | undefined) {
  const modo = mapa
    ? (mapa as Partial<EstadoDoSeletor>).__agsusDesiredBaseMapMode
    : undefined;
  return modo ?? MODE_MAP;
}

/*
  A camada de azulejos do fundo entra no mapa por aqui (`adicionarFundo`,
  leaflet.ts): no "Mapa DSEIs" ela fica guardada para quando a pessoa
  voltar ao "Mapa", sem entrar — e sem baixar azulejo nenhum.
*/
export function adicionarCamadaDeFundo<T extends { addTo(mapa: never): T }>(
  mapa: object,
  camada: T,
): T {
  const map = mapa as MapaPronto;
  if (
    map.__agsusBaseLayerSwitcherReady &&
    map.__agsusDesiredBaseMapMode === MODO_SIMPLES
  ) {
    rememberMapLayer(map, camada as unknown as CamadaDoFundo);
    return camada;
  }
  return camada.addTo(mapa as never);
}

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

export function addResilientBaseLayer(
  L: LeafletDoSeletor,
  mapa: MapaComSeletor,
) {
  const map = enhanceMap(L, mapa);
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

/* `window.L` com tudo o que o seletor usa; senão, nada a instalar. */
function leafletDoSeletor(valor: unknown): LeafletDoSeletor | null {
  if (!valor || typeof valor !== "object") return null;
  const L = valor as Partial<LeafletDoSeletor>;
  return L.map && L.tileLayer && L.control && L.DomUtil && L.DomEvent
    ? (L as LeafletDoSeletor)
    : null;
}

export function installMapBaseLayerSwitcher() {
  if (installed) return true;

  const L = leafletDoSeletor(window.L);
  if (!L) return false;
  if (L.__agsusBaseLayerSwitcherInstalled) {
    installed = true;
    return true;
  }

  const guardedTileLayer = L.tileLayer;
  // `envolverFabricaDoLeaflet` preserva o que está pendurado na fábrica —
  // nomeadamente `L.tileLayer.wms`. Ver `src/lib/fabrica-do-leaflet.ts`.
  L.tileLayer = envolverFabricaDoLeaflet(
    guardedTileLayer,
    function agsusTaggedTileLayer(
      this: unknown,
      urlTemplate: string,
      options: OpcoesDaCamada = {},
    ) {
      const kind = classifyBaseLayerUrl(urlTemplate);
      const tileOptions = normalizeTileZoomOptions(kind, options);
      const layer = guardedTileLayer.call(this, urlTemplate, tileOptions);
      layer.__agsusTileUrlTemplate = String(urlTemplate || "");
      layer.__agsusBaseMapKind = kind;
      return layer;
    },
  );

  const guardedMap = L.map;
  L.map = function agsusMapWithBaseLayerSwitcher(
    this: unknown,
    element: ElementoDoMapa,
    options: OpcoesDaCamada = {},
  ) {
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

function healthMapElementId(element: ElementoDoMapa) {
  if (typeof element === "string") return element;
  return String(element?.id || "");
}

/* Os mapas da Visão geral: os dois da Saúde Indígena e o de Projetos. */
function isHealthMapElement(element: ElementoDoMapa) {
  const id = healthMapElementId(element);
  return id === "map" || id === "detailMap" || id === "mapaDosProjetos";
}

export function normalizeMapZoomOptions(
  element: ElementoDoMapa,
  options: OpcoesDaCamada = {},
): OpcoesDaCamada {
  if (!isHealthMapElement(element)) return { ...options };
  return {
    ...options,
    minZoom: MAP_MIN_ZOOM,
    maxZoom: MAP_MAX_ZOOM,
  };
}

function enforceMapZoomRange(
  map: MapaComSeletor | null | undefined,
  element: ElementoDoMapa,
) {
  if (!map || !isHealthMapElement(element)) return;
  map.setMinZoom?.(MAP_MIN_ZOOM);
  map.setMaxZoom?.(MAP_MAX_ZOOM);
}

function normalizeTileZoomOptions(
  kind: ModoDoFundo | null,
  options: OpcoesDaCamada = {},
): OpcoesDaCamada {
  if (!kind) return { ...options };

  const nativeZoom = Number(options.maxNativeZoom ?? options.maxZoom);
  const normalized: OpcoesDaCamada = {
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

export function classifyBaseLayerUrl(urlTemplate: unknown): ModoDoFundo | null {
  const url = String(urlTemplate || "").toLowerCase();
  if (url.includes("world_imagery/mapserver")) return MODE_SATELLITE;
  if (CARTOGRAPHIC_HOSTS.some((host) => url.includes(host))) return MODE_MAP;
  return null;
}

function enhanceMap(L: LeafletDoSeletor, mapa: MapaComSeletor): MapaPronto {
  const map = mapa as MapaPronto;
  if (!map || map.__agsusBaseLayerSwitcherReady) return map;
  map.__agsusBaseLayerSwitcherReady = true;
  map.__agsusBaseMapMode = MODE_MAP;
  map.__agsusDesiredBaseMapMode = readStoredMode(aceitaMapaSimples(map));
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
      const desejado = map.__agsusDesiredBaseMapMode;
      if (desejado === MODE_SATELLITE || desejado === MODO_SIMPLES) {
        queueMicrotask(() => setBaseMapMode(L, map, desejado));
      }
    }
  });

  addSwitcherControl(L, map);

  map.whenReady(() => {
    queueMicrotask(() => {
      findLayers(map, MODE_MAP).forEach((layer) =>
        rememberMapLayer(map, layer),
      );
      const desejado = map.__agsusDesiredBaseMapMode;
      if (desejado === MODE_SATELLITE || desejado === MODO_SIMPLES) {
        setBaseMapMode(L, map, desejado);
      } else {
        syncControl(map);
      }
    });
  });
  return map;
}

function addSwitcherControl(L: LeafletDoSeletor, map: MapaPronto) {
  if (map.__agsusBaseLayerControl) return;

  const control = L.control({ position: "topleft" });
  control.onAdd = () => {
    const container = L.DomUtil.create(
      "div",
      "leaflet-control agsus-basemap-switcher",
    );
    container.setAttribute("role", "group");
    container.setAttribute("aria-label", "Camada de fundo do mapa");

    const botoes: [ModoDoFundo, string][] = [
      [MODE_MAP, "Mapa"],
      [MODE_SATELLITE, "Satélite"],
    ];
    if (aceitaMapaSimples(map)) botoes.push([MODO_SIMPLES, "Mapa DSEIs"]);
    for (const [modo, rotulo] of botoes) {
      const botao = createButton(L, modo, rotulo);
      botao.addEventListener("click", () => {
        map.__agsusDesiredBaseMapMode = modo;
        setBaseMapMode(L, map, modo, { persist: true });
      });
      container.append(botao);
    }

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    map.__agsusBaseLayerControlElement = container;
    syncControl(map);
    return container;
  };

  control.addTo(map);
  map.__agsusBaseLayerControl = control;
}

function createButton(L: LeafletDoSeletor, mode: ModoDoFundo, label: string) {
  const button = L.DomUtil.create("button", "agsus-basemap-switcher__button");
  if (button instanceof HTMLButtonElement) button.type = "button";
  button.dataset.mapMode = mode;
  button.textContent = label;
  button.setAttribute("aria-pressed", "false");
  return button;
}

function setBaseMapMode(
  L: LeafletDoSeletor,
  map: MapaPronto,
  requestedMode: ModoDoFundo,
  { persist = false } = {},
) {
  const mode =
    requestedMode === MODE_SATELLITE
      ? MODE_SATELLITE
      : requestedMode === MODO_SIMPLES && aceitaMapaSimples(map)
        ? MODO_SIMPLES
        : MODE_MAP;
  if (!map || map.__agsusSwitchingBaseLayer) return false;

  if (mode !== MODE_MAP) {
    const currentMapLayers = findLayers(map, MODE_MAP);
    currentMapLayers.forEach((layer) => rememberMapLayer(map, layer));
    if (mode === MODE_SATELLITE && !map.__agsusStoredMapLayers.length)
      return false;
  }

  map.__agsusSwitchingBaseLayer = true;
  try {
    if (mode !== MODE_MAP) {
      findLayers(map, MODE_MAP).forEach((layer) => map.removeLayer(layer));
    }
    if (mode === MODE_SATELLITE) {
      const satelliteLayer = getSatelliteLayer(L, map);
      if (!map.hasLayer(satelliteLayer)) satelliteLayer.addTo(map);
      satelliteLayer.bringToBack?.();
    } else if (
      map.__agsusSatelliteLayer &&
      map.hasLayer(map.__agsusSatelliteLayer)
    ) {
      map.removeLayer(map.__agsusSatelliteLayer);
    }
    // O "Mapa DSEIs" não tem azulejo nenhum: o fundo liso é do CSS.
    if (mode === MODE_MAP) {
      map.__agsusStoredMapLayers.forEach((layer) => {
        if (!map.hasLayer(layer)) layer.addTo(map);
        layer.bringToBack?.();
      });
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

  Ver `src/lib/recuo-de-azulejo.ts`: acima do zoom 17, nos territórios
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
export function criarCamadaComRecuo(
  leaflet: object,
  url: string,
  options: OpcoesDaCamada,
): CamadaDeFundo & CamadaDoFundo {
  // O `L` de verdade (do CDN): quem chama já conferiu `L.TileLayer.extend`.
  const L = leaflet as Pick<LeafletDoSeletor, "TileLayer" | "Util">;
  const Camada = L.TileLayer.extend({
    createTile(
      this: CamadaDeAzulejos,
      coords: CoordenadasDoAzulejo,
      done: (erro: Error | null, azulejo: HTMLElement) => void,
    ) {
      const tamanho = this.getTileSize();
      const caixa: CaixaDoAzulejo = document.createElement("div");
      caixa.style.overflow = "hidden";
      // O Leaflet lê `complete` para decidir se aborta o azulejo ao mudar de zoom.
      caixa.complete = false;

      const img = document.createElement("img");
      img.alt = "";
      img.setAttribute("role", "presentation");
      img.style.display = "block";
      img.style.maxWidth = "none";
      img.style.maxHeight = "none";
      const origem = this.options.crossOrigin;
      if (origem === true || origem === "") img.crossOrigin = "";
      else if (origem) img.crossOrigin = origem;

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
    _removeTile(this: CamadaDeAzulejos, key: string) {
      const img = this._tiles[key]?.el?.firstChild;
      if (img instanceof HTMLImageElement) {
        img.onload = null;
        img.onerror = null;
        img.src = L.Util.emptyImageUrl;
      }
      return L.TileLayer.prototype._removeTile.call(this, key);
    },
  });
  return new Camada(url, options) as CamadaDeFundo & CamadaDoFundo;
}

function getSatelliteLayer(L: LeafletDoSeletor, map: MapaPronto) {
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

function rememberMapLayer(map: MapaPronto, layer: CamadaDoFundo) {
  if (!layer || layer.__agsusBaseMapKind !== MODE_MAP) return;
  if (!map.__agsusStoredMapLayers.includes(layer)) {
    map.__agsusStoredMapLayers.push(layer);
  }
}

function findLayers(map: MapaComSeletor, kind: ModoDoFundo) {
  const layers: CamadaDoFundo[] = [];
  map.eachLayer?.((layer) => {
    if (layer?.__agsusBaseMapKind === kind) layers.push(layer);
  });
  return layers;
}

function syncControl(map: MapaPronto) {
  const root = map.__agsusBaseLayerControlElement;
  if (!root) return;
  root.querySelectorAll<HTMLElement>("[data-map-mode]").forEach((button) => {
    const active = button.dataset.mapMode === map.__agsusBaseMapMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function dispatchModeChange(map: MapaComSeletor, mode: ModoDoFundo) {
  const container = map.getContainer?.();
  container?.classList.toggle("map-satellite-mode", mode === MODE_SATELLITE);
  container?.classList.toggle(CLASSE_DO_MAPA_SIMPLES, mode === MODO_SIMPLES);
  container?.dispatchEvent(
    new CustomEvent(EVENTO_DO_FUNDO, {
      bubbles: true,
      detail: { mode },
    }),
  );
}

function dispatchFallback(map: MapaComSeletor) {
  map.getContainer?.().dispatchEvent(
    new CustomEvent("agsus:map-satellite-fallback", {
      bubbles: true,
      detail: { mode: MODE_MAP, reason: "tileerror" },
    }),
  );
}

/* A escolha guardada; o "Mapa DSEIs" vale só onde o mapa o oferece. */
function readStoredMode(aceitaSimples = false): ModoDoFundo {
  try {
    const guardado = localStorage.getItem(STORAGE_KEY);
    if (guardado === MODE_SATELLITE) return MODE_SATELLITE;
    if (guardado === MODO_SIMPLES && aceitaSimples) return MODO_SIMPLES;
    return MODE_MAP;
  } catch {
    return MODE_MAP;
  }
}

function storeMode(mode: ModoDoFundo) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // A preferência é opcional; o mapa continua funcional sem storage.
  }
}
