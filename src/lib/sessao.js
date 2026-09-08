/*
  Fonte única de verdade sobre o estado da sessão.

  A falsa "Sessão expirada" nascia de duas suposições espalhadas pelo código:

  1. Quatro módulos repetiam o mesmo `ensureSession()`: pediam `getSession()` e,
     diante de **qualquer** erro, declaravam a sessão expirada. Mas `getSession()`
     também falha quando a rede cai no meio da renovação do token — situação em
     que a sessão continua válida e só precisa de outra tentativa.

  2. `friendlyError()` decidia por substring: qualquer mensagem contendo "JWT" ou
     "session" virava "Sessão expirada". Basta uma RPC responder
     `Could not find the function public.registrar_evento_acesso(p_client_session_id, …)`
     — que contém "session" — para o sistema anunciar expiração a quem está
     perfeitamente autenticado.

  A correção não é mais uma camada: é parar de adivinhar. A biblioteca já
  distingue os casos (`isAuthRetryableFetchError`, `isAuthSessionMissingError`),
  e passamos a usar essa classificação em vez de ler texto.

  A regra passa a ser: **só afirmar que a sessão acabou quando houver prova.**
  Na dúvida, o estado é `indeterminado` e quem chamou tenta de novo ou avisa
  sobre a conexão — nunca manda a pessoa fazer login outra vez.
*/

import {
  isAuthApiError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
} from "@supabase/supabase-js";

export const SESSAO_ATIVA = "ativa";
export const SESSAO_ENCERRADA = "encerrada";
export const SESSAO_INDETERMINADA = "indeterminada";

/** Erro lançado quando a sessão comprovadamente acabou. */
export class SessaoEncerrada extends Error {
  constructor(mensagem = "Sessão expirada. Faça login novamente.") {
    super(mensagem);
    this.name = "SessaoEncerrada";
    this.sessaoEncerrada = true;
  }
}

/** Erro lançado quando não deu para saber — rede, tempo esgotado, servidor fora. */
export class FalhaDeConexao extends Error {
  constructor(
    mensagem = "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.",
    causa,
  ) {
    super(mensagem);
    this.name = "FalhaDeConexao";
    this.falhaTransitoria = true;
    this.causa = causa;
  }
}

/*
  Falhas de transporte não vêm só do auth-js: `fetch` rejeita com `TypeError`
  ("Failed to fetch") e um `AbortController` rejeita com `AbortError`. Nenhuma
  delas diz nada sobre a sessão.
*/
const NOMES_TRANSITORIOS = new Set([
  "AbortError",
  "TimeoutError",
  "NetworkError",
  "TypeError",
]);

const CODIGOS_HTTP_TRANSITORIOS = new Set([408, 429, 500, 502, 503, 504]);

export function ehFalhaTransitoria(erro) {
  if (!erro) return false;
  if (isAuthRetryableFetchError(erro)) return true;
  if (NOMES_TRANSITORIOS.has(erro.name)) return true;
  if (CODIGOS_HTTP_TRANSITORIOS.has(Number(erro.status))) return true;
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return true;
  return false;
}

/*
  Só três situações provam que a sessão acabou: a biblioteca dizer que não há
  sessão; o servidor responder 401; ou o token ser recusado por já ter expirado.
  `AuthApiError` com 403 é falta de permissão, não expiração — a distinção
  importa porque a saída para a pessoa é completamente diferente.
*/
const CODIGOS_DE_SESSAO_ENCERRADA = new Set([
  "session_not_found",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "session_expired",
  "bad_jwt",
]);

export function ehSessaoEncerrada(erro) {
  if (!erro) return false;
  if (ehFalhaTransitoria(erro)) return false;
  if (isAuthSessionMissingError(erro)) return true;
  if (CODIGOS_DE_SESSAO_ENCERRADA.has(erro.code)) return true;
  if (isAuthApiError(erro) && Number(erro.status) === 401) return true;
  /*
    PostgREST devolve estes códigos quando o JWT chega vencido ou ilegível.
    São códigos, não texto livre: nenhum outro erro os produz por acidente.
  */
  if (erro.code === "PGRST301" || erro.code === "PGRST303") return true;
  return false;
}

/**
 * Descobre o estado real da sessão, sem adivinhar.
 * @returns {Promise<{ estado: string, sessao: object|null, erro: unknown }>}
 */
export async function estadoDaSessao(client) {
  if (!client) {
    return { estado: SESSAO_INDETERMINADA, sessao: null, erro: null };
  }

  let resposta;
  try {
    resposta = await client.auth.getSession();
  } catch (erro) {
    return {
      estado: ehSessaoEncerrada(erro) ? SESSAO_ENCERRADA : SESSAO_INDETERMINADA,
      sessao: null,
      erro,
    };
  }

  const erro = resposta?.error;
  if (erro) {
    return {
      estado: ehSessaoEncerrada(erro) ? SESSAO_ENCERRADA : SESSAO_INDETERMINADA,
      sessao: null,
      erro,
    };
  }

  const sessao = resposta?.data?.session || null;
  if (sessao?.access_token) {
    return { estado: SESSAO_ATIVA, sessao, erro: null };
  }

  /*
    A leitura funcionou e não há sessão guardada: aqui sim, a pessoa está
    deslogada. É o único caminho que declara encerramento sem erro nenhum.
  */
  return { estado: SESSAO_ENCERRADA, sessao: null, erro: null };
}

/**
 * Exige sessão ativa. Substitui os quatro `ensureSession()` duplicados.
 * Lança `SessaoEncerrada` só com prova; `FalhaDeConexao` quando não deu para saber.
 */
export async function exigirSessao(client) {
  const { estado, sessao, erro } = await estadoDaSessao(client);
  if (estado === SESSAO_ATIVA) return sessao;
  if (estado === SESSAO_ENCERRADA) throw new SessaoEncerrada();
  throw new FalhaDeConexao(undefined, erro);
}
