/*
  A cena em volta dos fogos, sem DOM: o voo da Aya (a arara azul que solta o
  primeiro foguete), o véu escuro que faz as cores brilharem e a regra do som
  (opcional, desligado por padrão). O desenho é de src/modulos/comemoracao/;
  o roteiro e a física dos fogos, de src/lib/fogos.ts.

  Unidades: tempo em segundos desde o começo do show, posição em px CSS.
*/

import { gravarArmazenamento, lerArmazenamento } from "./comemoracao.ts";
import type { ArmazenamentoSimples } from "./comemoracao.ts";

/** Ponto de controle `[x, y]` em px CSS. */
export type PontoDoTrajeto = [number, number];

export interface TrajetoDaAya {
  inicio: number;
  duracao: number;
  soltura: number;
  batidas: number;
  /** Tamanho da Aya (px). */
  tamanho: number;
  /** Os quatro pontos da curva de Bézier cúbica. */
  pontos: [PontoDoTrajeto, PontoDoTrajeto, PontoDoTrajeto, PontoDoTrajeto];
}

export interface PosicaoDaAya {
  x: number;
  y: number;
  rotacao: number;
  escalaX: number;
  escalaY: number;
  opacidade: number;
}

/**
 * O som de um evento do show: estouro grave (marco e letreiro), estalo (o
 * comum), crepitar (estouro que estala no fim), assobio (foguete subindo) e
 * pop (rajada pequena e o confete da Aya).
 */
export interface SomDoEstouro {
  tipo: "grave" | "crepitar" | "estalo" | "assobio" | "pop";
  volume: number;
  /** Assobio: quanto dura a subida (s). */
  duracao?: number;
}

