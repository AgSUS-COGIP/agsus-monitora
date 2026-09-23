/*
  O MODELO DE CONVOCAÇÃO: as regras do edital como DADO.

  A primeira versão deste módulo tinha cinco categorias escritas no código —
  ampla, pretos e pardos, quilombola, indígena, PCD — com percentuais, cascata e
  forma de distribuição fixos. A leitura de oito editais da AgSUS mostrou que
  praticamente tudo isso varia:

    - 97/2025 reserva também para candidatos TRANS, uma sexta categoria;
    - o edital da FCC (125) junta negros e indígenas numa única cota de "grupo
      étnico-racial", a 20%, e não usa proporcionalidade nenhuma: publica as
      posições literais — 3ª, 8ª, 13ª… para a cota, 5ª, 21ª, 41ª… para PCD;
    - 91/2026 manda a vaga de PCD vazia para os INDÍGENAS, e não para a ampla
      como os outros; arredonda o PCD sempre para cima, com teto de 20%; e só
      aplica a reserva quando há duas ou mais vagas;
    - 91/2026 ainda permite acumular duas reservas, desde que uma seja PCD,
      enquanto os demais mandam classificar só na de percentual mais elevado.

  Cinco dos oito, porém, têm regras idênticas. Daí o desenho: um MODELO é um
  conjunto de regras nomeado e reutilizável, e cada edital aponta para um. Um
  edital novo com as regras de sempre não custa configuração nenhuma, e corrigir
  o modelo corrige todos os editais que o usam — o que é a força e o perigo da
  ideia, e por isso a tela avisa quantos editais serão afetados.

  ESTE FICHEIRO NÃO CALCULA NADA.

  Aqui mora a forma do modelo: normalizar o que vem do banco, dar os padrões, e
  responder "que categorias esta célula de modalidade declara?". A ordem de
  convocação em si está em `lista-convocacao-rules.js`, que consome um modelo já
  normalizado.
*/

const texto = (valor) => String(valor ?? "").trim();

/** Arredondamento da fração de vagas. */
export const ARREDONDAMENTOS = Object.freeze([
  {
    id: "meio_acima",
    rotulo: "Fração de 0,5 sobe, abaixo disso desce",
    ajuda: "Regra da maioria dos editais (ex.: 96/2025, item 5.2.1.1).",
  },
  {
    id: "sempre_acima",
    rotulo: "Sempre para o inteiro seguinte",
    ajuda: "Usada pelo 91/2026 para PCD, combinada com um teto.",
  },
]);

/*
  Como as vagas de reserva se espalham pela ordem de chamada.

  A `ajuda` de cada opção aparece na tela, abaixo do campo, e muda quando a
  escolha muda: são decisões que ninguém acerta pelo rótulo sozinho, e explicar
  com um exemplo custa menos do que uma convocação calculada errado.
*/
export const DISTRIBUICOES = Object.freeze([
  {
    id: "proporcional",
    rotulo: "Espalhar ao longo da convocação",
    ajuda:
      "Com 4 vagas de ampla e 2 de pretos e pardos, a ordem sai AC, PP, AC, AC, PP, AC — as cotas entram intercaladas em vez de ficarem no fim. É o que a maioria dos editais quer dizer por “alternância e proporcionalidade”, sem publicar a sequência.",
  },
  {
    id: "posicao_fixa",
    rotulo: "Usar as posições que o edital publica",
    ajuda:
      "Para o edital que lista as posições, como “a cota ocupa a 3ª, a 8ª, a 13ª… de cinco em cinco”. Cada categoria informa as primeiras posições e o intervalo em que a série continua.",
  },
]);

