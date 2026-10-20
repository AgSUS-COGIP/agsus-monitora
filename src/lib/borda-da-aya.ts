/*
  A Aya escondida na borda da tela, sem DOM: quando a pessoa solta a arara
  (ou a empurra com as setas) encostada numa borda, ela se esconde e fica só
  espiando. Aqui fica qual borda vale e como a posição guardada é lida; o
  desenho e o movimento são de src/modulos/aya/ (aya.jsx e aya.css).
*/

export const BORDAS_DA_AYA = Object.freeze([
  "esquerda",
  "direita",
  "topo",
  "baixo",
] as const);

export type BordaDaAya = (typeof BORDAS_DA_AYA)[number];

/* A esta distância (px) do limite, ou empurrada além dele, conta como encostada. */
export const ENCOSTO_PX = 4;

/* Cada seta move a arara por este tanto (px); com Shift, quatro vezes mais. */
export const PASSO_DO_TECLADO_PX = 24;

export function ehBordaDaAya(valor: unknown): valor is BordaDaAya {
  return (
    typeof valor === "string" &&
    (BORDAS_DA_AYA as readonly string[]).includes(valor)
  );
}

export interface PosicaoDesejada {
  /** Onde a arara iria (px), antes de ser contida na janela. */
  left: number;
  top: number;
  largura: number;
  altura: number;
  larguraDaJanela: number;
  alturaDaJanela: number;
  /** A folga mínima que a arara guarda das bordas (px). */
  margem: number;
}

/**
 * A borda em que a arara ficou encostada (a mais empurrada; no empate, as
 * laterais antes de topo e baixo), ou null.
 */
export function bordaEncostada(posicao: PosicaoDesejada): BordaDaAya | null {
  const { left, top, largura, altura, margem } = posicao;
  const distancias: Array<[BordaDaAya, number]> = [
    ["esquerda", left - margem],
    ["direita", posicao.larguraDaJanela - margem - largura - left],
    ["topo", top - margem],
    ["baixo", posicao.alturaDaJanela - margem - altura - top],
  ];
  let melhor: [BordaDaAya, number] | null = null;
  for (const candidata of distancias) {
    if (candidata[1] > ENCOSTO_PX) continue;
    if (!melhor || candidata[1] < melhor[1]) melhor = candidata;
  }
  return melhor ? melhor[0] : null;
}

/** O deslocamento de uma seta (ArrowLeft…), ou null para outras teclas. */
export function passoDaSeta(
  tecla: string,
  rapido = false,
): { dx: number; dy: number } | null {
  const passo = PASSO_DO_TECLADO_PX * (rapido ? 4 : 1);
  switch (tecla) {
    case "ArrowLeft":
      return { dx: -passo, dy: 0 };
    case "ArrowRight":
      return { dx: passo, dy: 0 };
    case "ArrowUp":
      return { dx: 0, dy: -passo };
    case "ArrowDown":
      return { dx: 0, dy: passo };
    default:
      return null;
  }
}

export interface PosicaoDaAya {
  left: number;
  top: number;
  borda?: BordaDaAya;
}

/** A posição guardada no navegador (JSON), validada; null se não houver ou vier torta. */
export function lerPosicaoDaAya(texto: string | null | undefined) {
  try {
    const valor = JSON.parse(texto || "null") as Partial<PosicaoDaAya> | null;
    if (!Number.isFinite(valor?.left) || !Number.isFinite(valor?.top))
      return null;
    const posicao: PosicaoDaAya = {
      left: Number(valor?.left),
      top: Number(valor?.top),
    };
    if (ehBordaDaAya(valor?.borda)) posicao.borda = valor.borda;
    return posicao;
  } catch {
    return null;
  }
}
