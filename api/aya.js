import {
  buildAyaSystemPrompt,
  curatedAnswerForQuestion,
  officialSourcesForQuestion,
  sanitizeAyaContext,
} from "../src/modules/aya-knowledge.js";

const MAX_QUESTION_LENGTH = 1200;
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CONTENT = 1200;
// Acima do limite do navegador, para que quem corte primeiro seja o cliente e
// a causa apareça como cancelamento, não como erro do servidor.
const REQUEST_TIMEOUT_MS = 50000;
const DEFAULT_MODEL = "qwen3:1.7b";
// 140 tokens cabem em ~11s de geração no hardware local medido. Com 180 o pior
// caso chega a 19s e estoura o limite de tempo do navegador.
const MAX_ANSWER_TOKENS = 120;

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

// Uma resposta false não dizia se faltava configuração no servidor, se a chave
// do Supabase era inválida ou se o token do usuário tinha expirado. As três
// viravam "unauthorized", e o sistema mandava o usuário entrar de novo mesmo
// quando entrar de novo não resolveria nada.
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

  const missing = [];
  if (!baseUrl) missing.push("VITE_SUPABASE_URL");
  if (!publishableKey) missing.push("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (missing.length) {
    return { status: "auth_not_configured", missing };
  }
  if (!accessToken) return { status: "unauthorized", reason: "sem_token" };

  const response = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: publishableKey,
    },
    signal: AbortSignal.timeout(5000),
  });
  if (response.ok) return { status: "ok" };

  // O Supabase responde 401 tanto para chave inválida quanto para token
  // expirado. Só a mensagem dele separa as duas.
  const body = await response.json().catch(() => ({}));
  const upstreamMessage = String(body?.message || body?.msg || "").slice(
    0,
    120,
  );
  const invalidKey = /api key/i.test(upstreamMessage);
  if (invalidKey) {
    return {
      status: "auth_not_configured",
      upstream: response.status,
      detail: upstreamMessage,
    };
  }
  if (response.status === 401 || response.status === 403) {
    return {
      status: "unauthorized",
      upstream: response.status,
      detail: upstreamMessage,
    };
  }
  return { status: "auth_unavailable", upstream: response.status };
}

/*
  O endereço do bridge é anunciado pelo próprio bridge, porque sem domínio
  próprio o túnel recebe um hostname novo a cada execução. Quando o anúncio não
  estiver disponível — banco fora, segredo ainda não definido, registro nunca
  escrito — vale a variável de ambiente, que é como funcionava antes.
*/
const IDADE_MAXIMA_REGISTRO_S = 30 * 60;

async function bridgeAnunciado(accessToken) {
  const baseUrl = String(process.env.VITE_SUPABASE_URL || "").replace(
    /\/$/,
    "",
  );
  const publishableKey = String(
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      "",
  );
  if (!baseUrl || !publishableKey || !accessToken) return null;

  try {
    const response = await fetch(`${baseUrl}/rest/v1/rpc/obter_bridge_aya`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: "{}",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const dados = await response.json().catch(() => null);
    const url = String(dados?.url || "").trim();
    if (!url) return null;
    const idade = Number(dados?.idade_segundos);
    return {
      url: url.replace(/\/$/, ""),
      idade: Number.isFinite(idade) ? idade : null,
    };
  } catch {
    return null;
  }
}

function safeSources(paraConhecimento) {
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
    const auth = await validateSupabaseSession(token);
    if (auth.status === "auth_not_configured") {
      return json(res, 503, {
        error: "auth_not_configured",
        missing: auth.missing,
        detail: auth.detail,
      });
    }
    if (auth.status === "auth_unavailable") {
      return json(res, 503, { error: "auth_unavailable" });
    }
    if (auth.status !== "ok") {
      return json(res, 401, { error: "unauthorized", detail: auth.detail });
    }
  } catch {
    return json(res, 503, { error: "auth_unavailable" });
  }

  const question = String(req.body?.question || "").trim();
  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return json(res, 400, { error: "invalid_question" });
  }

  /*
    Quando a pergunta é anafórica — "diga mais sobre esse DSEI" —, o cliente
    manda também a versão com a referência resolvida. Ela serve só para escolher
    conhecimento e fontes; o que segue para o modelo continua sendo o que a
    pessoa escreveu.
  */
  const referencia = String(req.body?.referencia || "")
    .trim()
    .slice(0, MAX_QUESTION_LENGTH);
  const paraConhecimento = referencia || question;

  const curated = curatedAnswerForQuestion(paraConhecimento);
  if (curated) {
    return json(res, 200, {
      answer: curated,
      sources: safeSources(paraConhecimento),
      model: "curated-official",
      provider: "curated-official",
    });
  }

  const anunciado = await bridgeAnunciado(token);
  const bridgeUrl =
    anunciado?.url ||
    String(process.env.AYA_LOCAL_BRIDGE_URL || "")
      .trim()
      .replace(/\/$/, "");
  const bridgeKey = String(process.env.AYA_LOCAL_BRIDGE_KEY || "").trim();
  if (!bridgeUrl || !bridgeKey) {
    return json(res, 503, {
      error: "local_ai_not_configured",
      sources: safeSources(paraConhecimento),
    });
  }

  // Registro velho significa que a máquina parou de dar sinal. Dizer isso é
  // mais útil do que tentar o endereço antigo e devolver um erro de rede.
  if (
    anunciado &&
    Number.isFinite(anunciado.idade) &&
    anunciado.idade > IDADE_MAXIMA_REGISTRO_S
  ) {
    return json(res, 503, {
      error: "local_ai_offline",
      minutos_sem_sinal: Math.round(anunciado.idade / 60),
      sources: safeSources(paraConhecimento),
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
            content: buildAyaSystemPrompt({
              section,
              title,
              question: paraConhecimento,
              context,
            }),
          },
          ...history,
          { role: "user", content: question },
        ],
        options: {
          temperature: 0.2,
          num_predict: MAX_ANSWER_TOKENS,
        },
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      /*
        O bridge também responde "unauthorized" — dele, quer dizer chave
        X-Aya-Bridge-Key errada. Repassar esse texto sem traduzir fazia a tela
        mostrar a mensagem de sessão inválida e mandar o usuário entrar de novo,
        para um problema que é de configuração do servidor e que login nenhum
        resolve. Código de terceiro não entra no nosso espaço de nomes.
      */
      const erroDoBridge = String(payload?.error || "");
      const motivo =
        response.status === 401 || erroDoBridge === "unauthorized"
          ? "local_ai_key_mismatch"
          : erroDoBridge || "local_ai_error";
      return json(res, 502, {
        error: motivo,
        sources: safeSources(paraConhecimento),
      });
    }

    const answer = String(payload?.answer || "").trim();
    if (!answer) {
      return json(res, 502, {
        error: "empty_ai_response",
        sources: safeSources(paraConhecimento),
      });
    }

    return json(res, 200, {
      answer,
      sources: safeSources(paraConhecimento),
      model: String(payload?.model || model),
      provider: "ollama-local",
    });
  } catch (error) {
    return json(res, error?.name === "AbortError" ? 504 : 502, {
      error:
        error?.name === "AbortError"
          ? "local_ai_timeout"
          : "local_ai_unavailable",
      sources: safeSources(paraConhecimento),
    });
  } finally {
    clearTimeout(timeout);
  }
}
