/*
  Procurar no DOM do teste com tipo: `achar` devolve o elemento que o teste
  sabe que existe (ou quebra dizendo o seletor), `acharTodos` a lista.
  O tipo do elemento vem do seletor (`"input"` → HTMLInputElement) ou é
  dado pelo teste (`achar<HTMLSelectElement>("#edital")`). Sem `onde`,
  procura no documento; com `onde` nulo (a linha que não apareceu), quebra
  como quebrava `null.querySelector(...)`.
*/
type Onde = [] | [ParentNode | null | undefined];

function raizDe(seletor: string, onde: Onde): ParentNode {
  if (!onde.length) return document;
  const [raiz] = onde;
  if (!raiz) throw new TypeError(`Sem onde procurar: ${seletor}`);
  return raiz;
}

export function achar<K extends keyof HTMLElementTagNameMap>(
  seletor: K,
  ...onde: Onde
): HTMLElementTagNameMap[K];
export function achar<E extends Element = HTMLElement>(
  seletor: string,
  ...onde: Onde
): E;
export function achar<E extends Element = HTMLElement>(
  seletor: string,
  ...onde: Onde
): E {
  const elemento = raizDe(seletor, onde).querySelector<E>(seletor);
  if (!elemento) throw new TypeError(`Elemento não encontrado: ${seletor}`);
  return elemento;
}

export function acharTodos<K extends keyof HTMLElementTagNameMap>(
  seletor: K,
  ...onde: Onde
): HTMLElementTagNameMap[K][];
export function acharTodos<E extends Element = HTMLElement>(
  seletor: string,
  ...onde: Onde
): E[];
export function acharTodos<E extends Element = HTMLElement>(
  seletor: string,
  ...onde: Onde
): E[] {
  return [...raizDe(seletor, onde).querySelectorAll<E>(seletor)];
}
