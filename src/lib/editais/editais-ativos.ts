/*
  Ativos e Histórico dos editais (Editais e as listas de editais da Avaliação
  documental, da Classificação e de Conduzir entrevistas): vai para o
  Histórico o edital que não está vigente — concluído, cancelado (a regra dos
  indicadores, ehEditalEncerrado) ou desativado. A situação é o status do
  edital; o desativado aparece como "Desativado".

  A separação e a contagem são src/lib/base/ativos-e-historico.ts.
*/
import {
  ehCancelado,
  ehConcluido,
  ehEditalEncerrado,
} from "../visao-geral/indicadores-do-monitoramento.ts";
import { tomDoStatusDoEdital } from "./editais-do-nucleo.ts";

export interface EditalComSituacao {
  id?: unknown;
  ativo?: boolean | null;
  status?: string | null;
}

/** O edital vai para o Histórico (o contrário de editalVigente)? */
export const editalDoHistorico = (edital: EditalComSituacao): boolean =>
  edital.ativo === false || ehEditalEncerrado(edital);

/**
 * "Reativar edital" no "⋯" da linha (Editais, Histórico): "reativar" no
 * concluído, "cancelado" no cancelado (o modal explica que é no formulário) e
 * `null` nos outros (ativos e desativados). A regra da reativação, sob
 * demanda, é `reativar-edital.ts`.
 */
export function acaoDeReativarNaLinha(
  edital:
    { readonly ativo?: unknown; readonly status?: unknown } | null | undefined,
): "reativar" | "cancelado" | null {
  if (!edital || edital.ativo === false) return null;
  if (ehCancelado(edital)) return "cancelado";
  if (ehConcluido(edital)) return "reativar";
  return null;
}

/** A situação que a contagem mostra: o status, ou "Desativado". */
export const situacaoDoEdital = (edital: EditalComSituacao): string =>
  edital.ativo === false ? "Desativado" : String(edital.status ?? "").trim();

/* O tom do `Selo` de cada situação (o mesmo do status na tabela de Editais). */
const SELO_DO_TOM: Readonly<Record<string, string>> = {
  green: "aprovado",
  red: "reprovado",
  yellow: "pendente",
  blue: "revisar",
  cyan: "revisar",
};

/** O tom do selo da situação: a cor complementa o rótulo. */
export const tomDaSituacaoDoEdital = (situacao: string): string =>
  SELO_DO_TOM[tomDoStatusDoEdital(situacao)] || "neutro";

/**
 * Junta o status das linhas do monitoramento (que têm `id`, `status` e
 * `ativo`) aos editais de uma lista que não os traz (a da Classificação).
 */
export function comSituacaoDoMonitoramento<T extends { id: string }>(
  editais: ReadonlyArray<T>,
  linhas: ReadonlyArray<unknown>,
): Array<T & EditalComSituacao> {
  const porId = new Map<string, EditalComSituacao>();
  for (const linha of linhas) {
    const l = linha as EditalComSituacao | null;
    if (l && typeof l.id === "string") porId.set(l.id, l);
  }
  return editais.map((edital) => {
    const linha = porId.get(edital.id);
    return linha
      ? { ...edital, status: linha.status ?? null, ativo: linha.ativo ?? null }
      : edital;
  });
}
