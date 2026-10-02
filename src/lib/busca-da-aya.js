/* Busca determinística: só devolve respostas escritas na base, sem rede. */
import { VERBETES_AYA } from "../modules/aya-conhecimento-gerado.js";
import {
  curatedAnswerForQuestion,
  acaoDaResposta,
  officialSourcesForQuestion,
} from "../modules/aya-knowledge.js";
import { paginaDaAya } from "./aya-paginas.js";
import { nomeDaArea } from "./menu-lateral.js";
import { contextualAyaAnswer, resolverReferencia } from "./contexto-da-aya.js";

export function normalizarPergunta(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bprocessos? seletivos?\b/g, "edital")
    .replace(/\bcontestacoes?\b|\bcontestacao\b/g, "recurso")
    .replace(/\btriagem\b/g, "analises curriculares")
    .replace(/\bcalendario\b/g, "cronograma")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const IGNORAR = new Set(
  "a o as os um uma uns umas de do da dos das e em no na nos nas por para pelo pela com que se eu voce me meu minha aqui esta esse isso favor gostaria quero saber sobre como qual quais sao funciona funcionam explique explicar pode posso consegue ajuda".split(
    " ",
  ),
);
function palavras(texto) {
  return [
    ...new Set(
      normalizarPergunta(texto)
        .split(" ")
        .filter((p) => p && !IGNORAR.has(p)),
    ),
  ];
}
function distancia(a, b) {
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++)
      atual[j] = Math.min(
        atual[j - 1] + 1,
        anterior[j] + 1,
        anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    anterior = atual;
  }
  return anterior[b.length];
}
function similaridade(a, b) {
  if (a === b || (a.length >= 4 && (a === b + "s" || b === a + "s"))) return 1;
  if (Math.min(a.length, b.length) < 4) return 0;
  const d = distancia(a, b);
  return d <= (Math.min(a.length, b.length) >= 8 ? 2 : 1)
    ? 1 - d / Math.max(a.length, b.length)
    : 0;
}

// Arquivo do verbete associa a regra à tela, mesmo sem botão de navegação.
const PAGINAS_DOS_ARQUIVOS = {
  "visao-geral": "dashboard",
  editais: "nucleo",
  cronograma: "calendario",
  analises: "analises",
  recursos: "recursos",
  entrevistas: "entrevistas",
  aprovados: "approved",
  selecao: "selecao",
  acessos: "config:acessos",
};
function daPagina(verbete, pagina) {
  return (
    verbete.abrir === pagina ||
    Object.entries(PAGINAS_DOS_ARQUIVOS).some(
      ([termo, view]) => pagina === view && verbete.arquivo?.includes(termo),
    )
  );
}

