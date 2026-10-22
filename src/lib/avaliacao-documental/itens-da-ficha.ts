/*
  Tirar e devolver um título, curso ou vínculo da ficha. O "×" do item tira
  com um clique (sem confirmação); a tela guarda o que saiu e oferece
  "Desfazer", que devolve o item na mesma posição. Foi assim que a ficha
  TREINO-P02 perdeu o vínculo (histórico: a versão 34 gravou vinculos: []
  vindo da tela, sem nenhuma outra mudança).
*/

export type ItemTirado<T> = { indice: number; item: T };

/** A lista sem o item `indice` e o que saiu (null se o índice não existe). */
export function tirarItem<T>(
  itens: readonly T[],
  indice: number,
): { itens: T[]; tirado: ItemTirado<T> | null } {
  if (indice < 0 || indice >= itens.length)
    return { itens: [...itens], tirado: null };
  return {
    itens: itens.filter((_, j) => j !== indice),
    tirado: { indice, item: itens[indice] as T },
  };
}

/** Devolve o item tirado na posição de onde saiu (ou no fim, se a lista encolheu). */
export function devolverItem<T>(
  itens: readonly T[],
  tirado: ItemTirado<T>,
): T[] {
  const lista = [...itens];
  lista.splice(Math.min(tirado.indice, lista.length), 0, tirado.item);
  return lista;
}
