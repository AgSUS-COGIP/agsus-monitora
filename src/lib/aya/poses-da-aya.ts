/*
  As poses da arara da Aya (ilustrações 3D em webp, uma por estado, em
  src/modulos/aya/mascote/imagens/), sem React: onde cada uma fica no quadro,
  o recorte do rosto e qual arquivo (1x ou 2x) baixar para o tamanho na tela.

  O quadro é o quadrado da arara inteira ("corpo"), de lado 1. Todas as poses
  estão na mesma escala e com os pés no mesmo ponto (ANCORA_DOS_PES): trocar
  de pose não faz a arara pular de lugar. As asas abertas (comemorando,
  apontando) passam do quadro para os lados, de propósito.

  Medidas tiradas das ilustrações originais (pés, bico e anel amarelo) ao
  reduzi-las: cada arquivo é a pose recortada, com o quadro a 160 px de
  altura (1x) ou 320 px (2x), webp com transparência, até 30 KB. Trocar uma
  ilustração = refazer o arquivo na mesma escala e atualizar a linha dela.
*/

import type { EstadoDaMascote } from "./estado-da-aya.ts";

export interface MedidasDaPose {
  /** Canto e tamanho da imagem, em frações do lado do quadro. */
  x: number;
  y: number;
  largura: number;
  altura: number;
  /** Centro do recorte do rosto (cabeça e um busto curto), em frações do quadro. */
  rostoX: number;
  rostoY: number;
}

export const MEDIDAS_DAS_POSES: Readonly<
  Record<EstadoDaMascote, Readonly<MedidasDaPose>>
> = Object.freeze({
  parada: {
    x: 0.1452,
    y: 0.0127,
    largura: 0.7103,
    altura: 0.9802,
    rostoX: 0.672,
    rostoY: 0.174,
  },
  atenta: {
    x: 0.2048,
    y: 0.0143,
    largura: 0.7714,
    altura: 0.9683,
    rostoX: 0.81,
    rostoY: 0.2,
  },
  falando: {
    x: 0.1571,
    y: 0.0087,
    largura: 0.8357,
    altura: 0.9952,
    rostoX: 0.677,
    rostoY: 0.174,
  },
  pensando: {
    x: 0.1532,
    y: 0.0127,
    largura: 0.7722,
    altura: 0.9921,
    rostoX: 0.671,
    rostoY: 0.166,
  },
  comemorando: {
    x: -0.0583,
    y: 0.0008,
    largura: 1.358,
    altura: 0.974,
    rostoX: 0.703,
    rostoY: 0.174,
  },
  dormindo: {
    x: 0.15,
    y: 0.0024,
    largura: 0.7389,
    altura: 1.0048,
    rostoX: 0.705,
    rostoY: 0.225,
  },
  acenando: {
    x: 0.1817,
    y: 0.0103,
    largura: 0.8381,
    altura: 0.9905,
    rostoX: 0.668,
    rostoY: 0.175,
  },
  apontando: {
    x: 0.0055,
    y: 0.0161,
    largura: 1.3294,
    altura: 0.9586,
    rostoX: 0.67,
    rostoY: 0.178,
  },
});

/** Os pés (centro, base) no quadro: o pivô do respiro e do pulinho. */
export const ANCORA_DOS_PES = Object.freeze({ x: 0.64, y: 0.97 });

/** Lado do recorte do rosto, em frações do quadro. */
export const LADO_DO_ROSTO = 0.4286;

/** Altura do quadro em cada arquivo (px). */
export const ALTURA_DO_ARQUIVO = Object.freeze({ "1x": 160, "2x": 320 });

export type ArquivoDaPose = keyof typeof ALTURA_DO_ARQUIVO;

/**
 * Do quadro "corpo" ao "rosto": desloca (em % do quadro) e amplia, com a
 * origem no canto de cima à esquerda, para o rosto ocupar o quadro.
 */
export function enquadramentoDoRosto(pose: EstadoDaMascote) {
  const medidas = MEDIDAS_DAS_POSES[pose];
  const escala = 1 / LADO_DO_ROSTO;
  const arredondar = (valor: number) => Number(valor.toFixed(2));
  return {
    x: arredondar((0.5 - escala * medidas.rostoX) * 100),
    y: arredondar((0.5 - escala * medidas.rostoY) * 100),
    escala: Number(escala.toFixed(4)),
  };
}

/** Largura da imagem da pose na tela (px CSS), com o rosto ampliado. */
export function larguraNaTela(
  pose: EstadoDaMascote,
  tamanho: number,
  rosto: boolean,
) {
  const largura = MEDIDAS_DAS_POSES[pose].largura * tamanho;
  return rosto ? largura / LADO_DO_ROSTO : largura;
}

/** Largura do arquivo (px) da pose. */
export function larguraDoArquivo(
  pose: EstadoDaMascote,
  arquivo: ArquivoDaPose,
) {
  return Math.round(
    MEDIDAS_DAS_POSES[pose].largura * ALTURA_DO_ARQUIVO[arquivo],
  );
}

/**
 * O menor arquivo que fica nítido: o 1x se ele cobre a largura na tela vezes
 * a densidade de pixels (com 5% de folga), senão o 2x.
 */
export function escolherArquivo(
  pose: EstadoDaMascote,
  larguraCss: number,
  densidade = 1,
): ArquivoDaPose {
  const precisa =
    larguraCss * (Number.isFinite(densidade) && densidade > 0 ? densidade : 1);
  return precisa <= larguraDoArquivo(pose, "1x") * 1.05 ? "1x" : "2x";
}
