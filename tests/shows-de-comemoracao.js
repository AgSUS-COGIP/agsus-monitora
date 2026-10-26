import { afterEach, expect } from "vitest";
import { soltarFogos as soltarFogosDoModulo } from "../src/modules/comemoracao.ts";

/*
  Nenhum show de comemoração sobrevive ao teste.

  A Aya que voa nos fogos é uma raiz React (montarMascoteAvulsa, em
  src/modulos/aya/mascote/mascote.tsx): o render inicial fica na fila do
  scheduler do React (setImmediate) e o desmontar sai num setTimeout(0)
  (tirarAya, em src/modules/comemoracao.ts). Teste que olha só o começo do
  show e não o encerra deixava essas tarefas na fila; quando o Vitest
  desmontava o jsdom antes de a fila andar, cada uma estourava
  "ReferenceError: window is not defined" fora de qualquer teste (26
  "unhandled errors" no CI do PR #495, conforme a ordem das tarefas na
  máquina). No navegador o show sempre acaba sozinho; o vazamento era só dos
  testes.

  Chame no topo do arquivo, antes dos outros afterEach (os hooks "after"
  rodam do último para o primeiro: assim este roda depois de um
  vi.useRealTimers do arquivo). Use o soltarFogos devolvido e
  passe a `acompanhar` cada documento falso: ao fim de cada teste, todo show
  é parado, todo aviso é fechado no × (que encerra o show do comemorar) e o
  desmontar da Aya roda ainda com o jsdom de pé.
*/
const SOBRAS = ".comemoracao__fogos, .comemoracao__veu, .comemoracao__aya";

export function encerrarShowsAoFimDeCadaTeste() {
  const shows = [];
  const documentos = [];
  const guardar = (show) => {
    if (show) shows.push(show);
    return show;
  };
  afterEach(async () => {
    for (const show of shows.splice(0)) show.parar();
    const docs = documentos.splice(0);
    for (const doc of docs)
      for (const fechar of doc.querySelectorAll(".comemoracao__fechar"))
        fechar.click();
    // tirarAya desmonta a arara num setTimeout(0): deixa rodar agora.
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (const doc of docs)
      expect(doc.querySelectorAll(SOBRAS)).toHaveLength(0);
  });
  return {
    soltarFogos: (...args) => guardar(soltarFogosDoModulo(...args)),
    acompanhar: (doc) => {
      documentos.push(doc);
      return doc;
    },
  };
}
