/*
  Mensagem clara quando um salvamento não chega ao servidor.

  O `fetch` rejeita com `TypeError: Failed to fetch` (Chrome), `NetworkError
  when attempting to fetch resource` (Firefox) ou `Load failed` (Safari); o
  supabase-js repassa esse texto no `error.message`. Mostrado cru, ele não diz
  à pessoa o que fazer — e um botão preso em "Salvando…" diz menos ainda.
*/

/** Os campos que esta classificação lê de um erro qualquer (todos opcionais). */
type ErroLido = {
  name?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  falhaTransitoria?: unknown;
};

const FALHA_DE_CONEXAO =
  /failed to fetch|networkerror|load failed|network request failed|fetch failed/i;

export const SEM_SERVIDOR =
  "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.";

export class TempoEsgotado extends Error {
  constructor(segundos: number) {
    super(`O servidor não respondeu em ${segundos} segundos.`);
    this.name = "TempoEsgotado";
  }
}

export function ehFalhaDeConexao(erro: unknown): boolean {
  if (!erro) return false;
  const lido = erro as ErroLido;
  // `FalhaDeConexao` de src/lib/sessao.ts (a sessão não pôde ser conferida).
  if (erro instanceof TempoEsgotado || lido.falhaTransitoria === true)
    return true;
  if (
    (["AbortError", "TimeoutError", "NetworkError"] as unknown[]).includes(
      lido.name,
    )
  )
    return true;
  return FALHA_DE_CONEXAO.test(
    String(lido.message ?? lido.details ?? erro ?? ""),
  );
}

/** Texto para a pessoa: o que aconteceu e o que fazer. */
export function mensagemDeFalha(erro: unknown): string {
  if (ehFalhaDeConexao(erro))
    return erro instanceof TempoEsgotado
      ? `${erro.message} ${SEM_SERVIDOR}`
      : SEM_SERVIDOR;
  const lido = erro as ErroLido | null | undefined;
  const texto = String(
    lido?.message || lido?.details || lido?.hint || erro || "",
  ).trim();
  return texto || "Erro desconhecido.";
}

/**
 * Rejeita com `TempoEsgotado` se a promessa não terminar a tempo — o botão
 * volta a ficar disponível em vez de esperar para sempre.
 */
export function comTempoLimite<T>(
  promessa: T | PromiseLike<T>,
  ms = 30000,
): Promise<T> {
  let espera: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    espera = setTimeout(
      () => rejeitar(new TempoEsgotado(Math.round(ms / 1000))),
      ms,
    );
  });
  return Promise.race([Promise.resolve(promessa), limite]).finally(() =>
    clearTimeout(espera),
  );
}