export function buscarNaBase(pergunta, pagina = "", verbetes = VERBETES_AYA) {
  const tokens = palavras(pergunta);
  if (!tokens.length) return [];
  return verbetes
    .filter((v) => v.resposta && v.arquivo !== "06-assuntos-gerais.md")
    .map((verbete) => {
      let melhor = { pontuacao: 0, cobertura: 0 };
      for (const termo of [...verbete.perguntas, verbete.titulo]) {
        const alvo = palavras(termo);
        if (!alvo.length) continue;
        // Cada palavra do alvo pode corresponder a uma só palavra da pergunta.
        const usados = new Set();
        let soma = 0;
        for (const token of tokens) {
          let valor = 0;
          let indice = -1;
          alvo.forEach((p, i) => {
            const s = usados.has(i) ? 0 : similaridade(token, p);
            if (s > valor) {
              valor = s;
              indice = i;
            }
          });
          if (indice >= 0) usados.add(indice);
          soma += valor;
        }
        const cobertura = soma / tokens.length;
        const pontuacao =
          0.78 * cobertura +
          (0.22 * soma) / Math.max(tokens.length, alvo.length);
        if (pontuacao > melhor.pontuacao) melhor = { pontuacao, cobertura };
      }
      return {
        verbete,
        ...melhor,
        pontuacao: melhor.pontuacao + (daPagina(verbete, pagina) ? 0.035 : 0),
      };
    })
    .filter((v) => v.cobertura >= 0.4)
    .sort((a, b) => b.pontuacao - a.pontuacao);
}

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
  const texto = normalizarPergunta(question);
  const sugestoesDaTela = pagina.sugestoes.slice(0, 3);
  const base = { unavailable: false, sources: [], provider: "base-monitora" };
  const foraDoSistema = () => ({
    ...base,
    answer:
      "Sou a Aya, do MONITORA. Ajudo com editais, cronogramas, análises, recursos, entrevistas, aprovados, seleção, mapas e acessos. Essa pergunta foge do que eu sei, mas posso ajudar com estas sugestões:",
    sugestoes: sugestoesDaTela,
  });
  if (
    /^(oi+|ola|bom dia|boa tarde|boa noite|ajuda|help|obrigad[oa]|valeu|o que voce (faz|consegue fazer))[ !?.]*$/.test(
      texto,
    )
  ) {
    return {
      ...base,
      answer: `${/^(obrigad|valeu)/.test(texto) ? "De nada!" : "Olá, sou a Aya, assistente do MONITORA."} ${pagina.intro}`,
      sugestoes: sugestoesDaTela,
    };
  }
  const contextual = contextualAyaAnswer(question, context);
  // Perguntas de contagem e filtros atuais não podem receber uma definição.
  const factual =
    /\b(quantos|quantas|quantidade|numero)\b/.test(texto) &&
    /\b(aqui|tela|aparecem|recorte|vagas|recursos|editais)\b/.test(texto);
  if (
    contextual &&
    (!/^Os filtros ativos/.test(contextual) ||
      /\b(ativos|agora|aqui|aplicados)\b/.test(texto))
  )
    return { ...base, answer: contextual, provider: "monitora-local-context" };
  if (factual)
    return {
      ...base,
      answer:
        "Não encontrei esse número nos dados disponíveis desta tela. Posso explicar os indicadores e filtros ou ajudar você a abrir um chamado.",
      sugestoes: sugestoesDaTela,
      oferecerChamado: true,
    };
  const pergunta = resolverReferencia(question, history);
  const geral =
    /\b(previsao do tempo|tempo hoje|clima|futebol|placar|carro|carros|planta|plantas|medicamento|remedio|fotossintese)\b/.test(
      texto,
    );
  if (geral) return foraDoSistema();
  const direta = curatedAnswerForQuestion(normalizarPergunta(pergunta));
  if (direta)
    return {
      ...base,
      answer: direta,
      provider: "curated-official",
      sources: officialSourcesForQuestion(pergunta),
      acao: acaoDaResposta(direta),
    };
  const resultados = buscarNaBase(pergunta, pagina.chave);
  if (
    !resultados.length &&
    !/\b(monitora|aya|edital|editais|cronograma|analise|analises|recurso|recursos|entrevista|entrevistas|aprovados|selecao|mapa|mapas|acesso|acessos|login|candidato|candidatos|vaga|vagas|tela|sistema|suporte)\b/.test(
      texto,
    )
  )
    return foraDoSistema();
  const primeiro = resultados[0];
  if (
    primeiro &&
    primeiro.cobertura >= 0.86 &&
    primeiro.pontuacao >= 0.83 &&
    (!resultados[1] || primeiro.pontuacao - resultados[1].pontuacao >= 0.06)
  ) {
    return {
      ...base,
      answer: primeiro.verbete.resposta,
      acao: primeiro.verbete.abrir || "",
      sources: officialSourcesForQuestion(primeiro.verbete.titulo),
    };
  }
  const sugestoes = resultados.slice(0, 3).map(({ verbete }) => ({
    rotulo: verbete.titulo,
    pergunta:
      /^(quem|como|quando|onde|por que|de onde|o que|para que|qual)/.test(
        verbete.perguntas[0],
      )
        ? `${verbete.perguntas[0]}?`
        : `O que é ${verbete.perguntas[0]}?`,
  }));
  return {
    ...base,
    answer: "Não encontrei exatamente isso. Você quis dizer…?",
    sugestoes: sugestoes.length ? sugestoes : sugestoesDaTela,
    oferecerChamado: true,
  };
}
