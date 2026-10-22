/*
  A cena em volta dos fogos, sem DOM: o voo da Aya (a arara azul que solta o
  primeiro foguete), o véu escuro que faz as cores brilharem e a regra do som
  (opcional, desligado por padrão). O desenho é de src/modules/comemoracao.js;
  o roteiro e a física dos fogos, de src/lib/fogos.js.

  Unidades: tempo em segundos desde o começo do show, posição em px CSS.
*/

import { gravarArmazenamento, lerArmazenamento } from "./comemoracao.js";

const limitar = (valor, min, max) => Math.min(max, Math.max(min, valor));

/*
  O voo: entra pela esquerda, sobe numa curva suave, passa pelo meio da tela
  e sai pela direita, mais alto. Solta o primeiro foguete em `soltura` s.
*/
export const VOO_DA_AYA = Object.freeze({
  inicio: 0,
  duracao: 2.2,
  soltura: 0.8,
  /* Batidas de asa por segundo. */
  batidas: 4.5,
});

/** O trajeto da Aya numa tela: curva de Bézier cúbica e o tamanho (px). */
export function trajetoDaAya({ largura = 800, altura = 600 } = {}) {
  const tamanho = Math.round(
    limitar(Math.min(largura, altura) * 0.13, 64, 128),
  );
  return {
    ...VOO_DA_AYA,
    tamanho,
    pontos: [
      [-0.12 * largura - tamanho, 0.66 * altura],
      [0.28 * largura, 0.3 * altura],
      [0.6 * largura, 0.62 * altura],
      [1.1 * largura + tamanho, 0.2 * altura],
    ],
  };
}

const suave = (u) => 0.5 - 0.5 * Math.cos(Math.PI * limitar(u, 0, 1));

function bezier([p0, p1, p2, p3], u) {
  const v = 1 - u;
  const ponto = (i) =>
    v * v * v * p0[i] +
    3 * v * v * u * p1[i] +
    3 * v * u * u * p2[i] +
    u * u * u * p3[i];
  const derivada = (i) =>
    3 * v * v * (p1[i] - p0[i]) +
    6 * v * u * (p2[i] - p1[i]) +
    3 * u * u * (p3[i] - p2[i]);
  return { x: ponto(0), y: ponto(1), dx: derivada(0), dy: derivada(1) };
}

/**
 * Onde a Aya está em `t` s: posição do centro, rotação (rad, acompanha a
 * curva), escala (o bater de asas: achata e estica de leve) e opacidade.
 * Fora do voo, `null`.
 */
export function posicaoDaAya(trajeto, t) {
  if (!trajeto) return null;
  const idade = t - trajeto.inicio;
  if (idade < 0 || idade > trajeto.duracao) return null;
  const u = suave(idade / trajeto.duracao);
  const { x, y, dx, dy } = bezier(trajeto.pontos, u);
  const asa = Math.sin(2 * Math.PI * trajeto.batidas * idade);
  const inclinacao = dx ? Math.atan2(dy, dx) : 0;
  return {
    x,
    y,
    rotacao: limitar(inclinacao * 0.55, -0.45, 0.45) + 0.06 * asa,
    escalaX: 1 + 0.03 * asa,
    escalaY: 1 - 0.09 * (0.5 + 0.5 * asa),
    opacidade: limitar(
      Math.min(idade / 0.15, (trajeto.duracao - idade) / 0.15),
      0,
      1,
    ),
  };
}

/** Onde nasce o foguete que a Aya solta: logo abaixo dela, na soltura. */
export function pontoDaSoltura(trajeto) {
  const aya = posicaoDaAya(trajeto, trajeto.inicio + trajeto.soltura);
  return { x: aya.x, y: aya.y + trajeto.tamanho * 0.3 };
}

// ── Véu ─────────────────────────────────────────────────────────────────────

/*
  O véu escuro sobre a tela: entra em 0,5 s e sai nos últimos 0,7 s. Devolve
  0–1; a cor e a força máxima de cada tema ficam no CSS (.comemoracao__veu).
*/
export function opacidadeDoVeu(t, duracao) {
  return limitar(Math.min(t / 0.5, (duracao - t) / 0.7), 0, 1);
}

// ── Som ─────────────────────────────────────────────────────────────────────

/* A preferência fica neste navegador; sem ela (ou sem armazenamento), mudo. */
export const CHAVE_DO_SOM = "agsus_monitora_som_das_comemoracoes";

export const somLigado = (armazenamento) =>
  lerArmazenamento(armazenamento, CHAVE_DO_SOM) === "1";

/** Guarda a escolha (try/catch dentro). Devolve se conseguiu guardar. */
export const guardarSom = (armazenamento, ligado) =>
  gravarArmazenamento(armazenamento, CHAVE_DO_SOM, ligado ? "1" : "0");

/*
  Só toca com o som ligado E depois de a pessoa interagir com a página (o
  navegador bloqueia áudio antes disso, e som que surge sozinho assusta).
*/
export const podeTocarSom = ({ ligado, interagiu }) =>
  ligado === true && interagiu === true;

/**
 * O som de um estouro (evento de avancarShow): "crepitar" para faíscas que
 * piscam e estalam, "grave" para o estouro do marco, "estalo" para o resto.
 * Volume baixo (0–1, relativo), menor nas salvas do grande final.
 */
export function somDoEstouro(evento = {}) {
  if (evento.papel === "marco") return { tipo: "grave", volume: 0.9 };
  if (evento.formato === "glitter" || evento.formato === "estalinho")
    return { tipo: "crepitar", volume: 0.5 };
  return { tipo: "estalo", volume: evento.papel === "final" ? 0.45 : 0.6 };
}
