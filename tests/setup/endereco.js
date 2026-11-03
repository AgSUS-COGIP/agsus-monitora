import { beforeEach } from "vitest";

/*
  A navegação do app escreve o endereço (src/app/endereco.ts: pushState e
  replaceState) e lê a rota dele ao entrar. O jsdom guarda o endereço entre
  os testes de um arquivo: cada teste começa na raiz, sem rota pedida.
*/
beforeEach(() => {
  globalThis.history?.replaceState?.(null, "", "/");
  try {
    globalThis.sessionStorage?.removeItem("monitora:rota-pedida");
  } catch {
    // Sem sessionStorage: nada a limpar.
  }
});
