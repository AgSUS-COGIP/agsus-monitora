import { RELATORIOS_DOS_PAINEIS } from "./relatorios-dos-paineis.ts";
import type { IdDoRelatorio } from "./relatorios-dos-paineis.ts";

/*
  O CATÁLOGO DE RELATÓRIOS (bloco Dados do menu, view `paineis-de-dados`;
  antes "Painéis"): a entrada da tela é uma grade de cartões, um por
  relatório de acompanhamento e gestão, separados em grupos. Cada cartão diz
  o que o relatório mostra numa linha; a tela põe a data do cálculo e os
  botões de exportar.

  Só entram aqui os relatórios que cruzam editais. Os documentos de uma
  etapa (resultado e relatório de desempate da Classificação, cartas de
  convocação, a exportação da lista de aprovados) ficam na tela da etapa.

  Grupo sem relatório não aparece. O relatório aberto vai no endereço
  (`/<área>/relatorios?relatorio=<id>`): `ehIdDoRelatorio` diz se o valor
  vale.
*/

export type GrupoDoRelatorio = "editais" | "aprovados" | "produtividade";

export interface RelatorioDoCatalogo {
  id: IdDoRelatorio;
  grupo: GrupoDoRelatorio;
  nome: string;
  /** O que o relatório mostra, em uma linha. */
  resumo: string;
}

export const GRUPOS_DOS_RELATORIOS: readonly {
  id: GrupoDoRelatorio;
  rotulo: string;
}[] = Object.freeze([
  Object.freeze({ id: "editais" as const, rotulo: "Editais" }),
  Object.freeze({ id: "aprovados" as const, rotulo: "Aprovados" }),
  Object.freeze({ id: "produtividade" as const, rotulo: "Produtividade" }),
]);

const GRUPO_DO_RELATORIO: Readonly<Record<IdDoRelatorio, GrupoDoRelatorio>> =
  Object.freeze({
    "resumo-dos-editais": "editais",
    "editais-por-cargo": "editais",
    aprovados: "aprovados",
  });

const RESUMO_DO_RELATORIO: Readonly<Record<IdDoRelatorio, string>> =
  Object.freeze({
    "resumo-dos-editais":
      "Um edital por linha: vagas imediatas, divulgação e data final.",
    "editais-por-cargo":
      "Uma vaga por linha: vagas imediatas, inscritos e aprovados.",
    aprovados:
      "A lista de aprovados vigente de cada edital, com status e matrícula.",
  });

/** Os relatórios do catálogo, na ordem das definições. */
export const CATALOGO_DOS_RELATORIOS: readonly RelatorioDoCatalogo[] =
  Object.freeze(
    RELATORIOS_DOS_PAINEIS.map((r) =>
      Object.freeze({
        id: r.id,
        grupo: GRUPO_DO_RELATORIO[r.id],
        nome: r.rotulo,
        resumo: RESUMO_DO_RELATORIO[r.id],
      }),
    ),
  );

/** O valor (do endereço, de um atalho) é o id de um relatório do catálogo? */
export function ehIdDoRelatorio(valor: unknown): valor is IdDoRelatorio {
  return CATALOGO_DOS_RELATORIOS.some((r) => r.id === valor);
}

export interface GrupoDoCatalogo {
  id: GrupoDoRelatorio;
  rotulo: string;
  relatorios: readonly RelatorioDoCatalogo[];
}

/** Os grupos na ordem de `GRUPOS_DOS_RELATORIOS`, só os que têm relatório. */
export function gruposDoCatalogo(
  relatorios: readonly RelatorioDoCatalogo[] = CATALOGO_DOS_RELATORIOS,
): GrupoDoCatalogo[] {
  return GRUPOS_DOS_RELATORIOS.map((grupo) => ({
    ...grupo,
    relatorios: relatorios.filter((r) => r.grupo === grupo.id),
  })).filter((grupo) => grupo.relatorios.length > 0);
}
