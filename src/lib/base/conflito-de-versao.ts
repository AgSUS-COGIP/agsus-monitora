/*
  Conflito de versão (concorrência otimista): a tela abriu uma versão e, ao
  salvar, o banco já tem outra (outra aba ou outra pessoa salvou antes).

  O banco levantava esse conflito com `errcode = '40001'`
  (serialization_failure). O PostgREST trata 40001 como falha de serialização
  e REPETE a transação sozinho — com a versão ainda velha, o conflito volta e
  a repetição não acaba (PostgREST/postgrest#3673): conexões presas e a tela
  sem resposta. As funções passam a usar `errcode = 'PT409'`: o PostgREST
  devolve HTTP 409 para `PTxyz` (status xyz; src/library/PostgREST/Error.hs,
  mapSQLtoHTTP, e docs.postgrest.org "Raise errors with HTTP Status Codes")
  e não repete.

  A tela aceita os dois códigos enquanto o banco muda (o front vai ao ar
  antes da migration que troca o código); depois, 40001 só chega de uma
  falha de serialização real, que também é "recarregue e tente de novo".
*/

export const CONFLITO_DE_VERSAO = "PT409";
export const CONFLITO_DE_VERSAO_ANTIGO = "40001";

const CODIGOS = new Set([CONFLITO_DE_VERSAO, CONFLITO_DE_VERSAO_ANTIGO]);

export const AVISO_DE_FICHA_ALTERADA =
  "Esta ficha foi alterada em outra aba ou por outra pessoa. Recarregue para continuar.";

/** Código do erro do banco/PostgREST (`erro.code`), ou "". */
function codigoDoErro(erro: unknown): string {
  if (!erro || typeof erro !== "object") return "";
  const codigo = (erro as { code?: unknown }).code;
  return typeof codigo === "string" ? codigo : "";
}

/** O banco recusou porque a versão aberta na tela já não é a vigente. */
export function ehConflitoDeVersao(erro: unknown): boolean {
  return CODIGOS.has(codigoDoErro(erro));
}
