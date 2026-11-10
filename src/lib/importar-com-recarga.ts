/*
  Import sob demanda que sobrevive a uma versão nova publicada.

  Os pedaços baixados na hora (ex.: as telas sob demanda) têm o hash no nome. Se a
  Vercel publica uma versão enquanto a página está aberta, o arquivo antigo
  some e o `import()` falha; o `lazy` do React guarda a falha e a ilha mostra
  "Não foi possível mostrar esta parte da tela" até a pessoa recarregar.

  Aqui a falha de carregamento recarrega a página uma vez (pega a versão
  nova). Se já recarregou há pouco e falhou de novo, o erro segue para quem
  chamou — sem laço de recarga.
*/

export const CHAVE_DA_RECARGA = "monitora:recarga-por-versao";
export const JANELA_DA_RECARGA_MS = 60 * 1000;

export interface OpcoesDaRecarga {
  armazenamento?: Pick<Storage, "getItem" | "setItem"> | null;
  recarregar?: () => void;
  agora?: number;
}

/** O arquivo sob demanda sumiu (publicação nova com a página aberta) ou a rede caiu. */
export const ehFalhaDeCarregamento = (erro: unknown) =>
  /dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically|ChunkLoadError/i.test(
    String(
      (erro as { message?: unknown } | null | undefined)?.message || erro || "",
    ),
  );

/*
  A frase para quem clicou numa ação (gerar PDF) depois de uma publicação nova:
  ali não se recarrega sozinho, porque a pessoa pode ter algo não salvo.
*/
export const MENSAGEM_DE_VERSAO_NOVA =
  "O MONITORA foi atualizado enquanto esta página estava aberta. Recarregue a página (F5) e tente de novo.";

/**
 * O erro de uma ação que baixa arquivo sob demanda: a falha de carregamento
 * vira MENSAGEM_DE_VERSAO_NOVA (com o erro original em `cause`); o resto
 * passa igual.
 */
export function erroDeVersaoNova(erro: unknown): unknown {
  return ehFalhaDeCarregamento(erro)
    ? new Error(MENSAGEM_DE_VERSAO_NOVA, { cause: erro })
    : erro;
}

/** true quando recarregou agora; false quando já tinha recarregado há pouco. */
export function recarregarUmaVez({
  armazenamento = globalThis.sessionStorage,
  recarregar = () => globalThis.location?.reload(),
  agora = Date.now(),
}: OpcoesDaRecarga = {}): boolean {
  let ultima = 0;
  try {
    ultima = Number(armazenamento?.getItem(CHAVE_DA_RECARGA)) || 0;
  } catch {
    ultima = 0;
  }
  if (ultima > 0 && agora - ultima < JANELA_DA_RECARGA_MS) return false;
  try {
    armazenamento?.setItem(CHAVE_DA_RECARGA, String(agora));
  } catch {
    // Sem sessionStorage (janela anônima travada): recarrega mesmo assim.
  }
  recarregar();
  return true;
}

/**
 * Envolve um `() => import(...)`: falha de carregamento recarrega a página uma
 * vez (e a promessa fica pendente, a página vai embora); outro erro, ou falha
 * logo depois de uma recarga, é repassado.
 */
export function importarComRecarga<T>(
  carregar: () => Promise<T>,
  opcoes?: OpcoesDaRecarga,
): () => Promise<T> {
  return () =>
    carregar().catch((erro: unknown) => {
      if (ehFalhaDeCarregamento(erro) && recarregarUmaVez(opcoes))
        return new Promise<T>(() => {});
      throw erro;
    });
}