/*
  A mesma pessoa pode ocupar vaga de MAIS DE UMA cota?

  É a pergunta que o campo responde, e vale explicá-la porque a situação não é
  óbvia: no XLSX, a coluna `modalidade` de um candidato às vezes traz duas
  reservas de uma vez — `"pretos e pardos" e "quilombola"`. Cada uma tem vagas
  próprias, e o que está em jogo é se essa pessoa pode ocupar as duas ou só uma.

  Os rótulos são respostas à pergunta, e não nomes de regra: "não", "só quando",
  "sim". A ajuda mostra o caso concreto, porque é onde se vê a diferença.
*/
export const COTAS_MULTIPLAS = Object.freeze([
  {
    id: "maior_percentual",
    rotulo: "Não — vale só a cota de maior percentual",
    ajuda:
      "ANA declarou pretos e pardos (25%) e quilombola (2%). Ela disputa só como pretos e pardos, e a vaga reservada a quilombolas fica para a próxima quilombola da lista. Percentuais iguais decidem pela melhor posição relativa. É o que dizem 96/2025, 97/2025, 30/2026, 93/2026 e o edital da FGV.",
  },
  {
    id: "acumula_com_acumulavel",
    rotulo: "Só quando uma delas for a cota acumulável",
    ajuda:
      "ANA declarou PCD e indígena, e PCD está marcada como acumulável numa das fichas abaixo: então ela guarda as DUAS reservas e ocupa a que vier primeiro na convocação. Quem declara duas cotas sem que nenhuma seja a acumulável continua valendo só a de maior percentual. É a regra do 91/2026, item 5.13.",
  },
  {
    id: "todas",
    rotulo: "Sim — qualquer cota que tenha declarado",
    ajuda:
      "ANA declarou pretos e pardos e quilombola, e ocupa a vaga que vier primeiro, de qualquer das duas. Nenhum dos oito editais lidos faz assim; existe como escape para um edital futuro.",
  },
]);

