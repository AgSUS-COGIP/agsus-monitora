/* Respostas sobre os dados fornecidos pela tela e referências da conversa. */
function normalizeQuestion(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countDseisFromContext(context) {
  if (Array.isArray(context?.territories) && context.territories.length) {
    const dseis = context.territories.filter((nome) =>
      /^DSEI\b/i.test(String(nome)),
    );
    if (dseis.length) return dseis.length;
  }
  const summary = String(context?.mapSummary || "");
  const explicitDsei = summary.match(/\b(\d{1,3})\s*DSEI/i);
  if (explicitDsei) return Number(explicitDsei[1]);
  return null;
}

export function contextualAyaAnswer(question, context = {}) {
  const cleanQuestion = String(question || "");
  const normalized = normalizeQuestion(cleanQuestion);
  const asksIdentity =
    /\bqual(?: e)? (?:o )?seu nome\b/.test(normalized) ||
    /\bcomo voce se chama\b/.test(normalized) ||
    /\bquem e voce\b/.test(normalized) ||
    /\bquem voce e\b/.test(normalized);

  if (asksIdentity) {
    return "Eu sou a Aya, assistente do MONITORA da AgSUS.";
  }

  const asksDseiCount =
    /\bquant(?:o|os)\b[\s\S]{0,40}\b(?:dsei|dseis)\b/i.test(cleanQuestion) ||
    /\b(?:quantidade|numero|número)\b[\s\S]{0,40}\b(?:dsei|dseis)\b/i.test(
      cleanQuestion,
    ) ||
    /\b(?:dsei|dseis)\b[\s\S]{0,40}\bquant(?:o|os)\b/i.test(cleanQuestion);

  if (asksDseiCount) {
    const count = countDseisFromContext(context);
    if (Number.isFinite(count)) {
      const filterNote = context.activeFilters?.length
        ? " no recorte dos filtros ativos"
        : " na visão atual do mapa";
      return `O MONITORA está mostrando ${count} DSEI${count === 1 ? "" : "s"}${filterNote}.`;
    }
  }

  const asksFilters = /\b(?:filtro|filtros|recorte)\b/i.test(cleanQuestion);
  if (asksFilters && context.activeFilters?.length) {
    return `Os filtros ativos agora são: ${context.activeFilters.join("; ")}.`;
  }

  return "";
}

/*
  "Diga mais sobre esse DSEI" não diz qual, e a busca por conhecimento só
  enxergava a pergunta atual. O usuário recebia a definição genérica logo depois
  de ter nomeado o distrito, e repetir a pergunta não adiantava.

  A referência é resolvida juntando a última pergunta do usuário à atual, e só
  quando a atual é anafórica de fato. Fazer isso sempre arrastaria o assunto
  anterior para perguntas que já têm assunto próprio: depois de falar de
  Alagoas, "o que é CASAI?" voltaria a falar de Alagoas.
*/
const REFERENCIA_VAGA =
  /\b(?:esse|essa|este|esta|desse|dessa|deste|desta|nele|nela|dele|dela|isso|disso|o mesmo|a mesma)\b/i;

export function resolverReferencia(question, history = []) {
  const atual = String(question || "");
  if (!REFERENCIA_VAGA.test(atual)) return atual;

  const anterior = [...history]
    .reverse()
    .find((item) => item?.role === "user" && String(item.content || "").trim());
  if (!anterior) return atual;

  return `${String(anterior.content).slice(0, 300)} ${atual}`;
}
