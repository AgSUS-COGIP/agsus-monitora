/*
  Busca determinística da Aya: só devolve respostas escritas na base
  (docs/aya/*.md, compilados em src/modules/aya-conhecimento-gerado.js), sem
  rede e sem gerar texto.

  COMO O VERBETE É PONTUADO

  A pergunta vira termos (src/lib/termos-da-aya.js: stopwords, singular,
  sinônimos em grupo, radical) depois de corrigir a digitação de cada palavra
  que a base não conhece. Cada termo vale pela raridade na base (IDF) e pelo
  lugar em que aparece no verbete: nas `perguntas` (peso 3), no título (2) ou na
  resposta (1). A soma, dividida pelo máximo possível, vai de 0 a 1. Pergunta
  que é exatamente uma das frases das `perguntas` vale 1; frase contida na
  pergunta soma um bônus. Verbetes da página aberta valem 15% a mais, e os da
  área Saúde Indígena, 10% a mais quando é ela a área atual.

  - pontuação ≥ LIMIAR_CONFIANTE, sem empate com o segundo: responde com o
    verbete;
  - entre LIMIAR_INCERTO e LIMIAR_CONFIANTE, ou abaixo disso com termo do
    domínio: "Você quis dizer…?" com até 3 verbetes e a oferta de chamado;
  - abaixo de LIMIAR_INCERTO sem termo do domínio, ou com metade ou mais das
    palavras desconhecidas pela base ("me conta uma piada"): fora do escopo.

  Antes da base vêm a conversa (src/lib/conversa-da-aya.js) e os dados da tela
  (src/lib/contexto-da-aya.js).
*/
import { VERBETES_AYA } from "../modules/aya-conhecimento-gerado.js";
import {
  curatedAnswerForQuestion,
  officialSourcesForQuestion,
} from "../modules/aya-knowledge.js";
import { paginaDaAya } from "./aya-paginas.js";
import { nomeDaArea } from "./menu-lateral.js";
import { contextualAyaAnswer, resolverReferencia } from "./contexto-da-aya.js";
import {
  EXPRESSOES,
  aplicarSinonimos,
  distancia,
  normalizar,
  palavrasDe,
  radical,
  termosDe,
  toleranciaPara,
} from "./termos-da-aya.js";
import { intencaoDeConversa, textoDaConversa } from "./conversa-da-aya.js";

export const LIMIAR_CONFIANTE = 0.6;
export const LIMIAR_INCERTO = 0.3;
const BONUS_DA_PAGINA = 1.15;
const BONUS_DA_AREA = 1.1;
const MAXIMO_DE_SUGESTOES = 3;
const MARGEM_DE_EMPATE = 0.06;

/* ---------- Índice da base ---------- */

/*
  Página de cada arquivo de docs/aya, para o bônus da página aberta. As chaves
  são as de `paginaDaAya` (src/lib/aya-paginas.js): a view do menu ou
  `config:<seção>`.
*/
const PAGINAS_DO_ARQUIVO = Object.freeze({
  "regras-da-visao-geral.md": ["dashboard"],
  "regras-dos-mapas.md": ["dashboard"],
  "regras-do-mapa-saude-indigena.md": ["dashboard"],
  "regras-dos-editais.md": ["nucleo"],
  "regras-do-cronograma.md": ["calendario"],
  "regras-das-analises.md": ["analises"],
  "regras-da-avaliacao-documental.md": ["avaliacao-documental"],
  "regras-dos-recursos.md": ["recursos"],
  "regras-das-entrevistas.md": ["entrevistas"],
  "regras-da-classificacao.md": ["classificacao"],
  "regras-da-lista-de-aprovados.md": ["approved"],
  "regras-da-selecao.md": ["selecao"],
  "regras-das-configuracoes.md": ["config"],
  "regras-dos-acessos.md": ["config:acessos", "config"],
  "regras-dos-modulos-e-abas.md": ["config:modulos", "config"],
  "regras-do-status-das-atualizacoes.md": ["config:cargas", "config"],
});

const ARQUIVOS_DA_SAUDE_INDIGENA = new Set([
  "01-saude-indigena.md",
  "02-dsei-e-rede.md",
  "04-dseis.md",
  "05-politica-e-controle-social.md",
  "regras-do-mapa-saude-indigena.md",
]);

const indices = new WeakMap();

