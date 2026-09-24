/*
  Os sinais entre o código legado e a barra lateral, que é React
  (`src/componentes/barra-lateral/`).

  O legado não mexe no DOM da barra. Ele empurra dados para o estado dela
  (`src/componentes/barra-lateral/estado.js`) e avisa, por estes eventos em
  `document`, o que a barra não tem como perceber sozinha — nenhum
  `MutationObserver` observa classe de `body` ou atributo de `html`.
*/

/* A barra avisa: o menu foi montado ou a página ativa trocou. O menu inferior do celular espelha. */
export const EVENTO_MENU_ATUALIZADO = "agsus:menu-lateral-atualizado";

/* O legado avisa: a barra foi recolhida, expandida, ou a gaveta abriu ou fechou. */
export const EVENTO_BARRA_ALTERNADA = "agsus:barra-lateral-alternada";

/* O legado avisa: o tema da página trocou (`html[data-theme]`). */
export const EVENTO_TEMA_ALTERADO = "agsus:tema-alterado";

export function avisar(nome, detalhe, documento = globalThis.document) {
  const janela = documento?.defaultView || globalThis;
  documento?.dispatchEvent(new janela.CustomEvent(nome, { detail: detalhe }));
}
