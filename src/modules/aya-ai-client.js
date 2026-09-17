import { getSupabaseClient } from "../lib/supabaseClient.js";
import { exigirSessao } from "../lib/sessao.js";
import {
  officialSourcesForQuestion,
  questionNeedsAyaAi,
} from "./aya-knowledge.js";

const AI_TIMEOUT_MS = 17000;

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
      ...visibleTextList(doc, ".active-filters-bar .pill, .filter-chip", 12, 120),
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

function countFromMapSummary(context) {
  const match = String(context?.mapSummary || "").match(/\b(\d{1,3})\b/);
  if (match) return Number(match[1]);
  if (Array.isArray(context?.territories) && context.territories.length) {
    return context.territories.length;
  }
  return null;
}

export function contextualAyaAnswer(question, context = {}) {
  const cleanQuestion = String(question || "");
  const asksDseiCount =
    /\bquant(?:o|os|a|as)\b[\s\S]*\b(?:dsei|dseis|territ[oó]rio|territ[oó]rios)\b/i.test(
      cleanQuestion,
    ) ||
    /\b(?:dsei|dseis|territ[oó]rio|territ[oó]rios)\b[\s\S]*\bquant(?:o|os|a|as)\b/i.test(
      cleanQuestion,
    );

  if (asksDseiCount) {
    const count = countFromMapSummary(context);
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

function unavailableAnswer(question, context) {
  return (
    contextualAyaAnswer(question, context) ||
    "A IA da Aya está temporariamente indisponível. Posso responder ao que estiver carregado nesta tela, mas não vou inventar uma resposta genérica para o que depende da IA."
  );
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
  const client = getSupabaseClient();
  if (!client) {
    return {
      answer: unavailableAnswer(question, context),
      sources: officialSourcesForQuestion(question),
      unavailable: true,
    };
  }

  let session;
  try {
    session = await exigirSessao(client);
  } catch {
    return {
      answer: unavailableAnswer(question, context),
      sources: officialSourcesForQuestion(question),
      unavailable: true,
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
      return {
        answer: unavailableAnswer(question, context),
        sources:
          Array.isArray(payload?.sources) && payload.sources.length
            ? payload.sources
            : officialSourcesForQuestion(question),
        unavailable: true,
        error: String(payload?.error || `http_${response.status}`),
      };
    }

    return {
      answer: String(payload.answer).trim(),
      sources: Array.isArray(payload.sources) ? payload.sources : [],
      unavailable: false,
    };
  } catch (error) {
    return {
      answer: unavailableAnswer(question, context),
      sources: officialSourcesForQuestion(question),
      unavailable: true,
      error: error?.name === "AbortError" ? "timeout" : "network_error",
    };
  } finally {
    clearTimeout(timeout);
  }
}
