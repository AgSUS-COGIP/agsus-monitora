/*
  Mensagem clara quando um salvamento não chega ao servidor.

  O `fetch` rejeita com `TypeError: Failed to fetch` (Chrome), `NetworkError
  when attempting to fetch resource` (Firefox) ou `Load failed` (Safari); o
  supabase-js repassa esse texto no `error.message`. Mostrado cru, ele não diz
  à pessoa o que fazer — e um botão preso em "Salvando…" diz menos ainda.
*/

const FALHA_DE_CONEXAO =
  /failed to fetch|networkerror|load failed|network request failed|fetch failed/i;

export const SEM_SERVIDOR =
  "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.";

export class TempoEsgotado extends Error {
  constructor(segundos) {
    super(`O servidor não respondeu em ${segundos} segundos.`);
    this.name = "TempoEsgotado";
  }
}

export function ehFalhaDeConexao(erro) {
  if (!erro) return false;
  // `FalhaDeConexao` de src/lib/sessao.js (a sessão não pôde ser conferida).
  if (erro instanceof TempoEsgotado || erro.falhaTransitoria === true)
    return true;
  if (["AbortError", "TimeoutError", "NetworkError"].includes(erro.name))
    return true;
  return FALHA_DE_CONEXAO.test(
    String(erro.message ?? erro.details ?? erro ?? ""),
  );
}

/** Texto para a pessoa: o que aconteceu e o que fazer. */
export function mensagemDeFalha(erro) {
  if (ehFalhaDeConexao(erro))
    return erro instanceof TempoEsgotado
      ? `${erro.message} ${SEM_SERVIDOR}`
      : SEM_SERVIDOR;
  const texto = String(
    erro?.message || erro?.details || erro?.hint || erro || "",
  ).trim();
  return texto || "Erro desconhecido.";
}

/**
 * Rejeita com `TempoEsgotado` se a promessa não terminar a tempo — o botão
 * volta a ficar disponível em vez de esperar para sempre.
 * @template T
 * @param {T | PromiseLike<T>} promessa
 * @param {number} [ms]
 * @returns {Promise<T>}
 */
export function comTempoLimite(promessa, ms = 30000) {
  let espera;
  const limite = new Promise((_, rejeitar) => {
    espera = setTimeout(
      () => rejeitar(new TempoEsgotado(Math.round(ms / 1000))),
      ms,
    );
  });
  return Promise.race([Promise.resolve(promessa), limite]).finally(() =>
    clearTimeout(espera),
  );
}
