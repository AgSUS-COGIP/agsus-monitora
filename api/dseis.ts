/*
  /api/dseis — os DSEIs (lista, sedes e pontos) e as CASAIs nacionais, lidos
  do SIGEPSI.

  1. só GET;
  2. só para quem está logado no MONITORA: o front manda
     `Authorization: Bearer <token da sessão do Supabase>`, conferido em
     `/auth/v1/user` (o mesmo token que as RPCs usam);
  3. lê a API do SIGEPSI com `SIGEPSI_API_TOKEN`, que nunca sai da função;
  4. responde `{ dseis: { <chave>: { nome, polos, sede } }, casaisNacionais,
     lidoEm }` (`localizacoesPorDsei` e `casaisNacionaisDoSigepsi`,
     src/lib/mapas/mapa-saude-indigena/localizacoes-do-sigepsi.ts).

  A resposta da API fica guardada por CACHE_MS na instância da função: abrir o
  mapa várias vezes não repete o pedido ao SIGEPSI. O cache do navegador é
  privado (a rota exige login; nada vai para o cache compartilhado da Vercel).

  Variáveis na Vercel (Settings › Environment Variables):
    VITE_SUPABASE_URL              já existe (a do app)
    VITE_SUPABASE_PUBLISHABLE_KEY  já existe (a do app)
    SIGEPSI_API_TOKEN              o Bearer da API do SIGEPSI (secreto)
*/

import {
  casaisNacionaisDoSigepsi,
  localizacoesPorDsei,
} from "../src/lib/mapas/mapa-saude-indigena/localizacoes-do-sigepsi.js";
import type {
  CasaiNacionalDoSigepsi,
  LocalizacoesPorDsei,
} from "../src/lib/mapas/mapa-saude-indigena/localizacoes-do-sigepsi.js";
import type { PedidoDaVercel, RespostaDaVercel } from "./_tipos-da-vercel.js";

export const URL_DO_SIGEPSI =
  "https://sigepsi.agenciasus.org.br/api/mapa-dseis/localizacoes/todas";
const ESPERA_MS = 15_000;
export const CACHE_MS = 10 * 60_000;

const variavel = (...nomes: string[]): string =>
  nomes.map((nome) => String(process.env[nome] || "").trim()).find(Boolean) ||
  "";

export function configuracao() {
  const base = variavel("VITE_SUPABASE_URL", "SUPABASE_URL").replace(
    /\/+$/,
    "",
  );
  const publicavel = variavel(
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
  );
  const tokenDoSigepsi = variavel("SIGEPSI_API_TOKEN");
  const faltam = [
    ...(base ? [] : ["VITE_SUPABASE_URL"]),
    ...(publicavel ? [] : ["VITE_SUPABASE_PUBLISHABLE_KEY"]),
    ...(tokenDoSigepsi ? [] : ["SIGEPSI_API_TOKEN"]),
  ];
  return { base, publicavel, tokenDoSigepsi, faltam };
}

let guardado: {
  em: number;
  dseis: LocalizacoesPorDsei;
  casaisNacionais: CasaiNacionalDoSigepsi[];
} | null = null;

/** Só para os testes: esquece a resposta guardada. */
export function esquecerCache() {
  guardado = null;
}

function responder(
  res: RespostaDaVercel,
  status: number,
  corpo: unknown,
): void {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    status < 400 ? "private, max-age=600" : "private, no-store",
  );
  res.end(JSON.stringify(corpo));
}

function tokenDoPedido(req: PedidoDaVercel): string {
  const cabecalho = String(req.headers?.authorization || "");
  const achado = /^Bearer\s+(\S+)$/i.exec(cabecalho);
  return achado ? (achado[1] ?? "") : "";
}

async function sessaoValida(
  base: string,
  publicavel: string,
  token: string,
): Promise<boolean> {
  const resposta = await fetch(`${base}/auth/v1/user`, {
    headers: { apikey: publicavel, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(ESPERA_MS),
  });
  return resposta.ok;
}

export default async function handler(
  req: PedidoDaVercel,
  res: RespostaDaVercel,
): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return responder(res, 405, { erro: "metodo_nao_permitido" });
  }

  const config = configuracao();
  if (config.faltam.length) {
    return responder(res, 500, {
      erro: "configuracao_ausente",
      faltam: config.faltam,
    });
  }

  const token = tokenDoPedido(req);
  try {
    if (!token || !(await sessaoValida(config.base, config.publicavel, token)))
      return responder(res, 401, { erro: "sessao_invalida" });
  } catch (falha) {
    console.error("[api] dseis: sessão", falha);
    return responder(res, 502, { erro: "falha_na_sessao" });
  }

  const agora = Date.now();
  if (guardado && agora - guardado.em < CACHE_MS) {
    return responder(res, 200, {
      dseis: guardado.dseis,
      casaisNacionais: guardado.casaisNacionais,
      lidoEm: new Date(guardado.em).toISOString(),
    });
  }

  try {
    const resposta = await fetch(URL_DO_SIGEPSI, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.tokenDoSigepsi}`,
      },
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    if (!resposta.ok) {
      // O status ajuda a configurar (401/403 = token do SIGEPSI recusado).
      console.error(`[api] dseis: SIGEPSI ${resposta.status}`);
      return responder(res, 502, {
        erro: "falha_no_sigepsi",
        status_do_sigepsi: resposta.status,
      });
    }
    const linhas: unknown = await resposta.json();
    if (!Array.isArray(linhas)) {
      return responder(res, 502, { erro: "resposta_invalida_do_sigepsi" });
    }
    guardado = {
      em: agora,
      dseis: localizacoesPorDsei(linhas),
      casaisNacionais: casaisNacionaisDoSigepsi(linhas),
    };
    return responder(res, 200, {
      dseis: guardado.dseis,
      casaisNacionais: guardado.casaisNacionais,
      lidoEm: new Date(agora).toISOString(),
    });
  } catch (falha) {
    // A mensagem fica no log da função, não na resposta.
    console.error("[api] dseis: SIGEPSI", falha);
    return responder(res, 502, { erro: "falha_no_sigepsi" });
  }
}
