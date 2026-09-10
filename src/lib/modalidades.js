/*
  Modalidade de concorrência: um conjunto, não um texto.

  Uma vaga pode ser reservada a mais de uma modalidade, e a origem às vezes
  entrega as duas na mesma célula. O painel tratava a célula inteira como um
  valor atômico, então cada combinação virava uma modalidade nova na lista de
  filtros — e quem procurasse "Indígenas" não achava a vaga que também era
  indígena.

  Medido no export de 09/09/2026, 3561 linhas do recorte Ativo:

     2424  "Ampla concorrência"
      584  "Pretos e pardos"
      447  "Indígenas"
       94  "Pessoas com deficiência (PCD)"
        7  "Quilombolas"
        3  "Ampla concorrência', 'Indígenas"
        1  "Ampla concorrência', 'Pretos e pardos"
        1  "Pessoas com deficiência (PCD)  Indígenas"

  Cinco linhas combinadas, em duas formas diferentes: separador `', '` — restos
  de uma lista serializada como texto, com os colchetes e as aspas externas
  perdidos pelo caminho — e separador de dois espaços. Como as formas divergem,
  procurar separador seria adivinhar. Procuram-se as modalidades canônicas
  dentro da célula, o que atravessa qualquer separador presente ou futuro.

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
