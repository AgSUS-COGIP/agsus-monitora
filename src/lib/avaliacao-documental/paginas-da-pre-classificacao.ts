/*
  A triagem em páginas, sem DOM e sem estado. A aba lê o resumo
  (obter_resumo_pre_classificacao: vagas com as contagens, lotes, congeladas e
  listas, sem os inscritos) e as linhas de cada vaga 50 por vez
  (listar_pre_classificacao), como o job Python gravou: nada se recalcula
  aqui. As vagas e as listas oficiais são partes à parte
  (obter_vagas_pre_classificacao, obter_listas_pre_classificacao), lidas
  quando a parte da tela abre. Migration
  20261029120000_triagem_e_eliminados_em_paginas.sql.

  Banco ainda sem essas RPCs: a aba lê o resultado inteiro, como antes
  (obter_pre_classificacao), e estas funções tiram dele o mesmo resumo e as
  mesmas páginas, na mesma ordem do banco: CLASSIFICADOS = no lote pela
  posição, depois fora do lote pela posição; ELIMINADOS = pelo código;
  PODE_INCLUIR = fora do lote e eliminados que podem entrar por decisão.
*/
import { podeIncluirPorDecisao } from "./tela-da-pre-classificacao.ts";
import { semAcento } from "../fila-de-conducao.ts";
import type {
  DadosDaPreClassificacao,
  InscritoDaPre,
} from "../../modulos/avaliacao-documental/tipos-da-pre-classificacao.ts";

export const RPC_RESUMO_DA_PRE = "obter_resumo_pre_classificacao";
export const RPC_VAGAS_DA_PRE = "obter_vagas_pre_classificacao";
export const RPC_LISTAS_DA_PRE = "obter_listas_pre_classificacao";
export const RPC_PAGINA_DA_PRE = "listar_pre_classificacao";
export const RPC_CONFERIR_ELIMINADOS = "conferir_eliminados_pre_classificacao";

export type GrupoDaPre = "CLASSIFICADOS" | "ELIMINADOS" | "PODE_INCLUIR";

/**
 * O recorte de uma lista: a vaga (null = o edital todo), o grupo, a busca e,
 * nos eliminados, o código do motivo (20261029210000).
 */
export interface RecorteDaPre {
  vaga: string | null;
  grupo: GrupoDaPre;
  busca?: string;
  motivo?: string;
}

/** Um motivo de eliminação com quantos eliminados ele tem no recorte. */
export interface MotivoDaPre {
  codigo: string;
  motivo: string;
  total: number;
}

/** Uma página como a tela usa (o cursor é opaco: o do banco ou o deslocamento). */
export interface PaginaDaPre {
  linhas: InscritoDaPre[];
  proximo: unknown;
  total: number;
  /** Sem vaga: quantos por vaga no recorte. */
  porVaga: Record<string, number>;
  /** Nos eliminados: quantos por motivo no recorte, sem o filtro de motivo. */
  porMotivo: MotivoDaPre[];
}

const numero = (v: unknown): number =>
  Number.isFinite(Number(v)) ? Number(v) : 0;
const ehNoLote = (c: InscritoDaPre) =>
  c.situacao === "NO_LOTE" || c.situacao === "ANALISADO";

/** A ordem do grupo (a mesma de listar_pre_classificacao). */
function grupoDaLinha(c: InscritoDaPre): number {
  if (ehNoLote(c)) return 0;
  return c.situacao === "RANQUEADO" ? 1 : 2;
}
// O banco compara o texto byte a byte (collate "C").
const porTexto = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function noGrupo(c: InscritoDaPre, grupo: GrupoDaPre): boolean {
  if (grupo === "CLASSIFICADOS")
    return ehNoLote(c) || c.situacao === "RANQUEADO";
  if (grupo === "ELIMINADOS") return c.situacao === "ELIMINADO";
  return podeIncluirPorDecisao(c);
}

/** As linhas do recorte, na ordem do banco, tiradas da leitura inteira. */
export function linhasDaPreInteira(
  dados: DadosDaPreClassificacao | null | undefined,
  { vaga, grupo, busca = "", motivo = "" }: RecorteDaPre,
): InscritoDaPre[] {
  const termo = semAcento(busca).trim();
  const posicao = (c: InscritoDaPre) =>
    grupo === "ELIMINADOS" ? 0 : (c.posicao ?? 2147483647);
  return (dados?.candidatos ?? [])
    .filter(
      (c) =>
        (vaga === null || String(c.vaga) === vaga) &&
        noGrupo(c, grupo) &&
        (!motivo || c.motivo_codigo === motivo) &&
        (!termo ||
          semAcento(`${c.codigo ?? ""} ${c.nome ?? ""}`).includes(termo)),
    )
    .sort(
      (a, b) =>
        porTexto(String(a.vaga), String(b.vaga)) ||
        grupoDaLinha(a) - grupoDaLinha(b) ||
        posicao(a) - posicao(b) ||
        porTexto(String(a.codigo ?? ""), String(b.codigo ?? "")),
    );
}

