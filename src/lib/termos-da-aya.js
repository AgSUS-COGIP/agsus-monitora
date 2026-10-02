/*
  Como uma frase vira termos para a busca da Aya (src/lib/busca-da-aya.js).

  1. normalização: minúsculas, sem acento, pontuação vira espaço;
  2. stopwords do português saem ("o", "de", "como", "qual"…); "não" e "sem"
     ficam, porque mudam o sentido ("não contratados", "sem inscritos");
  3. as palavras ficam no singular ("editais" → "edital");
  4. sinônimos do domínio viram um conceito só ("processo seletivo", "PSS" e
     "edital" são `#edital`; "contestação" é `#recurso`; "banca" é
     `#entrevista`), inclusive expressões de várias palavras;
  5. o resto vira radical: sem plural e sem sufixo comum ("convocação",
     "convocar" e "convocados" viram "convoc").

  Sem DOM e sem estado: a pergunta e os verbetes passam pelas mesmas funções.
*/

export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOPWORDS = new Set(
  `a o as os um uma uns umas de da do das dos d em na no nas nos num numa nuns
  numas por pelo pela pelos pelas para pra pro pras pros com e ou mas nem
  que se ao aos la lo como qual quais quando onde porque pq quanto quanta
  eh sao ser seria foi era esta estao estar esteve tem tenho ter ha havia eu tu
  voce voces vc vcs ele ela eles elas me mim te ti lhe meu minha meus minhas
  seu sua seus suas teu tua isso isto esse essa esses essas este estes estas
  aquele aquela aqui ai ali sobre mais menos muito muita muitos muitas pode
  podem posso podemos consigo consegue fazer faz faco fica ficam funciona
  funcionam ja so tambem sim entao ainda quero queria gostaria saber
  preciso precisa explica explique explicar diga diz dizer fale falar favor pfv
  vou vai algo alguma algum alguns algumas cada todo toda todos todas outro
  outra outros outras significa significado mesmo mesma agora hoje tipo coisa
  coisas certo`.split(/\s+/),
);

const PLURAIS = [
  ["oes", "ao"],
  ["aes", "ao"],
  ["ais", "al"],
  ["eis", "el"],
  ["ns", "m"],
  ["res", "r"],
  ["zes", "z"],
  ["s", ""],
];

/* Sufixos comuns, do mais longo ao mais curto. O radical fica com 3+ letras. */
const SUFIXOS = [
  "amentos",
  "imentos",
  "amento",
  "imento",
  "acoes",
  "icoes",
  "mente",
  "idade",
  "acao",
  "icao",
  "ucao",
  "adora",
  "ador",
  "avel",
  "ivel",
  "ados",
  "adas",
  "idos",
  "idas",
  "ado",
  "ada",
  "ido",
  "ida",
  "ar",
  "er",
  "ir",
  "a",
  "e",
  "o",
];

// Siglas cujo plural a regra geral erraria ("casais" viraria "casal").
const PLURAIS_IRREGULARES = Object.freeze({ casais: "casai", ubsis: "ubsi" });

/** A palavra (já normalizada) sem plural: "editais" → "edital". */
export function singular(palavra) {
  const p = String(palavra || "");
  if (PLURAIS_IRREGULARES[p]) return PLURAIS_IRREGULARES[p];
  if (p.length <= 3 || /^\d+$/.test(p) || p.endsWith("ss")) return p;
  for (const [fim, troca] of PLURAIS) {
    if (p.endsWith(fim) && p.length - fim.length >= 3)
      return p.slice(0, -fim.length) + troca;
  }
  return p;
}

/** O radical: sem plural e sem sufixo comum ("convocados" → "convoc"). */
export function radical(palavra) {
  const p = singular(palavra);
  if (p.length <= 3 || /^\d+$/.test(p)) return p;
  for (const sufixo of SUFIXOS) {
    if (p.endsWith(sufixo) && p.length - sufixo.length >= 3)
      return p.slice(0, -sufixo.length);
  }
  return p;
}

