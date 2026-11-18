/*
  O formato da API de editais (`api/editais.ts`): uma linha por unidade e
  edital, com unidade, edital, status, etapa, vagas, contratados, ociosas,
  risco e o link do edital (só o link; os anexos não vêm). Os dados são as
  linhas ativas da VW_MONITORAMENTO_INDIGENA_OPERACIONAL (a mesma da tela de
  Editais), de todas as áreas, lidas pela função da Vercel com a chave de
  servidor por `listar_editais_da_api` (20261105170000).

  A função da Vercel (`api/editais.ts`) importa daqui; a Vercel compila o
  TypeScript de cada função e do que ela importa.
*/

export type EditalDaApi = {
  id: string | number | null;
  unidade: string;
  area: string;
  edital: string;
  status: string;
  etapa: string;
  vagas: number;
  contratados: number;
  ociosas: number;
  risco: string;
  link: string;
};

export type FiltrosDaApi = {
  edital: string;
  unidade: string;
  status: string;
  etapa: string;
  risco: string;
  area: string;
};

/** A query string da requisição (cada parâmetro pode vir repetido, em lista). */
export type QueryDaApi = Readonly<Record<string, unknown>> | null | undefined;

/** Uma linha devolvida pela RPC (JSON do banco, sem formato garantido). */
export type LinhaDaRpc = Readonly<Record<string, unknown>> | null | undefined;

/** A leitura (só service_role; chamada por api/editais.ts; 20261105170000). */
export const RPC_DOS_EDITAIS = "listar_editais_da_api";

/** Os filtros aceitos na query string. */
export const FILTROS_DA_API: readonly (keyof FiltrosDaApi)[] = Object.freeze([
  "edital",
  "unidade",
  "status",
  "etapa",
  "risco",
  "area",
] as const);

/** Texto aparado ("" para nulo). Também usado por aprovados-e-cronograma-da-api.ts. */
export const texto = (valor: unknown): string =>
  valor == null ? "" : String(valor).trim();

export const numero = (valor: unknown): number => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

/*
  Minúsculas, sem acento e com hífen como espaço, para comparar "Médio" com
  "medio" e "Saúde Indígena" com "saude-indigena" (o código da área).
*/
export const chave = (valor: unknown): string =>
  texto(valor)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/-/g, " ")
    .toLowerCase();

/** O primeiro valor de um parâmetro da query (pode vir repetido), aparado e curto. */
export function valorDaQuery(query: QueryDaApi, nome: string): string {
  const valor: unknown = query?.[nome];
  const primeiro: unknown = Array.isArray(valor) ? valor[0] : valor;
  return texto(primeiro).slice(0, 120);
}

/*
  As linhas da resposta da RPC: `{ linhas }` ou a lista crua. Cada linha é
  lida campo a campo, com `?.`, por isso uma linha fora do formato só sai com
  os campos vazios.
*/
export function linhasDoPayload(payload: unknown): LinhaDaRpc[] {
  const lista: unknown =
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? "linhas" in payload
        ? payload.linhas
        : undefined
      : payload;
  return Array.isArray(lista) ? (lista as LinhaDaRpc[]) : [];
}

/** Lê os filtros da query (o primeiro valor, se vier repetido). */
export function filtrosDaApi(query: QueryDaApi): FiltrosDaApi {
  const filtros: FiltrosDaApi = {
    edital: "",
    unidade: "",
    status: "",
    etapa: "",
    risco: "",
    area: "",
  };
  for (const nome of FILTROS_DA_API) filtros[nome] = valorDaQuery(query, nome);
  return filtros;
}

/** Uma linha do monitoramento no formato da API. */
export function editalDaApi(linha: LinhaDaRpc): EditalDaApi {
  const id = linha?.id;
  return {
    id: typeof id === "number" || typeof id === "string" ? id : null,
    unidade: texto(linha?.unidade),
    area: texto(linha?.area),
    edital: texto(linha?.edital),
    status: texto(linha?.status),
    etapa: texto(linha?.etapa),
    vagas: numero(linha?.vagas_total),
    contratados: numero(linha?.contratados),
    ociosas: numero(linha?.vagas_ociosas),
    risco: texto(linha?.risco),
    link: texto(linha?.link_edital),
  };
}

/*
  Status, etapa, risco e área: igualdade (sem caixa nem acento).
  Edital e unidade: contém o trecho.
*/
function passaNosFiltros(item: EditalDaApi, filtros: FiltrosDaApi): boolean {
  for (const nome of ["status", "etapa", "risco", "area"] as const) {
    if (filtros[nome] && chave(item[nome]) !== chave(filtros[nome]))
      return false;
  }
  for (const nome of ["edital", "unidade"] as const) {
    if (filtros[nome] && !chave(item[nome]).includes(chave(filtros[nome])))
      return false;
  }
  return true;
}

/**
 * A resposta da RPC (`{ linhas, versao }` ou a lista crua) virada nos editais
 * da API, já filtrados.
 */
export function editaisDaApi(
  payload: unknown,
  filtros: Partial<FiltrosDaApi> = {},
): EditalDaApi[] {
  const f = filtrosDaApi(filtros);
  return linhasDoPayload(payload)
    .map(editalDaApi)
    .filter((item) => passaNosFiltros(item, f));
}

/** Os totais das linhas devolvidas. */
export function totaisDaApi(editais: readonly EditalDaApi[]): {
  linhas: number;
  vagas: number;
  contratados: number;
  ociosas: number;
} {
  return editais.reduce(
    (t, e) => ({
      linhas: t.linhas + 1,
      vagas: t.vagas + e.vagas,
      contratados: t.contratados + e.contratados,
      ociosas: t.ociosas + e.ociosas,
    }),
    { linhas: 0, vagas: 0, contratados: 0, ociosas: 0 },
  );
}
