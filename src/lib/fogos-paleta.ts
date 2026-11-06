/* Fogos: a paleta dos estouros (API pública em src/lib/fogos.ts). */

import type { PaletaDosFogos } from "./fogos-tipos.ts";

// ── Paleta ──────────────────────────────────────────────────────────────────

/* Tokens da marca usados nos estouros (o tema decide o valor). */
export const TOKENS_DA_PALETA = Object.freeze([
  "--brand-primary",
  "--brand-accent",
  "--series-1",
  "--series-2",
  "--series-3",
  "--series-4",
  "--series-5",
]);
const DOURADOS = ["#ffd23f", "#ffb627"] as const;
const BRANCO = "#fff6dc";
/* Cores vivas que brilham sobre o véu; no tema claro, somam-se às da marca. */
const VIVAS = ["#59f2c8", "#4fdcff", "#ff7a59", "#c38cff"];

/*
  A cor de cada área (src/styles/barra-lateral.css, [data-cor-da-area]): o
  token que o tema dá a ela. Os fogos puxam essa cor para a forma, o
  letreiro e parte dos estouros.
*/
export const TOKENS_DAS_AREAS: Readonly<Record<string, string>> = Object.freeze(
  {
    "saude-indigena": "--state-success",
    sede: "--state-info",
    projetos: "--state-warning",
  },
);

/**
 * As cores do show: os tokens do tema que tiverem valor, mais dourado e
 * branco. Com o véu escuro por baixo, a luz se soma ("lighter") nos dois
 * temas; no claro, que tem tokens escuros, entram também cores vivas.
 * `lerToken` devolve o valor do token (ou vazio). Sem token, a reserva.
 */
export function paletaDosFogos(
  lerToken: (nome: string) => unknown = () => "",
  {
    escuro = true,
    area = null,
  }: { escuro?: boolean; area?: string | null } = {},
): PaletaDosFogos {
  const ler = (nome: string): string => {
    try {
      return String(lerToken(nome) || "").trim();
    } catch {
      return "";
    }
  };
  const ehCor = (cor: string) => /^(#|rgb|hsl)/i.test(cor);
  const daMarca = TOKENS_DA_PALETA.map(ler).filter(ehCor);
  const tokenDaArea = area ? TOKENS_DAS_AREAS[area] : undefined;
  const lida = tokenDaArea ? ler(tokenDaArea) : "";
  const daArea = ehCor(lida) ? lida : null;
  const base = daMarca.length ? daMarca : VIVAS;
  return {
    cores: [
      ...new Set([
        ...(daArea ? [daArea] : []),
        ...base,
        ...(escuro ? [] : VIVAS),
        ...DOURADOS,
        BRANCO,
      ]),
    ],
    dourado: DOURADOS[0],
    ambar: DOURADOS[1],
    centelha: BRANCO,
    fumaca: escuro ? "#9aa6bd" : "#c9d2e3",
    composicao: "lighter",
    area: daArea,
  };
}
