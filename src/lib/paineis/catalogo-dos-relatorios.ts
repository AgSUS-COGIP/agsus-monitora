import { RELATORIOS_DOS_PAINEIS } from "./relatorios-dos-paineis.ts";
import type { IdDoRelatorio } from "./relatorios-dos-paineis.ts";
import type { IdQueAbre } from "./endereco-dos-relatorios.ts";

/*
  O CATÁLOGO DE RELATÓRIOS (bloco Dados do menu, view `paineis-de-dados`;
  antes "Painéis"): a entrada da tela é uma grade de cartões, um por
  relatório de acompanhamento e gestão, separados em grupos. Cada cartão diz
  o que o relatório mostra numa linha (e, quando dois relatórios contam a
  mesma coisa por regras diferentes, a regra numa segunda linha); a tela põe
  quando ele foi calculado e os botões.

  Três jeitos de relatório (`tipo`):
  - `calculado`: calculado no banco (ler_relatorio_do_painel), com tabela
    paginada, Sincronizar e exportação (src/lib/paineis/relatorios-dos-paineis.ts);
  - `montador`: o montador de relatório, com os editais da área ou o recorte
    da Visão geral (src/lib/paineis/relatorio-da-visao-geral.ts);
  - `diretoria`: o modelo Diretoria do montador, gerado direto do cartão
    (editais, vagas por cargo e aprovados; src/lib/paineis/relatorio-da-diretoria.ts);
  - `resumo-por-cargo`: o Resumo por cargo e status, contado no navegador
    sobre a lista de aprovados vigente (src/lib/paineis/resumo-por-cargo-e-status.ts).
    Só aparece para quem tem o recurso `aprovados` (o mesmo da Lista de
    aprovados, de onde saiu em 23/11/2026).

  Só entram aqui os relatórios que cruzam editais. Os documentos de uma
  etapa (resultado e relatório de desempate da Classificação, cartas de
  convocação, a exportação da lista de aprovados) ficam na tela da etapa.

  Grupo sem relatório não aparece. O relatório aberto vai no endereço
  (`/<área>/relatorios?relatorio=<id>`): `ehRelatorioDoEndereco` diz se o
  valor abre alguma coisa; o atalho "Ver em Relatórios" das outras telas
  monta a busca com `buscaDoRelatorio`.
*/

export type GrupoDoRelatorio = "editais" | "aprovados" | "produtividade";

export type TipoDoRelatorio =
  "calculado" | "montador" | "diretoria" | "resumo-por-cargo";

export type IdDoCatalogo =
  | IdDoRelatorio
  | "montar-relatorio"
  | "relatorio-da-diretoria"
  | "resumo-por-cargo";

export interface RelatorioDoCatalogo {
  id: IdDoCatalogo;
  tipo: TipoDoRelatorio;
  grupo: GrupoDoRelatorio;
  nome: string;
  /** O que o relatório mostra, em uma linha. */
  resumo: string;
  /** A regra que o separa de outro parecido, em uma linha (ou nada). */
  regra?: string;
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

/*
  As duas versões ficam (decisão de 23/11/2026, até a regra ser uma só): o
  cartão diz qual é a de cada um.
*/
const REGRA_DO_RELATORIO: Readonly<Partial<Record<IdDoRelatorio, string>>> =
  Object.freeze({
    "editais-por-cargo":
      "Calculado no banco; aprovados casados pelo código da vaga.",
    aprovados: "Admissão: o dia em que o aprovado virou Contratado no sistema.",
  });

const CALCULADOS: readonly RelatorioDoCatalogo[] = RELATORIOS_DOS_PAINEIS.map(
  (r) =>
    Object.freeze({
      id: r.id,
      tipo: "calculado" as const,
      grupo: GRUPO_DO_RELATORIO[r.id],
      nome: r.rotulo,
      resumo: RESUMO_DO_RELATORIO[r.id],
      ...(REGRA_DO_RELATORIO[r.id] ? { regra: REGRA_DO_RELATORIO[r.id] } : {}),
    }),
);

const MONTAR_RELATORIO: RelatorioDoCatalogo = Object.freeze({
  id: "montar-relatorio",
  tipo: "montador",
  grupo: "editais",
  nome: "Montar relatório",
  resumo:
    "Escolha as seções, as colunas e o formato (PDF, Excel ou CSV) dos editais.",
});

const RESUMO_POR_CARGO: RelatorioDoCatalogo = Object.freeze({
  id: "resumo-por-cargo",
  tipo: "resumo-por-cargo",
  grupo: "aprovados",
  nome: "Resumo por cargo e status",
  resumo:
    "Por edital, cargo, regime e jornada: aprovados, contratados, desistentes e reserva.",
});

const RELATORIO_DA_DIRETORIA: RelatorioDoCatalogo = Object.freeze({
  id: "relatorio-da-diretoria",
  tipo: "diretoria",
  grupo: "aprovados",
  nome: "Relatório da diretoria",
  resumo: "Editais, vagas por cargo e aprovados, num arquivo só.",
  regra: "Admissão conciliada com o RH; o download fica registrado.",
});

/** Todos os relatórios do catálogo, na ordem em que aparecem. */
export const CATALOGO_DOS_RELATORIOS: readonly RelatorioDoCatalogo[] =
  Object.freeze([
    ...CALCULADOS.filter((r) => r.grupo === "editais"),
    MONTAR_RELATORIO,
    ...CALCULADOS.filter((r) => r.grupo === "aprovados"),
    RESUMO_POR_CARGO,
    RELATORIO_DA_DIRETORIA,
  ]);

/** O que a pessoa pode ver no catálogo, além do recurso da tela. */
export interface AcessoAoCatalogo {
  /** O recurso `aprovados` (o Resumo por cargo e status). */
  aprovados: boolean;
}

/** Os relatórios que a pessoa vê (o Resumo por cargo pede o recurso `aprovados`). */
export function catalogoPermitido(
  acesso: AcessoAoCatalogo,
): readonly RelatorioDoCatalogo[] {
  return CATALOGO_DOS_RELATORIOS.filter(
    (r) => r.tipo !== "resumo-por-cargo" || acesso.aprovados,
  );
}

/** O valor (do endereço, de um atalho) é o id de um relatório calculado no banco? */
export function ehIdDoRelatorio(valor: unknown): valor is IdDoRelatorio {
  return CALCULADOS.some((r) => r.id === valor);
}

/** O valor do endereço (`?relatorio=`) abre alguma coisa por cima do catálogo? */
export function ehRelatorioDoEndereco(valor: unknown): valor is IdQueAbre {
  return (
    ehIdDoRelatorio(valor) ||
    valor === "montar-relatorio" ||
    valor === "resumo-por-cargo"
  );
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
