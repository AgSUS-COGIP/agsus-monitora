/*
  Os avisos de conferência de um edital, para a gaveta da Visão geral
  (revisão de 17/11/2026): da lista da área (listar_avisos_conferencia_se_mudou,
  já normalizada), só os do edital da linha, abertos e dispensados. Os
  resolvidos ficam na central de avisos (Configurações › Status das
  atualizações).
*/

type AvisoComEdital = { editalId?: string | null };
type ListaComAvisos<A extends AvisoComEdital> = {
  abertos: readonly A[];
  dispensados: readonly A[];
  resolvidos: readonly A[];
};

/** A lista só com os avisos do edital (sem os resolvidos), ou `null`. */
export function avisosDoEdital<
  A extends AvisoComEdital,
  L extends ListaComAvisos<A>,
>(lista: L | null | undefined, editalId: unknown): L | null {
  const id = String(editalId ?? "").trim();
  if (!lista || !id) return null;
  const doEdital = (aviso: A) => String(aviso?.editalId ?? "") === id;
  return {
    ...lista,
    abertos: lista.abertos.filter(doEdital),
    dispensados: lista.dispensados.filter(doEdital),
    resolvidos: [],
  };
}
