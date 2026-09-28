/*
  Lista de aprovados numa chamada só.

  `listar_candidatos_aprovados_compacto()` devolve os dados de cada lista uma vez
  (`listas`, por id) e os candidatos em linhas posicionais (`colunas` +
  `linhas`). Aqui eles voltam ao formato de sempre — um objeto por candidato,
  com as mesmas chaves de `listar_candidatos_aprovados` —, para o resto da tela
  não mudar. A ordem é a do banco.
*/
export function expandirCandidatosCompactos(pacote) {
  const colunas = Array.isArray(pacote?.colunas) ? pacote.colunas : [];
  const colunasDaLista = Array.isArray(pacote?.colunas_da_lista)
    ? pacote.colunas_da_lista
    : [];
  const listas =
    pacote?.listas && typeof pacote.listas === "object" ? pacote.listas : {};
  const linhas = Array.isArray(pacote?.linhas) ? pacote.linhas : [];
  const posicaoDaLista = colunas.indexOf("lista_id");

  return linhas.map((linha) => {
    const candidato = {};
    colunas.forEach((coluna, i) => {
      candidato[coluna] = linha[i] ?? null;
    });
    const lista = listas[linha[posicaoDaLista]] || [];
    colunasDaLista.forEach((coluna, i) => {
      candidato[coluna] = lista[i] ?? null;
    });
    return candidato;
  });
}
