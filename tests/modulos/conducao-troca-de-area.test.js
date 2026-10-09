import { describe, expect, it } from "vitest";

import { criarEstadoDaConducao } from "../../src/modulos/entrevistas/estado-da-conducao.ts";

/*
  Trocar de área com a lista ainda carregando: a resposta da área antiga
  chegava depois e a tela da área nova mostrava editais/roteiros da anterior.
*/
function supabaseControlado() {
  const pendentes = [];
  return {
    pendentes,
    rpc: (nome, argumentos) =>
      new Promise((resolver) => pendentes.push({ nome, argumentos, resolver })),
  };
}

const responder = (pedido, data) => pedido.resolver({ data, error: null });

describe("condução: troca de área com carga em andamento", () => {
  it("a lista de roteiros da área antiga não cai sobre a nova", async () => {
    const supabase = supabaseControlado();
    const conducao = criarEstadoDaConducao({ supabase, tempoLimiteMs: 10_000 });
    const antiga = conducao.carregarRoteiros("sede");
    const nova = conducao.carregarRoteiros("projetos");
    responder(supabase.pendentes[1], [{ id: "r-projetos" }]);
    await nova;
    responder(supabase.pendentes[0], [{ id: "r-sede" }]);
    await antiga;
    expect(conducao.obter().area).toBe("projetos");
    expect(conducao.obter().roteiros.lista).toEqual([{ id: "r-projetos" }]);
  });

  it("a lista de editais da área antiga não cai sobre a nova", async () => {
    const supabase = supabaseControlado();
    const conducao = criarEstadoDaConducao({ supabase, tempoLimiteMs: 10_000 });
    const antiga = conducao.carregarEditais("sede");
    const nova = conducao.carregarEditais("projetos");
    responder(supabase.pendentes[0], {
      admin_global: false,
      editais: [{ id: "e-sede", edital: "01/2026" }],
    });
    await antiga;
    expect(conducao.obter().editais.carregando).toBe(true);
    responder(supabase.pendentes[1], { admin_global: false, editais: [] });
    await nova;
    expect(conducao.obter().area).toBe("projetos");
    expect(conducao.obter().editais.lista).toEqual([]);
  });
});
