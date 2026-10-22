/*
  Intenções de conversa da Aya: saudação, ajuda, agradecimento e despedida.
  Não precisam de verbete. A busca (src/lib/busca-da-aya.js) consulta isto
  antes da base: mensagem que é só conversa recebe a resposta de conversa;
  com pergunta junto ("bom dia, como dar acesso?"), a pergunta vai para a base
  e a saudação abre a resposta ("Bom dia! …").
*/
import { normalizar } from "./termos-da-aya.js";

const SAUDACOES = [
  ["bom dia", "Bom dia!"],
  ["boa tarde", "Boa tarde!"],
  ["boa noite", "Boa noite!"],
  ["oi", "Oi!"],
  ["oie", "Oi!"],
  ["oii+", "Oi!"],
  ["ola", "Olá!"],
  ["opa", "Olá!"],
  ["e ai", "Olá!"],
  ["eai", "Olá!"],
  ["hello", "Olá!"],
  ["hey", "Olá!"],
  ["tudo bem", "Olá!"],
  ["tudo bom", "Olá!"],
  ["como vai", "Olá!"],
];

/*
  `tirar`: a expressão sai da pergunta que vai para a base. As de ajuda ficam,
  porque "como funciona o processo seletivo?" é pergunta, não pedido de ajuda.
*/
const INTENCOES = [
  {
    nome: "ajuda",
    tirar: false,
    expressoes: [
      "preciso de ajuda",
      "me ajuda",
      "me ajude",
      "pode me ajudar",
      "ajuda",
      "ajude",
      "socorro",
      "help",
      "o que voce faz",
      "o que voce sabe fazer",
      "o que voce sabe",
      "o que voce consegue fazer",
      "o que voce pode fazer",
      "o que (eu )?posso perguntar",
      "o que (eu )?posso te perguntar",
      "como funciona",
      "como voce funciona",
      "como (eu )?te uso",
      "como (eu )?uso (a )?aya",
      "como usar (a )?aya",
      "como usar",
      "comandos",
      "menu de ajuda",
    ],
  },
  {
    nome: "agradecimento",
    tirar: true,
    expressoes: [
      "muito obrigad[oa]",
      "obrigad[oa]",
      "brigad[oa]",
      "obg",
      "valeu",
      "vlw",
      "agradeco",
      "grat[oa]",
    ],
  },
  {
    nome: "despedida",
    tirar: true,
    expressoes: [
      "tchau",
      "ate mais",
      "ate logo",
      "ate amanha",
      "ate a proxima",
      "falou",
      "adeus",
      "bye",
    ],
  },
];

// Palavras que sobram sem mudar o sentido ("ok, obrigado Aya").
const ENCHIMENTO = new Set(
  "aya por favor pfv ok beleza show perfeito otimo legal".split(" "),
);
// Sozinhas, também não são pergunta ("e então, tudo bem?").
const LIGACOES = new Set("a o e entao bem certo".split(" "));

function tirarExpressao(texto, expressao) {
  const padrao = new RegExp(`(^| )${expressao}(?= |$)`, "g");
  return padrao.test(texto)
    ? {
        achou: true,
        resto: texto.replace(padrao, " ").replace(/\s+/g, " ").trim(),
      }
    : { achou: false, resto: texto };
}

const semEnchimento = (texto, tambem = new Set()) =>
  texto
    .split(" ")
    .filter((p) => p && !ENCHIMENTO.has(p) && !tambem.has(p))
    .join(" ");

/**
 * A conversa contida na mensagem: `{ intencao, saudacao, resto, pergunta }`.
 *
 * - `intencao`: "saudacao", "ajuda", "agradecimento", "despedida" ou "";
 * - `saudacao`: a frase que abre a resposta ("Bom dia!"), ou "";
 * - `resto`: o que sobra além da conversa; vazio quer dizer que a mensagem é
 *   só conversa;
 * - `pergunta`: o texto (normalizado) que segue para a base, sem a saudação,
 *   o agradecimento e a despedida.
 */
export function intencaoDeConversa(mensagem) {
  let texto = normalizar(mensagem);
  let saudacao = "";
  for (const [expressao, frase] of SAUDACOES) {
    const { achou, resto } = tirarExpressao(texto, expressao);
    if (achou) {
      if (!saudacao) saudacao = frase;
      texto = resto;
    }
  }
  let intencao = "";
  let pergunta = texto;
  for (const { nome, tirar, expressoes } of INTENCOES) {
    for (const expressao of expressoes) {
      const { achou, resto } = tirarExpressao(texto, expressao);
      if (!achou) continue;
      if (!intencao) intencao = nome;
      texto = resto;
      if (tirar) pergunta = tirarExpressao(pergunta, expressao).resto;
    }
  }
  if (!intencao && saudacao) intencao = "saudacao";
  return {
    intencao,
    saudacao,
    resto: semEnchimento(texto, LIGACOES),
    pergunta: semEnchimento(pergunta),
  };
}

export const O_QUE_A_AYA_FAZ =
  "editais, cronogramas, análises, recursos, entrevistas, aprovados, seleção, mapas e acessos";

/** O texto da resposta de conversa; `intro` é a apresentação da página aberta. */
export function textoDaConversa({ intencao, saudacao = "", intro = "" }) {
  const comIntro = (texto) => (intro ? `${texto} ${intro}` : texto);
  if (intencao === "ajuda")
    return comIntro(
      `Sou a Aya, assistente do MONITORA. Explico as telas e as regras de ${O_QUE_A_AYA_FAZ}, olhando a página em que você está; também mostro a tela com um tour e, quando eu não resolver, abro um chamado ao suporte.`,
    );
  if (intencao === "agradecimento")
    return "De nada! Se surgir outra dúvida, é só perguntar. Talvez isto ajude:";
  if (intencao === "despedida")
    return "Até mais! Quando precisar, estou aqui no canto da tela.";
  return comIntro(
    saudacao
      ? `${saudacao} Sou a Aya, assistente do MONITORA.`
      : "Olá, sou a Aya, assistente do MONITORA.",
  );
}
