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

  it("traz os pareceres do escopo com a área do painel e aproveita no detalhe", async () => {
    rpc.mockResolvedValue({
      data: {
        columns: ["id", "analise"],
        rows: [
          ["a", "Apto"],
          ["b", "Inapto"],
        ],
      },
      error: null,
    });
    const { buscarPareceresDoEscopo, buscarParecerDaLinha, esquecerPareceres } =
      await carregarModulo();

    const mapa = await buscarPareceresDoEscopo("ativo");
    expect(mapa.get("b")).toBe("Inapto");
    expect(rpc).toHaveBeenCalledWith("get_analises_texto_do_painel", {
      p_scope: "ativo",
      p_area: "saude-indigena",
    });

    await buscarPareceresDoEscopo("ativo");
    await expect(buscarParecerDaLinha("a")).resolves.toBe("Apto");
    expect(rpc).toHaveBeenCalledTimes(1);

    esquecerPareceres();
    await buscarPareceresDoEscopo("ativo");
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
