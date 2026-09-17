import http from "node:http";
import { timingSafeEqual } from "node:crypto";

const HOST = process.env.AYA_BRIDGE_HOST || "127.0.0.1";
const PORT = Number(process.env.AYA_BRIDGE_PORT || 8787);
const OLLAMA_URL = String(
  process.env.OLLAMA_URL || "http://127.0.0.1:11434",
).replace(/\/$/, "");
const BRIDGE_KEY = String(process.env.AYA_LOCAL_BRIDGE_KEY || "");
const MAX_BODY_BYTES = 256 * 1024;
const ALLOWED_MODELS = new Set(
  String(process.env.AYA_ALLOWED_MODELS || "qwen3:1.7b,qwen3:4b,qwen3:8b")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
// Mantém o modelo residente na memória. Sem isso o Ollama o descarrega após
// 5 minutos ocioso e a primeira pergunta seguinte paga ~19s de recarga, acima
// do limite de tempo do navegador.
const KEEP_ALIVE = process.env.AYA_KEEP_ALIVE || -1;
const WARMUP_MODEL = "qwen3:1.7b";

if (!BRIDGE_KEY || BRIDGE_KEY.length < 24) {
  console.error("Defina AYA_LOCAL_BRIDGE_KEY com pelo menos 24 caracteres.");
  process.exit(1);
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function safeKeyEquals(received) {
  const a = Buffer.from(String(received || ""));
  const b = Buffer.from(BRIDGE_KEY);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, { ok: true, provider: "ollama-local" });
  }

  if (req.method !== "POST" || req.url !== "/chat") {
    return send(res, 404, { error: "not_found" });
  }

  if (!safeKeyEquals(req.headers["x-aya-bridge-key"])) {
    return send(res, 401, { error: "unauthorized" });
  }

  try {
    const payload = await readJson(req);
    const model = String(payload?.model || "").trim();
    const messages = Array.isArray(payload?.messages) ? payload.messages : [];
    if (!model || !ALLOWED_MODELS.has(model) || !messages.length) {
      return send(res, 400, { error: "invalid_request" });
    }

    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: messages.slice(-10).map((item) => ({
          role: ["system", "user", "assistant"].includes(item?.role)
            ? item.role
            : "user",
          content: String(item?.content || "").slice(0, 12000),
        })),
        stream: false,
        think: false,
        keep_alive: KEEP_ALIVE,
        options: {
          temperature: Number(payload?.options?.temperature ?? 0.2),
          num_predict: Math.min(
            800,
            Number(payload?.options?.num_predict ?? 140),
          ),
        },
      }),
      signal: AbortSignal.timeout(120000),
    });

    const data = await ollamaResponse.json().catch(() => ({}));
    if (!ollamaResponse.ok) {
      return send(res, 502, {
        error: String(data?.error || "ollama_error"),
      });
    }

    const answer = String(data?.message?.content || "").trim();
    if (!answer) return send(res, 502, { error: "empty_response" });

    return send(res, 200, {
      answer,
      model: String(data?.model || model),
    });
  } catch (error) {
    return send(res, error?.message === "body_too_large" ? 413 : 500, {
      error:
        error?.message === "body_too_large" ? "body_too_large" : "bridge_error",
    });
  }
});

// Carrega o modelo padrão antes da primeira pergunta real. Sem isso a primeira
// pessoa a usar a Aya depois de subir o bridge espera cerca de 39s, contra os
// 12s de uma pergunta com o modelo já residente.
async function aquecerModelo() {
  const model = String(process.env.AYA_LOCAL_MODEL || WARMUP_MODEL).trim();
  if (!ALLOWED_MODELS.has(model)) return;
  const inicio = Date.now();
  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ok" }],
        stream: false,
        think: false,
        keep_alive: KEEP_ALIVE,
        options: { num_predict: 1 },
      }),
      signal: AbortSignal.timeout(180000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(`Modelo ${model} aquecido e residente em ${segundos}s.`);
  } catch (error) {
    console.warn(
      `Não foi possível aquecer ${model}: ${error?.message || error}. A primeira pergunta será mais lenta.`,
    );
  }
}

server.listen(PORT, HOST, () => {
  console.log(`Aya Local Bridge em http://${HOST}:${PORT}`);
  console.log(`Ollama: ${OLLAMA_URL}`);
  console.log(`Modelos permitidos: ${[...ALLOWED_MODELS].join(", ")}`);
  console.log(`keep_alive: ${KEEP_ALIVE}`);
  aquecerModelo();
});
