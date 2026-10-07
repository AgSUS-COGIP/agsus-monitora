/*
  As contas do "Painel de entrevistas" (src/modulos/entrevistas/), sem React:
  o andamento de cada edital e de cada vaga, os candidatos empatados na nota
  da entrevista e a agenda dos próximos dias. Lê as entrevistas já
  normalizadas por src/lib/entrevistas-do-painel.js (payload de
  `get_entrevistas_da_area`, que deixa o edital de treinamento de fora).

  Andamento (cada entrevista conta uma vez, nesta ordem):
    faltou     comparecimento "N";
    apto       parecer APTO;
    inapto     parecer INAPTO;
    andamento  compareceu, ainda sem parecer;
    o resto    aguardando (sem comparecimento nem parecer).
  Os números do cartão seguem os KPIs: convocados (todas as entrevistas do
  recorte), entrevistados (compareceram), faltaram, aptos, inaptos e sem
  parecer.

  Empate: duas ou mais entrevistas do mesmo edital e da mesma vaga com a
  mesma nota (quem compareceu e tem nota). O desempate não é daqui: é o da
  regra de classificação do edital, feito na Classificação.
*/

export type EntrevistaDoPainel = {
  id: string;
  edital_id?: string | null;
  edital?: string;
  unidade?: string;
  vaga?: string;
  cargo?: string;
  candidato?: string;
  nota?: number | null;
  parecer?: string;
  compareceu?: string | null;
};

export type Numeros = {
  convocados: number;
  entrevistados: number;
  faltaram: number;
  aptos: number;
  inaptos: number;
  semParecer: number;
  /** As partes da barra, exclusivas (somam `convocados`). */
  barra: {
    apto: number;
    inapto: number;
    faltou: number;
    andamento: number;
    aguardando: number;
  };
};

export type AndamentoDaVaga = {
  vaga: string;
  cargo: string;
  numeros: Numeros;
};

export type AndamentoDoEdital = {
  edital: string;
  editalId: string | null;
  unidade: string;
  numeros: Numeros;
  vagas: AndamentoDaVaga[];
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

export function numerosDasEntrevistas(
  entrevistas: readonly EntrevistaDoPainel[],
): Numeros {
  const n: Numeros = {
    convocados: entrevistas.length,
    entrevistados: 0,
    faltaram: 0,
    aptos: 0,
    inaptos: 0,
    semParecer: 0,
    barra: { apto: 0, inapto: 0, faltou: 0, andamento: 0, aguardando: 0 },
  };
  for (const e of entrevistas) {
    const parecer = texto(e.parecer).toUpperCase();
    if (e.compareceu === "S") n.entrevistados += 1;
    if (e.compareceu === "N") n.faltaram += 1;
    if (parecer === "APTO") n.aptos += 1;
    else if (parecer === "INAPTO") n.inaptos += 1;
    else n.semParecer += 1;
    if (e.compareceu === "N") n.barra.faltou += 1;
    else if (parecer === "APTO") n.barra.apto += 1;
    else if (parecer === "INAPTO") n.barra.inapto += 1;
    else if (e.compareceu === "S") n.barra.andamento += 1;
    else n.barra.aguardando += 1;
  }
  return n;
}

/** Percentual feito (com parecer ou falta) do total, de 0 a 100, inteiro. */
export function percentualFeito(n: Numeros): number {
  if (!n.convocados) return 0;
  const feitas = n.barra.apto + n.barra.inapto + n.barra.faltou;
  return Math.round((feitas / n.convocados) * 100);
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

/** Um cartão por edital, com as vagas dele, na ordem do edital e da vaga. */
export function andamentoPorEdital(
  entrevistas: readonly EntrevistaDoPainel[],
): AndamentoDoEdital[] {
  const porEdital = agrupar(
    entrevistas,
    (e) => texto(e.edital) || "Sem edital",
  );
  return [...porEdital.entries()]
    .map(([edital, lista]) => {
      const porVaga = agrupar(lista, (e) => texto(e.vaga) || "—");
      return {
        edital,
        editalId: lista.find((e) => e.edital_id)?.edital_id ?? null,
        unidade: texto(lista.find((e) => texto(e.unidade))?.unidade),
        numeros: numerosDasEntrevistas(lista),
        vagas: [...porVaga.entries()]
          .map(([vaga, daVaga]) => ({
            vaga,
            cargo: texto(daVaga.find((e) => texto(e.cargo))?.cargo),
            numeros: numerosDasEntrevistas(daVaga),
          }))
          .sort((a, b) => comparar(a.vaga, b.vaga)),
      };
    })
    .sort((a, b) => comparar(a.edital, b.edital));
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
        editalId: lista.find((e) => e.edital_id)?.edital_id ?? null,
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
