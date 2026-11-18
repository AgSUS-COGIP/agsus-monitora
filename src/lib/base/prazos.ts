/*
  Faixas de prazo (padrão tirado do SIGEPSI): quanto falta para uma data e em
  que faixa ela cai, sem DOM. As datas são "aaaa-mm-dd" (o dia de Brasília
  para `hoje`); a conta é de dias de calendário, sem fuso.

  - "vencido": a data já passou (no próprio dia ainda vale: "Vence hoje");
  - "ate-30" / "ate-90" / "ate-180": vence em menos de 30, 90 ou 180 dias;
  - "depois": 180 dias ou mais.

  O texto diz sempre a situação ("Vence em 12 dias", "Venceu há 3 dias"):
  a cor do selo (src/ui/selo-de-prazo.tsx) só complementa.
*/

export type FaixaDoPrazo =
  "vencido" | "ate-30" | "ate-90" | "ate-180" | "depois";

export interface SituacaoDoPrazo {
  /** Dias até a data: 0 = hoje; negativo = já passou. */
  dias: number;
  faixa: FaixaDoPrazo;
}

export const FAIXAS_DO_PRAZO: readonly FaixaDoPrazo[] = Object.freeze([
  "vencido",
  "ate-30",
  "ate-90",
  "ate-180",
  "depois",
]);

export const ROTULO_DA_FAIXA: Readonly<Record<FaixaDoPrazo, string>> =
  Object.freeze({
    vencido: "Vencido",
    "ate-30": "Vence em menos de 30 dias",
    "ate-90": "Vence em menos de 90 dias",
    "ate-180": "Vence em menos de 180 dias",
    depois: "Vence em 180 dias ou mais",
  });

const DATA = /^(\d{4})-(\d{2})-(\d{2})/;
const DIA_EM_MS = 86_400_000;

function diaUtc(data: string): number | null {
  const partes = DATA.exec(String(data || ""));
  if (!partes) return null;
  const [, ano, mes, dia] = partes;
  const ms = Date.UTC(Number(ano), Number(mes) - 1, Number(dia));
  return Number.isFinite(ms) ? ms : null;
}

/** Dias de calendário de `hoje` até `data` (negativo se já passou); null se alguma não é data. */
export function diasAte(
  data: string | null | undefined,
  hoje: string,
): number | null {
  if (!data) return null;
  const alvo = diaUtc(data);
  const base = diaUtc(hoje);
  if (alvo === null || base === null) return null;
  return Math.round((alvo - base) / DIA_EM_MS);
}

export function faixaDosDias(dias: number): FaixaDoPrazo {
  if (dias < 0) return "vencido";
  if (dias < 30) return "ate-30";
  if (dias < 90) return "ate-90";
  if (dias < 180) return "ate-180";
  return "depois";
}

/** Quanto falta e a faixa; null sem data. */
export function situacaoDoPrazo(
  data: string | null | undefined,
  hoje: string,
): SituacaoDoPrazo | null {
  const dias = diasAte(data, hoje);
  return dias === null ? null : { dias, faixa: faixaDosDias(dias) };
}

/** A coluna "dias restantes": "Vence hoje", "Vence amanhã", "Vence em 12 dias", "Venceu ontem", "Venceu há 3 dias". */
export function textoDosDiasRestantes(dias: number): string {
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Vence amanhã";
  if (dias === -1) return "Venceu ontem";
  const n = new Intl.NumberFormat("pt-BR").format(Math.abs(dias));
  return dias > 0 ? `Vence em ${n} dias` : `Venceu há ${n} dias`;
}

/** Quantas datas em cada faixa (as sem data ficam de fora): a contagem dos filtros. */
export function contarPorFaixa(
  datas: ReadonlyArray<string | null | undefined>,
  hoje: string,
): Record<FaixaDoPrazo, number> {
  const contagem = Object.fromEntries(
    FAIXAS_DO_PRAZO.map((faixa) => [faixa, 0]),
  ) as Record<FaixaDoPrazo, number>;
  for (const data of datas) {
    const situacao = situacaoDoPrazo(data, hoje);
    if (situacao) contagem[situacao.faixa] += 1;
  }
  return contagem;
}
