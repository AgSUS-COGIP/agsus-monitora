/*
  Lista de aprovados numa chamada só.

  `listar_candidatos_aprovados_compacto(p_area)` devolve os dados de cada lista
  uma vez (`listas`) e os candidatos em linhas posicionais (`colunas` +
  `linhas`). Aqui eles voltam ao formato de sempre — um objeto por candidato,
  com as mesmas chaves, na mesma ordem, de `listar_candidatos_aprovados` —,
  para o resto da tela não mudar. A ordem das linhas é a do banco.

  Dois formatos:
  - 2 (com área): `listas` é um array e a linha leva o índice da lista; a
    primeira coluna da lista é o `lista_id`. Cargo, modalidade, status e
    código da vaga vão uma vez em `dicionarios` e a linha leva o índice (base 0).
    Sem isso, cargo (~60 caracteres) e código da vaga (~47) se repetiam em cada
    um dos milhares de candidatos.
  - 1 (sem área, o banco de antes da migration 20260929190000): `listas` é um
    objeto por id e a linha leva o próprio id. Sai junto com o ramo sem área da
    função no banco.
  A mesma conta serve aos dois: `listas[linha[lista_id]]` acha a lista pelo
  índice (array) ou pelo id (objeto).
*/
export function expandirCandidatosCompactos(pacote) {
  const colunas = Array.isArray(pacote?.colunas) ? pacote.colunas : [];
  const colunasDaLista = Array.isArray(pacote?.colunas_da_lista)
    ? pacote.colunas_da_lista
    : [];
  const listas =
    pacote?.listas && typeof pacote.listas === "object" ? pacote.listas : {};
  const dicionarios =
    pacote?.dicionarios && typeof pacote.dicionarios === "object"
      ? pacote.dicionarios
      : {};
  const linhas = Array.isArray(pacote?.linhas) ? pacote.linhas : [];
  const posicaoDaLista = colunas.indexOf("lista_id");
  const dicionarioDe = colunas.map((coluna) =>
    Array.isArray(dicionarios[coluna]) ? dicionarios[coluna] : null,
  );

  return linhas.map((linha) => {
    const candidato = {};
    colunas.forEach((coluna, i) => {
      const valor = linha[i] ?? null;
      const dicionario = dicionarioDe[i];
      candidato[coluna] =
        dicionario && valor !== null ? (dicionario[valor] ?? null) : valor;
    });
    // No formato 2, a primeira coluna da lista (`lista_id`) troca o índice pelo id.
    const lista = listas[linha[posicaoDaLista]] || [];
    colunasDaLista.forEach((coluna, i) => {
      candidato[coluna] = lista[i] ?? null;
    });
    return candidato;
  });
}

/* Formato do pacote que traz área e versão (o que a cópia do navegador guarda). */
export const FORMATO_POR_AREA = 2;

/** O banco disse que a cópia que o front tem continua valendo. */
export const pacoteInalterado = (pacote) => pacote?.inalterado === true;

/*
  A cópia da lista de aprovados no navegador (regras em `cache-de-payload.js`):
  uma por área, só do formato 2 e com as linhas. A versão dos dados é a
  `versao` do pacote, que o banco calcula dos próprios dados a cada chamada.
*/
export const LISTA_DE_APROVADOS = Object.freeze({
  nome: "lista de aprovados",
  chave: ({ area }) => `aprovados:${String(area ?? "").trim()}`,
  esquema: (pacote) => pacote?.formato,
  esquemas: Object.freeze([FORMATO_POR_AREA]),
  valido: (pacote) =>
    Array.isArray(pacote.linhas) && typeof pacote.versao === "string",
});
