/*
  A fila só com o que mudou
  (supabase/migrations/20261014231000_fila_e_ficha_so_o_que_mudou.sql):
  obter_fila_avaliacao_desde recebe o gerado_em e a marca da leitura anterior
  e devolve, em vez do núcleo inteiro (114/2026: 1.342 linhas, ~440 KB), só as
  linhas cuja ficha mudou desde então (parcial), os ids que saíram do núcleo
  e quantas linhas ele tem. Aqui, sem DOM e sem estado, a junção com a fila
  que a tela já tem; quando algo não bate (linha nova no núcleo, que mudaria a
  ordem, ou total diferente), `null`: a tela lê a fila inteira.
*/
import type { InscritoDaFila } from "./fila-fora-do-lote.ts";

export const RPC_FILA_DESDE = "obter_fila_avaliacao_desde";

/** A fila como a tela guarda (o payload de obter_fila_avaliacao, com marca). */
export interface DadosDaFila {
  gerado_em?: string | null;
  marca?: string | null;
  candidatos?: InscritoDaFila[] | null;
  [chave: string]: unknown;
}

/** A resposta de obter_fila_avaliacao_desde. */
export interface RespostaDaFilaDesde extends DadosDaFila {
  parcial?: boolean;
  saiu?: string[] | null;
  total_nucleo?: number | null;
}

const ehRegistro = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** Os argumentos da próxima leitura: o gerado_em e a marca da fila que a tela tem. */
export function argumentosDaFilaDesde(
  editalId: string,
  anterior: DadosDaFila | null | undefined,
): { p_edital: string; p_desde: string | null; p_marca: string | null } {
  const desde =
    typeof anterior?.gerado_em === "string" ? anterior.gerado_em : null;
  const marca = typeof anterior?.marca === "string" ? anterior.marca : null;
  return {
    p_edital: editalId,
    p_desde: desde && marca ? desde : null,
    p_marca: desde && marca ? marca : null,
  };
}

/**
 * A fila depois da resposta: a inteira (parcial false) volta como veio; a
 * parcial é juntada à anterior (linhas trocadas no lugar, as que saíram
 * tiradas; o resto da fila — contagens, analistas, filtros — vem da resposta,
 * e as vagas, que estão na marca, ficam as de antes). `null` quando não dá
 * para juntar.
 */
export function aplicarMudancasDaFila(
  anterior: DadosDaFila | null | undefined,
  resposta: unknown,
): DadosDaFila | null {
  if (!ehRegistro(resposta)) return null;
  const r = resposta as RespostaDaFilaDesde;
  if (r.parcial !== true) return r;
  if (!anterior || !Array.isArray(anterior.candidatos)) return null;
  const mudaram = new Map<string, InscritoDaFila>();
  for (const c of Array.isArray(r.candidatos) ? r.candidatos : [])
    if (c && typeof c.id === "string") mudaram.set(c.id, c);
  const saiu = new Set(Array.isArray(r.saiu) ? r.saiu.map(String) : []);
  const ids = new Set(anterior.candidatos.map((c) => c.id));
  // Linha que não estava na fila: a posição dela depende da ordem do banco.
  for (const id of mudaram.keys()) if (!ids.has(id)) return null;
  const candidatos = anterior.candidatos
    .filter((c) => !saiu.has(c.id))
    .map((c) => mudaram.get(c.id) ?? c);
  if (candidatos.length !== Number(r.total_nucleo)) return null;
  const {
    parcial: _parcial,
    saiu: _saiu,
    total_nucleo: _total,
    candidatos: _linhas,
    ...resto
  } = r;
  return {
    ...anterior,
    ...resto,
    vagas: r.vagas ?? anterior.vagas,
    candidatos,
  };
}
