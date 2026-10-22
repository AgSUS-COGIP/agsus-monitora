/*
  Qual entrevista vale quando a mesma pessoa tem mais de uma (a linha da
  planilha e a do sistema da mesma análise, por exemplo). A REGRA ÚNICA, a
  mesma de private."FC_ENTREVISTAS_VIGENTES" (migration
  20261022200000_funil_do_edital_de_uma_fonte_so.sql), usada pela
  Classificação (src/lib/classificacao/motor.ts) e pelo Painel de entrevistas
  (src/lib/entrevistas-do-painel.ts):

    1º a que tem parecer (APTO ou INAPTO);
    2º a que tem nota;
    3º a do sistema;
    4º a mais recente (última mudança);
    5º o maior id.

  Assim uma convocação nova do sistema (ainda SEM_PARECER) não apaga o
  parecer e a nota que já vieram da planilha.
*/

export interface EntrevistaComparavel {
  id: string;
  parecer: string;
  nota: number | null;
  origem?: string | null;
  atualizadoEm?: string | null;
}

const temParecer = (e: EntrevistaComparavel) =>
  e.parecer === "APTO" || e.parecer === "INAPTO";

const momento = (valor: string | null | undefined) => {
  const ms = valor ? Date.parse(valor) : NaN;
  return Number.isFinite(ms) ? ms : -Infinity;
};

/** Negativo quando `a` vale mais que `b` (para `sort`). */
export function compararEntrevistas(
  a: EntrevistaComparavel,
  b: EntrevistaComparavel,
) {
  const criterios = [
    Number(temParecer(b)) - Number(temParecer(a)),
    Number(b.nota !== null) - Number(a.nota !== null),
    Number(b.origem === "sistema") - Number(a.origem === "sistema"),
  ];
  for (const diferenca of criterios) if (diferenca) return diferenca;
  const recente = momento(b.atualizadoEm) - momento(a.atualizadoEm);
  if (recente) return recente;
  return a.id === b.id ? 0 : a.id > b.id ? -1 : 1;
}

/** A entrevista que vale entre as de uma mesma pessoa; `null` sem nenhuma. */
export function entrevistaVigente<T extends EntrevistaComparavel>(
  entrevistas: readonly T[],
): T | null {
  let melhor: T | null = null;
  for (const e of entrevistas)
    if (!melhor || compararEntrevistas(e, melhor) < 0) melhor = e;
  return melhor;
}