const limitar = (valor: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, valor));

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
export function trajetoDaAya({
  largura = 800,
  altura = 600,
}: { largura?: number; altura?: number } = {}): TrajetoDaAya {
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

const suave = (u: number): number =>
  0.5 - 0.5 * Math.cos(Math.PI * limitar(u, 0, 1));

function bezier(
  [p0, p1, p2, p3]: TrajetoDaAya["pontos"],
  u: number,
): { x: number; y: number; dx: number; dy: number } {
  const v = 1 - u;
  const ponto = (i: 0 | 1): number =>
    v * v * v * p0[i] +
    3 * v * v * u * p1[i] +
    3 * v * u * u * p2[i] +
    u * u * u * p3[i];
  const derivada = (i: 0 | 1): number =>
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
export function posicaoDaAya(
  trajeto: TrajetoDaAya | null | undefined,
  t: number,
): PosicaoDaAya | null {
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
export function pontoDaSoltura(trajeto: TrajetoDaAya): {
  x: number;
  y: number;
} {
  const aya = posicaoDaAya(trajeto, trajeto.inicio + trajeto.soltura);
  return { x: aya!.x, y: aya!.y + trajeto.tamanho * 0.3 };
}

// ── Véu ─────────────────────────────────────────────────────────────────────

/*
  O véu escuro sobre a tela: entra em 0,5 s e sai nos últimos 0,7 s. Devolve
  0–1; a cor e a força máxima de cada tema ficam no CSS (.comemoracao__veu).
*/
export function opacidadeDoVeu(t: number, duracao: number): number {
  return limitar(Math.min(t / 0.5, (duracao - t) / 0.7), 0, 1);
}

// ── Som ─────────────────────────────────────────────────────────────────────

/* A preferência fica neste navegador; sem ela (ou sem armazenamento), mudo. */
export const CHAVE_DO_SOM = "agsus_monitora_som_das_comemoracoes";

export const somLigado = (
  armazenamento: ArmazenamentoSimples | null | undefined,
): boolean => lerArmazenamento(armazenamento, CHAVE_DO_SOM) === "1";

/** Guarda a escolha (try/catch dentro). Devolve se conseguiu guardar. */
export const guardarSom = (
  armazenamento: ArmazenamentoSimples | null | undefined,
  ligado: unknown,
): boolean =>
  gravarArmazenamento(armazenamento, CHAVE_DO_SOM, ligado ? "1" : "0");

/*
  Só toca com o som ligado E depois de a pessoa interagir com a página (o
  navegador bloqueia áudio antes disso, e som que surge sozinho assusta).
*/
export const podeTocarSom = ({
  ligado,
  interagiu,
}: {
  ligado?: unknown;
  interagiu?: unknown;
}): boolean => ligado === true && interagiu === true;

/* Os formatos cujas faíscas estalam ou piscam: o som crepita depois do estouro. */
const FORMATOS_QUE_CREPITAM: readonly unknown[] = Object.freeze([
  "glitter",
  "estalinho",
  "crepitante",
]);

/**
 * O som de um evento do show (de avancarShow ou da cena): "assobio" para o
 * foguete que assobia ao subir, "pop" para a rajada e o confete da Aya,
 * "grave" para o marco e o letreiro, "crepitar" para faíscas que piscam e
 * estalam, "estalo" para o resto. Volume baixo (0–1, relativo), menor nas
 * salvas do grande final e da apoteose (muitos juntos).
 */
export function somDoEstouro(
  evento: {
    tipo?: unknown;
    papel?: unknown;
    formato?: unknown;
    subida?: unknown;
  } = {},
): SomDoEstouro {
  if (evento.tipo === "lancamento")
    return {
      tipo: "assobio",
      volume: 0.35,
      duracao: limitar(Number(evento.subida) || 0.8, 0.3, 1.6),
    };
  if (evento.tipo === "confete" || evento.papel === "rajada")
    return { tipo: "pop", volume: 0.4 };
  if (evento.papel === "marco" || evento.papel === "letreiro")
    return { tipo: "grave", volume: 0.9 };
  if (FORMATOS_QUE_CREPITAM.includes(evento.formato))
    return { tipo: "crepitar", volume: 0.5 };
  return {
    tipo: "estalo",
    volume:
      evento.papel === "final"
        ? 0.45
        : evento.papel === "apoteose"
          ? 0.35
          : 0.6,
  };
}

// ── A dança da Aya (no grande final) ────────────────────────────────────────

/*
  Depois do voo, a Aya volta no grande final: sobe pelo canto de baixo,
  dança (pulinhos no ritmo, balançando o corpo), dá uma cambalhota, solta
  confete e desce. Tudo por transform, quadro a quadro (pausa junto com o
  show quando a aba some). Tempos em s, relativos ao início da dança.
*/
export const DANCA_DA_AYA = Object.freeze({
  /* Sobe do pé da tela. */
  entrada: 0.35,
  /* Pulinhos por segundo. */
  pulos: 2.4,
  /* A cambalhota começa aqui e dura isto. */
  cambalhota: 0.85,
  giro: 0.6,
  /* O confete sai este tanto antes do fim (e a Aya dá um pulo maior). */
  confeteAntes: 1.25,
  /* Desce e some. */
  saida: 0.35,
  /* Dança no máximo isto; show curto, o que couber depois do voo. */
  maxima: 3.1,
  minima: 1.9,
});

export interface DancaDaAya {
  inicio: number;
  duracao: number;
  /** Centro da Aya parada (px CSS). */
  x: number;
  y: number;
  tamanho: number;
  /** Quando (s do show) e de onde sai o confete. */
  confete: number;
}

/**
 * A dança da Aya num show de `duracao` s, depois do voo (`trajeto`): no
 * canto de baixo à esquerda, terminando um pouco antes do fim. Sem espaço
 * (show curto demais), null.
 */
export function dancaDaAya(
  trajeto: TrajetoDaAya | null | undefined,
  {
    largura = 800,
    altura = 600,
    duracao,
  }: { largura?: number; altura?: number; duracao: number },
): DancaDaAya | null {
  if (!trajeto) return null;
  const fim = duracao - 0.15;
  const inicio = Math.max(
    trajeto.inicio + trajeto.duracao + 0.15,
    fim - DANCA_DA_AYA.maxima,
  );
  if (fim - inicio < DANCA_DA_AYA.minima) return null;
  const tamanho = trajeto.tamanho;
  return {
    inicio,
    duracao: fim - inicio,
    x: Math.max(tamanho * 0.8, largura * 0.12),
    y: altura - tamanho * 0.62,
    tamanho,
    confete: fim - DANCA_DA_AYA.confeteAntes,
  };
}

const sobe = (u: number): number => 1 - (1 - limitar(u, 0, 1)) ** 3;

/**
 * Onde a Aya está na dança em `t` s do show (posição do centro, rotação,
 * escala e opacidade, como no voo). Fora da dança, null.
 */
export function posicaoNaDanca(
  danca: DancaDaAya | null | undefined,
  t: number,
): PosicaoDaAya | null {
  if (!danca) return null;
  const idade = t - danca.inicio;
  if (idade < 0 || idade > danca.duracao) return null;
  const { entrada, pulos, cambalhota, giro, saida } = DANCA_DA_AYA;
  const tamanho = danca.tamanho;
  // Entra subindo e sai descendo pelo pé da tela.
  const fora =
    (1 - sobe(idade / entrada)) * tamanho * 1.3 +
    sobe((idade - (danca.duracao - saida)) / saida) * tamanho * 1.3;
  // Pulinhos no ritmo (|sen|), com o corpo balançando de um lado para o outro.
  const fase = 2 * Math.PI * pulos * idade;
  let pulo = Math.abs(Math.sin(fase / 2)) * tamanho * 0.16;
  let rotacao = 0.2 * Math.sin(fase / 2);
  // A cambalhota: um pulo alto com uma volta inteira.
  const u = (idade - cambalhota) / giro;
  if (u >= 0 && u <= 1) {
    pulo = 4 * u * (1 - u) * tamanho * 0.9;
    rotacao = -2 * Math.PI * (0.5 - 0.5 * Math.cos(Math.PI * u));
  }
  // O pulo do confete: mais alto, de asas abertas.
  const c = (t - danca.confete + 0.15) / 0.5;
  if (c >= 0 && c <= 1) pulo = Math.max(pulo, 4 * c * (1 - c) * tamanho * 0.5);
  // Agacha ao tocar o chão (achata) e estica no ar.
  const noChao = 1 - limitar(pulo / (tamanho * 0.16), 0, 1);
  return {
    x: danca.x + Math.sin(fase / 4) * tamanho * 0.12,
    y: danca.y - pulo + fora,
    rotacao,
    escalaX: 1 + 0.08 * noChao,
    escalaY: 1 - 0.1 * noChao,
    opacidade: limitar(
      Math.min(idade / 0.12, (danca.duracao - idade) / 0.12),
      0,
      1,
    ),
  };
}
