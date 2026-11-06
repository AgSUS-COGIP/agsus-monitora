/* Tours da Aya: qual tour e quais trilhas valem para a tela e o perfil (API pública em ../aya-tours.ts). */

import {
  paginasPermitidas,
  secaoDeConfiguracaoPermitida,
} from "../access-roles.ts";
import type { PaginasPermitidas } from "../tipos-dos-acessos.ts";
import type {
  AberturaDoTour,
  PassoDoTour,
  PerfilDoTour,
  TourDaPagina,
  TrilhaDaAya,
} from "./tipos.ts";
import { TOURS } from "./tours.ts";
import { TRILHAS } from "./trilhas.ts";

/* ---------- Regras puras ---------- */

/* As abas que têm tour próprio, pelo valor que a tela marca. */
const ABAS_COM_TOUR: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    "conduzir-entrevistas": ["preparar"],
    classificacao: ["agenda", "regra"],
    approved: ["convocacao"],
    "avaliacao-documental": ["regra", "fila"],
  });

function normalizarAba(aba: unknown): string | undefined {
  return String(aba || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)[0];
}

/** A chave do tour para o que está aberto (`view`, aba, seção de Configurações). */
export function chaveDoTour({
  view = "",
  secao = "",
  aba = "",
}: AberturaDoTour = {}): string {
  const base = String(view || "");
  if (base === "config") return secao ? `config:${secao}` : "config";
  const escolhida = normalizarAba(aba);
  if ((ABAS_COM_TOUR[base] || []).includes(escolhida!))
    return `${base}:${escolhida}`;
  return base;
}

const passoPermitido = (p: PassoDoTour, perfil: unknown): boolean =>
  !p.exige || !perfil || p.exige(perfil);

/**
 * O tour da tela aberta (e da aba), recortado pela área e pelo perfil: os
 * passos de botão que a pessoa não vê saem. `null` se a tela não tem tour.
 */
export function tourDaPagina({
  view = "",
  area = "",
  secao = "",
  aba = "",
  perfil = null,
}: AberturaDoTour & {
  area?: string;
  perfil?: unknown;
} = {}): TourDaPagina | null {
  const chave = chaveDoTour({ view, secao, aba });
  const tour = TOURS[chave];
  if (!tour) return null;
  const passos = tour.passos.filter(
    (p) =>
      (!p.areas || p.areas.includes(String(area || ""))) &&
      passoPermitido(p, perfil),
  );
  return passos.length ? { ...tour, chave, passos } : null;
}

/** As telas e abas que têm tour. */
export const PAGINAS_COM_TOUR: readonly string[] = Object.freeze(
  Object.keys(TOURS),
);

const permitida = (perfil: unknown, pagina: unknown): boolean => {
  const [view, secao] = String(pagina || "").split(":");
  if (view === "config" && secao)
    return secaoDeConfiguracaoPermitida(perfil, secao);
  return paginasPermitidas(perfil)[view as keyof PaginasPermitidas] === true;
};

/** Os passos da trilha que este perfil faz: só os de páginas que ele abre e cuja regra ele cumpre. */
export function passosDaTrilha(
  trilha: TrilhaDaAya,
  perfil: unknown,
): PassoDoTour[] {
  return trilha.passos.filter(
    (p) =>
      (!p.pagina || permitida(perfil, p.pagina)) &&
      (!p.exige || p.exige(perfil)),
  );
}

/** As trilhas que o perfil pode fazer (a regra da trilha e ao menos um passo de tela). */
export function trilhasDoPerfil(perfil: unknown): TrilhaDaAya[] {
  if (!perfil || (perfil as NonNullable<PerfilDoTour>).ativo === false)
    return [];
  return TRILHAS.filter(
    (trilha) =>
      trilha.exige(perfil) &&
      passosDaTrilha(trilha, perfil).some((p) => p.pagina),
  ).map((trilha) => ({ ...trilha, passos: passosDaTrilha(trilha, perfil) }));
}
