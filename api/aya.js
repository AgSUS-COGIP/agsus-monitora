import {
  AYA_SOURCE_CATALOG,
  buildAyaSystemPrompt,
  officialSourcesForQuestion,
  sanitizeAyaContext,
} from "../src/modules/aya-knowledge.js";

const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-5.6-sol";
const MAX_QUESTION_LENGTH = 1200;
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CONTENT = 1200;
const REQUEST_TIMEOUT_MS = 15000;

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(JSON.stringify(payload));
}

function bearerToken(req) {
  const value = String(req.headers.authorization || "");
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

function safeHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];
  return rawHistory
    .filter((item) => item && ["user", "assistant"].includes(item.role))
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item.role,
      content: String(item.content || "").slice(0, MAX_HISTORY_CONTENT),
    }))
    .filter((item) => item.content.trim());
}

async function validateSupabaseSession(accessToken) {
  const baseUrl = String(process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const publishableKey = String(
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      "",
  );
  if (!baseUrl || !publishableKey || !accessToken) return false;

  const response = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: publishableKey,
    },
    signal: AbortSignal.timeout(5000),
  });
  return response.ok;
}

function safeSources(question) {
  return officialSourcesForQuestion(question).map(({ id, label, url }) => ({
    id,
    label,
    url,
  }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "method_not_allowed" });
  }

  const token = bearerToken(req);
  try {
    if (!(await validateSupabaseSession(token))) {
      return json(res, 401, { error: "unauthorized" });
    }
  } catch {
    return json(res, 503, { error: "auth_unavailable" });
  }

  const question = String(req.body?.question || "").trim();
  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return json(res, 400, { error: "invalid_question" });
  }

  const context = sanitizeAyaContext(req.body?.context || {});
  const section = String(req.body?.section || "").slice(0, 80);
  const title = String(req.body?.title || "").slice(0, 120);
  const history = safeHistory(req.body?.history);
  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;

  if (!apiKey) {
    return json(res, 503, {
      error: "ai_not_configured",
      sources: safeSources(question),
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.AYA_AI_MODEL || DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content: buildAyaSystemPrompt({ section, title, context }),
          },
          ...history,
          { role: "user", content: question },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return json(res, 502, {
        error: "ai_gateway_error",
        sources: safeSources(question),
      });
    }

    const payload = await response.json();
    const answer = String(payload?.choices?.[0]?.message?.content || "").trim();
    if (!answer) {
      return json(res, 502, {
        error: "empty_ai_response",
        sources: safeSources(question),
      });
    }

    return json(res, 200, {
      answer,
      sources: safeSources(question),
      model: payload?.model || process.env.AYA_AI_MODEL || DEFAULT_MODEL,
    });
  } catch (error) {
    return json(res, error?.name === "AbortError" ? 504 : 502, {
      error: error?.name === "AbortError" ? "ai_timeout" : "ai_unavailable",
      sources: safeSources(question),
    });
  } finally {
    clearTimeout(timeout);
  }
}
