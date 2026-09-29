import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("../../src/lib/supabaseClient.js", () => ({
  getSupabaseClient: () => ({ rpc }),
}));

async function carregarModulo() {
  vi.resetModules();
  return import("../../src/analises/analises-pareceres-sob-demanda.js");
}

beforeEach(() => {
  rpc.mockReset();
});

describe("parecer sob demanda do painel de análises", () => {
  it("busca o parecer da linha uma vez só", async () => {
    rpc.mockResolvedValue({
      data: { id: "a", analise: "Apto" },
      error: null,
    });
    const { buscarParecerDaLinha } = await carregarModulo();

    await expect(buscarParecerDaLinha("a")).resolves.toBe("Apto");
    await expect(buscarParecerDaLinha("a")).resolves.toBe("Apto");

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_analise_detalhe_do_painel", {
      p_id: "a",
    });
  });

  it("tenta de novo depois de uma falha", async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: new Error("rede") })
      .mockResolvedValueOnce({ data: { analise: "Apto" }, error: null });
    const { buscarParecerDaLinha } = await carregarModulo();

    await expect(buscarParecerDaLinha("a")).rejects.toThrow("rede");
    await expect(buscarParecerDaLinha("a")).resolves.toBe("Apto");
  });

  it("o detalhamento vem inteiro, uma vez por registro, e serve ao parecer", async () => {
    rpc.mockResolvedValue({
      data: { id: "a", analise: "Apto", pontuacao_escolaridade: 10 },
      error: null,
    });
    const { buscarDetalheDaLinha, buscarParecerDaLinha } =
      await carregarModulo();

    await expect(buscarDetalheDaLinha("a")).resolves.toEqual({
      id: "a",
      analise: "Apto",
      pontuacao_escolaridade: 10,
    });
    await expect(buscarParecerDaLinha("a")).resolves.toBe("Apto");
    expect(rpc).toHaveBeenCalledTimes(1);
    await expect(buscarDetalheDaLinha("")).resolves.toBeNull();
  });

  it("traz os textos do escopo com a área do painel e aproveita no detalhe", async () => {
    rpc.mockResolvedValue({
      data: {
        columns: ["id", "analise", "link_pdf"],
        rows: [
          ["a", "Apto", null],
          ["b", "Inapto", "https://pdf/b"],
        ],
      },
      error: null,
    });
    const { buscarTextosDoEscopo, buscarParecerDaLinha, esquecerTextos } =
      await carregarModulo();

    const mapa = await buscarTextosDoEscopo("todos");
    expect(mapa.get("b")).toEqual({
      analise: "Inapto",
      link_pdf: "https://pdf/b",
    });
    expect(rpc).toHaveBeenCalledWith("get_analises_texto_do_painel", {
      p_scope: "todos",
      p_area: "saude-indigena",
    });

    await buscarTextosDoEscopo("todos");
    await expect(buscarParecerDaLinha("a")).resolves.toBe("Apto");
    expect(rpc).toHaveBeenCalledTimes(1);

    esquecerTextos();
    await buscarTextosDoEscopo("todos");
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
