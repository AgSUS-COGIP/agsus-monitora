import { beforeEach } from "vitest";
import { esquecerFiltrosDasTelas } from "../../src/app/filtros-no-endereco.ts";

/*
  A navegação do app escreve o endereço (src/app/endereco.ts: pushState e
  replaceState) e lê a rota dele ao entrar. O jsdom guarda o endereço entre
  os testes de um arquivo: cada teste começa na raiz, sem rota pedida e sem
  os filtros que as telas deixaram (src/app/filtros-no-endereco.ts).
*/
beforeEach(() => {
  globalThis.history?.replaceState?.(null, "", "/");
  esquecerFiltrosDasTelas();
  try {
    globalThis.sessionStorage?.removeItem("monitora:rota-pedida");
  } catch {
    // Sem sessionStorage: nada a limpar.
  }
});
