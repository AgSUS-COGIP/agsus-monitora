import { afterEach, describe, expect, it, vi } from "vitest";
import { criarEstadoDosAcessos } from "../../src/componentes/acessos/estado.js";
import { SEM_SERVIDOR } from "../../src/lib/falha-de-rede.js";

/*
  Uma chamada que nunca volta (rede caída no meio do caminho) não pode deixar
  a ação "Salvando…" presa: passado o tempo limite, o estado solta a ação e
  mostra a mensagem de rede.
*/
afterEach(() => vi.useRealTimers());

describe("Acessos: tempo limite das chamadas", () => {
  it("salvar que não responde termina em erro de rede e libera a ação", async () => {
    vi.useFakeTimers();
    const supabase = {
      rpc: vi.fn(() => new Promise(() => {})),
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "x" } },
          error: null,
        }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
      },
    };
    const estado = criarEstadoDosAcessos({ supabase, toast: vi.fn() });
    estado.registrar(
      {
        id: "u1",
        nome: "Ana",
        email: "ana@x",
        permissoes: {
          nucleo: {
            nivel: "leitor",
            origem: "grupo",
            nivel_grupo: "leitor",
            revisao: 0,
          },
        },
      },
      "nucleo",
      "editor",
    );
    const salvando = estado.salvar("Mudança de função");
    await vi.advanceTimersByTimeAsync(0);
    expect(estado.obter().acao?.tipo).toBe("salvar");
    await vi.advanceTimersByTimeAsync(30000);
    await expect(salvando).resolves.toBe(false);
    expect(estado.obter().acao).toBeNull();
    expect(estado.obter().aviso.texto).toContain(SEM_SERVIDOR);
    expect(estado.obter().rascunho.size).toBe(1);
    estado.desligar();
  });
});