function indexar(verbetes) {
  if (indices.has(verbetes)) return indices.get(verbetes);
  const itens = verbetes
    .filter((verbete) => verbete.resposta && verbete.perguntas?.length)
    .map((verbete) => {
      const frases = verbete.perguntas
        .map((frase) => ({
          literal: palavrasDe(frase).join(" "),
          termos: termosDe(frase),
        }))
        .filter((frase) => frase.termos.length);
      return {
        verbete,
        frases,
        perguntas: new Set(frases.flatMap((frase) => frase.termos)),
        titulo: new Set(termosDe(verbete.titulo)),
        listaDoTitulo: termosDe(verbete.titulo),
        resposta: new Set(termosDe(verbete.resposta)),
      };
    });
  const df = new Map();
  const dominio = new Set();
  for (const item of itens) {
    const todos = new Set([
      ...item.perguntas,
      ...item.titulo,
      ...item.resposta,
    ]);
    for (const termo of todos) df.set(termo, (df.get(termo) || 0) + 1);
    for (const termo of [...item.perguntas, ...item.titulo]) dominio.add(termo);
  }
  // Vocabulário da correção: as palavras (no singular) da base e as dos
  // sinônimos, com a frequência do radical ou do conceito para desempatar.
  const vocabulario = new Map();
  for (const { verbete } of itens) {
    const texto = [...verbete.perguntas, verbete.titulo, verbete.resposta];
    for (const palavra of palavrasDe(texto.join(" ")))
      if (!vocabulario.has(palavra))
        vocabulario.set(palavra, df.get(radical(palavra)) || 1);
  }
  for (const { conceito, termos } of EXPRESSOES) {
    dominio.add(conceito);
    for (const termo of termos) vocabulario.set(termo, df.get(conceito) || 1);
  }
  const indice = { itens, df, dominio, vocabulario, total: itens.length };
  indices.set(verbetes, indice);
  return indice;
}

/*
  A correção recebe a palavra no singular e compara com as palavras da base e
  as dos sinônimos: "recurço" vira "recurso", e "entrevsita" (letras trocadas)
  vira "entrevista", que os sinônimos depois trocam pelo conceito. Palavra
  conhecida, ou cujo radical a base conhece, fica como está.
*/
function corrigir(palavra, indice) {
  if (indice.vocabulario.has(palavra) || indice.df.has(radical(palavra)))
    return palavra;
  const teto = toleranciaPara(palavra);
  if (!teto) return palavra;
  let melhor = null;
  for (const [candidato, frequencia] of indice.vocabulario) {
    if (candidato.length < 3) continue;
    const d = distancia(palavra, candidato, teto);
    if (d > teto) continue;
    // Erro de digitação raramente é na primeira letra.
    const custo = d + (candidato[0] === palavra[0] ? 0 : 0.5);
    if (
      !melhor ||
      custo < melhor.custo ||
      (custo === melhor.custo && frequencia > melhor.frequencia)
    )
      melhor = { candidato, custo, frequencia };
  }
  return melhor && melhor.custo <= teto ? melhor.candidato : palavra;
}

const idf = (indice, termo) =>
  Math.log(1 + indice.total / (1 + (indice.df.get(termo) || 0)));

function daPagina(verbete, pagina) {
  const chave = String(pagina || "");
  if (!chave) return false;
  if (verbete.abrir && verbete.abrir === chave) return true;
  const paginas = PAGINAS_DO_ARQUIVO[verbete.arquivo] || [];
  return (
    paginas.includes(chave) ||
    (chave.startsWith("config") && paginas.includes("config"))
  );
}

const mesmaLista = (a, b) =>
  a.length === b.length && [...a].sort().join(" ") === [...b].sort().join(" ");

