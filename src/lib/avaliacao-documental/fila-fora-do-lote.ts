/*
  A fila leve (supabase/migrations/20261014180000_fila_leve.sql): obter_fila_avaliacao
  traz só o núcleo (quem está no lote ou tem ficha viva) e as contagens dos de
  fora do lote (eliminados e ranqueados sem ficha viva); as linhas de fora vêm
  sob demanda, em páginas, por obter_fila_fora_do_lote — só quando a aba aberta
  precisa delas (Inscritos, Eliminados) ou a coordenação vai incluir por
  decisão. Aqui, sem DOM e sem estado: as contagens das abas com os de fora,
  a lista inteira na ordem do banco e a leitura das páginas.

  A aba Eliminados (sem filtro de responsável) não lê a lista de fora do lote:
  pede ao banco 50 por vez, com vaga, modalidade, busca e ordem aplicadas lá
  (listar_eliminados_fila, 20261029120000_triagem_e_eliminados_em_paginas.sql).
*/
import { contadoresDaFila } from "./fila.ts";
import type { OrdemDaFila } from "./fila.ts";

/** O inscrito na fila, como o banco devolve (as chaves nulas não vêm). */
export interface InscritoDaFila {
  id: string;
  vaga?: string | number | null;
  codigo?: string | number | null;
  situacao_pre?: string | null;
  posicao?: number | null;
  modalidade?: string | null;
  ficha?: { id?: string; situacao?: string } | null;
  [chave: string]: unknown;
}

/** fora_do_lote de obter_fila_avaliacao (schema_version 2). */
export interface ResumoForaDoLote {
  total: number;
  eliminados: number;
  ranqueados: number;
  modalidades: string[];
  versao: string;
}

export interface PaginaForaDoLote {
  candidatos?: InscritoDaFila[] | null;
  proximo?: string | null;
}

/** As abas que mostram os de fora do lote (as outras são só do núcleo). */
const ETAPAS_COM_FORA_DO_LOTE = new Set(["inscritos", "eliminados"]);

/** A aba precisa das linhas de fora do lote? */
export const precisaDoForaDoLote = (
  etapa: string | null | undefined,
): boolean => !etapa || ETAPAS_COM_FORA_DO_LOTE.has(etapa);

const inteiro = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
};

/** O resumo de fora do lote da fila (zeros quando o banco ainda não manda). */
export function resumoForaDoLote(dados: unknown): ResumoForaDoLote {
  const bruto =
    dados && typeof dados === "object"
      ? (dados as { fora_do_lote?: unknown }).fora_do_lote
      : null;
  const f = (bruto && typeof bruto === "object" ? bruto : {}) as Record<
    string,
    unknown
  >;
  return {
    total: inteiro(f.total),
    eliminados: inteiro(f.eliminados),
    ranqueados: inteiro(f.ranqueados),
    modalidades: Array.isArray(f.modalidades)
      ? f.modalidades.filter((m): m is string => typeof m === "string" && !!m)
      : [],
    versao: typeof f.versao === "string" ? f.versao : "",
  };
}

/**
 * Os contadores das abas: os do núcleo (contadoresDaFila) mais os de fora do
 * lote em Inscritos e Eliminados (as outras abas são só do núcleo: fora do
 * lote ninguém tem ficha viva).
 */
export function contadoresComForaDoLote(
  nucleo: InscritoDaFila[],
  fora: ResumoForaDoLote,
): Record<string, number> {
  const base = contadoresDaFila(nucleo) as Record<string, number>;
  return {
    ...base,
    inscritos: (base.inscritos ?? 0) + fora.total,
    eliminados: (base.eliminados ?? 0) + fora.eliminados,
  };
}

const texto = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v);
const comparador = new Intl.Collator("pt-BR", {
  numeric: true,
  sensitivity: "base",
});

/*
  A ordem do banco (a de obter_fila_avaliacao antes da fila leve): vaga,
  eliminados por último, posição (sem posição no fim) e código.
*/
function ordemDoBanco(a: InscritoDaFila, b: InscritoDaFila): number {
  const posicao = (c: InscritoDaFila) =>
    Number.isFinite(c.posicao) ? (c.posicao as number) : Infinity;
  return (
    comparador.compare(texto(a.vaga), texto(b.vaga)) ||
    Number(a.situacao_pre === "ELIMINADO") -
      Number(b.situacao_pre === "ELIMINADO") ||
    posicao(a) - posicao(b) ||
    comparador.compare(texto(a.codigo), texto(b.codigo))
  );
}

/** O núcleo e os de fora do lote numa lista só, na ordem do banco (sem repetir inscrito). */
export function juntarFila(
  nucleo: InscritoDaFila[] | null | undefined,
  fora: InscritoDaFila[] | null | undefined,
): InscritoDaFila[] {
  const base = Array.isArray(nucleo) ? nucleo : [];
  if (!Array.isArray(fora) || !fora.length) return base;
  const vistos = new Set(base.map((c) => c.id));
  return [...base, ...fora.filter((c) => !vistos.has(c.id))].sort(ordemDoBanco);
}

