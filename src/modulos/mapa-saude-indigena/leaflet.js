/*
  O LEAFLET DO MAPA DA SAÚDE INDÍGENA (sem React)

  O Leaflet vem do CDN como `window.L`, envolvido no arranque por
  `map-guard.js` (limites do Brasil, zoom, régua, teclado),
  `map-base-layer-switcher.js` (Mapa/Satélite), `map-zoom-range.js` e
  `indigenous-territories-layer.js` (Terras Indígenas e abrangência dos DSEI).
  Os dois últimos só enfeitam mapas cujo contêiner tem id `map` ou
  `detailMap` — por isso os ids do componente (ver README).

  Tudo o que entra no mapa é montado com a API do DOM (`textContent`,
  `createElementNS`): popups, dicas e ícones, sem `innerHTML`.
*/
import { criarCamadaComRecuo } from "../../modules/map-base-layer-switcher.js";
import {
  CORES_DO_MAPA,
  DESENHO_DAS_FORMAS,
  formaDoTipo,
} from "../../lib/mapa-saude-indigena/formas.js";
import { BR_OUTLINE, UF_GEO } from "../../lib/mapa-saude-indigena/contornos.js";

export function obterLeaflet() {
  const L = globalThis.L;
  return L && typeof L.map === "function" ? L : null;
}

/* Dica (tooltip) só onde há ponteiro que flutua; no toque, o popup basta. */
export function podeFlutuar() {
  return (
    globalThis.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches ===
    true
  );
}

/*
  `zoomSnap` em quartos é o que faz o Brasil (ou o distrito) encher a
  moldura: com 1, o `fitBounds` só aceita zoom inteiro e o país ocupava 60%.
*/
export function criarMapa(L, elemento) {
  return L.map(elemento, {
    zoomControl: true,
    scrollWheelZoom: true,
    attributionControl: true,
    minZoom: 4,
    maxZoom: 18,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    worldCopyJump: false,
  });
}

/*
  Fundo com recurso: OSM e, depois de 4 azulejos falhados seguidos, a imagem de
  satélite (a CARTO anónima devolve 200 com o azulejo "API KEY REQUIRED" e
  nunca falha — por isso saiu). O satélite usa o recuo de azulejo.
*/
const FUNDOS = Object.freeze([
  {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    opcoes: { maxZoom: 19, attribution: "© OpenStreetMap" },
  },
  {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    opcoes: {
      maxZoom: 19,
      attribution: "© Esri, Maxar, Earthstar Geographics",
    },
    recuo: true,
  },
]);

export function adicionarFundo(L, mapa, elemento) {
  let indice = 0;
  let falhas = 0;
  let camada = null;
  const montar = () => {
    const fundo = FUNDOS[indice];
    const opcoes = {
      ...fundo.opcoes,
      crossOrigin: true,
      updateWhenIdle: false,
      keepBuffer: 3,
    };
    camada =
      fundo.recuo && L.TileLayer?.extend
        ? criarCamadaComRecuo(L, fundo.url, opcoes)
        : L.tileLayer(fundo.url, opcoes);
    camada.on?.("tileload", () => {
      falhas = 0;
      elemento.classList.remove("map-tiles-recovering");
    });
    camada.on?.("tileerror", () => {
      falhas += 1;
      if (falhas < 4 || indice >= FUNDOS.length - 1) return;
      elemento.classList.add("map-tiles-recovering");
      mapa.removeLayer(camada);
      indice += 1;
      falhas = 0;
      montar().addTo(mapa);
    });
    return camada;
  };
  return montar().addTo(mapa);
}

/* O Leaflet guarda a última medida: o contêiner que muda de tamanho avisa. */
export function observarTamanho(mapa, elemento) {
  if (typeof ResizeObserver === "undefined") return () => {};
  let quadro = 0;
  const observador = new ResizeObserver(() => {
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(() => {
      if (!elemento.offsetWidth || !elemento.offsetHeight) return;
      try {
        mapa.invalidateSize({ animate: false, pan: false });
      } catch {
        // mapa já removido
      }
    });
  });
  observador.observe(elemento);
  return () => {
    cancelAnimationFrame(quadro);
    observador.disconnect();
  };
}

export function remedir(mapa) {
  try {
    mapa?.invalidateSize?.({ animate: false });
  } catch {
    // mapa já removido
  }
}

