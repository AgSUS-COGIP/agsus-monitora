import {
  buildAyaSystemPrompt,
  officialSourcesForQuestion,
  sanitizeAyaContext,
} from "../src/modules/aya-knowledge.js";

const MAX_QUESTION_LENGTH = 1200;
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CONTENT = 1200;
const REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_MODEL = "qwen3:8b";

function json(res, status, payload) {
  res
    .status(status)
    .setHeader("Content-Type", "application/json; charset=utf-8");
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
  const baseUrl = String(process.env.VITE_SUPABASE_URL || "").replace(
    /\/$/,
    "",
  );
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

  const bridgeUrl = String(process.env.AYA_LOCAL_BRIDGE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const bridgeKey = String(process.env.AYA_LOCAL_BRIDGE_KEY || "").trim();
  if (!bridgeUrl || !bridgeKey) {
    return json(res, 503, {
      error: "local_ai_not_configured",
      sources: safeSources(question),
    });
  }

  const context = sanitizeAyaContext(req.body?.context || {});
  const section = String(req.body?.section || "").slice(0, 80);
  const title = String(req.body?.title || "").slice(0, 120);
  const history = safeHistory(req.body?.history);
  const model = String(process.env.AYA_LOCAL_MODEL || DEFAULT_MODEL).trim();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${bridgeUrl}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Aya-Bridge-Key": bridgeKey,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: buildAyaSystemPrompt({ section, title, context }),
          },
          ...history,
          { role: "user", content: question },
        ],
        options: {
          temperature: 0.2,
          num_predict: 500,
        },
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json(res, 502, {
        error: String(payload?.error || "local_ai_error"),
        sources: safeSources(question),
      });
    }

    const answer = String(payload?.answer || "").trim();
    if (!answer) {
      return json(res, 502, {
        error: "empty_ai_response",
        sources: safeSources(question),
      });
    }

    return json(res, 200, {
      answer,
      sources: safeSources(question),
      model: String(payload?.model || model),
      provider: "ollama-local",
    });
  } catch (error) {
    return json(res, error?.name === "AbortError" ? 504 : 502, {
      error:
        error?.name === "AbortError"
          ? "local_ai_timeout"
          : "local_ai_unavailable",
      sources: safeSources(question),
    });
  } finally {
    clearTimeout(timeout);
  }
}
