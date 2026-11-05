/*
  A parte comum das rotas da API para outro sistema (/api/editais,
  /api/aprovados, /api/cronograma): sem login, pela chave fixa.

  O "_" no começo do nome faz a Vercel NÃO publicar este arquivo como rota.

  1. só GET;
  2. confere `Authorization: Bearer <EDITAIS_API_CHAVE>` em tempo constante;
  3. chama a RPC com a chave de servidor do Supabase
     (SUPABASE_SERVICE_ROLE_KEY), que nunca sai da função;
  4. responde JSON sem cache, com o erro em { erro: "<código>" }.

  Variáveis na Vercel (Settings › Environment Variables):
    VITE_SUPABASE_URL           já existe (a do app)
    SUPABASE_SERVICE_ROLE_KEY   chave de servidor do Supabase (secreta)
    EDITAIS_API_CHAVE           a chave entregue ao outro sistema (vale para
                                as três rotas; gere com `openssl rand -hex 32`)
*/

import { createHash, timingSafeEqual } from "node:crypto";

const ESPERA_MS = 15_000;

const variavel = (...nomes) =>
  nomes.map((nome) => String(process.env[nome] || "").trim()).find(Boolean) ||
  "";

/*
  As três variáveis, aparadas (um espaço ou quebra de linha colada junto na
  Vercel não conta). `faltam` lista só os NOMES das ausentes, para o 500 dizer
  o que configurar; valor nenhum sai na resposta.
*/
export function configuracao() {
  const base = variavel("VITE_SUPABASE_URL", "SUPABASE_URL").replace(
    /\/+$/,
    "",
  );
  const servidor = variavel("SUPABASE_SERVICE_ROLE_KEY");
  const chaveDaApi = variavel("EDITAIS_API_CHAVE");
  const faltam = [
    ...(base ? [] : ["VITE_SUPABASE_URL"]),
    ...(servidor ? [] : ["SUPABASE_SERVICE_ROLE_KEY"]),
    ...(chaveDaApi ? [] : ["EDITAIS_API_CHAVE"]),
  ];
  return { base, servidor, chaveDaApi, faltam };
}

function tokenDoPedido(req) {
  const cabecalho = String(req.headers?.authorization || "");
  const achado = /^Bearer\s+(\S+)$/i.exec(cabecalho);
  return achado ? achado[1] : "";
}

/* Compara pelo hash, em tempo constante (o tamanho da chave não vaza). */
function mesmaChave(recebida, esperada) {
  const a = createHash("sha256").update(recebida).digest();
  const b = createHash("sha256").update(esperada).digest();
  return timingSafeEqual(a, b);
}

function responder(res, status, corpo) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(corpo));
}

/**
 * A função da Vercel de uma rota: lê `rpc` e responde `montar(payload, query)`.
 * @param {{ rpc: string, montar: (payload: unknown, query: Record<string, unknown> | undefined) => unknown }} rota
 */
export function criarRotaComChave({ rpc, montar }) {
  return async function handler(req, res) {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      responder(res, 405, { erro: "metodo_nao_permitido" });
      return;
    }

    const config = configuracao();
    if (config.faltam.length) {
      responder(res, 500, {
        erro: "configuracao_ausente",
        faltam: config.faltam,
      });
      return;
    }

    const token = tokenDoPedido(req);
    if (!token || !mesmaChave(token, config.chaveDaApi)) {
      responder(res, 401, { erro: "chave_invalida" });
      return;
    }

    try {
      const resposta = await fetch(`${config.base}/rest/v1/rpc/${rpc}`, {
        method: "POST",
        headers: {
          apikey: config.servidor,
          // A chave antiga (JWT) também vai no Authorization; a nova (sb_secret_…) só no apikey.
          ...(config.servidor.startsWith("eyJ")
            ? { Authorization: `Bearer ${config.servidor}` }
            : {}),
          "Content-Type": "application/json",
        },
        body: "{}",
        signal: AbortSignal.timeout(ESPERA_MS),
      });
      if (!resposta.ok) {
        responder(res, 502, { erro: "falha_na_leitura" });
        return;
      }
      responder(res, 200, montar(await resposta.json(), req.query));
    } catch {
      responder(res, 502, { erro: "falha_na_leitura" });
    }
  };
}
