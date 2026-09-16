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

function uniqueTexts(values, limit = 10) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const text = compactText(value);
    const key = text.toLocaleLowerCase("pt-BR");
    if (!text || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

export function collectAyaPageContext(doc = document) {
  const dseis = uniqueTexts(
    Array.from(doc.querySelectorAll(".health-map-unit")).map((item) => {
      const name = item.querySelector("strong")?.textContent || "";
      const detail = item.querySelector("small")?.textContent || "";
      return [name, detail].filter(Boolean).join(" — ");
    }),
    12,
  );

  const editais = uniqueTexts(
    Array.from(
      doc.querySelectorAll(
        "#monitorRows tr, #nucleoTableBody tr, #nucleoRows tr, .nucleo-table tbody tr",
      ),
    ).map((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      return cells
        .slice(0, 4)
        .map((cell) => compactText(cell.textContent, 100))
        .filter(Boolean)
        .join(" — ");
    }),
    12,
  );

  return {
    pathname: doc.defaultView?.location?.pathname || "",
    dseis,
    editais,
  };
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
  const client = getSupabaseClient();
  if (!client) {
    return {
      answer: "",
      sources: officialSourcesForQuestion(question),
      unavailable: true,
    };
  }

  let session;
  try {
    session = await exigirSessao(client);
  } catch {
    return {
      answer: "",
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
        context: collectAyaPageContext(doc),
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.answer) {
      return {
        answer: "",
        sources:
          Array.isArray(payload?.sources) && payload.sources.length
            ? payload.sources
            : officialSourcesForQuestion(question),
        unavailable: true,
      };
    }

    return {
      answer: String(payload.answer).trim(),
      sources: Array.isArray(payload.sources) ? payload.sources : [],
      unavailable: false,
    };
  } catch {
    return {
      answer: "",
      sources: officialSourcesForQuestion(question),
      unavailable: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}