/*
  `pergunta`: { literal, lista, termos } — as palavras corrigidas, os termos na
  ordem (com repetição) e o conjunto deles.
*/
function pontuar(item, pergunta, { pagina, area }, indice) {
  const { termos } = pergunta;
  let obtido = 0;
  let maximo = 0;
  for (const termo of termos) {
    const peso = idf(indice, termo);
    maximo += peso * 3;
    if (item.perguntas.has(termo)) obtido += peso * 3;
    else if (item.titulo.has(termo)) obtido += peso * 2;
    else if (item.resposta.has(termo)) obtido += peso;
  }
  /*
    Quanto da frase mais parecida (das perguntas ou do título) a pergunta
    cobre, também pela raridade: "lista" cobre pouco de "lista dos 34 DSEIs" e
    não basta para responder com ela; "prazo" cobre a maior parte de "prazo do
    recurso", porque "recurso" é comum na base.
  */
  let frase = 0;
  for (const alvo of [
    ...item.frases.map((f) => f.termos),
    item.listaDoTitulo,
  ]) {
    const unicos = [...new Set(alvo)];
    const total = unicos.reduce((soma, termo) => soma + idf(indice, termo), 0);
    const coberto = unicos
      .filter((termo) => termos.has(termo))
      .reduce((soma, termo) => soma + idf(indice, termo), 0);
    if (total) frase = Math.max(frase, coberto / total);
  }
  let nota = maximo ? (obtido / maximo) * (0.3 + 0.7 * frase) : 0;

  /*
    A pergunta é exatamente uma das frases: passa do limiar e fica acima de
    qualquer verbete que só a contenha, mesmo com o bônus da página. A mesma
    escrita ("entrevista") vale mais que o mesmo conceito ("banca"); a
    cobertura desempata entre verbetes com a mesma frase curta. "banca da
    entrevista" são dois termos, então não é exatamente "entrevista".
  */
  const frases = item.frases.filter((frase) =>
    frase.termos.every((termo) => termos.has(termo)),
  );
  if (frases.some((frase) => frase.literal === pergunta.literal))
    nota = 3 + nota / 10;
  else if (frases.some((frase) => mesmaLista(frase.termos, pergunta.lista)))
    nota = 2 + nota / 10;
  else if (frases.length) {
    const maior = Math.max(...frases.map((frase) => frase.termos.length));
    nota += 0.15 + 0.05 * Math.min(maior, 3);
  }

  if (daPagina(item.verbete, pagina)) nota *= BONUS_DA_PAGINA;
  if (
    area === "saude-indigena" &&
    ARQUIVOS_DA_SAUDE_INDIGENA.has(item.verbete.arquivo)
  )
    nota *= BONUS_DA_AREA;
  return nota;
}

/**
 * Os verbetes mais próximos da pergunta, do melhor ao pior:
 * `{ termos, dominio, desconhecidos, ranking: [{ verbete, pontuacao, bruta }] }`.
 * `pontuacao` vai de 0 a 1; `bruta` passa de 2 quando a pergunta é uma das frases.
 * `dominio` diz se algum termo é do MONITORA; `desconhecidos` conta os termos
 * que a base não tem nem depois da correção.
 */
export function buscarNaBase(
  pergunta,
  { pagina = "", area = "" } = {},
  verbetes = VERBETES_AYA,
) {
  const indice = indexar(verbetes);
  const palavras = palavrasDe(pergunta).map((palavra) =>
    corrigir(palavra, indice),
  );
  const lista = aplicarSinonimos(palavras);
  const termos = [...new Set(lista)];
  const consulta = {
    literal: palavras.join(" "),
    lista,
    termos: new Set(lista),
  };
  const ranking = termos.length
    ? indice.itens
        .map((item) => ({
          verbete: item.verbete,
          bruta: pontuar(item, consulta, { pagina, area }, indice),
        }))
        .filter((achado) => achado.bruta > 0)
        .sort((a, b) => b.bruta - a.bruta)
        .map(({ verbete, bruta }) => ({
          verbete,
          bruta,
          pontuacao: Math.min(bruta, 1),
        }))
    : [];
  return {
    termos,
    dominio: termos.some((termo) => indice.dominio.has(termo)),
    desconhecidos: termos.filter((termo) => !indice.df.has(termo)).length,
    ranking,
  };
}

/* ---------- Resposta ---------- */

const INTERROGATIVA =
  /^(quem|como|quando|onde|por que|de onde|o que|para que|quais?|quantos?|quantas?|pode|posso) /;

/*
  O botão de um verbete: o título no rótulo e, como pergunta, a primeira frase
  das perguntas que já é interrogativa ("O que é <frase>?" se nenhuma for).
  Clicar nele responde, porque a frase é exatamente uma das do verbete.
*/
function sugestaoDoVerbete(verbete) {
  const frase =
    verbete.perguntas.find((p) => INTERROGATIVA.test(p)) ||
    `o que é ${verbete.perguntas[0]}`;
  return {
    rotulo: verbete.titulo,
    pergunta: `${frase[0].toUpperCase()}${frase.slice(1)}?`,
  };
}

const TEXTO_FORA_DO_ESCOPO =
  "Sou a Aya, do MONITORA. Ajudo com editais, cronogramas, análises, recursos, entrevistas, aprovados, seleção, mapas e acessos. Essa pergunta foge do que eu sei, mas posso ajudar com estas sugestões:";

// Assuntos que a Aya não trata, mesmo que uma palavra coincida com a base.
const FORA_DO_SISTEMA =
  /\b(previsao do tempo|tempo hoje|clima|futebol|placar|carros?|plantas?|medicamentos?|remedios?|fotossintese)\b/;