/* Contorno do Brasil e divisas das UFs: referência, sem clique. */
export function desenharContornos(L, camada, variante = "nacional") {
  const nacional = variante === "nacional";
  try {
    L.geoJSON(UF_GEO, {
      style: nacional
        ? {
            color: CORES_DO_MAPA.divisasDasUfs,
            weight: 0.6,
            opacity: 0.35,
            fill: false,
            interactive: false,
          }
        : {
            color: CORES_DO_MAPA.divisasNoDetalhe,
            weight: 0.65,
            opacity: 0.45,
            fillColor: CORES_DO_MAPA.fundoDasUfsNoDetalhe,
            fillOpacity: 0.025,
            interactive: false,
          },
    }).addTo(camada);
    L.geoJSON(BR_OUTLINE, {
      style: {
        color: nacional
          ? CORES_DO_MAPA.contornoDoBrasil
          : CORES_DO_MAPA.contornoNoDetalhe,
        weight: nacional ? 2.6 : 2,
        opacity: nacional ? 0.9 : 0.8,
        fill: false,
        interactive: false,
      },
    }).addTo(camada);
  } catch {
    // contorno é referência; sem ele o mapa continua útil
  }
}

/* Conteúdo de popup ou dica: { titulo, linhas, nota } em nós de texto. */
export function conteudoEmElemento(documento, { titulo, linhas = [], nota }) {
  const caixa = documento.createElement("div");
  caixa.className = "mapa-si-balao";
  if (titulo) {
    const b = documento.createElement("strong");
    b.className = "mapa-si-balao__titulo";
    b.textContent = titulo;
    caixa.append(b);
  }
  for (const linha of linhas) {
    if (!linha) continue;
    const span = documento.createElement("span");
    span.textContent = linha;
    caixa.append(span);
  }
  if (nota) {
    const small = documento.createElement("small");
    small.className = "mapa-si-balao__nota";
    small.textContent = nota;
    caixa.append(small);
  }
  return caixa;
}

const SVG = "http://www.w3.org/2000/svg";

/* A forma do tipo em SVG (18×18), para o ícone do Leaflet. */
export function svgDoTipo(documento, chave, cor) {
  const { forma, cor: corDoTipo } = formaDoTipo(chave);
  const svg = documento.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 18 18");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("aria-hidden", "true");
  const desenho = DESENHO_DAS_FORMAS[forma];
  const no = documento.createElementNS(SVG, desenho ? "path" : "circle");
  if (desenho) {
    no.setAttribute("d", desenho);
    no.setAttribute("stroke-linejoin", "round");
  } else {
    no.setAttribute("cx", "9");
    no.setAttribute("cy", "9");
    no.setAttribute("r", "6.4");
  }
  no.setAttribute("fill", cor || corDoTipo);
  no.setAttribute("stroke", "#ffffff");
  no.setAttribute("stroke-width", "1.6");
  svg.append(no);
  return svg;
}

export function iconeDoRegistro(L, documento, registro) {
  const caixa = documento.createElement("span");
  caixa.className = [
    "mapa-si-marcador",
    registro.vinculo === "externo" ? "mapa-si-marcador--externo" : "",
  ]
    .filter(Boolean)
    .join(" ");
  caixa.append(svgDoTipo(documento, registro.type?.key, registro.type?.color));
  return L.divIcon({
    className: "mapa-si-marcador-wrap",
    html: caixa,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/* Losango roxo da CASAI nacional. */
export function iconeDaCasaiNacional(L, documento) {
  const losango = documento.createElement("span");
  losango.className = "mapa-si-casai-nacional";
  losango.style.background = CORES_DO_MAPA.casaiNacional;
  return L.divIcon({
    className: "mapa-si-marcador-wrap",
    html: losango,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/*
  Dica e popup no mesmo marcador: a dica fecha quando o popup abre e não
  reabre enquanto ele estiver aberto (o autopan traz o marcador de volta para
  baixo do cursor).
*/
export function ligarDicaEPopup(marcador, documento, { dica, popup }) {
  if (popup) marcador.bindPopup(conteudoEmElemento(documento, popup));
  if (dica && podeFlutuar()) {
    marcador.bindTooltip(conteudoEmElemento(documento, dica), {
      direction: "top",
      opacity: 0.96,
    });
    if (popup) {
      marcador.on("popupopen", () => marcador.closeTooltip());
      marcador.on("tooltipopen", () => {
        if (marcador.isPopupOpen?.()) marcador.closeTooltip();
      });
    }
  }
  return marcador;
}