/** Quantos por motivo numa lista de eliminados (a mesma ordem do banco: mais primeiro). */
export function motivosDasLinhas(
  linhas: readonly InscritoDaPre[],
): MotivoDaPre[] {
  const contagem = new Map<string, MotivoDaPre>();
  for (const c of linhas) {
    const codigo = String(c.motivo_codigo ?? "");
    if (!codigo) continue;
    const atual = contagem.get(codigo);
    if (atual) atual.total += 1;
    else
      contagem.set(codigo, {
        codigo,
        motivo: String(c.motivo ?? codigo),
        total: 1,
      });
  }
  return [...contagem.values()].sort(
    (a, b) => b.total - a.total || porTexto(a.codigo, b.codigo),
  );
}

/** Quantos por vaga numa lista de linhas. */
export function contarPorVaga(
  linhas: readonly InscritoDaPre[],
): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const c of linhas) {
    const vaga = String(c.vaga);
    contagem[vaga] = (contagem[vaga] ?? 0) + 1;
  }
  return contagem;
}

/**
 * O resumo tirado da leitura inteira: sem os inscritos, com os lotes, as
 * congeladas e quantos fora do lote por vaga (o que o banco manda no resumo).
 */
export function resumoDaPreInteira(
  dados: DadosDaPreClassificacao,
): DadosDaPreClassificacao {
  const { candidatos = [], ...resto } = dados;
  const lotes = new Map<number, number>();
  const fora = new Map<string, number>();
  const datas: string[] = [];
  let congeladas = 0;
  for (const c of candidatos) {
    if (c.lote) lotes.set(c.lote, (lotes.get(c.lote) ?? 0) + 1);
    if (c.situacao === "RANQUEADO")
      fora.set(String(c.vaga), (fora.get(String(c.vaga)) ?? 0) + 1);
    if (c.declarada_congelada !== null && c.declarada_congelada !== undefined) {
      congeladas += 1;
      if (c.congelada_em) datas.push(String(c.congelada_em));
    }
  }
  return {
    ...resto,
    vagas: (dados.vagas ?? []).map((v) => ({
      ...v,
      fora_do_lote: fora.get(String(v.codigo)) ?? 0,
    })),
    lotes: [...lotes.entries()]
      .sort(([a], [b]) => a - b)
      .map(([lote, quantidade]) => ({ lote, quantidade })),
    congeladas: { quantidade: congeladas, em: datas.sort()[0] ?? null },
  };
}

/** A resposta de listar_pre_classificacao como a tela usa. */
export function paginaDaResposta(resposta: unknown): PaginaDaPre {
  const r = (resposta && typeof resposta === "object" ? resposta : {}) as {
    candidatos?: unknown;
    proximo?: unknown;
    total?: unknown;
    por_vaga?: unknown;
    por_motivo?: unknown;
  };
  const linhas = Array.isArray(r.candidatos)
    ? (r.candidatos as InscritoDaPre[])
    : [];
  const porVaga: Record<string, number> = {};
  if (r.por_vaga && typeof r.por_vaga === "object")
    for (const [vaga, n] of Object.entries(r.por_vaga))
      porVaga[vaga] = numero(n);
  const porMotivo = (Array.isArray(r.por_motivo) ? r.por_motivo : [])
    .filter(
      (m): m is Record<string, unknown> => Boolean(m) && typeof m === "object",
    )
    .map((m) => ({
      codigo: String(m.codigo ?? ""),
      motivo: String(m.motivo ?? m.codigo ?? ""),
      total: numero(m.total),
    }))
    .filter((m) => m.codigo);
  return {
    linhas,
    proximo: r.proximo ?? null,
    total: r.total === undefined ? linhas.length : numero(r.total),
    porVaga,
    porMotivo,
  };
}

/** O que listar_pre_classificacao recebe. */
export function argumentosDaPagina(
  editalId: string,
  { vaga, grupo, busca = "", motivo = "" }: RecorteDaPre,
  apos: unknown,
  limite: number,
) {
  return {
    p_edital: editalId,
    p_vaga: vaga,
    p_grupo: grupo,
    p_busca: busca.trim() || null,
    p_apos: apos ?? null,
    p_limite: limite,
    // Só com motivo escolhido: o banco antes de 20261029210000 não conhece o parâmetro.
    ...(motivo ? { p_motivo: motivo } : {}),
  };
}
