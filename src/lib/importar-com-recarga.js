/*
  Import sob demanda que sobrevive a uma versão nova publicada.

  Os pedaços baixados na hora (ex.: o painel do chat) têm o hash no nome. Se a
  Vercel publica uma versão enquanto a página está aberta, o arquivo antigo
  some e o `import()` falha; o `lazy` do React guarda a falha e a ilha mostra
  "Não foi possível mostrar esta parte da tela" até a pessoa recarregar.

  Aqui a falha de carregamento recarrega a página uma vez (pega a versão
  nova). Se já recarregou há pouco e falhou de novo, o erro segue para quem
  chamou — sem laço de recarga.
*/

export const CHAVE_DA_RECARGA = "monitora:recarga-por-versao";
export const JANELA_DA_RECARGA_MS = 60 * 1000;

const ehFalhaDeCarregamento = (erro) =>
  /dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically|ChunkLoadError/i.test(
    String(erro?.message || erro || ""),
  );

/** true quando recarregou agora; false quando já tinha recarregado há pouco. */
export function recarregarUmaVez({
  armazenamento = globalThis.sessionStorage,
  recarregar = () => globalThis.location?.reload(),
  agora = Date.now(),
} = {}) {
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
export function importarComRecarga(carregar, opcoes) {
  return () =>
    carregar().catch((erro) => {
      if (ehFalhaDeCarregamento(erro) && recarregarUmaVez(opcoes))
        return new Promise(() => {});
      throw erro;
    });
}
