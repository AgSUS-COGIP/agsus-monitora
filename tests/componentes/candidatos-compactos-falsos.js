/*
  Monta, a partir de candidatos no formato de sempre, o pacote que
  `listar_candidatos_aprovados_compacto()` devolve (listas uma vez + linhas).
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
