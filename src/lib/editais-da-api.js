/*
  O formato da API de editais (`api/editais.js`): uma linha por unidade e
  edital, com unidade, edital, status, etapa, vagas, contratados, ociosas,
  risco e o link do edital (só o link; os anexos não vêm). Os dados são as
  linhas ativas da VW_MONITORAMENTO_INDIGENA_OPERACIONAL (a mesma da tela de
  Editais), de todas as áreas, lidas pela função da Vercel com a chave de
  servidor por `listar_editais_da_api` (20261105170000).

  JS com JSDoc (e não TS) porque a função da Vercel importa daqui sem build.
*/

/**
 * @typedef {{
 *   id: string | number | null,
 *   unidade: string,
 *   edital: string,
 *   status: string,
 *   etapa: string,
 *   vagas: number,
 *   contratados: number,
 *   ociosas: number,
 *   risco: string,
 *   link: string,
 * }} EditalDaApi
 */

/** @typedef {{ edital: string, unidade: string, status: string, etapa: string, risco: string }} FiltrosDaApi */

/** A leitura (só service_role; chamada por api/editais.js; 20261105170000). */
export const RPC_DOS_EDITAIS = "listar_editais_da_api";

/** Os filtros aceitos na query string. */
export const FILTROS_DA_API = Object.freeze([
  "edital",
  "unidade",
  "status",
  "etapa",
  "risco",
]);

/** Texto aparado ("" para nulo). Também usado por aprovados-e-cronograma-da-api.js. */
export const texto = (valor) => (valor == null ? "" : String(valor).trim());

export const numero = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

/** Minúsculas e sem acento, para comparar "Médio" com "medio". */
export const chave = (valor) =>
  texto(valor).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * O primeiro valor de um parâmetro da query (pode vir repetido), aparado e curto.
 * @param {Record<string, unknown> | null | undefined} query
 * @param {string} nome
 */
export function valorDaQuery(query, nome) {
  const valor = query?.[nome];
  return texto(Array.isArray(valor) ? valor[0] : valor).slice(0, 120);
}

/**
 * As linhas da resposta da RPC: `{ linhas }` ou a lista crua.
 * @param {unknown} payload
 * @returns {Record<string, unknown>[]}
 */
export function linhasDoPayload(payload) {
  if (Array.isArray(payload)) return payload;
  const linhas = /** @type {any} */ (payload)?.linhas;
  return Array.isArray(linhas) ? linhas : [];
}

/**
 * Lê os filtros da query (o primeiro valor, se vier repetido).
 * @param {Record<string, unknown> | null | undefined} query
 * @returns {FiltrosDaApi}
 */
export function filtrosDaApi(query) {
  const filtros = /** @type {FiltrosDaApi} */ ({});
  for (const nome of FILTROS_DA_API) filtros[nome] = valorDaQuery(query, nome);
  return filtros;
}

/**
 * Uma linha do monitoramento no formato da API.
 * @param {Record<string, unknown>} linha
 * @returns {EditalDaApi}
 */
export function editalDaApi(linha) {
  const id = linha?.id;
  return {
    id: typeof id === "number" || typeof id === "string" ? id : null,
    unidade: texto(linha?.unidade),
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

/**
 * Status, etapa e risco: igualdade (sem caixa nem acento).
 * Edital e unidade: contém o trecho.
 * @param {EditalDaApi} item
 * @param {FiltrosDaApi} filtros
 */
function passaNosFiltros(item, filtros) {
  for (const nome of ["status", "etapa", "risco"]) {
    if (filtros[nome] && chave(item[nome]) !== chave(filtros[nome]))
      return false;
  }
  for (const nome of ["edital", "unidade"]) {
    if (filtros[nome] && !chave(item[nome]).includes(chave(filtros[nome])))
      return false;
  }
  return true;
}

/**
 * A resposta da RPC (`{ linhas, versao }` ou a lista crua) virada nos editais
 * da API, já filtrados.
 * @param {unknown} payload
 * @param {Partial<FiltrosDaApi>} [filtros]
 * @returns {EditalDaApi[]}
 */
export function editaisDaApi(payload, filtros = {}) {
  const f = filtrosDaApi(filtros);
  return linhasDoPayload(payload)
    .map(editalDaApi)
    .filter((item) => passaNosFiltros(item, f));
}

/**
 * Os totais das linhas devolvidas.
 * @param {EditalDaApi[]} editais
 */
export function totaisDaApi(editais) {
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
