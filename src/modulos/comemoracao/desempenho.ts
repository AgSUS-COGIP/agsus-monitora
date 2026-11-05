/*
  O desempenho das comemorações: mede o tempo de cada quadro e, se o
  computador não dá conta (abaixo de ~45 fps por um tempo), baixa a
  qualidade sozinho — menos partículas, menos halos, sem fumaça e, no fim,
  sem a densidade de pixels extra. Nunca volta a subir no mesmo show (subir
  e descer faria a imagem "piscar"). Sem DOM: quem aplica é `Fogos`
  (comemoracoes.tsx).
*/

/* O quadro de 60 fps e o limiar (45 fps) a partir do qual a qualidade cai. */
export const QUADRO_ALVO_MS = 1000 / 60;
export const QUADRO_LENTO_MS = 1000 / 45;
/* Quadros medidos antes de decidir, e entre uma queda e outra. */
export const QUADROS_PARA_DECIDIR = 24;
/* Quadro maior que isto é pausa (aba voltando, depurador), não lentidão. */
export const QUADRO_IGNORADO_MS = 250;

export type Qualidade = 0 | 1 | 2;

/** Quanto cada qualidade deixa: do teto de partículas e das faíscas por estouro. */
export const AJUSTE_DA_QUALIDADE: Readonly<
  Record<Qualidade, { particulas: number; faiscas: number }>
> = Object.freeze({
  2: Object.freeze({ particulas: 1, faiscas: 1 }),
  1: Object.freeze({ particulas: 0.6, faiscas: 0.7 }),
  0: Object.freeze({ particulas: 0.35, faiscas: 0.45 }),
});

export interface MedidorDeDesempenho {
  /** Média móvel do tempo do quadro (ms). */
  media: number;
  /** Quadros medidos desde a última mudança. */
  quadros: number;
  qualidade: Qualidade;
}

export const criarMedidor = (): MedidorDeDesempenho => ({
  media: QUADRO_ALVO_MS,
  quadros: 0,
  qualidade: 2,
});

/**
 * Registra um quadro de `dtMs` ms. Devolve se a qualidade caiu agora (quem
 * desenha aplica o novo nível). Quadro zerado ou enorme não conta.
 */
export function registrarQuadro(
  medidor: MedidorDeDesempenho,
  dtMs: number,
): boolean {
  if (!(dtMs > 0) || dtMs > QUADRO_IGNORADO_MS) return false;
  medidor.media = medidor.media * 0.9 + dtMs * 0.1;
  medidor.quadros += 1;
  if (
    medidor.qualidade > 0 &&
    medidor.quadros >= QUADROS_PARA_DECIDIR &&
    medidor.media > QUADRO_LENTO_MS
  ) {
    medidor.qualidade = (medidor.qualidade - 1) as Qualidade;
    // Mede de novo, do zero, já no nível novo.
    medidor.quadros = 0;
    medidor.media = QUADRO_ALVO_MS;
    return true;
  }
  return false;
}