/*
  Cada grupo vira um conceito (`#edital`). As expressões passam pela mesma
  normalização da pergunta, então plural, acento e "de" no meio não importam.
  A comparação é pela palavra no singular, não pelo radical: "aprovado" e
  "aprovação" têm o mesmo radical e não são a mesma coisa. Por isso cada forma
  verbal que importa está escrita ("contestar", "convocado"…).
*/
export const SINONIMOS = Object.freeze({
  edital: [
    "edital",
    "processo seletivo",
    "processo de selecao",
    "pss",
    "certame",
    "chamamento publico",
    "selecao publica",
  ],
  vaga: ["vaga", "cargo", "posto de trabalho"],
  candidato: ["candidato", "candidata", "inscrito", "inscrita", "concorrente"],
  aprovado: [
    "aprovado",
    "aprovada",
    "classificado",
    "classificada",
    "habilitado",
    "habilitada",
  ],
  recurso: [
    "recurso",
    "contestacao",
    "contestar",
    "impugnacao",
    "impugnar",
    "recorrer",
  ],
  entrevista: ["entrevista", "entrevistar", "entrevistador", "banca"],
  analise: [
    "analise curricular",
    "analise de curriculo",
    "analise",
    "triagem",
    "curriculo",
  ],
  acesso: ["acesso", "acessar", "permissao", "login", "logar", "autorizacao"],
  dsei: [
    "dsei",
    "distrito sanitario especial indigena",
    "distrito sanitario",
    "distrito",
  ],
  polo: ["polo base", "polo"],
  ubsi: ["ubsi", "unidade basica de saude indigena", "posto de saude", "posto"],
  casai: ["casai", "casa de saude indigena", "casa de apoio"],
  cronograma: ["cronograma", "calendario"],
  convocacao: ["convocacao", "convocar", "convocado", "convocada"],
  contratacao: ["contratacao", "contratar", "contratado", "admissao"],
  chamado: ["chamado", "suporte", "ticket", "helpdesk"],
  indicador: ["indicador", "kpi", "metrica"],
  parecer: ["parecer juridico", "parecer", "juridico"],
});

/** As palavras de um texto, sem stopwords, no singular. */
export function palavrasDe(texto) {
  return normalizar(texto)
    .split(" ")
    .filter((palavra) => palavra && !STOPWORDS.has(palavra))
    .map(singular);
}

/* As expressões dos sinônimos, no singular, da mais longa à mais curta. */
export const EXPRESSOES = Object.freeze(
  Object.entries(SINONIMOS)
    .flatMap(([conceito, lista]) =>
      lista.map((expressao) => ({
        conceito: `#${conceito}`,
        termos: palavrasDe(expressao),
      })),
    )
    .filter((item) => item.termos.length)
    .sort((a, b) => b.termos.length - a.termos.length),
);

/** Troca as expressões pelos conceitos; o resto vira radical. */
export function aplicarSinonimos(palavras) {
  const saida = [];
  for (let i = 0; i < palavras.length;) {
    const achada = EXPRESSOES.find((item) =>
      item.termos.every((termo, j) => palavras[i + j] === termo),
    );
    if (achada) {
      saida.push(achada.conceito);
      i += achada.termos.length;
    } else {
      saida.push(radical(palavras[i]));
      i += 1;
    }
  }
  return saida;
}

/** Os termos de um texto: sem stopwords, com sinônimos trocados e em radical. */
export function termosDe(texto) {
  return aplicarSinonimos(palavrasDe(texto));
}

/**
 * Distância de edição com transposição (Damerau, versão OSA): "entrevsita"
 * fica a 1 de "entrevista". Passou do `teto`, devolve `teto + 1` sem terminar.
 */
export function distancia(a, b, teto = Infinity) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > teto) return teto + 1;
  const linhas = [];
  for (let i = 0; i <= a.length; i += 1) {
    linhas[i] = [i];
    for (let j = 1; j <= b.length; j += 1) linhas[i][j] = i === 0 ? j : 0;
  }
  for (let i = 1; i <= a.length; i += 1) {
    let menorDaLinha = Infinity;
    for (let j = 1; j <= b.length; j += 1) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      let valor = Math.min(
        linhas[i - 1][j] + 1,
        linhas[i][j - 1] + 1,
        linhas[i - 1][j - 1] + custo,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        valor = Math.min(valor, linhas[i - 2][j - 2] + 1);
      linhas[i][j] = valor;
      menorDaLinha = Math.min(menorDaLinha, valor);
    }
    if (menorDaLinha > teto) return teto + 1;
  }
  return linhas[a.length][b.length];
}

/** Quantos erros a correção aceita: 0 até 3 letras, 1 até 7, 2 a partir de 8. */
export const toleranciaPara = (palavra) =>
  palavra.length >= 8 ? 2 : palavra.length >= 4 ? 1 : 0;
