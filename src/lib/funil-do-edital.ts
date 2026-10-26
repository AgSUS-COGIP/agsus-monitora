/*
  O funil do edital na Visão geral e no modal do edital: de onde vêm os
  números e de quando são. O banco escolhe UMA fonte por edital
  (private."FC_ATUALIZAR_KPIS_PELA_SELECAO", migration
  20261022200000_funil_do_edital_de_uma_fonte_so.sql) e grava "TP_FONTE_FUNIL"
  e "DT_FONTE_FUNIL"; o campo que a fonte não tem chega nulo e aparece como
  "—" (nunca 0: zero inscritos seria um dado, e acenderia "Sem inscritos").
*/
import { quandoFoi } from "./texto-da-conferencia.ts";

export const FONTES_DO_FUNIL: Readonly<Record<string, string>> = Object.freeze({
  AVALIACAO_DOCUMENTAL: "Avaliação documental",
  SELECAO: "Seleção",
  ANALISES: "Análises curriculares",
});

export interface LinhaComFunil {
  TP_FONTE_FUNIL?: string | null;
  DT_FONTE_FUNIL?: string | null;
}

/** "Fonte: Seleção, em 16/10, 08:10"; sem fonte gravada, `null`. */
export function textoDaFonteDoFunil(
  linha: LinhaComFunil | null | undefined,
  agora = new Date(),
) {
  const fonte = FONTES_DO_FUNIL[String(linha?.TP_FONTE_FUNIL ?? "")];
  if (!fonte) return null;
  const quando = quandoFoi(linha?.DT_FONTE_FUNIL, agora);
  return quando ? `Fonte: ${fonte}, ${quando}` : `Fonte: ${fonte}`;
}

/** Número do funil em pt-BR; sem valor (a fonte não tem o campo), "—". */
export function numeroDoFunil(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") return "—";
  const n = Number(valor);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR") : "—";
}
