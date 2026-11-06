/*
  O formato da API de aprovados (`api/aprovados.ts`) e de cronograma
  (`api/cronograma.ts`), para outro sistema. Os dados vêm de
  `listar_aprovados_da_api` e `listar_cronograma_da_api` (migration
  20261105150000; área em 20261105190000), lidas pela função da Vercel com a
  chave de servidor: editais ativos de todas as áreas. `area` é o nome da
  área do edital (Saúde Indígena, SEDE, Projetos). `edital_id` é o mesmo `id` de
  /api/editais, para cruzar.

  A importação usa `.js` (e não `.ts`) porque as funções da Vercel importam
  daqui: a Vercel compila cada `.ts` para `.js` e acha o `.ts` pelo nome
  `.js`; com `.ts` no caminho, a função publicada não acharia o arquivo.
*/
import {
  chave,
  linhasDoPayload,
  texto,
  valorDaQuery,
  type LinhaDaRpc,
  type QueryDaApi,
} from "./editais-da-api.js";

/** As leituras (só service_role; chamadas pelas funções da Vercel). */
export const RPC_DOS_APROVADOS = "listar_aprovados_da_api";
export const RPC_DO_CRONOGRAMA = "listar_cronograma_da_api";

export type AprovadoDaApi = {
  edital_id: string;
  edital: string;
  unidade: string;
  area: string;
  cargo: string;
  classificacao: number | null;
  nota: number | null;
  nome: string;
  modalidade: string;
  status: string;
  matricula: string;
  processo_sei: string;
  codigo_vaga: string;
  sub_judice: boolean;
};

export type EtapaDaApi = {
  edital_id: string;
  edital: string;
  unidade: string;
  area: string;
  ordem: number | null;
  atividade: string;
  data_inicio: string | null;
  data_fim: string | null;
};

/** Os campos filtrados por igualdade e os filtrados por trecho. */
type FiltrosDe<T> = {
  readonly igual: readonly (keyof T & string)[];
  readonly contem: readonly (keyof T & string)[];
};

const numeroOuNulo = (valor: unknown): number | null => {
  if (valor == null || valor === "") return null;
  const n = Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Data `AAAA-MM-DD` (o começo do texto do banco) ou nulo. */
const dataOuNulo = (valor: unknown): string | null => {
  const achado = /^\d{4}-\d{2}-\d{2}/.exec(texto(valor));
  return achado ? achado[0] : null;
};

/*
  Filtros: `edital_id` e os de "igual" comparam sem caixa nem acento; os de
  "contém" acham o trecho.
*/
const FILTROS_DOS_APROVADOS: FiltrosDe<AprovadoDaApi> = Object.freeze({
  igual: ["edital_id", "status", "modalidade", "area"],
  contem: ["edital", "unidade", "cargo", "nome"],
});
const FILTROS_DO_CRONOGRAMA: FiltrosDe<EtapaDaApi> = Object.freeze({
  igual: ["edital_id", "area"],
  contem: ["edital", "unidade", "atividade"],
});

function filtrar<T extends Record<string, unknown>>(
  itens: T[],
  query: QueryDaApi,
  { igual, contem }: FiltrosDe<T>,
): T[] {
  const pedidos = [...igual, ...contem]
    .map((nome) => [nome, chave(valorDaQuery(query, nome))] as const)
    .filter(([, valor]) => valor);
  if (!pedidos.length) return itens;
  return itens.filter((item) =>
    pedidos.every(([nome, valor]) =>
      igual.includes(nome)
        ? chave(item[nome]) === valor
        : chave(item[nome]).includes(valor),
    ),
  );
}

/** Um candidato no formato da API. */
export function aprovadoDaApi(linha: LinhaDaRpc): AprovadoDaApi {
  return {
    edital_id: texto(linha?.edital_id),
    edital: texto(linha?.edital),
    unidade: texto(linha?.unidade),
    area: texto(linha?.area),
    cargo: texto(linha?.cargo),
    classificacao: numeroOuNulo(linha?.classificacao),
    nota: numeroOuNulo(linha?.nota),
    nome: texto(linha?.nome),
    modalidade: texto(linha?.modalidade),
    status: texto(linha?.status),
    matricula: texto(linha?.matricula),
    processo_sei: texto(linha?.processo_sei),
    codigo_vaga: texto(linha?.codigo_vaga),
    sub_judice: linha?.sub_judice === true,
  };
}

/** Uma etapa do cronograma no formato da API. */
export function etapaDaApi(linha: LinhaDaRpc): EtapaDaApi {
  return {
    edital_id: texto(linha?.edital_id),
    edital: texto(linha?.edital),
    unidade: texto(linha?.unidade),
    area: texto(linha?.area),
    ordem: numeroOuNulo(linha?.ordem),
    atividade: texto(linha?.atividade),
    data_inicio: dataOuNulo(linha?.data_inicio),
    data_fim: dataOuNulo(linha?.data_fim),
  };
}

/**
 * A resposta de /api/aprovados: os candidatos filtrados e o total.
 * Filtros: ?edital_id=&status=&modalidade=&area= (igual) e ?edital=&unidade=&cargo=&nome= (contém).
 */
export function respostaDosAprovados(
  payload: unknown,
  query?: QueryDaApi,
): { aprovados: AprovadoDaApi[]; totais: { linhas: number } } {
  const aprovados = filtrar(
    linhasDoPayload(payload).map(aprovadoDaApi),
    query,
    FILTROS_DOS_APROVADOS,
  );
  return { aprovados, totais: { linhas: aprovados.length } };
}

/**
 * A resposta de /api/cronograma: as etapas filtradas e o total.
 * Filtros: ?edital_id=&area= (igual) e ?edital=&unidade=&atividade= (contém).
 */
export function respostaDoCronograma(
  payload: unknown,
  query?: QueryDaApi,
): { etapas: EtapaDaApi[]; totais: { linhas: number } } {
  const etapas = filtrar(
    linhasDoPayload(payload).map(etapaDaApi),
    query,
    FILTROS_DO_CRONOGRAMA,
  );
  return { etapas, totais: { linhas: etapas.length } };
}
