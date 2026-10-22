/*
  O ENQUADRAMENTO DO BRASIL NOS MAPAS DA VISÃO GERAL, sem DOM nem Leaflet.

  O problema: o `fitBounds` encaixava o contorno do país (BRASIL_BOUNDS) quase
  sem folga (10 px) e o `map-guard` não deixava o zoom descer de 4.5. A 4.5 o
  Brasil tem ~663 px de altura em Web Mercator; num mapa de 640 px (64vh numa
  tela de 1000 px) o país ficava maior que a moldura e o norte (Roraima e
  Amapá, lat. 5.27) e o sul saíam cortados — e as bolhas da borda, que têm até
  15 px de raio e 3 px de traço, ficavam pela metade.

  A regra: a folga de cada lado é o maior ponto do mapa mais 12 px, e o zoom
  mínimo desce, em quartos (`zoomSnap` 0.25), até o país inteiro caber com essa
  folga — 4.5 continua sendo o limite quando a moldura é grande o bastante.
  O `map-guard.js` usa `zoomQueCabe` antes de cada enquadramento do Brasil.

  A conta é a mesma do Leaflet: Web Mercator com azulejos de 256 px.
*/
import { BRASIL_BOUNDS } from "./brasil-bounds.js";
import { RAIO_MAXIMO as RAIO_DA_BOLHA } from "./mapa-render.js";

/*
  O maior ponto dos mapas: o raio da bolha do DSEI e o traço dela. O ponto de
  Projetos não passa do raio da bolha (src/lib/visao-geral-da-area.ts; o
  teste confere).
*/
export const TRACO_MAXIMO = 3;
export const RAIO_MAXIMO_NO_MAPA = RAIO_DA_BOLHA + TRACO_MAXIMO;
export const FOLGA_ALEM_DO_RAIO = 12;
export const FOLGA_DO_BRASIL = RAIO_MAXIMO_NO_MAPA + FOLGA_ALEM_DO_RAIO;

/* O zoom em que o mapa mostra o país na escala nacional (≈ 500 km na régua). */
export const ZOOM_NACIONAL = 4.5;
/* Abaixo disso o Brasil vira um selo: nenhuma moldura do app chega lá. */
export const ZOOM_MINIMO_PARA_CABER = 3;
export const PASSO_DO_ZOOM = 0.25;

const AZULEJO = 256;

/* Posição em pixels no zoom 0 (Web Mercator, como `map.project` do Leaflet). */
export function projetar([latitude, longitude]) {
  const seno = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * AZULEJO,
    y: (0.5 - Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI)) * AZULEJO,
  };
}

function tamanhoNoZoomZero(limites) {
  const [sul, oeste] = limites[0];
  const [norte, leste] = limites[1];
  const noroeste = projetar([norte, oeste]);
  const sudeste = projetar([sul, leste]);
  return { largura: sudeste.x - noroeste.x, altura: sudeste.y - noroeste.y };
}

/*
  O maior zoom (em passos de 0.25, como o `zoomSnap`) em que `limites` cabem
  na moldura com `folga` de cada lado — nunca acima de `maximo` (a escala
  nacional) nem abaixo de ZOOM_MINIMO_PARA_CABER. Moldura sem tamanho
  (escondida) devolve `maximo`: o enquadramento é refeito ao aparecer.
*/
export function zoomQueCabe({
  largura,
  altura,
  limites = BRASIL_BOUNDS,
  folga = FOLGA_DO_BRASIL,
  maximo = ZOOM_NACIONAL,
  passo = PASSO_DO_ZOOM,
} = {}) {
  const util = {
    largura: Number(largura) - 2 * folga,
    altura: Number(altura) - 2 * folga,
  };
  if (!(util.largura > 0) || !(util.altura > 0)) return maximo;
  const base = tamanhoNoZoomZero(limites);
  const escala = Math.min(
    util.largura / base.largura,
    util.altura / base.altura,
  );
  const zoom = Math.floor(Math.log2(escala) / passo) * passo;
  return Math.max(ZOOM_MINIMO_PARA_CABER, Math.min(maximo, zoom));
}

/*
  Quanto sobra entre o país e cada borda da moldura, em pixels, com os
  limites centrados no `zoom` — negativo é corte. É o que os testes conferem:
  o ponto mais ao norte (Roraima, lat. 5.27) tem de ficar a pelo menos
  RAIO_MAXIMO_NO_MAPA da borda de cima.
*/
export function sobraNaMoldura({
  largura,
  altura,
  zoom,
  limites = BRASIL_BOUNDS,
}) {
  const base = tamanhoNoZoomZero(limites);
  const fator = 2 ** zoom;
  const horizontal = (Number(largura) - base.largura * fator) / 2;
  const vertical = (Number(altura) - base.altura * fator) / 2;
  return {
    cima: vertical,
    baixo: vertical,
    esquerda: horizontal,
    direita: horizontal,
  };
}

/*
  O ENQUADRAMENTO DO RECORTE, a regra dos dois mapas da Visão geral (Saúde
  Indígena e Projetos). Sem filtro: o Brasil. Com filtro: os pontos que
  sobraram — um só vira zoom ZOOM_DO_PONTO nele; mais de um, a caixa deles
  (OPCOES_DA_CAIXA). Filtro que não deixa ponto nenhum também é o Brasil. A
  `chave` muda só quando muda o que enquadrar: o mapa não reenquadra a cada
  redesenho (nem ao agrupar a lista, nem com um ponto a mais fora do mapa).

  `pontos` são `[lat, lon]`; o mapa do DSEI tem o enquadramento dele.
*/
export const ZOOM_DO_PONTO = 7;
export const OPCOES_DA_CAIXA = Object.freeze({ padding: [60, 60], maxZoom: 7 });

/** @param {{pontos?: readonly (readonly [number, number])[], filtroAtivo?: boolean}} [opcoes] */
export function enquadramentoDoRecorte({
  pontos = [],
  filtroAtivo = false,
} = {}) {
  const lista = (Array.isArray(pontos) ? pontos : []).filter(
    (ponto) =>
      Array.isArray(ponto) &&
      Number.isFinite(Number(ponto[0])) &&
      Number.isFinite(Number(ponto[1])),
  );
  const chave =
    (filtroAtivo ? "F|" : "A|") +
    lista.map((p) => p.map((v) => Number(v).toFixed(4)).join(",")).join("|");
  if (!filtroAtivo || !lista.length)
    return { modo: "brasil", pontos: [], chave };
  if (lista.length === 1) return { modo: "ponto", pontos: lista, chave };
  return { modo: "caixa", pontos: lista, chave };
}
