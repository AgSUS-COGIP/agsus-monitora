/*
  O que fica guardado no navegador sobre as trilhas da Aya: o passo em que a
  pessoa parou em cada trilha, se já concluiu, e se a oferta de "Primeiros
  passos" da primeira entrada já foi feita. Só localStorage, sempre com
  try/catch: sem armazenamento (janela privada, bloqueio), as trilhas
  funcionam, só não lembram. As regras (normalizar, rótulo, onde retomar)
  são de src/lib/aya-tours.js.
*/

import {
  comPassoDaTrilha,
  comTrilhaConcluida,
  progressoDasTrilhas,
} from "../../../lib/aya-tours.js";

export const CHAVE_PROGRESSO_DAS_TRILHAS = "agsus_aya_trilhas_v1";
export const CHAVE_OFERTA_DE_PRIMEIROS_PASSOS =
  "agsus_aya_primeiros_passos_oferecidos_v1";

function ler(janela, chave) {
  try {
    return janela.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(janela, chave, valor) {
  try {
    janela.localStorage.setItem(chave, valor);
  } catch {
    // sem armazenamento: só não lembra
  }
}

export function lerProgressoDasTrilhas(janela = globalThis.window) {
  try {
    return progressoDasTrilhas(
      JSON.parse(ler(janela, CHAVE_PROGRESSO_DAS_TRILHAS) || "{}"),
    );
  } catch {
    return {};
  }
}

function salvar(janela, progresso) {
  gravar(janela, CHAVE_PROGRESSO_DAS_TRILHAS, JSON.stringify(progresso));
  return progresso;
}

/** Guarda o passo atual da trilha (índice nos passos que o perfil faz). */
export function salvarPassoDaTrilha(janela, id, passo) {
  return salvar(
    janela,
    comPassoDaTrilha(lerProgressoDasTrilhas(janela), id, passo),
  );
}

export function concluirTrilha(janela, id) {
  return salvar(janela, comTrilhaConcluida(lerProgressoDasTrilhas(janela), id));
}

export const ofertaDePrimeirosPassosFeita = (janela = globalThis.window) =>
  ler(janela, CHAVE_OFERTA_DE_PRIMEIROS_PASSOS) === "1";

export function marcarOfertaDePrimeirosPassos(janela = globalThis.window) {
  gravar(janela, CHAVE_OFERTA_DE_PRIMEIROS_PASSOS, "1");
}
