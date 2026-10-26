/*
  O texto da hora no topo das telas que vêm de carga (Análises, Seleção,
  Entrevistas): quando a carga conferiu os dados pela última vez e, se
  houver, quando eles mudaram. Antes a tela mostrava só "Atualizado em" com a
  hora do dado mais novo, e na segunda de manhã parecia parada ("Atualizado
  em 04/10, 13:05") embora a carga tivesse rodado e só não achado mudança.

  - hoje: "às 09:32"; outro dia: "em 04/10, 13:05" (horário de Brasília);
  - conferido e mudança: "Conferido às 09:32 · última mudança em 04/10, 13:05";
  - só um dos dois: "Conferido às …" ou "Atualizado em …";
  - nenhum: null (a tela decide o texto).
*/

const FUSO = "America/Sao_Paulo";

const lerData = (valor) => {
  if (valor instanceof Date)
    return Number.isNaN(valor.getTime()) ? null : valor;
  if (valor === null || valor === undefined || valor === "") return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
};

const dia = (data) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);

const hora = (data) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);

/** "às 09:32" (mesmo dia de `agora`) ou "em 04/10, 13:05". */
export function quandoFoi(valor, agora = new Date()) {
  const data = lerData(valor);
  if (!data) return "";
  if (dia(data) === dia(agora)) return `às ${hora(data)}`;
  return `em ${dia(data).slice(0, 5)}, ${hora(data)}`;
}

/** @param {{ conferidoEm?: unknown, mudancaEm?: unknown, agora?: Date }} [opcoes] */
export function textoDaConferencia({
  conferidoEm,
  mudancaEm,
  agora = new Date(),
} = {}) {
  const conferido = quandoFoi(conferidoEm, agora);
  const mudanca = quandoFoi(mudancaEm, agora);
  if (conferido && mudanca && lerData(mudancaEm) < lerData(conferidoEm))
    return `Conferido ${conferido} · última mudança ${mudanca}`;
  if (conferido) return `Conferido ${conferido}`;
  if (mudanca) return `Atualizado ${mudanca}`;
  return null;
}
