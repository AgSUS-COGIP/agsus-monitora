import { useSyncExternalStore } from "react";
import {
  EVENTO_BARRA_ALTERNADA,
  EVENTO_TEMA_ALTERADO,
} from "../../lib/eventos-da-barra-lateral.js";

/*
  O que a barra lê do ambiente que o legado controla: a classe de `body` que
  recolhe a barra, a largura em que ela vira gaveta e o tema de `html`. Quem
  muda essas coisas avisa por evento (`eventos-da-barra-lateral.js`); não há
  `MutationObserver`.
*/

/* O corte da gaveta: o mesmo de `SIDEBAR_MOBILE_BREAKPOINT` e do CSS (900px). */
export const LARGURA_DE_GAVETA = 900;

function assinarEventos(doDocumento, daJanela) {
  return (avisar) => {
    for (const nome of doDocumento) document.addEventListener(nome, avisar);
    for (const nome of daJanela) window.addEventListener(nome, avisar);
    return () => {
      for (const nome of doDocumento) {
        document.removeEventListener(nome, avisar);
      }
      for (const nome of daJanela) window.removeEventListener(nome, avisar);
    };
  };
}

const assinarBarra = assinarEventos([EVENTO_BARRA_ALTERNADA], ["resize"]);
const assinarTema = assinarEventos([EVENTO_TEMA_ALTERADO], ["storage"]);

export const barraRecolhida = () =>
  document.body.classList.contains("sidebar-collapsed");
export const emGaveta = () => window.innerWidth <= LARGURA_DE_GAVETA;
export const temaEscuro = () =>
  document.documentElement.getAttribute("data-theme") === "dark";

export function usarBarraRecolhida() {
  return useSyncExternalStore(assinarBarra, barraRecolhida);
}

export function usarGaveta() {
  return useSyncExternalStore(assinarBarra, emGaveta);
}

export function usarTemaEscuro() {
  return useSyncExternalStore(assinarTema, temaEscuro);
}
