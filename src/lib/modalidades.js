/*
  Modalidade de concorrência: um conjunto, não um texto.

  Uma vaga pode ser reservada a mais de uma modalidade, e a origem às vezes
  entrega as duas na mesma célula. O painel tratava a célula inteira como um
  valor atômico, então cada combinação virava uma modalidade nova na lista de
  filtros — e quem procurasse "Indígenas" não achava a vaga que também era
  indígena.

  Medido em `vw_analises_dashboard_base` no principal, 10/09/2026: 4073
  registros ativos, 10 valores brutos distintos. Além das cinco canônicas:

      Ampla concorrência" "Indígenas
      Ampla concorrência", "Indígenas
      Ampla concorrência", "Pretos e pardos
      Indígenas" "Pessoas com deficiência (PCD)
      Pessoas com deficiência (PCD); Indígenas

  Um dia antes, o export de 09/09 trazia outras três combinações, com separador
  `', '` e com dois espaços — restos de listas serializadas como texto, com
  colchetes e aspas externas perdidos por caminhos diferentes. Nenhuma delas
  sobreviveu ao retrato seguinte.

  Cinco formas de separador em dois retratos com um dia de diferença. É por isso
  que aqui não se procura separador nenhum: procuram-se as modalidades canônicas
  dentro da célula, o que atravessa a forma de ontem, a de hoje e a de amanhã.

  O que não casa com nenhuma canônica é devolvido como está. Um valor
  desconhecido tem de continuar filtrável e visível — sumir da lista seria pior
  do que aparecer torto, e é assim que uma modalidade nova de verdade aparece em
  vez de ser engolida.
*/

export const MODALIDADES = Object.freeze([
  "Ampla concorrência",
  "Pretos e pardos",
  "Indígenas",
  "Pessoas com deficiência (PCD)",
  "Quilombolas",
]);

const chave = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const CANONICAS = MODALIDADES.map((rotulo) => ({
  rotulo,
  chave: chave(rotulo),
}));

/*
  Devolve sempre na ordem de `MODALIDADES`, não na ordem em que aparecem na
  célula: a lista de filtros precisa ser estável, e a mesma combinação escrita
  em ordens diferentes é a mesma combinação.
*/
export function modalidadesDe(valor) {
  const bruto = String(valor ?? "").trim();
  if (!bruto) return [];
  const alvo = chave(bruto);
  const achadas = CANONICAS.filter((m) => alvo.includes(m.chave)).map(
    (m) => m.rotulo,
  );
  return achadas.length ? achadas : [bruto];
}
