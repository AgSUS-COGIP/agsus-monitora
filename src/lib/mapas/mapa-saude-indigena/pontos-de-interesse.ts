/*
  PONTOS DE INTERESSE DO MAPA NACIONAL

  Os chips acima do mapa do Brasil acendem os DSEIs que atendem a um critério
  já calculado em outro lugar — nada aqui conta de novo:

  - "Com vagas ociosas": `ociosas` de "Territórios por vagas" (`contarPorDsei`);
  - "Menos de 40% preenchidas": o % da barra (`percentualPreenchido`), só de
    DSEI com vaga — sem vaga não há o que preencher;
  - "Acesso só aéreo ou fluvial": DSEI com ao menos uma unidade cujos meios de
    acesso (do SIGEPSI, `unidadesComAcesso`) são só aéreo e/ou fluvial. Sem o
    acesso do SIGEPSI, o chip não aparece (nunca vira zero).

  Um chip por vez; o mesmo chip de novo apaga o destaque. As chaves dos DSEIs
  são as das bolhas (`chaveDoDsei`).
*/
import type { TerritorioDoMapa } from "./tipos.ts";
import type { UnidadeComAcesso } from "./territorio-na-tela.ts";
import { chaveDoDsei } from "./chaves.ts";

export type ChaveDoDestaque =
  "ociosas" | "preenchimento-baixo" | "acesso-aereo-fluvial";

export interface DestaqueDoMapa {
  chave: ChaveDoDestaque;
  rotulo: string;
  /** As chaves (`chaveDoDsei`) dos DSEIs que acendem. */
  dseis: ReadonlySet<string>;
}

/** Abaixo deste % de vagas preenchidas o DSEI acende em "Menos de 40% preenchidas". */
export const PREENCHIMENTO_BAIXO = 40;

const SO_AEREO_OU_FLUVIAL: ReadonlySet<string> = new Set(["Aéreo", "Fluvial"]);

/** A unidade só se alcança por avião ou barco (nenhum meio terrestre nem "Não informado"). */
export function soAereoOuFluvial(meios: readonly string[] | null): boolean {
  return (
    Array.isArray(meios) &&
    meios.length > 0 &&
    meios.every((m) => SO_AEREO_OU_FLUVIAL.has(m))
  );
}

export function destaquesDoMapa({
  territorios,
  unidadesPorDsei = null,
}: {
  territorios: readonly TerritorioDoMapa[];
  /** As unidades com acesso por DSEI (chave do mapa); `null` sem o acesso do SIGEPSI. */
  unidadesPorDsei?: ReadonlyMap<
    string,
    { unidades: readonly UnidadeComAcesso[] }
  > | null;
}): DestaqueDoMapa[] {
  const lista = Array.isArray(territorios) ? territorios : [];
  const chaves = (filtro: (t: TerritorioDoMapa) => boolean) =>
    new Set(lista.filter(filtro).map((t) => t.chave));
  const destaques: DestaqueDoMapa[] = [
    {
      chave: "ociosas",
      rotulo: "Com vagas ociosas",
      dseis: chaves((t) => t.ociosas > 0),
    },
    {
      chave: "preenchimento-baixo",
      rotulo: `Menos de ${PREENCHIMENTO_BAIXO}% preenchidas`,
      dseis: chaves((t) => t.vagas > 0 && t.preenchidas < PREENCHIMENTO_BAIXO),
    },
  ];
  const comAcesso =
    unidadesPorDsei &&
    [...unidadesPorDsei.values()].some(({ unidades }) =>
      unidades.some((u) => u.meios !== null),
    );
  if (unidadesPorDsei && comAcesso) {
    const remotos = new Set<string>();
    for (const [k, { unidades }] of unidadesPorDsei)
      if (unidades.some((u) => soAereoOuFluvial(u.meios)))
        remotos.add(chaveDoDsei(k));
    const noMapa = new Set(lista.map((t) => t.chave));
    destaques.push({
      chave: "acesso-aereo-fluvial",
      rotulo: "Acesso só aéreo ou fluvial",
      dseis: new Set([...remotos].filter((c) => noMapa.has(c))),
    });
  }
  return destaques;
}