/*
  Normalização do texto, partilhada pela célula de modalidade e pelos termos de
  cada categoria: sem acento, sem caixa, e toda pontuação virada em espaço.

  É o que faz o separador não importar. A célula chega como `"pretos e pardos",
  "quilombola"` ou `"pretos e pardos" e "quilombola"` conforme o dia, e depois
  desta passagem as duas viram a mesma sequência de palavras.
*/
export function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escaparRegex(valor) {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/*
  Os termos são escritos por quem configura, não por quem programa. Por isso não
  são expressões regulares: são palavras, e uma delas terminada em `*` casa
  também com as suas flexões — `preto*` alcança "pretos", `quilombol*` alcança
  "quilombola" e "quilombolas".

  Sem o asterisco, o termo casa apenas com a palavra inteira. É o padrão mais
  seguro: `ac` solto casaria com "acesso" se fosse prefixo.
*/
export function compilarTermos(termos) {
  const partes = (Array.isArray(termos) ? termos : [])
    .map((termo) => {
      const cru = texto(termo);
      const prefixo = cru.endsWith("*");
      const base = normalizarTexto(cru.replace(/\*+$/, ""));
      if (!base) return null;
      return prefixo ? `${escaparRegex(base)}\\w*` : escaparRegex(base);
    })
    .filter(Boolean);
  if (!partes.length) return null;
  return new RegExp(`\\b(?:${partes.join("|")})\\b`);
}

/** Aceita os termos como lista ou como texto separado por `;` ou nova linha. */
export function lerTermos(valor) {
  if (Array.isArray(valor)) return valor.map(texto).filter(Boolean);
  return String(valor ?? "")
    .split(/[;\n]/)
    .map(texto)
    .filter(Boolean);
}

function inteiroNaoNegativo(valor) {
  const numero = Math.floor(Number(valor));
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

function taxa(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return 0;
  return Math.min(numero, 100);
}

function escolher(lista, valor, padrao) {
  const id = texto(valor);
  return lista.some((item) => item.id === id) ? id : padrao;
}

function normalizarCategoria(categoria, indice) {
  const id = normalizarTexto(categoria?.id).replace(/ /g, "_");
  return {
    id: id || `categoria_${indice + 1}`,
    rotulo: texto(categoria?.rotulo) || `Categoria ${indice + 1}`,
    sigla: texto(categoria?.sigla).slice(0, 10) || "—",
    ampla: categoria?.ampla === true,
    /*
      A categoria acumulável é a que pode somar-se a outra na mesma pessoa,
      quando o modelo usa `acumula_com_acumulavel`. Nos editais da AgSUS é
      sempre a de PCD.
    */
    acumulavel: categoria?.acumulavel === true,
    percentual: taxa(categoria?.percentual),
    arredondamento: escolher(
      ARREDONDAMENTOS,
      categoria?.arredondamento,
      "meio_acima",
    ),
    // Teto do percentual desta reserva depois do arredondamento. 0 = sem teto.
    teto: taxa(categoria?.teto),
    /*
      Vagas mínimas para ESTA reserva se aplicar. É por categoria, e não do
      modelo, porque o edital da FGV pede duas para as cotas raciais (7.1.3) e
      CINCO para PCD (6.5) — o mesmo edital, dois mínimos.
    */
    minimo: inteiroNaoNegativo(categoria?.minimo),
    termos: lerTermos(categoria?.termos),
    posicoes: (Array.isArray(categoria?.posicoes) ? categoria.posicoes : [])
      .map(inteiroNaoNegativo)
      .filter(Boolean)
      .sort((a, b) => a - b),
    intervalo: inteiroNaoNegativo(categoria?.intervalo),
    cascata: (Array.isArray(categoria?.cascata) ? categoria.cascata : [])
      .map((valor) => normalizarTexto(valor).replace(/ /g, "_"))
      .filter(Boolean),
    ordem: indice,
  };
}

/**
 * Põe um modelo vindo do banco (ou do formulário) na forma que o cálculo
 * espera, com todos os campos presentes e dentro dos limites.
 *
 * Garante uma e uma só categoria de ampla concorrência: ela é o resto, e sem
 * ela não haveria para onde reverter uma reserva vazia. Se o modelo não
 * declarar nenhuma, a primeira categoria sem percentual é promovida; não
 * havendo nenhuma, uma é acrescentada.
 */
export function normalizarModelo(modelo) {
  const categorias = (
    Array.isArray(modelo?.categorias) ? modelo.categorias : []
  ).map(normalizarCategoria);

  const amplas = categorias.filter((categoria) => categoria.ampla);
  if (amplas.length === 0) {
    categorias.unshift(
      normalizarCategoria(
        {
          id: "ampla",
          rotulo: "Ampla concorrência",
          sigla: "AC",
          ampla: true,
          termos: ["ampla", "geral", "ac", "livre", "universal"],
        },
        -1,
      ),
    );
  } else if (amplas.length > 1) {
    // A primeira fica; as outras viram cota comum, para o resto não ser ambíguo.
    amplas.slice(1).forEach((categoria) => {
      categoria.ampla = false;
    });
  }

  categorias.forEach((categoria, indice) => {
    categoria.ordem = indice;
    // A ampla não tem percentual próprio: é o que sobra depois das reservas.
    if (categoria.ampla) categoria.percentual = 0;
  });

  const ids = new Set(categorias.map((categoria) => categoria.id));
  categorias.forEach((categoria) => {
    // Cascata só pode apontar para categoria que existe, e nunca para si mesma.
    categoria.cascata = categoria.cascata.filter(
      (destino) => ids.has(destino) && destino !== categoria.id,
    );
  });

  return {
    id: texto(modelo?.id),
    nome: texto(modelo?.nome) || "Modelo sem nome",
    distribuicao: escolher(DISTRIBUICOES, modelo?.distribuicao, "proporcional"),
    cotaMultipla: escolher(
      COTAS_MULTIPLAS,
      modelo?.cotaMultipla,
      "maior_percentual",
    ),
    categorias,
  };
}

/*
  Compilar os termos custa uma expressão regular nova, e `lerModalidade` corre
  uma vez por candidato: sem cache, uma lista de mil aprovados compilaria seis
  mil regex a cada desenho da tela. O padrão fica guardado na própria categoria,
  invisível a quem só lê o modelo.
*/
const padroes = new WeakMap();

function padraoDaCategoria(categoria) {
  if (padroes.has(categoria)) return padroes.get(categoria);
  const padrao = compilarTermos(categoria.termos);
  padroes.set(categoria, padrao);
  return padrao;
}

/** A categoria que recebe o resto das vagas. */
export function categoriaDaAmpla(modelo) {
  return modelo.categorias.find((categoria) => categoria.ampla);
}

/** Só as reservas, na ordem em que o modelo as declara. */
export function categoriasDeReserva(modelo) {
  return modelo.categorias.filter((categoria) => !categoria.ampla);
}

export function categoriaPorId(modelo, id) {
  return modelo.categorias.find((categoria) => categoria.id === id) || null;
}

export function rotuloDaCategoria(modelo, id) {
  return categoriaPorId(modelo, id)?.rotulo || "—";
}

export function siglaDaCategoria(modelo, id) {
  return categoriaPorId(modelo, id)?.sigla || "—";
}

/**
 * Lê a célula de modalidade contra os termos das categorias do modelo.
 *
 * Todos os termos são testados contra a célula INTEIRA, e não contra pedaços
 * dela: dividir por um separador quebraria "pretos e pardos" ao meio, e o
 * separador varia de edital para edital — vírgula, "e", ponto e vírgula, barra.
 * Uma célula pode acender duas categorias, que é o caso real de quem declara
 * duas cotas.
 *
 * @returns {{ reservas: string[], reconhecida: boolean }} `reservas` traz os ids
 *   das reservas declaradas, na ordem do modelo. `reconhecida` é falso quando
 *   nenhum termo bateu — nem os da ampla —, o que sinaliza célula vazia ou termo
 *   que o modelo ainda não conhece.
 */
export function lerModalidade(modalidade, modelo) {
  const alvo = normalizarTexto(modalidade);
  if (!alvo) return { reservas: [], reconhecida: false };

  const reservas = [];
  let bateuAlguma = false;
  modelo.categorias.forEach((categoria) => {
    const padrao = padraoDaCategoria(categoria);
    if (!padrao || !padrao.test(alvo)) return;
    bateuAlguma = true;
    if (!categoria.ampla) reservas.push(categoria.id);
  });

  return { reservas, reconhecida: bateuAlguma };
}

/*
  CATÁLOGO DE REFERÊNCIA

  Os três conjuntos de regras que os oito editais lidos usam, prontos para
  servirem de ponto de partida a um modelo novo. Ficam no código, e não no
  banco, de propósito: são a leitura de editais publicados, e mudá-los é dizer
  que se leu o edital de outra forma — coisa que merece revisão, não um campo de
  formulário. O que o gestor cria a partir daqui vira linha no banco e é dele.

  A cascata de cada reserva segue a redação dos editais: quilombola vai para
  indígena, indígena vai para quilombola, e faltando as duas vai para negros e
  só então para a ampla — que é o destino final de todas e por isso nunca
  aparece escrita.
*/
export const MODELOS_DE_REFERENCIA = Object.freeze([
  Object.freeze({
    // Regra dos editais 96/2025, 30/2026, 93/2026, Cebraspe 2026 e FGV.
    id: "lei-15142-2025",
    nome: "Lei 15.142/2025 — 25/3/2 e 5% PCD",
    distribuicao: "proporcional",
    cotaMultipla: "maior_percentual",
    categorias: [
      {
        id: "ampla",
        rotulo: "Ampla concorrência",
        sigla: "AC",
        ampla: true,
        termos: ["ampla*", "geral*", "ac", "livre*", "universal*"],
      },
      {
        id: "pretos_pardos",
        rotulo: "Pretos e pardos",
        sigla: "PP",
        percentual: 25,
        termos: ["preto*", "pardo*", "negro*", "negra*", "afro*", "pp", "ppi"],
        cascata: [],
      },
      {
        id: "indigena",
        rotulo: "Indígena",
        sigla: "IND",
        percentual: 3,
        termos: ["indigena*", "indio*", "ppi"],
        cascata: ["quilombola", "pretos_pardos"],
      },
      {
        id: "quilombola",
        rotulo: "Quilombola",
        sigla: "QUI",
        percentual: 2,
        termos: ["quilombol*", "quilombo*"],
        cascata: ["indigena", "pretos_pardos"],
      },
      {
        id: "pcd",
        rotulo: "Pessoa com deficiência",
        sigla: "PCD",
        percentual: 5,
        termos: ["pcd*", "deficien*", "pne*"],
        cascata: [],
      },
    ],
  }),
  Object.freeze({
    // Regra do edital 97/2025, que acrescenta a reserva para candidatos trans.
    id: "portaria-5801-trans",
    nome: "Portaria GM/MS 5.801/2024 — 30/5/5/5 e 10% PCD",
    distribuicao: "proporcional",
    cotaMultipla: "maior_percentual",
    categorias: [
      {
        id: "ampla",
        rotulo: "Ampla concorrência",
        sigla: "AC",
        ampla: true,
        termos: ["ampla*", "geral*", "ac", "livre*", "universal*"],
      },
      {
        id: "pretos_pardos",
        rotulo: "Pretos e pardos",
        sigla: "PP",
        percentual: 30,
        termos: ["preto*", "pardo*", "negro*", "negra*", "afro*", "pp"],
        cascata: [],
      },
      {
        id: "indigena",
        rotulo: "Indígena",
        sigla: "IND",
        percentual: 5,
        termos: ["indigena*", "indio*"],
        cascata: ["quilombola", "pretos_pardos"],
      },
      {
        id: "quilombola",
        rotulo: "Quilombola",
        sigla: "QUI",
        percentual: 5,
        termos: ["quilombol*", "quilombo*"],
        cascata: ["indigena", "pretos_pardos"],
      },
      {
        id: "trans",
        rotulo: "Pessoa trans",
        sigla: "TR",
        percentual: 5,
        termos: ["trans*", "travesti*", "transexual*"],
        cascata: [],
      },
      {
        id: "pcd",
        rotulo: "Pessoa com deficiência",
        sigla: "PCD",
        percentual: 10,
        termos: ["pcd*", "deficien*", "pne*"],
        cascata: [],
      },
    ],
  }),
  Object.freeze({
    /*
      Edital da FGV. Mesmos percentuais da Lei 15.142/2025, mas com dois
      detalhes que nenhum outro tem juntos:

        6.4 — o PCD arredonda SEMPRE para cima (Decreto 9.508, §3), enquanto as
              cotas raciais seguem a regra dos 0,5 (7.1.1);
        6.5 — só há reserva de PCD em cargo com CINCO ou mais vagas, e
        7.1.3 — só há reserva racial em cargo com DUAS ou mais.

      É o edital que obrigou o mínimo a ser por categoria: numa vaga de três,
      a reserva racial vale e a de PCD não.

      Sem cascata: o 7.13 manda a reserva vazia direto para a ampla.
    */
    id: "fgv-minimos-por-cargo",
    nome: "FGV — 25/3/2 e 5% PCD, com mínimos por cargo",
    distribuicao: "proporcional",
    cotaMultipla: "maior_percentual",
    categorias: [
      {
        id: "ampla",
        rotulo: "Ampla concorrência",
        sigla: "AC",
        ampla: true,
        termos: ["ampla*", "geral*", "ac", "livre*", "universal*"],
      },
      {
        id: "pretos_pardos",
        rotulo: "Pessoas negras",
        sigla: "PP",
        percentual: 25,
        minimo: 2,
        termos: ["preto*", "pardo*", "negro*", "negra*", "afro*", "pp"],
        cascata: [],
      },
      {
        id: "indigena",
        rotulo: "Indígena",
        sigla: "IND",
        percentual: 3,
        minimo: 2,
        termos: ["indigena*", "indio*"],
        cascata: [],
      },
      {
        id: "quilombola",
        rotulo: "Quilombola",
        sigla: "QUI",
        percentual: 2,
        minimo: 2,
        termos: ["quilombol*", "quilombo*"],
        cascata: [],
      },
      {
        id: "pcd",
        rotulo: "Pessoa com deficiência",
        sigla: "PCD",
        percentual: 5,
        minimo: 5,
        arredondamento: "sempre_acima",
        termos: ["pcd*", "deficien*", "pne*"],
        cascata: [],
      },
    ],
  }),
  Object.freeze({
    /*
      Reserva ÚNICA de 30%, sem dividir entre as cotas: é o que fazem o 65/2025
      (DSEI Mato Grosso do Sul), o 05/2026 (MFC) e o 63/2025. A Lei 15.142/2025
      é a mesma dos outros, mas estes editais não publicam a repartição 25/3/2 —
      abrem uma lista única e chamam por ela.

      O 65/2025 inclui indígenas na reserva; o 05/2026 e o 63/2025 falam só de
      pretos, pardos e quilombolas. Para esses dois, basta apagar o termo
      `indigena*` da categoria. Deixá-lo por omissão é o lado seguro: se ninguém
      se declarou indígena naquele edital, o termo não acende nada.
    */
    id: "lei-15142-reserva-unica",
    nome: "Lei 15.142/2025 — reserva única de 30% e 5% PCD",
    distribuicao: "proporcional",
    cotaMultipla: "maior_percentual",
    categorias: [
      {
        id: "ampla",
        rotulo: "Ampla concorrência",
        sigla: "AC",
        ampla: true,
        termos: ["ampla*", "geral*", "ac", "livre*", "universal*"],
      },
      {
        id: "ppiq",
        rotulo: "Pretos, pardos, quilombolas e indígenas",
        sigla: "PPIQ",
        percentual: 30,
        termos: [
          "preto*",
          "pardo*",
          "negro*",
          "negra*",
          "afro*",
          "quilombol*",
          "quilombo*",
          "indigena*",
          "indio*",
          "ppiq",
          "ppi",
        ],
        cascata: [],
      },
      {
        id: "pcd",
        rotulo: "Pessoa com deficiência",
        sigla: "PCD",
        percentual: 5,
        termos: ["pcd*", "deficien*", "pne*"],
        cascata: [],
      },
    ],
  }),
  Object.freeze({
    /*
      Regra do edital FCC 125: negros e indígenas numa cota só, e as posições
      publicadas no edital em vez de proporcionalidade.
    */
    id: "etnico-racial-posicoes",
    nome: "Grupo étnico-racial por posições — 20% e 5% PCD",
    distribuicao: "posicao_fixa",
    cotaMultipla: "maior_percentual",
    categorias: [
      {
        id: "ampla",
        rotulo: "Ampla concorrência",
        sigla: "AC",
        ampla: true,
        termos: ["ampla*", "geral*", "ac", "livre*", "universal*"],
      },
      {
        id: "etnico_racial",
        rotulo: "Grupo étnico-racial",
        sigla: "ER",
        percentual: 20,
        termos: [
          "preto*",
          "pardo*",
          "negro*",
          "negra*",
          "indigena*",
          "indio*",
          "etnico*",
        ],
        // 3ª, 8ª, 13ª… — o edital lista as duas primeiras e o intervalo de 5.
        posicoes: [3, 8],
        intervalo: 5,
        cascata: [],
      },
      {
        id: "pcd",
        rotulo: "Pessoa com deficiência",
        sigla: "PCD",
        percentual: 5,
        termos: ["pcd*", "deficien*", "pne*"],
        // 5ª, 21ª, 41ª… — a série do edital não é aritmética desde o início.
        posicoes: [5, 21],
        intervalo: 20,
        cascata: [],
      },
    ],
  }),
]);

/**
 * Busca um modelo de referência pelo id.
 *
 * Existe para que nada dependa da POSIÇÃO no catálogo: acrescentar um modelo
 * novo no meio da lista não pode mudar o significado de quem o consome.
 */
export function modeloDeReferencia(id) {
  return MODELOS_DE_REFERENCIA.find((modelo) => modelo.id === id) || null;
}

/** Um modelo em branco, para quem vai montar as regras do zero. */
export function modeloEmBranco() {
  return normalizarModelo({
    nome: "",
    distribuicao: "proporcional",
    cotaMultipla: "maior_percentual",
    categorias: [
      {
        id: "ampla",
        rotulo: "Ampla concorrência",
        sigla: "AC",
        ampla: true,
        termos: ["ampla*", "geral*", "ac"],
      },
    ],
  });
}
