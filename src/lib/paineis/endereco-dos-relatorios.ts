import type { IdDoRelatorio } from "./relatorios-dos-paineis.ts";

/*
  O ENDEREÇO DE RELATÓRIOS (`/<área>/relatorios?relatorio=<id>&origem=…&edital=…`)
  e a busca que o atalho "Ver em Relatórios" das outras telas monta
  (src/componentes/ver-em-relatorios.tsx). Fica separado do catálogo
  (./catalogo-dos-relatorios.ts) de propósito: o atalho está na Visão geral,
  que vai no pacote de entrada, e o catálogo traz as definições dos relatórios
  e a exportação em Excel/PDF (orçamento de bundle, `check:bundle-size`). Aqui
  só entram tipos e texto.
*/

/** Os relatórios que abrem por cima do catálogo (e vão no endereço). */
export type IdQueAbre = IdDoRelatorio | "montar-relatorio" | "resumo-por-cargo";

/** De onde vem o recorte do montador: a área inteira ou a Visão geral como está. */
export type OrigemDoRecorte = "" | "visao-geral";

export const ehOrigemDoRecorte = (valor: unknown): valor is OrigemDoRecorte =>
  valor === "" || valor === "visao-geral";

/** Os editais do atalho no endereço (`edital=1,2`), sem vazios nem repetidos. */
export function editaisDoEndereco(valor: unknown): string[] {
  return [
    ...new Set(
      String(valor ?? "")
        .split(",")
        .map((parte) => parte.trim())
        .filter(Boolean),
    ),
  ];
}

/** O texto de `edital=` para a lista de editais (vazio sem nenhum). */
export function editaisParaOEndereco(editais: readonly string[]): string {
  return editaisDoEndereco(editais.join(",")).join(",");
}

/**
 * A busca do endereço de Relatórios para um atalho de outra tela
 * (`relatorio=resumo-por-cargo&edital=7`), sem os valores vazios.
 */
export function buscaDoRelatorio(
  relatorio: IdQueAbre,
  extras: { origem?: OrigemDoRecorte; editais?: readonly string[] } = {},
): string {
  const parametros = new URLSearchParams({ relatorio });
  if (extras.origem) parametros.set("origem", extras.origem);
  const editais = editaisParaOEndereco(extras.editais ?? []);
  if (editais) parametros.set("edital", editais);
  return parametros.toString();
}
