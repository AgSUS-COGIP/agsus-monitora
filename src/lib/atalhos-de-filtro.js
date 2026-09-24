/*
  Campo Ano do painel de filtros da Saúde Indígena.

  Substitui o botão "Editais 2026", que tinha o ano fixo e envelheceria em
  janeiro: os anos saem dos próprios números de edital ("11/2026").

  Tudo aqui é sobre listas de valores dos filtros (texto), sem DOM.
*/

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
