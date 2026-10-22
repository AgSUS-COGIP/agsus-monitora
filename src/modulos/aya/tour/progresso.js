/*
  O que fica guardado no navegador sobre as trilhas da Aya: o passo em que a
  pessoa parou em cada trilha, se já concluiu, se a oferta de "Primeiros
  passos" da primeira entrada já foi feita e em quais telas o convite para
  o tour ("Quer que eu mostre esta tela?") já apareceu. Só localStorage, sempre com
  try/catch: sem armazenamento (janela privada, bloqueio), as trilhas
  funcionam, só não lembram. As regras (normalizar, rótulo, onde retomar)
  são de src/lib/aya-tours.js.
*/

import {
  comPassoDaTrilha,
  comTrilhaConcluida,
  convitesFeitos,
  progressoDasTrilhas,
} from "../../../lib/aya-tours.js";

export const CHAVE_PROGRESSO_DAS_TRILHAS = "agsus_aya_trilhas_v1";
export const CHAVE_OFERTA_DE_PRIMEIROS_PASSOS =
  "agsus_aya_primeiros_passos_oferecidos_v1";
export const CHAVE_CONVITES_DE_TOUR = "agsus_aya_convites_de_tour_v1";

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

/* Convite da primeira visita a cada tela: as telas (chaves de tour) já convidadas. */
export function lerConvitesDeTour(janela = globalThis.window) {
  try {
    return convitesFeitos(
      JSON.parse(ler(janela, CHAVE_CONVITES_DE_TOUR) || "[]"),
    );
  } catch {
    return [];
  }
}

export function marcarConviteDeTour(janela, chave) {
  const feitos = lerConvitesDeTour(janela);
  if (!feitos.includes(chave)) feitos.push(chave);
  gravar(janela, CHAVE_CONVITES_DE_TOUR, JSON.stringify(feitos));
  return feitos;
}
