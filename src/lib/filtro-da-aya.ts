/*
  O botão "Abrir" de uma resposta com número da Aya leva à tela já
  recortada: o pedido (`{ edital: "93/2026", metrica: "pendente" }`, de
  src/lib/intencoes-da-aya.ts) vira os filtros que cada tela já tem. Sem DOM:
  a tela passa as opções dos filtros dela e recebe os filtros novos.

  O edital casa pelo número ("93/2026" ou só "93"); a métrica, pelo filtro
  que o indicador da tela aplica quando é clicado. O que não casa fica como
  estava (a tela abre sem aquele recorte, nunca com um recorte errado).
*/
import type { FiltrosDasAnalises } from "../modulos/analises/tipos.ts";
import type {
  CampoDoFiltro as CampoDoFiltroDasEntrevistas,
  FiltrosDoPainel,
  OpcoesDosFiltros as OpcoesDasEntrevistas,
} from "../modulos/entrevistas/tipos-do-painel.ts";
import type {
  FiltrosDaSelecao,
  OpcoesDosFiltros as OpcoesDaSelecao,
} from "../modulos/selecao/tipos.ts";
import { mesmoEdital } from "./intencoes-da-aya.ts";
import type {
  CampoDoFiltroDosRecursos,
  FiltrosDosRecursos,
} from "./tipos-dos-recursos.ts";

/** Uma opção de filtro: o texto ou `{ valor, rotulo }`. */
export type OpcaoDoFiltro =
  string | { valor?: unknown; rotulo?: unknown } | null | undefined;

/**
 * O pedido da Aya (ou de um aviso de conferência): edital, métrica e busca.
 * Vem de `pedirFiltro`, sem forma garantida.
 */
export interface PedidoDaAya {
  edital?: unknown;
  metrica?: unknown;
  busca?: unknown;
}

/** As opções de uma tela que têm a lista de editais. */
interface OpcoesComEditais {
  editais?: readonly OpcaoDoFiltro[];
}

const valorDe = (opcao: OpcaoDoFiltro): string =>
  typeof opcao === "string" ? opcao : String(opcao?.valor ?? "");
const rotuloDe = (opcao: OpcaoDoFiltro): string =>
  typeof opcao === "string"
    ? opcao
    : String(opcao?.rotulo ?? opcao?.valor ?? "");

/** Os valores das opções cujo rótulo é o edital pedido. */
export function opcoesDoEdital(
  opcoes: readonly OpcaoDoFiltro[] | null | undefined,
  edital: unknown,
): string[] {
  if (!edital) return [];
  return (opcoes || [])
    .filter((opcao) => mesmoEdital(rotuloDe(opcao), edital))
    .map(valorDe);
}

/* O filtro que o indicador clicado aplica em cada tela. */
const METRICA_DE_RECURSOS: Readonly<
  Record<string, readonly [CampoDoFiltroDosRecursos, string]>
> = Object.freeze({
  aguardandoParecer: ["situacao", "EM_ANALISE_JURIDICA"],
  atrasados: ["pendencia", "prazo_vencido"],
  deferidos: ["situacao", "deferidos"],
  indeferidos: ["situacao", "INDEFERIDO"],
});
const METRICA_DE_ENTREVISTAS: Readonly<
  Record<string, readonly [CampoDoFiltroDasEntrevistas, string]>
> = Object.freeze({
  aptos: ["parecer", "APTO"],
  inaptos: ["parecer", "INAPTO"],
  compareceram: ["comparecimento", "S"],
});

/** Recursos: um edital (pelo id) e o filtro do indicador. */
export function filtrosDeRecursos(
  atuais: Readonly<FiltrosDosRecursos>,
  pedido: PedidoDaAya | null | undefined,
  opcoes: OpcoesComEditais | null | undefined,
): FiltrosDosRecursos {
  const proximos = { ...atuais };
  const [edital] = opcoesDoEdital(opcoes?.editais, pedido?.edital);
  if (edital) proximos.edital = edital;
  const metrica = METRICA_DE_RECURSOS[pedido?.metrica as string];
  if (metrica) proximos[metrica[0]] = metrica[1];
  return proximos;
}

/**
 * Entrevistas (Resultados): um edital, o parecer ou comparecimento e a busca
 * (o caso de um aviso de conferência busca o candidato).
 */
export function filtrosDeEntrevistas(
  atuais: FiltrosDoPainel,
  pedido: PedidoDaAya | null | undefined,
  opcoes: Partial<OpcoesDasEntrevistas> | null | undefined,
): FiltrosDoPainel {
  const proximos = { ...atuais };
  const [edital] = opcoesDoEdital(opcoes?.editais, pedido?.edital);
  if (edital) proximos.edital = edital;
  const busca = String(pedido?.busca ?? "").trim();
  if (busca) proximos.busca = busca;
  const metrica = METRICA_DE_ENTREVISTAS[pedido?.metrica as string];
  if (metrica) proximos[metrica[0]] = metrica[1];
  return proximos;
}

/** Seleção: os editais (escolha múltipla) com o número pedido. */
export function filtrosDaSelecao(
  atuais: FiltrosDaSelecao,
  pedido: PedidoDaAya | null | undefined,
  opcoes: Partial<OpcoesDaSelecao> | null | undefined,
): FiltrosDaSelecao {
  const editais = opcoesDoEdital(opcoes?.editais, pedido?.edital);
  return editais.length ? { ...atuais, editais } : { ...atuais };
}

/* Análises: o indicador clicado (`kpi` da tela) para cada métrica da Aya. */
const KPI_DAS_ANALISES: Readonly<Record<string, string>> = Object.freeze({
  pendente: "pendente",
  revisar: "revisar",
  aprovado: "aprovado",
  reprovado: "reprovado",
  analisado: "analisado",
});

/**
 * Análises: os editais (escolha múltipla, pelo valor da linha), o KPI e a
 * busca (o caso de um aviso de conferência busca pelo nome do candidato).
 * Devolve `{ filtros, kpi }`; o KPI fica como estava se a métrica não tem um.
 */
export function filtrosDasAnalises(
  atuais: FiltrosDasAnalises,
  pedido: PedidoDaAya | null | undefined,
  linhas:
    | readonly (Readonly<Record<string, unknown>> | null | undefined)[]
    | null
    | undefined,
  kpiAtual = "",
): { filtros: FiltrosDasAnalises; kpi: string } {
  const editais = [
    ...new Set(
      (linhas || [])
        .map((linha) => String(linha?.edital ?? "").trim())
        .filter(Boolean),
    ),
  ];
  const escolhidos = opcoesDoEdital(editais, pedido?.edital);
  const filtros: FiltrosDasAnalises = escolhidos.length
    ? { ...atuais, edital: escolhidos }
    : { ...atuais };
  const busca = String(pedido?.busca ?? "").trim();
  if (busca) filtros.busca = busca;
  return {
    filtros,
    kpi: KPI_DAS_ANALISES[pedido?.metrica as string] ?? kpiAtual,
  };
}
