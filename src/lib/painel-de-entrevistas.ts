/*
  As contas do "Painel de entrevistas" (src/modulos/entrevistas/), sem React:
  o edital do recorte (o da agenda dos próximos dias), os candidatos
  empatados na nota da entrevista e a agenda. Lê as entrevistas já
  normalizadas por src/lib/entrevistas-do-painel.ts (payload de
  `get_entrevistas_da_area`, que deixa o edital de treinamento de fora).

  Empate: duas ou mais entrevistas do mesmo edital e da mesma vaga com a
  mesma nota (quem compareceu e tem nota). O desempate não é daqui: é o da
  regra de classificação do edital, feito na Classificação.
*/

export type EntrevistaDoPainel = {
  id: string;
  edital_id?: unknown;
  edital?: string;
  unidade?: string;
  vaga?: string;
  cargo?: string;
  candidato?: string;
  nota?: number | null;
  parecer?: string;
  compareceu?: string | null;
};

export type EditalDoRecorte = {
  edital: string;
  editalId: string | null;
};

export type GrupoEmpatado = {
  chave: string;
  edital: string;
  editalId: string | null;
  vaga: string;
  nota: number;
  ids: string[];
  candidatos: string[];
};

const texto = (valor: unknown) => String(valor ?? "").trim();
const comparar = (a: string, b: string) =>
  a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });

/* IDs preservados do JSON só viram destinos de navegação quando são texto. */
function idDoEdital(entrevistas: readonly EntrevistaDoPainel[]): string | null {
  const id = entrevistas.find(
    (e) => typeof e.edital_id === "string" && e.edital_id,
  )?.edital_id;
  return typeof id === "string" ? id : null;
}

function agrupar<T>(itens: readonly T[], chave: (item: T) => string) {
  const grupos = new Map<string, T[]>();
  for (const item of itens) {
    const k = chave(item);
    const lista = grupos.get(k);
    if (lista) lista.push(item);
    else grupos.set(k, [item]);
  }
  return grupos;
}

/** O edital do recorte: o filtrado ou, havendo um só nas entrevistas, ele. */
export function editalDoRecorte(
  entrevistas: readonly EntrevistaDoPainel[],
  edital: string,
): EditalDoRecorte | null {
  const nome = texto(edital);
  const doEdital = nome
    ? entrevistas.filter((e) => texto(e.edital) === nome)
    : entrevistas;
  if (!doEdital.length) return null;
  const unico = texto(doEdital[0]?.edital);
  if (!nome && doEdital.some((e) => texto(e.edital) !== unico)) return null;
  return {
    edital: unico,
    editalId: idDoEdital(doEdital),
  };
}

/** Os grupos empatados na nota da entrevista (mesmo edital, mesma vaga, mesma nota). */
export function gruposEmpatados(
  entrevistas: readonly EntrevistaDoPainel[],
): GrupoEmpatado[] {
  const comNota = entrevistas.filter(
    (e) =>
      e.compareceu === "S" &&
      typeof e.nota === "number" &&
      Number.isFinite(e.nota),
  );
  const grupos = agrupar(
    comNota,
    (e) =>
      `${texto(e.edital)}|${texto(e.vaga)}|${Math.round(Number(e.nota) * 100)}`,
  );
  return [...grupos.entries()]
    .filter(([, lista]) => lista.length > 1)
    .map(([chave, lista]) => {
      const primeira = lista[0] as EntrevistaDoPainel;
      return {
        chave,
        edital: texto(primeira.edital),
        editalId: idDoEdital(lista),
        vaga: texto(primeira.vaga),
        nota: Number(primeira.nota),
        ids: lista.map((e) => e.id),
        candidatos: lista.map((e) => texto(e.candidato)),
      };
    })
    .sort(
      (a, b) =>
        comparar(a.edital, b.edital) ||
        comparar(a.vaga, b.vaga) ||
        b.nota - a.nota,
    );
}

/** id da entrevista → quantos empatam com ela (2 ou mais). */
export function mapaDeEmpates(grupos: readonly GrupoEmpatado[]) {
  const mapa = new Map<string, number>();
  for (const g of grupos) for (const id of g.ids) mapa.set(id, g.ids.length);
  return mapa;
}

export type ItemDaAgenda = {
  analise_id?: string | null;
  nome?: string | null;
  vaga?: string | null;
  cargo?: string | null;
  data?: string | null;
  inicio?: string | null;
  banca?: number | null;
};

export type DiaDaAgenda = {
  data: string;
  itens: ItemDaAgenda[];
};

/** Os próximos `dias` dias com entrevista, a partir de hoje (Brasília), por horário. */
export function proximosDiasDaAgenda(
  itens: readonly ItemDaAgenda[] | null | undefined,
  hoje: string,
  dias = 5,
): DiaDaAgenda[] {
  const futuros = (itens || []).filter(
    (i): i is ItemDaAgenda & { data: string } =>
      typeof i.data === "string" && i.data >= hoje,
  );
  const porDia = agrupar(futuros, (i) => i.data);
  return [...porDia.entries()]
    .sort(([a], [b]) => comparar(a, b))
    .slice(0, dias)
    .map(([data, lista]) => ({
      data,
      itens: [...lista].sort(
        (a, b) =>
          comparar(texto(a.inicio), texto(b.inicio)) ||
          (a.banca ?? 0) - (b.banca ?? 0),
      ),
    }));
}
