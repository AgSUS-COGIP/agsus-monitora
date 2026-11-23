/*
  Anterior e Próximo nas fichas abertas de uma lista, sem DOM: quem está antes
  e depois do item aberto na lista como ela está na tela (com o filtro e a
  ordem atuais). O componente é `usarNavegacaoDaLista` + a gaveta
  (src/ui/navegacao-da-ficha.tsx).

  O item aberto pode sair da lista enquanto a ficha está aberta (decidir um
  pendente com o filtro "Pendentes"): os vizinhos vêm então da lista de
  quando ele ainda estava nela — o anterior e o próximo que continuam na
  lista —, para "Próximo" levar ao seguinte, e a posição fica vazia.
*/

export interface VizinhosNaLista<C> {
  /** 1 = o primeiro; `null` quando o item aberto saiu da lista. */
  posicao: number | null;
  total: number;
  anterior: C | null;
  proximo: C | null;
}

/**
 * Os vizinhos de `atual` em `chaves`. `antes` é a lista de quando `atual`
 * ainda estava nela (para quando ele sai); sem ele lá também, `null`.
 */
export function vizinhosNaLista<C>(
  chaves: readonly C[],
  atual: C,
  antes?: readonly C[] | null,
): VizinhosNaLista<C> | null {
  const total = chaves.length;
  const indice = chaves.indexOf(atual);
  if (indice >= 0)
    return {
      posicao: indice + 1,
      total,
      anterior: indice > 0 ? chaves[indice - 1]! : null,
      proximo: indice < total - 1 ? chaves[indice + 1]! : null,
    };
  const onde = antes ? antes.indexOf(atual) : -1;
  if (!antes || onde < 0) return null;
  const naLista = new Set(chaves);
  const anterior =
    antes
      .slice(0, onde)
      .reverse()
      .find((chave) => naLista.has(chave)) ?? null;
  const proximo =
    antes.slice(onde + 1).find((chave) => naLista.has(chave)) ?? null;
  return { posicao: null, total, anterior, proximo };
}

/** "3 de 41"; fora da lista, "41 na lista". */
export function textoDaPosicao(posicao: number | null, total: number) {
  const numero = (valor: number) => valor.toLocaleString("pt-BR");
  return posicao === null
    ? `${numero(total)} na lista`
    : `${numero(posicao)} de ${numero(total)}`;
}

/* Onde as setas já têm outro uso: escrever, escolher, percorrer abas e menus. */
const PAPEIS_COM_SETAS = [
  "tablist",
  "tab",
  "radiogroup",
  "radio",
  "menu",
  "menubar",
  "menuitem",
  "listbox",
  "option",
  "slider",
  "spinbutton",
  "grid",
  "tree",
  "combobox",
  "textbox",
];
const COM_SETAS = [
  "input",
  "textarea",
  "select",
  "[contenteditable]:not([contenteditable='false'])",
  ...PAPEIS_COM_SETAS.map((papel) => `[role='${papel}']`),
].join(",");

export interface TeclaDaFicha {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  defaultPrevented?: boolean;
  target?: EventTarget | null;
}

/**
 * ← vai ao anterior e → ao próximo, fora de campos de texto e de controles
 * que usam as setas (abas, opções, menus, a tabela do gráfico) e sem tecla
 * modificadora (Alt+← é o voltar do navegador).
 */
export function passoDaTecla(
  evento: TeclaDaFicha,
): "anterior" | "proximo" | null {
  if (evento.key !== "ArrowLeft" && evento.key !== "ArrowRight") return null;
  if (
    evento.defaultPrevented ||
    evento.altKey ||
    evento.ctrlKey ||
    evento.metaKey ||
    evento.shiftKey
  )
    return null;
  const alvo = evento.target as Element | null;
  if (alvo && typeof alvo.closest === "function" && alvo.closest(COM_SETAS))
    return null;
  return evento.key === "ArrowLeft" ? "anterior" : "proximo";
}
