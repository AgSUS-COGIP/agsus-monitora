/*
  As RPCs `*_se_mudou` (migration 20261013160000) recebem a `versao` da cópia
  e, se ela ainda vale, devolvem só `{ inalterado: true, versao }` em vez do
  payload inteiro: a revalidação deixa de baixar megabytes para nada.
*/

/** A versão dos dados que o banco mandou junto do payload, ou `null`. */
export function versaoDoPacote(payload: unknown): string | null {
  const versao = (payload as { versao?: unknown } | null | undefined)?.versao;
  return typeof versao === "string" && versao ? versao : null;
}

/** O banco disse que a versão enviada ainda vale? */
export const respostaInalterada = (resposta: unknown): boolean =>
  Boolean(resposta) &&
  (resposta as { inalterado?: unknown }).inalterado === true;
