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
  Conter a palavra não basta.

  A primeira versão perguntava `alvo.includes(chave)`. Isso classifica
  `Não indígenas` como `Indígenas`, porque a string contém a palavra — e
  `Reindígenas` também, porque contém a sequência de letras. Seriam duas linhas
  filtradas como o oposto do que dizem.

  Duas guardas resolvem. Fronteira lexical: a canônica só conta como palavra
  inteira, não como pedaço de outra. E negação: uma ocorrência precedida de
  `não`, `exceto`, `sem` e afins é descartada — mas só ela, porque
  `Ampla concorrência, exceto indígenas` continua sendo ampla concorrência.

  Esta é a mesma semântica do produtor, em `normalizeModalidadeConcorrenciaText_`
  no Apps Script. As duas pontas precisam concordar: de nada adianta o produtor
  parar de criar o falso positivo se o consumidor o reintroduz na leitura.
*/
const NEGACOES = Object.freeze([
  "nao",
  "nem",
  "sem",
  "exceto",
  "salvo",
  "excluindo",
  "excluido",
  "excluida",
  "fora",
  "menos",
  "nenhum",
  "nenhuma",
  "diferente",
]);

const escaparRegex = (texto) =>
  String(texto).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const terminaEmNegacao = (trechoAnterior) => {
  const palavras = String(trechoAnterior)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/);
  return NEGACOES.includes(palavras[palavras.length - 1] || "");
};

/*
  A fronteira só é exigida do lado em que a própria canônica termina em
  caractere alfanumérico: `pessoas com deficiencia (pcd)` acaba em ")", e exigir
  um separador depois do parêntese rejeitaria a forma legítima.
*/
const ocorreSemNegacao = (alvo, chaveCanonica) => {
  const antes = /^[a-z0-9]/.test(chaveCanonica) ? "(^|[^a-z0-9])" : "()";
  const depois = /[a-z0-9]$/.test(chaveCanonica) ? "($|[^a-z0-9])" : "()";
  const padrao = new RegExp(antes + escaparRegex(chaveCanonica) + depois, "g");

  let achado = padrao.exec(alvo);
  while (achado !== null) {
    const fimDoPrefixo = achado.index + (achado[1] ? achado[1].length : 0);
    if (!terminaEmNegacao(alvo.slice(0, fimDoPrefixo))) return true;
    padrao.lastIndex = achado.index + 1;
    achado = padrao.exec(alvo);
  }
  return false;
};

/*
  Devolve sempre na ordem de `MODALIDADES`, não na ordem em que aparecem na
  célula: a lista de filtros precisa ser estável, e a mesma combinação escrita
  em ordens diferentes é a mesma combinação.
*/
export function modalidadesDe(valor) {
  const bruto = String(valor ?? "").trim();
  if (!bruto) return [];
  const alvo = chave(bruto);
  const achadas = CANONICAS.filter((m) => ocorreSemNegacao(alvo, m.chave)).map(
    (m) => m.rotulo,
  );
  return achadas.length ? achadas : [bruto];
}
