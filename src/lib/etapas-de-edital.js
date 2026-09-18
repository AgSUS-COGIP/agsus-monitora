/*
  Tipos de etapa do Calendário de Editais.

  O cronograma guarda `atividade` como texto livre, digitado à mão no editor da
  Equipe Núcleo (ver `nucleo-cronograma.js`). Não existe coluna `tipo` no banco.
  O calendário, porém, precisa de um tipo para pintar a cor e alimentar o filtro
  "Tipo de etapa". Este ficheiro deduz esse tipo a partir do texto.

  A dedução é deliberadamente conservadora: quando nenhuma palavra-chave casa, a
  etapa cai em `outros` — com cor neutra — em vez de ser empurrada para o tipo
  mais parecido. Uma etapa sem cor é um detalhe visual; uma etapa pintada com a
  cor errada faz alguém ler o calendário de forma errada.

  A ORDEM DE `TIPOS_DE_ETAPA` É A ORDEM DE PRECEDÊNCIA e não é arbitrária. Os
  nomes reais do modelo padrão acumulam várias palavras-chave na mesma frase:

    "Prazo de recurso do resultado preliminar documental"
       → tem "recurso" E "resultado"; o certo é Recursos.
    "Resultado Preliminar da Avaliação Documental e de Títulos"
       → tem "resultado" E "documental"; o certo é Resultado.
    "Resultado Preliminar das Entrevistas"
       → tem "resultado" E "entrevista"; o certo é Resultado.

  Por isso `recursos` vem antes de `resultado`, que vem antes de `entrevistas` e
  de `analise`. Mover uma linha muda a classificação de etapas já existentes.

  Ao mexer aqui, rode `tests/etapas-de-edital.test.js`: ele fixa as doze
  atividades do modelo padrão, que é o que a maioria dos editais usa.
*/

/*
  Remove acentos e caixa: o texto vem digitado à mão e varia muito.

  Exportada porque a busca do calendário precisa exatamente da mesma regra — se
  a classificação entende "homologacao" como "Homologação", quem pesquisa sem
  acento tem de encontrar o mesmo. Duas normalizações diferentes acabariam por
  divergir.
*/
export function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Tipos de etapa, em ordem de precedência (o primeiro que casar vence).
 * `cor` é o nome do token CSS, definido em `styles/calendario-editais.css`.
 */
export const TIPOS_DE_ETAPA = [
  /*
    Impugnação antes de Recursos, e não dentro dele: acontece contra o edital,
    antes de existir qualquer resultado, enquanto os recursos contestam um
    resultado já publicado. São momentos diferentes do processo. Por isso
    "impugna" saiu da lista de `recursos` — lá era um termo morto, mas deixá-lo
    escrito fazia parecer que os dois competiam.
  */
  {
    id: "impugnacao",
    rotulo: "Impugnação do edital",
    cor: "laranja",
    termos: ["impugna"],
  },
  {
    id: "recursos",
    rotulo: "Recursos",
    cor: "rosa",
    termos: ["recurso", "recursos", "contrarrazao", "contestacao"],
  },
  /*
    Não há tipo para homologação nem para admissão. Ambos existiram e foram
    removidos a pedido de quem usa a tela: o cronograma dos editais não tem essas
    etapas — o modelo padrão vai da publicação do edital ao resultado final — e
    duas cores na legenda que nunca pintavam nada só gastavam a paleta.

    Se um edital escrever uma etapa dessas à mão, ela cai em `outros`, com a cor
    neutra, que é o comportamento correto para algo que o sistema não sabe
    classificar. Se passarem a ser comuns, reintroduza os tipos aqui — antes de
    `resultado`, porque "Homologação do resultado final" já é capturada por
    `resultado-final`.
  */
  /*
    O resultado final do processo seletivo é o marco que encerra tudo — não é
    mais um dos vários resultados parciais (documental, entrevistas) que
    acontecem pelo caminho. Vem antes de `resultado` porque a frase contém a
    palavra "resultado" e seria capturada por ele.

    Os termos são frases inteiras, de propósito: "processo seletivo" sozinho
    apareceria em nomes como "Publicação do Edital do Processo Seletivo", que
    não é resultado de coisa nenhuma.
  */
  {
    id: "resultado-final",
    rotulo: "Resultado final",
    cor: "violeta",
    termos: [
      "resultado final do processo seletivo",
      "resultado final do processo",
      "resultado final do pss",
      "homologacao do resultado final",
    ],
  },
  {
    id: "resultado",
    rotulo: "Resultado",
    cor: "ambar",
    termos: ["resultado", "classificacao final", "gabarito"],
  },
  /*
    Convocar para a entrevista é agendamento, não a entrevista em si: quem lê o
    calendário precisa de saber que naquele dia sai a lista de convocados, e não
    que alguém está a ser entrevistado.

    Vem antes de `entrevistas` porque a frase contém "entrevista". Os termos são
    frases e não só "convocacao" — há convocação para admissão, para prova, para
    perícia, e nenhuma delas é isto. O que não casar cai em `entrevistas`, que
    continua a ser uma resposta razoável.
  */
  {
    id: "convocacao-entrevista",
    rotulo: "Convocação para entrevista",
    cor: "turquesa",
    termos: [
      "convocacao para a entrevista",
      "convocacao para entrevista",
      "convocacao para as entrevistas",
      "convocacao de entrevista",
      "convocacao para a fase de entrevista",
    ],
  },
  {
    id: "entrevistas",
    rotulo: "Entrevistas",
    cor: "violeta-claro",
    termos: ["entrevista", "arguicao", "banca"],
  },
  {
    id: "inscricoes",
    rotulo: "Inscrições",
    cor: "verde",
    termos: ["inscri", "publicacao do edital", "abertura do edital"],
  },
  {
    id: "analise",
    rotulo: "Análise curricular",
    cor: "azul-escuro",
    termos: [
      "analise",
      "avaliacao",
      "curricular",
      "documental",
      "titulo",
      "triagem",
    ],
  },
];