export function responderAya({
  question = "",
  section = "",
  title = "",
  area = "",
  secao = "",
  history = [],
  context = {},
} = {}) {
  const pagina = paginaDaAya({
    view: section,
    titulo: title,
    area,
    nomeDaArea: nomeDaArea(area),
    secao,
  });
  const sugestoesDaTela = pagina.sugestoes.slice(0, MAXIMO_DE_SUGESTOES);
  const base = { unavailable: false, sources: [], provider: "base-monitora" };

  const conversa = intencaoDeConversa(question);
  if (conversa.intencao && !conversa.resto)
    return {
      ...base,
      provider: "aya-conversa",
      answer: textoDaConversa({ ...conversa, intro: pagina.intro }),
      sugestoes: sugestoesDaTela,
    };

  // "Bom dia, como dar acesso?": a pergunta segue sem a saudação, que abre a resposta.
  const prefixo = conversa.saudacao ? `${conversa.saudacao} ` : "";
  // Sem conversa, a pergunta segue como veio (a resposta direta lê "AL/SE").
  const original = conversa.intencao ? conversa.pergunta : question;
  const texto = normalizar(original);
  const responder = (resposta) => ({
    ...base,
    ...resposta,
    answer: `${prefixo}${resposta.answer}`,
  });
  const foraDoEscopo = () =>
    responder({ answer: TEXTO_FORA_DO_ESCOPO, sugestoes: sugestoesDaTela });

  const contextual = contextualAyaAnswer(original, context);
  // Perguntas de contagem e filtros atuais não podem receber uma definição.
  const factual =
    /\b(quantos|quantas|quantidade|numero)\b/.test(texto) &&
    /\b(aqui|tela|aparecem|recorte|vagas|recursos|editais)\b/.test(texto);
  if (
    contextual &&
    (!/^Os filtros ativos/.test(contextual) ||
      /\b(ativos|agora|aqui|aplicados)\b/.test(texto))
  )
    return responder({
      answer: contextual,
      provider: "monitora-local-context",
    });
  if (factual)
    return responder({
      answer:
        "Não encontrei esse número nos dados disponíveis desta tela. Posso explicar os indicadores e filtros ou ajudar você a abrir um chamado.",
      sugestoes: sugestoesDaTela,
      oferecerChamado: true,
    });
  if (FORA_DO_SISTEMA.test(texto)) return foraDoEscopo();

  const pergunta = resolverReferencia(original, history);
  // Duas perguntas sobre o DSEI Alagoas e Sergipe numa só (aya-knowledge.js).
  const composta = curatedAnswerForQuestion(pergunta);
  if (composta)
    return responder({
      answer: composta,
      provider: "curated-official",
      sources: officialSourcesForQuestion(pergunta),
    });

  const { ranking, dominio, termos, desconhecidos } = buscarNaBase(pergunta, {
    pagina: pagina.chave,
    area,
  });
  const [melhor, segundo] = ranking;
  const pontuacao = melhor?.pontuacao || 0;
  // Empate não vira certeza ("lista" casa com várias listas): a não ser que só
  // o primeiro seja exatamente uma das frases, a diferença tem de ser clara.
  const destacado =
    !segundo ||
    melhor.bruta - segundo.bruta >= MARGEM_DE_EMPATE ||
    (melhor.bruta >= 2 && segundo.bruta < 2);
  if (melhor && pontuacao >= LIMIAR_CONFIANTE && destacado)
    return responder({
      answer: melhor.verbete.resposta,
      acao: melhor.verbete.abrir || "",
      sources: officialSourcesForQuestion(melhor.verbete.titulo),
    });

  // Metade ou mais da pergunta fora da base ("me conta uma piada") não é
  // dúvida sobre o MONITORA, mesmo que uma palavra ("conta") apareça nela.
  const maisDesconhecida = desconhecidos * 2 >= termos.length;
  if (maisDesconhecida || (pontuacao < LIMIAR_INCERTO && !dominio))
    return foraDoEscopo();

  const vistas = new Set();
  const sugestoes = ranking
    .filter((achado) => achado.pontuacao >= LIMIAR_INCERTO / 2)
    .map(({ verbete }) => sugestaoDoVerbete(verbete))
    .filter((s) => !vistas.has(s.pergunta) && vistas.add(s.pergunta))
    .slice(0, MAXIMO_DE_SUGESTOES);
  return responder({
    answer: "Não encontrei exatamente isso. Você quis dizer…?",
    sugestoes: sugestoes.length ? sugestoes : sugestoesDaTela,
    oferecerChamado: true,
  });
}
