/*
  O LEAFLET DOS MAPAS DA VISÃO GERAL (sem React)

  Usado pelo mapa da Saúde Indígena e pelo de Projetos
  (src/modulos/mapa-de-projetos/). O Leaflet vem do CDN como `window.L`,
  envolvido no arranque por `map-guard.js` (limites do Brasil, zoom, régua,
  teclado), `map-base-layer-switcher.js` (Mapa/Satélite), `map-zoom-range.js`
  e `indigenous-territories-layer.js` (Terras Indígenas e abrangência dos
  DSEI). Os dois últimos só enfeitam mapas cujo contêiner tem id `map` ou
  `detailMap` (o Mapa/Satélite também `mapaDosProjetos`) — por isso os ids
  dos componentes (ver README).

  Tudo o que entra no mapa é montado com a API do DOM (`textContent`,
  `createElementNS`): popups, dicas e ícones, sem `innerHTML`.
*/
import type {
  CoordenadasDoMapa,
  MapaNacional,
} from "../../lib/tipos-do-mapa.ts";
import type {
  RegistroDoDsei,
  EnquadramentoDoMapa,
} from "../../lib/mapa-saude-indigena/tipos.ts";
import type { MapaDoPainel, MapaCriadoDoBrasil } from "./tipos-do-painel.ts";
import type {
  LeafletDoMapa,
  CamadaDeFundo,
  CamadaDoMapa,
  CamadaLeaflet,
  MarcadorIndigena,
  LequeDoMapa,
} from "./tipos-do-leaflet.ts";
import { leafletDoMapa } from "./tipos-do-leaflet.ts";
export interface ConteudoDoBalao {
  titulo?: string;
  linhas?: readonly string[];
  nota?: string;
}
import { BRASIL_BOUNDS } from "../../lib/brasil-bounds.js";
import {
  FOLGA_DO_BRASIL,
  OPCOES_DA_CAIXA,
  ZOOM_DO_PONTO,
  ZOOM_NACIONAL,
} from "../../lib/enquadramento-do-brasil.js";
import { calcularLeque } from "../../lib/leque-de-marcadores.js";
import { criarCamadaComRecuo } from "../../modules/map-base-layer-switcher.js";
import {
  CORES_DO_MAPA,
  DESENHO_DAS_FORMAS,
  formaDoTipo,
} from "../../lib/mapa-saude-indigena/formas.ts";
import { BR_OUTLINE, UF_GEO } from "../../lib/mapa-saude-indigena/contornos.js";
import {
  manterDicasDentroDoMapa,
  opcoesDoPopup,
} from "../../lib/dica-dentro-do-mapa.js";

export function obterLeaflet() {
  return leafletDoMapa(Reflect.get(globalThis, "L"));
}

/* Dica (tooltip) só onde há ponteiro que flutua; no toque, o popup basta. */
export function podeFlutuar() {
  return (
    globalThis.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches ===
    true
  );
}

/* Quem pediu menos movimento ao sistema não vê o mapa voar: ele salta. */
export function prefereMenosMovimento() {
  return (
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ===
    true
  );
}

