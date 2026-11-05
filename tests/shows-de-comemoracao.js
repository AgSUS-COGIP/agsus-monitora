import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect } from "vitest";
import {
  Comemoracoes,
  comemorar as comemorarDoModulo,
} from "../src/modulos/comemoracao/comemoracoes.tsx";
import { filaDeComemoracoes } from "../src/app/fila-de-comemoracoes.ts";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/*
  As comemorações são React (src/modulos/comemoracao/comemoracoes.tsx), filhas
  da casca. Nos testes, `<Comemoracoes />` fica montado numa raiz própria (como
  a casca faz), e cada comemoração desenha por portal no `doc` que ela recebe
  (um documento falso, com canvas falso, ou o da página).

  Chame no topo do arquivo, antes dos outros afterEach (os hooks "after"
  rodam do último para o primeiro). Use o `comemorar` devolvido (roda em
  `act`) e passe a `acompanhar` cada documento falso: ao fim de cada teste,
  a fila esvazia, a raiz desmonta e nenhum aviso, canvas, véu ou arara sobra.
*/
const SOBRAS =
  ".comemoracao, .comemoracao__fogos, .comemoracao__veu, .comemoracao__aya";

export function encerrarShowsAoFimDeCadaTeste() {
  const documentos = [];
  let raiz = null;
  let lugar = null;
  beforeEach(() => {
    lugar = document.createElement("div");
    document.body.append(lugar);
    raiz = createRoot(lugar);
    act(() => raiz.render(createElement(Comemoracoes)));
  });
  afterEach(() => {
    act(() => filaDeComemoracoes.esvaziar());
    act(() => raiz?.unmount());
    lugar?.remove();
    raiz = null;
    for (const doc of documentos.splice(0))
      expect(doc.querySelectorAll(SOBRAS)).toHaveLength(0);
  });
  return {
    /** `comemorar` de verdade, dentro de `act` (o React desenha na hora). */
    comemorar: (...args) => {
      let aberta = null;
      act(() => {
        aberta = comemorarDoModulo(...args);
      });
      return aberta;
    },
    /** Um clique dentro de `act`. */
    clicar: (elemento) => act(() => elemento.click()),
    acompanhar: (doc) => {
      documentos.push(doc);
      return doc;
    },
  };
}

/** O requestAnimationFrame falso: cada quadro roda dentro de `act`. */
export function filaDeQuadros() {
  const quadros = [];
  return {
    quadros,
    requestAnimationFrame: (fn) =>
      quadros.push((agora) => act(() => fn(agora))),
  };
}

/**
 * `<Comemoracoes />` montado na página (como a casca), para quem comemora
 * pelo app (src/app/comemoracao-sob-demanda.ts). Chame dentro do `describe`,
 * DEPOIS do `afterEach` que limpa o body: este roda antes dele e tira as
 * comemorações pelo React, sem deixar nó órfão.
 */
export function comemoracoesNaPagina() {
  let raiz = null;
  let lugar = null;
  beforeEach(() => {
    lugar = document.createElement("div");
    document.body.append(lugar);
    raiz = createRoot(lugar);
    act(() => raiz.render(createElement(Comemoracoes)));
  });
  afterEach(() => {
    act(() => filaDeComemoracoes.esvaziar());
    act(() => raiz?.unmount());
    lugar?.remove();
    raiz = null;
  });
}
