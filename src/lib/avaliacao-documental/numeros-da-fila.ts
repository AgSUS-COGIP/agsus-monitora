/*
  Os números do alto da Fila da Avaliação documental (cards): concluídas
  hoje, as fichas abertas de quem está na tela e a meta do dia (a mesma
  conta do card "Ritmo da análise" do Painel das análises,
  src/lib/ritmo-da-analise.ts, lida de obter_ritmo_da_analise). Sem DOM; a
  lista é a que a Fila já carregou (obter_fila_avaliacao), sem consulta nova
  — só a meta pede o ritmo, uma vez por área, e some se a pessoa não pode
  ler o Painel das análises.
*/
import {
  agoraEmBrasilia,
  calcularRitmo,
  lerRitmoDaAnalise,
} from "../ritmo-da-analise.ts";
import type { Agora } from "../ritmo-da-analise.ts";

interface FichaDosNumeros {
  ficha?: {
    situacao?: unknown;
    responsavel?: unknown;
    concluida_em?: unknown;
  } | null;
}

const ABERTAS: ReadonlySet<unknown> = new Set([
  "PENDENTE",
  "EM_ANALISE",
  "REVISAR",
]);

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

/** As fichas ainda abertas (pendente, em análise, em revisão) com a pessoa. */
export function minhasAbertas(
  candidatos: readonly FichaDosNumeros[] | null | undefined,
  eu: string | null | undefined,
): number {
  if (!eu) return 0;
  let n = 0;
  for (const c of candidatos ?? [])
    if (c.ficha?.responsavel === eu && ABERTAS.has(c.ficha.situacao)) n += 1;
  return n;
}

/** "45%" (parte do total, para baixo; 100% só com tudo feito); "" sem total. */
export function percentualDe(parte: number, total: number): string {
  if (!total) return "";
  if (parte >= total) return "100%";
  return `${Math.min(99, Math.floor((parte / total) * 100))}%`;
}

export interface MetaDoDia {
  meta: number;
  feito: number;
}

/**
 * A meta de hoje do edital, do retrato de obter_ritmo_da_analise (a conta
 * do Painel das análises). null sem o edital no retrato, sem prazo no
 * cronograma ou fora de dia útil.
 */
export function metaDoDia(
  resposta: unknown,
  editalId: string,
  agora: Agora = agoraEmBrasilia(),
): MetaDoDia | null {
  const edital = lerRitmoDaAnalise(resposta).find((e) => e.id === editalId);
  if (!edital) return null;
  const { dia } = calcularRitmo(edital, agora);
  if (dia.situacao === "sem-meta" || dia.situacao === "nao-util" || !dia.meta)
    return null;
  return { meta: dia.meta, feito: dia.feito };
}
