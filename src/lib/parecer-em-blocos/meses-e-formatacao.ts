/* Parecer em blocos: meses de experiência e formatação (portados do simulador) (API pública em ../parecer-em-blocos.ts). */

// ── Meses de experiência (portado do simulador, sem mudança) ─────────────

/** parseUTCDate do simulador: "AAAA-MM-DD" → Date em UTC (ou null). */
export function dataUtc(texto: string | null | undefined): Date | null {
  if (!texto) return null;
  const partes = texto.split("-");
  if (partes.length !== 3) return null;
  return new Date(
    Date.UTC(
      parseInt(partes[0]!, 10),
      parseInt(partes[1]!, 10) - 1,
      parseInt(partes[2]!, 10),
    ),
  );
}

/**
 * calcularMesesCompletos do simulador: meses de calendário completos de d1 a
 * d2 (o mesmo dia do mês seguinte fecha um mês; no fim do mês, o último dia).
 * O dia final não soma: de 01/01 a 31/01 dá 0 mês.
 */
export function calcularMesesCompletos(
  d1: Date | null,
  d2: Date | null,
): number {
  if (!d1 || !d2 || d2 < d1) return 0;

  let meses =
    (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12 +
    (d2.getUTCMonth() - d1.getUTCMonth());
  const diaOriginal = d1.getUTCDate();

  let tempDate = new Date(
    Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth() + meses, diaOriginal),
  );
  if (
    tempDate.getUTCMonth() !==
    (((d1.getUTCMonth() + meses) % 12) + 12) % 12
  ) {
    tempDate = new Date(
      Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth() + meses + 1, 0),
    );
  }

  if (d2 < tempDate) {
    meses--;
  }

  return meses < 0 ? 0 : meses;
}

/** Os meses de uma experiência (calcularExperienciaIndividual do simulador). */
export function mesesDaExperiencia(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  const d1 = dataUtc(inicio);
  const d2 = dataUtc(fim);
  return d1 && d2 && d2 >= d1 ? calcularMesesCompletos(d1, d2) : 0;
}

/**
 * O total das experiências que atendem, sem as sobreposições
 * (calcularExperienciasEGlobal do simulador): ordena pelo início, une quando
 * o próximo começa até o fim do atual (o dia seguinte NÃO emenda) e soma os
 * meses completos de cada intervalo unido.
 */
export function totalSemSobreposicao(
  itens: readonly { atende: boolean; inicio: string; fim: string }[],
  pontosPorMes = 0.2,
): { meses: number; pontos: number } {
  const intervalos: { start: Date; end: Date }[] = [];
  for (const item of itens) {
    if (!item.atende || !item.inicio || !item.fim) continue;
    const d1 = dataUtc(item.inicio);
    const d2 = dataUtc(item.fim);
    if (d1 && d2 && d2 >= d1) intervalos.push({ start: d1, end: d2 });
  }
  if (intervalos.length === 0) return { meses: 0, pontos: 0 };

  intervalos.sort((a, b) => a.start.getTime() - b.start.getTime());
  const mesclados: { start: Date; end: Date }[] = [];
  let atual = intervalos[0]!;
  for (let i = 1; i < intervalos.length; i++) {
    const proximo = intervalos[i]!;
    if (proximo.start <= atual.end) {
      if (proximo.end > atual.end)
        atual = { start: atual.start, end: proximo.end };
    } else {
      mesclados.push(atual);
      atual = proximo;
    }
  }
  mesclados.push(atual);

  const meses = mesclados.reduce(
    (soma, inter) => soma + calcularMesesCompletos(inter.start, inter.end),
    0,
  );
  return { meses, pontos: meses * pontosPorMes };
}

// ── Formatação (a do simulador) ──────────────────────────────────────────

/** formatDate do simulador: "AAAA-MM-DD" → "DD/MM/AAAA"; vazio → "__/__/____". */
export function dataDoParecer(texto: string | null | undefined): string {
  if (!texto) return "__/__/____";
  const partes = texto.split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : texto;
}

/** Um decimal com vírgula ("toFixed(1).replace('.', ',')"). */
export const pontosDoParecer = (valor: number) =>
  valor.toFixed(1).replace(".", ",");

export function texto(valor: unknown): string {
  return valor === null || valor === undefined ? "" : String(valor).trim();
}
