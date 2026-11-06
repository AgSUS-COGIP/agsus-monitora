/*
  Os números da faixa de situação da Fila da Avaliação documental:
  concluídas hoje, as aptas entre as concluídas e o ritmo do dia (o selo e a
  meta: a mesma conta do card "Ritmo da análise" do Painel das análises,
  src/lib/ritmo-da-analise.ts, lida de obter_ritmo_da_analise). Sem DOM; a
  lista é a que a Fila já carregou (obter_fila_avaliacao), sem consulta nova
  — só o ritmo pede obter_ritmo_da_analise, uma vez por área, e some se a
  pessoa não pode ler o Painel das análises.
*/
import {
  agoraEmBrasilia,
  calcularRitmo,
  lerRitmoDaAnalise,
  seloDoCard,
  TOM_DO_SELO_DO_RITMO,
} from "../ritmo-da-analise.ts";
import type { Agora } from "../ritmo-da-analise.ts";

interface FichaDosNumeros {
  ficha?: {
    situacao?: unknown;
    resultado?: unknown;
    concluida_em?: unknown;
  } | null;
}

/** O dia (AAAA-MM-DD) de uma data em Brasília; "" se não for data. */
function diaEmBrasilia(valor: unknown): string {
  if (typeof valor !== "string" && typeof valor !== "number") return "";
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "" : agoraEmBrasilia(data).hoje;
}

/** Quantas fichas foram concluídas hoje (horário de Brasília). */
export function concluidasHoje(
  candidatos: readonly FichaDosNumeros[] | null | undefined,
  agora: Date = new Date(),
): number {
  const hoje = agoraEmBrasilia(agora).hoje;
  let n = 0;
  for (const c of candidatos ?? [])
    if (
      c.ficha?.situacao === "CONCLUIDA" &&
      diaEmBrasilia(c.ficha.concluida_em) === hoje
    )
      n += 1;
  return n;
}

/** As concluídas com resultado "Apto". */
export function aptasDaFila(
  candidatos: readonly FichaDosNumeros[] | null | undefined,
): number {
  let n = 0;
  for (const c of candidatos ?? [])
    if (c.ficha?.situacao === "CONCLUIDA" && c.ficha.resultado === "APTO")
      n += 1;
  return n;
}

export interface RitmoDaFila {
  /** A meta de hoje; null sem prazo no cronograma ou fora de dia útil. */
  meta: number | null;
  feito: number;
  /** O selo do card "Ritmo da análise" ("No ritmo hoje", "Concluído"); "" sem selo. */
  selo: { rotulo: string; tom: string };
}

/**
 * O ritmo de hoje do edital, do retrato de obter_ritmo_da_analise (a conta
 * do Painel das análises): o selo e a meta do dia. null sem o edital no
 * retrato.
 */
export function ritmoDaFila(
  resposta: unknown,
  editalId: string,
  agora: Agora = agoraEmBrasilia(),
): RitmoDaFila | null {
  const edital = lerRitmoDaAnalise(resposta).find((e) => e.id === editalId);
  if (!edital) return null;
  const r = calcularRitmo(edital, agora);
  const { dia } = r;
  const semMeta =
    dia.situacao === "sem-meta" || dia.situacao === "nao-util" || !dia.meta;
  const selo = seloDoCard(r);
  return {
    meta: semMeta ? null : dia.meta,
    feito: dia.feito,
    selo: { rotulo: selo.rotulo, tom: TOM_DO_SELO_DO_RITMO[selo.situacao] },
  };
}
