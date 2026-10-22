/*
  A escala da folha na prévia "Como fica no SEI" (src/modulos/classificacao/
  documento.tsx). A folha é desenhada no tamanho de uma A4 (210 mm ≈ 794 px a
  96 dpi) e reduzida ou ampliada por inteiro, como num leitor de PDF:
  "Ajustar" cabe na largura disponível; − e + andam pelos passos de zoom.
*/

/** Largura da folha A4 em px CSS (210 mm a 96 dpi). */
export const LARGURA_DA_FOLHA = 794;
/** Altura de uma página A4 (297 mm), o mínimo da folha antes de medir. */
export const ALTURA_DA_PAGINA = 1123;

export const PASSOS_DE_ZOOM: readonly number[] = Object.freeze([
  0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2,
]);

const MINIMO = PASSOS_DE_ZOOM[0] ?? 0.5;
const MAXIMO = PASSOS_DE_ZOOM.at(-1) ?? 2;

/** Arredonda a escala para 2 casas, dentro dos limites do zoom. */
export function limitarEscala(escala: number): number {
  if (!Number.isFinite(escala) || escala <= 0) return 1;
  return Math.round(Math.min(MAXIMO, Math.max(MINIMO, escala)) * 100) / 100;
}

/** O menor "Ajustar": no celular a folha inteira cabe (o zoom amplia). */
export const MENOR_AJUSTE = 0.3;

/**
 * A escala que faz a folha caber na largura disponível (menos a margem da
 * "mesa" em volta da folha). Sem largura medida, 1.
 */
export function escalaParaLargura(
  larguraDisponivel: number,
  margem = 32,
): number {
  if (!Number.isFinite(larguraDisponivel) || larguraDisponivel <= 0) return 1;
  const escala = (larguraDisponivel - margem) / LARGURA_DA_FOLHA;
  return (
    Math.round(Math.min(MAXIMO, Math.max(MENOR_AJUSTE, escala)) * 100) / 100
  );
}

/** O próximo passo de zoom (+1 amplia, −1 reduz) a partir da escala atual. */
export function proximoZoom(atual: number, sentido: 1 | -1): number {
  const escala = Number.isFinite(atual) && atual > 0 ? atual : 1;
  if (sentido > 0)
    return PASSOS_DE_ZOOM.find((p) => p > escala + 0.001) ?? MAXIMO;
  return (
    [...PASSOS_DE_ZOOM].reverse().find((p) => p < escala - 0.001) ?? MINIMO
  );
}

/** "75%". */
export function rotuloDoZoom(escala: number): string {
  return `${Math.round((Number.isFinite(escala) && escala > 0 ? escala : 1) * 100)}%`;
}

/** O tamanho da área que a folha escalada ocupa (para a rolagem). */
export function tamanhoEscalado(
  alturaDaFolha: number,
  escala: number,
): { largura: number; altura: number } {
  const altura = Math.max(ALTURA_DA_PAGINA, Math.ceil(alturaDaFolha || 0));
  return {
    largura: Math.ceil(LARGURA_DA_FOLHA * escala),
    altura: Math.ceil(altura * escala),
  };
}
