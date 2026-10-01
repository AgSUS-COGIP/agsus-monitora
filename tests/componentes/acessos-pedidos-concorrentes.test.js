import { describe, expect, it } from "vitest";
import { criarEstadoDosAcessos } from "../../src/componentes/acessos/estado.js";

/*
  Filtro, busca e página disparam cargas sem esperar a anterior. Antes, a
  resposta que chegasse por último ficava na tela — mesmo sendo a do filtro
  anterior —, e a tabela mostrava pessoas que não eram do filtro escolhido.
*/
function supabaseControlado() {
  const pendentes = [];
  return {
    pendentes,
    rpc: (nome, argumentos) =>
      new Promise((resolver) => pendentes.push({ nome, argumentos, resolver })),
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
}

const matrizCom = (id) => ({ usuarios: [{ id }], total: 1 });

describe("Acessos: cargas concorrentes", () => {
  it("a resposta do filtro anterior não substitui a do filtro atual", async () => {
    const supabase = supabaseControlado();
    const estado = criarEstadoDosAcessos({ supabase, toast: () => {} });
    const primeira = estado.carregarMatriz({ filtroGrupo: "a" });
    const segunda = estado.carregarMatriz({ filtroGrupo: "b" });
    // espera as duas chamadas chegarem ao "banco"
    while (supabase.pendentes.length < 2) await Promise.resolve();
    supabase.pendentes[1].resolver({ data: matrizCom("do-b"), error: null });
    await segunda;
    supabase.pendentes[0].resolver({ data: matrizCom("do-a"), error: null });
    await primeira;
    expect(estado.obter().filtroGrupo).toBe("b");
    expect(estado.obter().matriz.usuarios).toEqual([{ id: "do-b" }]);
  });

  it("a busca anterior das contas desativadas não substitui a atual", async () => {
    const supabase = supabaseControlado();
    const estado = criarEstadoDosAcessos({ supabase, toast: () => {} });
    const primeira = estado.carregarDesativadas({ busca: "an" });
    const segunda = estado.carregarDesativadas({ busca: "ana" });
    while (supabase.pendentes.length < 2) await Promise.resolve();
    supabase.pendentes[1].resolver({ data: { contas: [] }, error: null });
    await segunda;
    supabase.pendentes[0].resolver({
      data: { contas: [{ id: "x", email: "antonio@x" }] },
      error: null,
    });
    await primeira;
    expect(estado.obter().buscaDasDesativadas).toBe("ana");
    expect(estado.obter().desativadas).toEqual([]);
  });
});
