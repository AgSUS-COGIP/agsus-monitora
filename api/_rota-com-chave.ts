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
import type {
  PedidoDaVercel,
  QueryDaVercel,
  RespostaDaVercel,
} from "./_tipos-da-vercel.js";

const ESPERA_MS = 15_000;

/** Uma rota: a RPC que ela lê e como a resposta é montada a partir dela. */
export type RotaComChave = {
  rpc: string;
  montar: (payload: unknown, query: QueryDaVercel | undefined) => unknown;
};

const variavel = (...nomes: string[]): string =>
  nomes.map((nome) => String(process.env[nome] || "").trim()).find(Boolean) ||
  "";

/*
  As três variáveis, aparadas (um espaço ou quebra de linha colada junto na
  Vercel não conta). `faltam` lista só os NOMES das ausentes, para o 500 dizer
  o que configurar; valor nenhum sai na resposta.
*/
export function configuracao(): {
  base: string;
  servidor: string;
  chaveDaApi: string;
  faltam: string[];
} {
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

function tokenDoPedido(req: PedidoDaVercel): string {
  const cabecalho = String(req.headers?.authorization || "");
  const achado = /^Bearer\s+(\S+)$/i.exec(cabecalho);
  return achado ? (achado[1] ?? "") : "";
}

/* Compara pelo hash, em tempo constante (o tamanho da chave não vaza). */
function mesmaChave(recebida: string, esperada: string): boolean {
  const a = createHash("sha256").update(recebida).digest();
  const b = createHash("sha256").update(esperada).digest();
  return timingSafeEqual(a, b);
}

function responder(
  res: RespostaDaVercel,
  status: number,
  corpo: unknown,
): void {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(corpo));
}

/* O `code` do erro do PostgREST, quando vier como texto. */
function codigoDoErro(erro: unknown): string | null {
  return typeof erro === "object" &&
    erro !== null &&
    "code" in erro &&
    typeof erro.code === "string"
    ? erro.code
    : null;
}

/* A falha do `AbortSignal.timeout` chega com o nome "TimeoutError". */
function esgotouOTempo(falha: unknown): boolean {
  return (
    typeof falha === "object" &&
    falha !== null &&
    "name" in falha &&
    falha.name === "TimeoutError"
  );
}

/** A função da Vercel de uma rota: lê `rpc` e responde `montar(payload, query)`. */
export function criarRotaComChave({
  rpc,
  montar,
}: RotaComChave): (
  req: PedidoDaVercel,
  res: RespostaDaVercel,
) => Promise<void> {
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
        /*
          O 502 diz o status HTTP do banco e o código do erro (ex.: 401 do
          PostgREST = chave de servidor recusada; 42501 = sem permissão;
          PGRST202 = função ausente). A mensagem inteira vai só para o log
          da função na Vercel.
        */
        const erro: unknown = await resposta.json().catch(() => null);
        console.error(`[api] ${rpc}: ${resposta.status}`, erro);
        responder(res, 502, {
          erro: "falha_na_leitura",
          status_do_banco: resposta.status,
          codigo: codigoDoErro(erro),
        });
        return;
      }
      const payload: unknown = await resposta.json();
      responder(res, 200, montar(payload, req.query));
    } catch (falha) {
      console.error(`[api] ${rpc}:`, falha);
      responder(res, 502, {
        erro: "falha_na_leitura",
        status_do_banco: null,
        codigo: esgotouOTempo(falha) ? "tempo_esgotado" : null,
      });
    }
  };
}