/*
  `zoomSnap` em quartos é o que faz o Brasil (ou o distrito) encher a
  moldura: com 1, o `fitBounds` só aceita zoom inteiro e o país ocupava 60%.
  Toda dica e todo popup do mapa ficam dentro dele (`manterDicasDentroDoMapa`:
  direção que cabe, largura relativa ao mapa); o `remove` desfaz o ouvinte.
*/
export function criarMapa(L: LeafletDoMapa, elemento: HTMLElement) {
  const mapa = L.map(elemento, {
    zoomControl: true,
    scrollWheelZoom: true,
    attributionControl: true,
    minZoom: 4,
    maxZoom: 18,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    worldCopyJump: false,
    // O enquadramento é do componente; o map-guard não reenquadra por cima.
    enquadramentoProprio: true,
  });
  manterDicasDentroDoMapa(mapa);
  return mapa;
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

export function adicionarFundo(
  L: LeafletDoMapa,
  mapa: MapaDoPainel,
  elemento: HTMLElement,
) {
  let indice = 0;
  let falhas = 0;
  let camada: CamadaDeFundo;
  const montar = () => {
    const fundo = FUNDOS[indice];
    if (!fundo) throw new Error("Fundo do mapa indisponível");
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

/*
  O Leaflet guarda a última medida: o contêiner que muda de tamanho avisa.

  O mapa pode nascer escondido — a Visão geral monta antes do login, e fica
  montada noutra tela ou ao trocar de área — e o enquadramento feito com
  medida zero sai no zoom errado (o do `map-guard` também desiste). Quando o
  contêiner passa de zero para um tamanho, `aoAparecer` reenquadra; quando
  muda de medida já visível (tela cheia, barra lateral, janela),
  `aoMudarDeTamanho`.
*/
export function observarTamanho(
  mapa: MapaDoPainel,
  elemento: HTMLElement,
  {
    aoAparecer,
    aoMudarDeTamanho,
  }: { aoAparecer?: () => void; aoMudarDeTamanho?: () => void } = {},
) {
  if (typeof ResizeObserver === "undefined") return () => {};
  const temTamanho = () =>
    Boolean(elemento.offsetWidth && elemento.offsetHeight);
  let visivel = temTamanho();
  let medida = `${elemento.offsetWidth}x${elemento.offsetHeight}`;
  let quadro = 0;
  const observador = new ResizeObserver(() => {
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(() => {
      if (!temTamanho()) {
        visivel = false;
        return;
      }
      try {
        mapa.invalidateSize({ animate: false, pan: false });
      } catch {
        // mapa já removido
      }
      const anterior = medida;
      medida = `${elemento.offsetWidth}x${elemento.offsetHeight}`;
      if (visivel) {
        if (medida !== anterior) aoMudarDeTamanho?.();
        return;
      }
      visivel = true;
      aoAparecer?.();
    });
  });
  observador.observe(elemento);
  return () => {
    cancelAnimationFrame(quadro);
    observador.disconnect();
  };
}

export function remedir(
  mapa: Pick<MapaNacional, "invalidateSize"> | null | undefined,
) {
  try {
    mapa?.invalidateSize?.({ animate: false });
  } catch {
    // mapa já removido
  }
}

/* O Brasil pelo contorno real (`BRASIL_BOUNDS`), como o `map-guard`. */
export function limitesDoBrasil(L: LeafletDoMapa) {
  return L.latLngBounds(BRASIL_BOUNDS[0], BRASIL_BOUNDS[1]);
}

/*
  O país inteiro com folga para as bolhas da borda (raio + traço + 12 px,
  src/lib/enquadramento-do-brasil.js); numa moldura baixa o `map-guard` deixa
  o zoom descer, em quartos, até caber — o norte não sai cortado.
*/
export function enquadrarNoBrasil(L: LeafletDoMapa, mapa: MapaDoPainel) {
  mapa.fitBounds(limitesDoBrasil(L), {
    padding: [FOLGA_DO_BRASIL, FOLGA_DO_BRASIL],
    animate: false,
  });
}

/*
  A volta de um DSEI ao Brasil: o mesmo enquadramento de `enquadrarNoBrasil`
  (folga das bolhas, escala nacional de ≈ 500 km no máximo; o `map-guard`
  desce o mínimo se a altura atual não couber), mas voando em `duracao`
  segundos. Quem decide se anima é `podeVoar` (menos movimento não voa).
*/
export const DURACAO_DA_VOLTA_AO_BRASIL = 0.8;

export function podeVoar(mapa: Pick<MapaDoPainel, "flyToBounds"> | null) {
  return typeof mapa?.flyToBounds === "function" && !prefereMenosMovimento();
}

export function voarAoBrasil(
  L: LeafletDoMapa,
  mapa: MapaDoPainel,
  { duracao = DURACAO_DA_VOLTA_AO_BRASIL } = {},
) {
  mapa.flyToBounds(limitesDoBrasil(L), {
    padding: [FOLGA_DO_BRASIL, FOLGA_DO_BRASIL],
    maxZoom: ZOOM_NACIONAL,
    duration: duracao,
  });
}

/*
  O enquadramento do recorte (`enquadramentoDoRecorte`,
  src/lib/enquadramento-do-brasil.js) no Leaflet, igual nos dois mapas
  nacionais: um ponto em ZOOM_DO_PONTO, a caixa com OPCOES_DA_CAIXA ou o
  Brasil. Com `voar` (a volta de um DSEI), anima em DURACAO_DA_VOLTA_AO_BRASIL.
*/
export function enquadrar(
  L: LeafletDoMapa,
  mapa: MapaDoPainel,
  enquadramento: EnquadramentoDoMapa,
  { voar = false } = {},
) {
  const duracao = { duration: DURACAO_DA_VOLTA_AO_BRASIL };
  if (enquadramento?.modo === "ponto") {
    const [ponto] = enquadramento.pontos;
    if (!ponto) return;
    if (voar) mapa.flyTo(ponto, ZOOM_DO_PONTO, duracao);
    else mapa.setView(ponto, ZOOM_DO_PONTO, { animate: false });
  } else if (enquadramento?.modo === "caixa") {
    const caixa = L.latLngBounds(enquadramento.pontos);
    if (voar) mapa.flyToBounds(caixa, { ...OPCOES_DA_CAIXA, ...duracao });
    else mapa.fitBounds(caixa, { ...OPCOES_DA_CAIXA, animate: false });
  } else if (voar) voarAoBrasil(L, mapa);
  else enquadrarNoBrasil(L, mapa);
}

/* O botão "Brasil": para a animação e volta ao país inteiro. */
export function voltarAoBrasil(
  L: LeafletDoMapa | null,
  mapa: MapaDoPainel | null,
) {
  if (!L || !mapa) return;
  try {
    mapa.stop?.();
    enquadrarNoBrasil(L, mapa);
  } catch {
    // mapa sem tamanho
  }
}

/* Gestos que mostram que a pessoa pegou o mapa (arrastar, zoom, teclado, clique). */
const GESTOS = ["pointerdown", "touchstart", "wheel", "keydown"];

/*
  O mapa nacional dos dois módulos: o mapa (`criarMapa`) enquadrado no
  Brasil, o fundo com recurso, os contornos e o observador de tamanho.

  `aoReenquadrar` é chamado quando o enquadramento do app precisa ser
  refeito: o mapa apareceu (estava sem medida) ou mudou de tamanho — tela
  cheia, barra lateral, janela — enquanto a pessoa não mexeu nele. Depois de
  um gesto dela, o redimensionamento só remede (a vista dela fica); `soltar()`,
  chamado pelo app depois de enquadrar de novo (filtro, "Brasil"), volta a
  acompanhar, e `pegar()` conta como gesto (a lista que leva a um ponto).
  `parar()` e o `mapa.remove()` desfazem tudo.
*/

export function criarMapaDoBrasil(
  L: LeafletDoMapa,
  elemento: HTMLElement,
  { aoReenquadrar }: { aoReenquadrar?: () => void } = {},
): MapaCriadoDoBrasil {
  const mapa = criarMapa(L, elemento);
  enquadrarNoBrasil(L, mapa);
  adicionarFundo(L, mapa, elemento);
  let mexido = false;
  const aoMexer = () => {
    mexido = true;
  };
  for (const gesto of GESTOS)
    elemento.addEventListener(gesto, aoMexer, { passive: true });
  const pararDeObservar = observarTamanho(mapa, elemento, {
    aoAparecer: () => aoReenquadrar?.(),
    aoMudarDeTamanho: () => {
      if (!mexido) aoReenquadrar?.();
    },
  });
  desenharContornos(L, L.layerGroup().addTo(mapa), "nacional");
  return {
    mapa,
    pegar: aoMexer,
    soltar: () => {
      mexido = false;
    },
    parar: () => {
      pararDeObservar();
      for (const gesto of GESTOS) elemento.removeEventListener(gesto, aoMexer);
    },
  };
}

/* Contorno do Brasil e divisas das UFs: referência, sem clique. */
export function desenharContornos(
  L: LeafletDoMapa,
  camada: CamadaDoMapa,
  variante = "nacional",
) {
  const nacional = variante === "nacional";
  try {
    L.geoJSON?.(UF_GEO, {
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
    L.geoJSON?.(BR_OUTLINE, {
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

/* O traço do leque usa o texto secundário do tema; o cinza-azulado é reserva. */
function corDoTraco() {
  try {
    const cor = getComputedStyle(document.documentElement)
      .getPropertyValue("--text-secondary")
      .trim();
    if (cor) return cor;
  } catch {
    // sem estilos computados (teste)
  }
  return CORES_DO_MAPA.traco;
}

/*
  O LEQUE dos dois mapas nacionais: as bolhas que caem no mesmo pixel
  (Yanomami e Leste de Roraima em Boa Vista; dois lugares de Projetos na
  mesma sede) são desenhadas num círculo de 16 px em volta do ponto real, com
  um traço até ele (src/lib/leque-de-marcadores.js). A coordenada não muda;
  recalcula a cada zoom e quando o app chama `aplicar()` depois de desenhar.

  `adicionar(marcador, lat, lon)` registra a bolha; `limpar()` esquece as
  bolhas e os traços (o app limpa a camada); `parar()` desliga o `zoomend`.
*/

export function criarLeque(
  L: LeafletDoMapa,
  mapa: MapaDoPainel,
  camada: CamadaDoMapa,
): LequeDoMapa {
  const marcadores: { marcador: MarcadorIndigena; lat: number; lon: number }[] =
    [];
  const tracos: CamadaLeaflet[] = [];
  const aplicar = () => {
    tracos.forEach((traco) => camada.removeLayer(traco));
    tracos.length = 0;
    const vivos = marcadores.filter(({ marcador }) =>
      camada.hasLayer(marcador),
    );
    if (!vivos.length) return;
    const pontos = vivos.map(({ lat, lon }) =>
      mapa.latLngToLayerPoint([lat, lon]),
    );
    const cor = corDoTraco();
    calcularLeque(pontos).forEach((desvio, i) => {
      const vivo = vivos[i];
      const ponto = pontos[i];
      if (!vivo || !ponto) return;
      const { marcador, lat, lon } = vivo;
      if (!desvio.emLeque) {
        marcador.setLatLng([lat, lon]);
        return;
      }
      const destino = mapa.layerPointToLatLng(
        ponto.add(L.point(desvio.dx, desvio.dy)),
      );
      marcador.setLatLng(destino);
      tracos.push(
        L.polyline([[lat, lon], destino], {
          color: cor,
          weight: 1,
          opacity: 0.7,
          interactive: false,
        }),
        L.circleMarker([lat, lon], {
          radius: 2,
          stroke: false,
          fillColor: cor,
          fillOpacity: 0.9,
          interactive: false,
        }),
      );
    });
    if (!tracos.length) return;
    tracos.forEach((traco) => camada.addLayer(traco));
    vivos.forEach(({ marcador }) => marcador.bringToFront?.());
  };
  mapa.on("zoomend", aplicar);
  return {
    adicionar(marcador: MarcadorIndigena, lat: number, lon: number) {
      marcadores.push({ marcador, lat, lon });
    },
    limpar() {
      marcadores.length = 0;
      tracos.length = 0;
    },
    aplicar,
    parar() {
      mapa.off("zoomend", aplicar);
    },
  };
}

/* Conteúdo de popup ou dica: { titulo, linhas, nota } em nós de texto. */

export function conteudoEmElemento(
  documento: Document,
  { titulo, linhas = [], nota }: ConteudoDoBalao,
) {
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
export function svgDoTipo(documento: Document, chave: string, cor?: string) {
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

export function iconeDoRegistro(
  L: LeafletDoMapa,
  documento: Document,
  registro: Pick<RegistroDoDsei, "vinculo" | "type">,
) {
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
export function iconeDaCasaiNacional(L: LeafletDoMapa, documento: Document) {
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
  baixo do cursor). `dica` e `popup` são `{ titulo, linhas, nota }` ou um
  elemento já montado (cada um o seu: um nó não fica em dois lugares).
*/
export function ligarDicaEPopup(
  marcador: MarcadorIndigena,
  documento: Document,
  {
    dica,
    popup,
  }: {
    dica?: ConteudoDoBalao | HTMLElement | null;
    popup?: ConteudoDoBalao | HTMLElement | null;
  },
) {
  const emElemento = (conteudo: ConteudoDoBalao | HTMLElement) =>
    "nodeType" in conteudo ? conteudo : conteudoEmElemento(documento, conteudo);
  if (popup) marcador.bindPopup(emElemento(popup), opcoesDoPopup());
  if (dica && podeFlutuar()) {
    marcador.bindTooltip(emElemento(dica), {
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