/** Usado quando nenhuma palavra-chave casa. Não faz parte da legenda colorida. */
export const TIPO_OUTROS = {
  id: "outros",
  rotulo: "Outros",
  cor: "neutro",
  termos: [],
};

/**
 * Deduz o tipo de uma etapa a partir do nome da atividade.
 * @param {string} atividade texto livre vindo do cronograma
 * @returns {{id: string, rotulo: string, cor: string}} nunca devolve null
 */
export function classificarEtapa(atividade) {
  const texto = normalizarTexto(atividade);
  if (!texto) return TIPO_OUTROS;
  const encontrado = TIPOS_DE_ETAPA.find((tipo) =>
    tipo.termos.some((termo) => texto.includes(termo)),
  );
  return encontrado || TIPO_OUTROS;
}

/*
  Datas do cronograma são `YYYY-MM-DD` (campos `<input type="date">`). Interpretar
  essa string com `new Date("2026-09-29")` dá meia-noite UTC, que no Brasil é o
  dia anterior — uma etapa apareceria no dia errado do calendário. Ancorar ao
  meio-dia local evita isso, e é a mesma convenção já usada em
  `nucleo-cronograma.js` (`dateLocal`). As duas precisam continuar iguais.
*/
export function dataLocal(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const data = new Date(`${texto}T12:00:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

/** Meio-dia local do dia de `referencia`, para comparar com `dataLocal`. */
function meioDiaDe(referencia) {
  return new Date(
    referencia.getFullYear(),
    referencia.getMonth(),
    referencia.getDate(),
    12,
  );
}

/*
  Três situações, todas derivadas só das datas — não há quarta.

  Houve, por pouco tempo: uma etapa que ainda não começou era "Pendente" se
  faltassem até dez dias e "Programado" acima disso. Esse limite de dez dias eu
  deduzi de um mockup; não vinha do banco nem de regra escrita por ninguém, e
  quem usava a tela não sabia dizer o que separava um do outro. Foi removido.
  Se um dia existir uma distinção real entre etapas próximas e distantes, ela
  precisa vir de uma regra do negócio, com o número decidido por quem entende do
  processo — e não do desenho de um protótipo.

  Os valores são identificadores internos, não texto de tela: a tela não escreve
  a situação em lugar nenhum, usa-a para colorir a linha do tempo e para esconder
  o que já passou.
*/
export const SITUACAO_ETAPA = {
  CONCLUIDA: "concluida",
  EM_ANDAMENTO: "em-andamento",
  FUTURA: "futura",
};

/**
 * Situação de UMA etapa pela data de hoje.
 *
 * Diferente de `calculateState` em `nucleo-cronograma.js`, que resume o edital
 * inteiro numa situação só. Aqui é por etapa.
 *
 * @param {{data_inicio?: string, data_fim?: string}} etapa
 * @param {Date} [referencia] hoje; parametrizado para os testes não dependerem do relógio
 * @returns {string|null} null quando a etapa não tem datas utilizáveis
 */
export function situacaoDaEtapa(etapa, referencia = new Date()) {
  const inicio = dataLocal(etapa?.data_inicio);
  const fim = dataLocal(etapa?.data_fim) || inicio;
  if (!inicio || !fim) return null;

  const hoje = meioDiaDe(referencia);
  if (fim < hoje) return SITUACAO_ETAPA.CONCLUIDA;
  if (inicio <= hoje) return SITUACAO_ETAPA.EM_ANDAMENTO;
  return SITUACAO_ETAPA.FUTURA;
}

/** Atalho para o único uso que a tela faz da situação além da cor. */
export function etapaConcluida(etapa, referencia = new Date()) {
  return situacaoDaEtapa(etapa, referencia) === SITUACAO_ETAPA.CONCLUIDA;
}