/** As modalidades do filtro: as do núcleo e as de fora do lote (o banco já manda a lista). */
export function modalidadesDaFila(
  nucleo: InscritoDaFila[],
  fora: ResumoForaDoLote,
): string[] {
  const todas = new Set<string>(fora.modalidades);
  for (const c of Array.isArray(nucleo) ? nucleo : [])
    if (typeof c.modalidade === "string" && c.modalidade)
      todas.add(c.modalidade);
  return [...todas].sort();
}

export const RPC_FORA_DO_LOTE = "obter_fila_fora_do_lote";
export const TAMANHO_DA_PAGINA = 2000;
/* 114/2026: 5.954 de fora do lote = 3 páginas; o teto só evita laço sem fim. */
const MAXIMO_DE_PAGINAS = 50;

/**
 * Lê todas as páginas de fora do lote (uma depois da outra: cada chamada é
 * curta, longe dos 8 s do banco). rpc(nome, argumentos) é a chamada da tela.
 */
export async function lerForaDoLote(
  rpc: (nome: string, argumentos: Record<string, unknown>) => Promise<unknown>,
  editalId: string,
  tamanho = TAMANHO_DA_PAGINA,
): Promise<InscritoDaFila[]> {
  const linhas: InscritoDaFila[] = [];
  let apos: string | null = null;
  for (let pagina = 0; pagina < MAXIMO_DE_PAGINAS; pagina += 1) {
    const r = (await rpc(RPC_FORA_DO_LOTE, {
      p_edital: editalId,
      p_apos: apos,
      p_limite: tamanho,
    })) as PaginaForaDoLote | null;
    if (Array.isArray(r?.candidatos)) linhas.push(...r.candidatos);
    apos = typeof r?.proximo === "string" && r.proximo ? r.proximo : null;
    if (!apos) return linhas;
  }
  throw new Error("A lista de fora do lote não terminou de carregar.");
}

/* ─── A aba Eliminados em páginas (listar_eliminados_fila) ─── */

export const RPC_ELIMINADOS_DA_FILA = "listar_eliminados_fila";
/* O CSV da aba lê o recorte inteiro em páginas maiores. */
export const PAGINA_DO_CSV = 2000;

/** As colunas que o banco sabe ordenar (as da aba Eliminados). */
const ORDENS_DOS_ELIMINADOS = new Set([
  "codigo",
  "nome",
  "vaga",
  "motivo",
  "art",
]);

/** O filtro da fila no que vale para os eliminados. */
export interface FiltroDosEliminados {
  etapa?: string;
  vaga?: string;
  modalidade?: string;
  responsavel?: string;
  busca?: string;
}

/** A ordem da tabela (chave da coluna e sentido; "" = a do banco). */
export type OrdemDosEliminados = OrdemDaFila;

/** Uma página da aba Eliminados. */
export interface PaginaDosEliminados {
  linhas: InscritoDaFila[];
  proximo: unknown;
  total: number;
}

/**
 * A aba vem do banco em páginas? Sim nos Eliminados, salvo com filtro de
 * responsável (quem tem ficha: a lista do núcleo, já na tela).
 */
export const eliminadosNoBanco = (
  filtro: FiltroDosEliminados | null | undefined,
): boolean => filtro?.etapa === "eliminados" && !filtro?.responsavel;

/** O que listar_eliminados_fila recebe. */
export function argumentosDosEliminados(
  editalId: string,
  filtro: FiltroDosEliminados,
  ordem: OrdemDosEliminados | null | undefined,
  apos: unknown,
  limite: number,
) {
  const coluna =
    ordem?.chave && ORDENS_DOS_ELIMINADOS.has(ordem.chave) && ordem.sentido
      ? ordem.chave
      : null;
  return {
    p_edital: editalId,
    p_vaga: filtro.vaga || null,
    p_modalidade: filtro.modalidade || null,
    p_busca: (filtro.busca ?? "").trim() || null,
    p_ordem: coluna,
    p_sentido: coluna && ordem?.sentido === "desc" ? "desc" : "asc",
    p_apos: apos ?? null,
    p_limite: limite,
  };
}

/** A resposta de listar_eliminados_fila como a tabela usa. */
export function paginaDosEliminados(resposta: unknown): PaginaDosEliminados {
  const r = (resposta && typeof resposta === "object" ? resposta : {}) as {
    candidatos?: unknown;
    proximo?: unknown;
    total?: unknown;
  };
  const linhas = Array.isArray(r.candidatos)
    ? (r.candidatos as InscritoDaFila[])
    : [];
  const total = Number(r.total);
  return {
    linhas,
    proximo: r.proximo ?? null,
    total: Number.isFinite(total) ? total : linhas.length,
  };
}
