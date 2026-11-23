/*
  Ativos e Histórico da Lista de aprovados (abas Aprovados e Resumo por
  cargo). A lista de trabalho (Ativos, o padrão) tem os candidatos de lista
  ativa; o Histórico, a um clique, tem as listas inativas ou substituídas e as
  de edital cancelado ou desativado.

  O edital CONCLUÍDO fica nos Ativos: na Lista de aprovados quase todo edital
  com lista já concluiu a seleção, e é justamente a lista dele que está em
  convocação. Com a regra das telas de Editais (concluído vai para o
  Histórico), a vista Ativos ficou vazia em produção (23/11/2026: os 85
  editais no Histórico).

  O filtro de Edital, os indicadores e o "N de M candidatos" partem da vista
  escolhida. A Convocação, o sub judice e os modais continuam vendo a área
  inteira (src/modulos/aprovados/lista-aprovados.tsx).
*/
import {
  contarPorSituacao,
  type SituacaoContada,
  type VistaDaLista,
} from "../base/ativos-e-historico.ts";
import {
  situacaoDoEdital,
  type EditalComSituacao,
} from "../editais/editais-ativos.ts";
import { ehCancelado } from "../visao-geral/indicadores-do-monitoramento.ts";

interface ListaDaVista {
  edital_id?: unknown;
  ativo?: unknown;
}

interface CandidatoDaVista {
  edital_id?: unknown;
  lista_ativa?: unknown;
}

export interface VistaDosAprovados<L, C> {
  listas: L[];
  candidatos: C[];
  /** Quantos editais aparecem na vista (pelas listas e pelos candidatos). */
  editais: number;
  /** Os editais da vista por situação ("Em andamento 9 · Suspenso 1"). */
  situacoes: SituacaoContada[];
}

const texto = (valor: unknown) => String(valor ?? "").trim();

/**
 * Separa as listas e os candidatos da área em Ativos e Histórico. `linhas`
 * são as linhas do monitoramento da área (id, status, ativo); edital sem
 * linha conta como vigente, e o concluído também.
 */
export function separarAprovados<
  L extends ListaDaVista,
  C extends CandidatoDaVista,
>(
  listas: readonly L[] | null | undefined,
  candidatos: readonly C[] | null | undefined,
  linhas: readonly unknown[] | null | undefined,
): Record<VistaDaLista, VistaDosAprovados<L, C>> {
  const porId = new Map<string, EditalComSituacao>();
  for (const linha of linhas || []) {
    const l = linha as EditalComSituacao | null;
    if (l && l.id !== undefined && l.id !== null) porId.set(texto(l.id), l);
  }
  // Só o edital cancelado ou desativado tira a lista dos Ativos (o concluído, não).
  const vigente = (editalId: unknown) => {
    const linha = porId.get(texto(editalId));
    return !linha || !(linha.ativo === false || ehCancelado(linha));
  };

  const vista = (ativos: boolean): VistaDosAprovados<L, C> => {
    const listasDaVista = (listas || []).filter(
      (l) => (vigente(l.edital_id) && Boolean(l.ativo)) === ativos,
    );
    const candidatosDaVista = (candidatos || []).filter(
      (c) => (vigente(c.edital_id) && Boolean(c.lista_ativa)) === ativos,
    );
    const ids = new Set(
      [...listasDaVista, ...candidatosDaVista]
        .map((item) => texto(item.edital_id))
        .filter(Boolean),
    );
    const editais = [...ids].map((id) => porId.get(id) ?? { id });
    return {
      listas: listasDaVista,
      candidatos: candidatosDaVista,
      editais: ids.size,
      situacoes: contarPorSituacao(editais, situacaoDoEdital),
    };
  };
  return { ativos: vista(true), historico: vista(false) };
}

/**
 * A vista onde o pedido (um edital, ou candidatos) aparece: a atual, se ele
 * está nela; senão a outra, se está lá. O número da Visão geral ou a faixa das
 * etapas que abre um edital concluído cai no Histórico, não num filtro vazio.
 */
export function vistaDoPedido<C extends CandidatoDaVista>(
  separados: Record<VistaDaLista, { candidatos: readonly C[] }>,
  atual: VistaDaLista,
  pedido: { editalIds?: readonly string[]; candidatoIds?: readonly string[] },
  idDoCandidato: (candidato: C) => string,
): VistaDaLista {
  const editais = new Set((pedido.editalIds || []).map(texto).filter(Boolean));
  const pessoas = new Set(
    (pedido.candidatoIds || []).map(texto).filter(Boolean),
  );
  if (!editais.size && !pessoas.size) return atual;
  const tem = (vista: VistaDaLista) =>
    separados[vista].candidatos.some(
      (c) => editais.has(texto(c.edital_id)) || pessoas.has(idDoCandidato(c)),
    );
  if (tem(atual)) return atual;
  const outra: VistaDaLista = atual === "ativos" ? "historico" : "ativos";
  return tem(outra) ? outra : atual;
}
