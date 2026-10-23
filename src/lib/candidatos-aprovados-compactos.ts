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
  - 1 (sem área, o banco de antes da migration 20260929210000): `listas` é um
    objeto por id e a linha leva o próprio id. Sai junto com o ramo sem área da
    função no banco.
  A mesma conta serve aos dois: `listas[linha[lista_id]]` acha a lista pelo
  índice (array) ou pelo id (objeto).

  "Contratado em outra lista" (migration 20261024120000): o dicionário
  `contratacao` leva, por id, [situação, motivo] das linhas que o job decidiu;
  viram `contratacao_situacao` e `contratacao_motivo` só nessas linhas.
*/
/** Lê uma chave dinâmica sem promover valores externos a tipos de negócio. */
function campo(valor: unknown, chave: unknown): unknown {
  return valor !== null && typeof valor === "object"
    ? Reflect.get(valor, String(chave))
    : undefined;
}
function lista(valor: unknown): readonly unknown[] {
  return Array.isArray(valor) ? valor : [];
}

export function expandirCandidatosCompactos(
  pacote: unknown,
): Record<string, unknown>[] {
  const colunas = lista(campo(pacote, "colunas")).map(String);
  const colunasDaLista = lista(campo(pacote, "colunas_da_lista")).map(String);
  const listas = campo(pacote, "listas");
  const dicionarios = campo(pacote, "dicionarios");
  const linhas = lista(campo(pacote, "linhas"));
  const posicaoDaLista = colunas.indexOf("lista_id");
  const contratacao = campo(dicionarios, "contratacao");
  const dicionarioDe = colunas.map((coluna): readonly unknown[] | null => {
    const valores = campo(dicionarios, coluna);
    return Array.isArray(valores) ? valores : null;
  });
  return linhas.map((linha) => {
    const candidato: Record<string, unknown> = {};
    colunas.forEach((coluna, i) => {
      const valor = campo(linha, i) ?? null;
      const dicionario = dicionarioDe[i];
      candidato[coluna] =
        dicionario && valor !== null
          ? (campo(dicionario, valor) ?? null)
          : valor;
    });
    // No formato 2, lista_id deixa de ser índice e recebe o ID da lista.
    const dadosDaLista = campo(listas, campo(linha, posicaoDaLista));
    colunasDaLista.forEach((coluna, i) => {
      candidato[coluna] = campo(dadosDaLista, i) ?? null;
    });
    const decidida = campo(contratacao, candidato.candidato_id);
    if (Array.isArray(decidida)) {
      candidato.contratacao_situacao = decidida[0] ?? null;
      candidato.contratacao_motivo = decidida[1] ?? null;
    }
    return candidato;
  });
}

/* Formato do pacote que traz área e versão (o que a cópia do navegador guarda). */
export const FORMATO_POR_AREA = 2;

/** O banco disse que a cópia que o front tem continua valendo. */
export const pacoteInalterado = (pacote: unknown) =>
  campo(pacote, "inalterado") === true;

/*
  A cópia da lista de aprovados no navegador (regras em `cache-de-payload.js`):
  uma por área, só do formato 2 e com as linhas. A versão dos dados é a
  `versao` do pacote, que o banco calcula dos próprios dados a cada chamada.
*/
export const LISTA_DE_APROVADOS = Object.freeze({
  nome: "lista de aprovados",
  chave: ({ area }: { area?: unknown }) =>
    `aprovados:${String(area ?? "").trim()}`,
  esquema: (pacote: unknown) => campo(pacote, "formato"),
  esquemas: Object.freeze([FORMATO_POR_AREA]),
  valido: (pacote: unknown) =>
    Array.isArray(campo(pacote, "linhas")) &&
    typeof campo(pacote, "versao") === "string",
});
