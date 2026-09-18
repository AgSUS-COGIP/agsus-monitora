import { getSupabaseClient } from "../lib/supabaseClient.js";
import { exigirSessao } from "../lib/sessao.js";
import {
  curatedAnswerForQuestion,
  officialSourcesForQuestion,
  questionNeedsAyaAi,
} from "./aya-knowledge.js";

const AI_TIMEOUT_MS = 25000;

function compactText(value, maxLength = 180) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function uniqueTexts(values, limit = 10, maxLength = 180) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const text = compactText(value, maxLength);
    const key = text.toLocaleLowerCase("pt-BR");
    if (!text || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function textOf(doc, selector, maxLength = 240) {
  return compactText(doc.querySelector(selector)?.textContent, maxLength);
}

function visibleTextList(doc, selector, limit = 10, maxLength = 220) {
  return uniqueTexts(
    Array.from(doc.querySelectorAll(selector))
      .filter((item) => !item.hidden)
      .map((item) => item.textContent),
    limit,
    maxLength,
  );
}

function normalizeQuestion(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function collectAyaPageContext(doc = document) {
  const territories = uniqueTexts(
    Array.from(doc.querySelectorAll(".health-map-unit[data-dsei]")).map(
      (item) => {
        const name = item.querySelector("strong")?.textContent || "";
        const detail = item.querySelector("small")?.textContent || "";
        const population =
          item.querySelector(".health-map-unit__type")?.textContent || "";
        return [name, detail, population ? `população ${population}` : ""]
          .filter(Boolean)
          .join(" — ");
      },
    ),
    34,
    240,
  );

  const dseis = territories.length
    ? territories
    : uniqueTexts(
        Array.from(doc.querySelectorAll(".health-map-unit")).map((item) => {
          const name = item.querySelector("strong")?.textContent || "";
          const detail = item.querySelector("small")?.textContent || "";
          return [name, detail].filter(Boolean).join(" — ");
        }),
        20,
        220,
      );

  const editais = uniqueTexts(
    Array.from(
      doc.querySelectorAll(
        "#monitorRows tr, #nucleoTableBody tr, #nucleoRows tr, .nucleo-table tbody tr",
      ),
    ).map((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      return cells
        .slice(0, 5)
        .map((cell) => compactText(cell.textContent, 100))
        .filter(Boolean)
        .join(" — ");
    }),
    12,
    400,
  );

  const kpis = visibleTextList(
    doc,
    ".kpis.kpis-main .kpi, [data-health-kpi], .health-reference-kpi",
    12,
    180,
  );

  const activeFilters = uniqueTexts(
    [
      textOf(doc, "#activeFiltersBar", 500),
      ...visibleTextList(
        doc,
        ".active-filters-bar .pill, .filter-chip",
        12,
        120,
      ),
    ],
    12,
    180,
  );

  return {
    pathname: doc.defaultView?.location?.pathname || "",
    pageTitle: compactText(doc.title, 160),
    mapSummary: textOf(doc, "#masterMapCount", 120),
    activeFilters,
    search: compactText(doc.querySelector("#tableSearch")?.value, 120),
    kpis,
    territories,
    dseis,
    editais,
  };
}

function countDseisFromContext(context) {
  if (Array.isArray(context?.territories) && context.territories.length) {
    return context.territories.length;
  }
  const summary = String(context?.mapSummary || "");
  const explicitDsei = summary.match(/\b(\d{1,3})\s*DSEI/i);
  if (explicitDsei) return Number(explicitDsei[1]);
  const match = summary.match(/\b(\d{1,3})\b/);
  return match ? Number(match[1]) : null;
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

const FAILURE_MESSAGES = {
  sem_conexao:
    "A conexão com o Supabase não está configurada nesta instalação, então não consigo autenticar a pergunta antes de consultar a IA.",
  sessao_expirada:
    "Sua sessão expirou. Entre novamente no MONITORA para que eu possa consultar a IA.",
  unauthorized:
    "A IA recusou a pergunta porque a sessão não foi aceita. Entre novamente no MONITORA.",
  auth_unavailable:
    "Não consegui validar sua sessão no Supabase agora, então a pergunta não chegou à IA.",
  auth_not_configured:
    "A validação de sessão do servidor está mal configurada: a chave do Supabase usada pelo MONITORA não foi aceita. Isso é configuração do ambiente, não da sua conta — entrar novamente não resolve.",
  local_ai_not_configured:
    "A IA local ainda não está configurada no ambiente do MONITORA: faltam AYA_LOCAL_BRIDGE_URL e AYA_LOCAL_BRIDGE_KEY.",
  local_ai_key_mismatch:
    "A chave AYA_LOCAL_BRIDGE_KEY configurada no MONITORA não confere com a do computador que hospeda a IA. É configuração do ambiente, não da sua conta — entrar novamente não resolve.",
  local_ai_offline:
    "O computador que hospeda a IA local está sem dar sinal há um tempo. Provavelmente foi desligado ou reiniciado e o serviço da Aya não subiu de volta.",
  local_ai_unavailable:
    "O computador que hospeda a IA local não respondeu. Verifique se o Ollama, o bridge e o túnel HTTPS estão no ar e se a URL do túnel continua válida.",
  local_ai_timeout:
    "A IA local demorou mais do que o limite do servidor do MONITORA para responder.",
  local_ai_error:
    "A IA local respondeu com erro. Verifique o modelo configurado em AYA_LOCAL_MODEL.",
  empty_ai_response: "A IA local respondeu vazio.",
  invalid_question:
    "A pergunta ficou fora do tamanho aceito. Tente reescrevê-la de forma mais curta.",
  timeout:
    "A IA demorou mais de 25 segundos e a pergunta foi cancelada pelo navegador.",
  network_error:
    "Não consegui falar com o servidor do MONITORA para enviar a pergunta à IA.",
  http_404:
    "O endereço /api/aya não existe neste ambiente. Ele é publicado apenas na implantação Vercel, não no servidor Laravel.",
};

const GENERIC_FAILURE = "A IA da Aya está temporariamente indisponível.";

const COMPLEMENTO_LOCAL =
  "Posso responder ao que estiver carregado nesta tela, mas não vou inventar uma resposta para o que depende da IA.";

/*
  O servidor já sabe por que a autenticação falhou — o Supabase distingue token
  expirado de assinatura inválida —, mas essa razão morria no JSON da resposta.
  Sem ela na tela, cada diagnóstico exigia um deploy só para enxergar. A nota
  fecha a mensagem, depois da orientação ao usuário.
*/
function notaTecnica(detalhe) {
  const tecnico = String(detalhe || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return tecnico ? `\n\nDetalhe técnico: ${tecnico}` : "";
}

export function ayaFailureMessage(reason, detalhe) {
  const base = FAILURE_MESSAGES[String(reason || "")] || GENERIC_FAILURE;
  return `${base}${notaTecnica(detalhe)}`;
}

function unavailableAnswer(question, context, reason, detalhe) {
  const local =
    curatedAnswerForQuestion(question) ||
    contextualAyaAnswer(question, context);
  if (local) return local;
  const base = FAILURE_MESSAGES[String(reason || "")] || GENERIC_FAILURE;
  return `${base} ${COMPLEMENTO_LOCAL}${notaTecnica(detalhe)}`;
}

export function shouldAskAyaAi(question, localMatched = false) {
  return questionNeedsAyaAi(question, localMatched);
}

export async function askAyaAi({
  question,
  section,
  title,
  history = [],
  doc = document,
} = {}) {
  const context = collectAyaPageContext(doc);
  const curated = curatedAnswerForQuestion(question);
  if (curated) {
    return {
      answer: curated,
      sources: officialSourcesForQuestion(question),
      unavailable: false,
      provider: "curated-official",
    };
  }

  const contextual = contextualAyaAnswer(question, context);
  if (contextual) {
    return {
      answer: contextual,
      sources: officialSourcesForQuestion(question),
      unavailable: false,
      provider: "monitora-local-context",
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      answer: unavailableAnswer(question, context, "sem_conexao"),
      sources: officialSourcesForQuestion(question),
      unavailable: true,
      error: "sem_conexao",
    };
  }

  let session;
  try {
    session = await exigirSessao(client);
  } catch {
    return {
      answer: unavailableAnswer(question, context, "sessao_expirada"),
      sources: officialSourcesForQuestion(question),
      unavailable: true,
      error: "sessao_expirada",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch("/api/aya", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        section,
        title,
        history: history.slice(-8),
        context,
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.answer) {
      const reason = String(payload?.error || `http_${response.status}`);
      return {
        answer: unavailableAnswer(question, context, reason, payload?.detail),
        sources:
          Array.isArray(payload?.sources) && payload.sources.length
            ? payload.sources
            : officialSourcesForQuestion(question),
        unavailable: true,
        error: reason,
      };
    }

    return {
      answer: String(payload.answer).trim(),
      sources: Array.isArray(payload.sources) ? payload.sources : [],
      unavailable: false,
    };
  } catch (error) {
    const reason = error?.name === "AbortError" ? "timeout" : "network_error";
    return {
      answer: unavailableAnswer(question, context, reason),
      sources: officialSourcesForQuestion(question),
      unavailable: true,
      error: reason,
    };
  } finally {
    clearTimeout(timeout);
  }
}
