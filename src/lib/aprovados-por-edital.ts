/*
  Quantos candidatos aprovados cada edital tem, pelas listas vigentes
  (`listar_listas_aprovados`: uma linha por edital, com `total_candidatos`).
  Editais usa para marcar o botão "Lista de aprovados" do edital sem nenhum
  aprovado.
*/

/** A linha de `listar_listas_aprovados` no que importa aqui. */
export interface ListaVigenteResumida {
  readonly edital_id?: unknown;
  readonly total_candidatos?: unknown;
}

/** edital_id → total de candidatos da lista vigente. */
export function aprovadosPorEdital(
  listas: unknown,
): ReadonlyMap<string, number> {
  const mapa = new Map<string, number>();
  if (!Array.isArray(listas)) return mapa;
  for (const lista of listas as ListaVigenteResumida[]) {
    const id = String(lista?.edital_id ?? "").trim();
    if (!id) continue;
    const total = Number(lista.total_candidatos);
    mapa.set(id, (mapa.get(id) ?? 0) + (Number.isFinite(total) ? total : 0));
  }
  return mapa;
}

/** O status sem acento, sem espaço nas pontas e em minúsculas. */
function normalizar(status: unknown): string {
  return String(status ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** O aviso do botão "Lista de aprovados" de um edital. */
export interface AvisoDaListaDoEdital {
  /** "aviso" (amarelo) ou "perigo" (vermelho). */
  readonly tom: "aviso" | "perigo";
  /** A legenda do botão (title) e o texto do toast no clique. */
  readonly texto: string;
}

export const TEXTO_SEM_APROVADOS = "Nenhum candidato foi aprovado neste edital";

/**
 * O aviso do botão "Lista de aprovados" do edital, ou `null` (botão normal):
 *  - Cancelado ou Suspenso → vermelho, "Edital cancelado" / "Edital suspenso";
 *  - Concluído sem lista vigente (ou com ela vazia) → amarelo, "Nenhum
 *    candidato foi aprovado neste edital". Sem as listas carregadas (`null`),
 *    não se sabe: sem aviso.
 * Edital em andamento ainda pode ter aprovados: sem aviso.
 */
export function avisoDaListaDoEdital(
  mapa: ReadonlyMap<string, number> | null | undefined,
  editalId: unknown,
  status: unknown,
): AvisoDaListaDoEdital | null {
  const s = normalizar(status);
  if (s.startsWith("cancel"))
    return { tom: "perigo", texto: "Edital cancelado" };
  if (s.startsWith("suspen"))
    return { tom: "perigo", texto: "Edital suspenso" };
  if (!s.startsWith("conclu") || !mapa) return null;
  const total = mapa.get(String(editalId ?? "").trim()) ?? 0;
  return total > 0 ? null : { tom: "aviso", texto: TEXTO_SEM_APROVADOS };
}
