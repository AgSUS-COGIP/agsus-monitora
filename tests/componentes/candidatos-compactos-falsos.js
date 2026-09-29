/*
  Monta, a partir de candidatos no formato de sempre, o pacote que
  `listar_candidatos_aprovados_compacto()` devolvia no formato 1 (listas uma vez
  + linhas), o de antes da migration 20260929190000.
*/
const COLUNAS_DA_LISTA = [
  "edital_id",
  "edital",
  "unidade",
  "lista_ativa",
  "arquivo_nome",
  "importado_em",
];
const COLUNAS = [
  "candidato_id",
  "lista_id",
  "cargo",
  "classificacao",
  "nota",
  "nome",
  "modalidade",
  "status",
  "processo_sei",
  "matricula",
  "sub_judice",
  "codigo_vaga",
];

export function compactarCandidatos(candidatos) {
  const listas = {};
  const linhas = candidatos.map((candidato, i) => {
    const lista = candidato.lista_id ?? `lista-${i}`;
    listas[lista] = COLUNAS_DA_LISTA.map((coluna) => candidato[coluna] ?? null);
    return COLUNAS.map((coluna) =>
      coluna === "lista_id" ? lista : (candidato[coluna] ?? null),
    );
  });
  return {
    colunas_da_lista: COLUNAS_DA_LISTA,
    listas,
    colunas: COLUNAS,
    linhas,
    total: linhas.length,
  };
}

const DICIONARIZADAS = ["cargo", "modalidade", "status", "codigo_vaga"];

/*
  O mesmo, no formato 2 (`listar_candidatos_aprovados_compacto(p_area)`):
  listas num array com o id na primeira coluna, a linha com o índice da lista,
  e cargo, modalidade, status e código da vaga em `dicionarios` (índice base 0,
  valores em ordem), como a migration 20260929190000 monta.
*/
export function compactarPorArea(
  candidatos,
  { area = "saude-indigena", versao = "v1" } = {},
) {
  const ids = [];
  const listas = [];
  candidatos.forEach((candidato, i) => {
    const lista = candidato.lista_id ?? `lista-${i}`;
    if (ids.includes(lista)) return;
    ids.push(lista);
    listas.push([
      lista,
      ...COLUNAS_DA_LISTA.map((coluna) => candidato[coluna] ?? null),
    ]);
  });
  const dicionarios = Object.fromEntries(
    DICIONARIZADAS.map((coluna) => [
      coluna,
      [
        ...new Set(
          candidatos
            .map((candidato) => candidato[coluna] ?? null)
            .filter((valor) => valor !== null),
        ),
      ].sort(),
    ]),
  );
  const linhas = candidatos.map((candidato, i) =>
    COLUNAS.map((coluna) => {
      if (coluna === "lista_id")
        return ids.indexOf(candidato.lista_id ?? `lista-${i}`);
      const valor = candidato[coluna] ?? null;
      if (!DICIONARIZADAS.includes(coluna) || valor === null) return valor;
      return dicionarios[coluna].indexOf(valor);
    }),
  );
  return {
    formato: 2,
    area,
    versao,
    inalterado: false,
    colunas_da_lista: ["lista_id", ...COLUNAS_DA_LISTA],
    listas,
    colunas: COLUNAS,
    dicionarios,
    linhas,
    total: linhas.length,
  };
}
