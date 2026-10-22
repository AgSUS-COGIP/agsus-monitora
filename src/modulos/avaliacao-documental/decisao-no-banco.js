/*
  Inclusão no lote por decisão da coordenação e revogação, usadas pela aba
  Pré-classificação e pela Fila (sem React). RPCs
  (supabase/migrations/20261007200000_inclusao_no_lote_por_decisao.sql;
  contrato em src/lib/rpc-contrato.js):
    incluir_no_lote_por_decisao(p_edital, p_codigos, p_motivo, p_vaga)
    revogar_decisao_lote(p_edital, p_codigos, p_motivo, p_vaga)
  Uma chamada por vaga (o mesmo código pode estar em mais de uma vaga).
*/
import { codigosPorVaga } from "../../lib/avaliacao-documental/tela-da-pre-classificacao.js";

const RPC_INCLUIR_POR_DECISAO = "incluir_no_lote_por_decisao";
const RPC_REVOGAR_DECISAO = "revogar_decisao_lote";

const ACOES = Object.freeze({
  incluir: {
    rpc: RPC_INCLUIR_POR_DECISAO,
    campo: "incluidos",
    texto: (n) =>
      `${n} ${n === 1 ? "candidato incluído" : "candidatos incluídos"} no lote por decisão da coordenação.`,
  },
  revogar: {
    rpc: RPC_REVOGAR_DECISAO,
    campo: "revogadas",
    texto: (n) =>
      `${n} ${n === 1 ? "decisão revogada" : "decisões revogadas"}.`,
  },
});

/**
 * Inclui ou revoga (acao = "incluir" | "revogar") os candidatos
 * [{ codigo, vaga }] do edital, com o motivo. `rpc(nome, argumentos)` é a
 * chamada do store. Devolve { quantidade, texto }; o erro do banco sobe.
 */
export async function decidirNoLote(rpc, acao, editalId, candidatos, motivo) {
  const a = ACOES[acao];
  if (!a) throw new Error(`Ação desconhecida: ${acao}`);
  let quantidade = 0;
  for (const { vaga, codigos } of codigosPorVaga(candidatos)) {
    const r = await rpc(a.rpc, {
      p_edital: editalId,
      p_codigos: codigos,
      p_motivo: String(motivo ?? "").trim(),
      p_vaga: vaga,
    });
    quantidade += Number(r?.[a.campo]) || 0;
  }
  return { quantidade, texto: a.texto(quantidade) };
}
