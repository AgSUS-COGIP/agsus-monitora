import { useSyncExternalStore } from "react";
import { EVENTO_TEMA_ALTERADO } from "../lib/eventos-da-barra-lateral.js";

/*
  O tema do app (claro/escuro), para os componentes React. Quem manda é a
  moldura (`alternarTema` em src/app/moldura.js, `window.toggleDarkMode`,
  acionado pelo seletor da barra lateral): ele marca `html[data-theme="dark"]` e avisa
  `agsus:tema-alterado`. Outra aba que trocou o tema avisa por `storage`.
  Sem `MutationObserver`.
*/

export const temaEscuro = () =>
  document.documentElement.getAttribute("data-theme") === "dark";

function assinarTema(avisar) {
  document.addEventListener(EVENTO_TEMA_ALTERADO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    document.removeEventListener(EVENTO_TEMA_ALTERADO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

/** Verdadeiro com o tema escuro do app ligado; muda junto com ele. */
export function usarTemaEscuro() {
  return useSyncExternalStore(assinarTema, temaEscuro);
}
