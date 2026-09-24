/*
  Atalhos de filtro da Saúde Indígena: Ano e Situação.

  Substituem quatro botões ("Editais 2026", "Em andamento", "Risco médio/alto",
  "Ocultar encerrados"): o ano estava fixo no botão e envelheceria em janeiro;
  "Em andamento" e "Ocultar encerrados" filtravam a mesma coisa por caminhos
  diferentes; e o risco já tem o KPI "Processos Críticos" e o filtro de Risco.

  Tudo aqui é sobre listas de valores dos filtros (texto), sem DOM.
*/

const normalizar = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** "11/2026", "Edital 3/2025 - DSEI X" → 2026, 2025. Sem ano → null. */
export function anoDoEdital(edital) {
  const achado = String(edital ?? "").match(/\/((?:19|20)\d{2})\b/);
  return achado ? Number(achado[1]) : null;
}

/** Anos presentes nos editais, do mais recente para o mais antigo. */
export function anosDosEditais(editais) {
  return [...new Set(editais.map(anoDoEdital).filter(Boolean))].sort(
    (a, b) => b - a,
  );
}

export function editaisDoAno(editais, ano) {
  return editais.filter((edital) => anoDoEdital(edital) === Number(ano));
}

const mesmoConjunto = (a, b) =>
  a.length === b.length && b.every((valor) => a.includes(valor));

/** Que ano a seleção de Edital representa: "" (nenhuma), um ano, ou "personalizado". */
export function anoDaSelecao(selecionados, editais) {
  if (!selecionados.length) return "";
  for (const ano of anosDosEditais(editais)) {
    const doAno = editaisDoAno(editais, ano);
    if (doAno.length && mesmoConjunto(selecionados, doAno)) return String(ano);
  }
  return "personalizado";
}

export const SITUACOES = Object.freeze([
  { id: "todos", rotulo: "Todos" },
  { id: "andamento", rotulo: "Em andamento" },
  { id: "encerrados", rotulo: "Encerrados" },
]);

const ehAndamento = (status) => normalizar(status).includes("andamento");
const ehEncerrado = (status) =>
  /conclu|cancel|encerr|finaliz/.test(normalizar(status));

/** Valores de Status que cada situação seleciona. "todos" = nenhum filtro. */
export function statusDaSituacao(situacao, todosOsStatus) {
  if (situacao === "andamento") return todosOsStatus.filter(ehAndamento);
  if (situacao === "encerrados") return todosOsStatus.filter(ehEncerrado);
  return [];
}

/** Que situação a seleção de Status representa; "" quando é outra combinação. */
export function situacaoDaSelecao(selecionados, todosOsStatus) {
  if (!selecionados.length) return "todos";
  for (const { id } of SITUACOES.slice(1)) {
    const alvo = statusDaSituacao(id, todosOsStatus);
    if (alvo.length && mesmoConjunto(selecionados, alvo)) return id;
  }
  return "";
}
