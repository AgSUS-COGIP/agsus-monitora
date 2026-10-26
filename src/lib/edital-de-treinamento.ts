/*
  O edital de treinamento (migration 20261007230000): dados fictícios para
  testar Entrevistas, Avaliação documental e Classificação sem tocar em dado
  real. Fica FORA da Visão geral, dos indicadores, dos painéis e dos robôs no
  modo padrão; APARECE nas telas operacionais com o selo "Treinamento".

  Um lugar só para reconhecer o edital (o banco faz o mesmo com
  private."FC_EH_TREINAMENTO"): a linha do monitoramento traz
  "ST_TREINAMENTO" = 'S'; as RPCs das telas trazem `treinamento: true`.
*/

export const ROTULO_DO_TREINAMENTO = "Treinamento";
export const MARCA_SEM_VALOR_OFICIAL = "TREINAMENTO — SEM VALOR OFICIAL";

/** Os campos que marcam o edital de treinamento (linha ou item de RPC). */
export interface MarcaDeTreinamento {
  treinamento?: unknown;
  ST_TREINAMENTO?: unknown;
  st_treinamento?: unknown;
}

/** O edital (linha do monitoramento ou item de RPC) é de treinamento? */
export function ehEditalDeTreinamento(edital: unknown): boolean {
  if (!edital || typeof edital !== "object") return false;
  if ((edital as MarcaDeTreinamento).treinamento === true) return true;
  const marca =
    (edital as MarcaDeTreinamento).ST_TREINAMENTO ??
    (edital as MarcaDeTreinamento).st_treinamento;
  return String(marca ?? "").toUpperCase() === "S";
}

/** As linhas sem os editais de treinamento (indicadores, mapas, painéis). */
export function semTreinamento<T>(
  linhas: readonly T[] | null | undefined,
): T[] {
  const lista = Array.isArray(linhas) ? linhas : [];
  return lista.some(ehEditalDeTreinamento)
    ? lista.filter((linha) => !ehEditalDeTreinamento(linha))
    : (lista as T[]);
}

/** O sufixo do edital no `<option>` do seletor (o `<option>` não leva selo). */
export function sufixoDeTreinamento(edital: unknown): string {
  return ehEditalDeTreinamento(edital) ? ` · ${ROTULO_DO_TREINAMENTO}` : "";
}

/** O edital escolhido na lista (para o selo no topo da tela). */
export function editalEscolhido<T extends { id?: unknown }>(
  editais: readonly T[] | null | undefined,
  id: unknown,
): T | null {
  if (!id) return null;
  return (
    (Array.isArray(editais) ? editais : []).find(
      (e) => String(e?.id) === String(id),
    ) || null
  );
}
