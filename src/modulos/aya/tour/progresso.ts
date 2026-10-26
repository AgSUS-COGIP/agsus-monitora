/*
  O que fica guardado no navegador sobre as trilhas da Aya: o passo em que a
  pessoa parou em cada trilha, se já concluiu, se a oferta de "Primeiros
  passos" da primeira entrada já foi feita e em quais telas o convite para
  o tour ("Quer que eu mostre esta tela?") já apareceu. Só localStorage, sempre com
  try/catch: sem armazenamento (janela privada, bloqueio), as trilhas
  funcionam, só não lembram. As regras (normalizar, rótulo, onde retomar)
  são de src/lib/aya-tours.ts.
*/

import {
  comPassoDaTrilha,
  comTrilhaConcluida,
  convitesFeitos,
  progressoDasTrilhas,
} from "../../../lib/aya-tours.ts";
import type { ProgressoDasTrilhas } from "../../../lib/aya-tours.ts";

/** A janela (ou um substituto nos testes) com o localStorage. */
export type JanelaComArmazenamento = { readonly localStorage: Storage };

export const CHAVE_PROGRESSO_DAS_TRILHAS = "agsus_aya_trilhas_v1";
export const CHAVE_OFERTA_DE_PRIMEIROS_PASSOS =
  "agsus_aya_primeiros_passos_oferecidos_v1";
export const CHAVE_CONVITES_DE_TOUR = "agsus_aya_convites_de_tour_v1";

function ler(janela: JanelaComArmazenamento, chave: string): string | null {
  try {
    return janela.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(
  janela: JanelaComArmazenamento,
  chave: string,
  valor: string,
): void {
  try {
    janela.localStorage.setItem(chave, valor);
  } catch {
    // sem armazenamento: só não lembra
  }
}

export function lerProgressoDasTrilhas(
  janela: JanelaComArmazenamento = globalThis.window,
): ProgressoDasTrilhas {
  try {
    return progressoDasTrilhas(
      JSON.parse(ler(janela, CHAVE_PROGRESSO_DAS_TRILHAS) || "{}"),
    );
  } catch {
    return {};
  }
}

function salvar(
  janela: JanelaComArmazenamento,
  progresso: ProgressoDasTrilhas,
): ProgressoDasTrilhas {
  gravar(janela, CHAVE_PROGRESSO_DAS_TRILHAS, JSON.stringify(progresso));
  return progresso;
}

/** Guarda o passo atual da trilha (índice nos passos que o perfil faz). */
export function salvarPassoDaTrilha(
  janela: JanelaComArmazenamento,
  id: string,
  passo: number,
): ProgressoDasTrilhas {
  return salvar(
    janela,
    comPassoDaTrilha(lerProgressoDasTrilhas(janela), id, passo),
  );
}

export function concluirTrilha(
  janela: JanelaComArmazenamento,
  id: string,
): ProgressoDasTrilhas {
  return salvar(janela, comTrilhaConcluida(lerProgressoDasTrilhas(janela), id));
}

export const ofertaDePrimeirosPassosFeita = (
  janela: JanelaComArmazenamento = globalThis.window,
): boolean => ler(janela, CHAVE_OFERTA_DE_PRIMEIROS_PASSOS) === "1";

export function marcarOfertaDePrimeirosPassos(
  janela: JanelaComArmazenamento = globalThis.window,
): void {
  gravar(janela, CHAVE_OFERTA_DE_PRIMEIROS_PASSOS, "1");
}

/* Convite da primeira visita a cada tela: as telas (chaves de tour) já convidadas. */
export function lerConvitesDeTour(
  janela: JanelaComArmazenamento = globalThis.window,
): string[] {
  try {
    return convitesFeitos(
      JSON.parse(ler(janela, CHAVE_CONVITES_DE_TOUR) || "[]"),
    );
  } catch {
    return [];
  }
}

export function marcarConviteDeTour(
  janela: JanelaComArmazenamento,
  chave: string,
): string[] {
  const feitos = lerConvitesDeTour(janela);
  if (!feitos.includes(chave)) feitos.push(chave);
  gravar(janela, CHAVE_CONVITES_DE_TOUR, JSON.stringify(feitos));
  return feitos;
}
