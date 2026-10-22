import { describe, expect, it } from "vitest";
import { chamarRpc, textoDoErro } from "../scripts/carga-de-planilha.mjs";

const CONFIG = { url: "https://x.supabase.co", chave: "k" };
const semEspera = { esperar: async () => {} };

function resposta(status, corpo) {
  return { ok: status < 400, status, text: async () => corpo };
}

describe("textoDoErro", () => {
  it("leva só code e message, nunca a linha recusada", () => {
    const texto = textoDoErro(
      JSON.stringify({
        code: "23502",
        message: "null value in column",
        details:
          "Failing row contains (Maria Fictícia, maria@exemplo.invalid).",
        hint: null,
      }),
    );
    expect(texto).toBe("23502: null value in column");
    expect(texto).not.toMatch(/Maria|exemplo/);
  });

  it("não ecoa corpo que não é JSON", () => {
    expect(textoDoErro("<html>Maria</html>")).toBe("resposta sem JSON");
  });
});

describe("chamarRpc", () => {
  it("não repete erro 4xx e não traz details", async () => {
    let chamadas = 0;
    const buscar = async () => {
      chamadas++;
      return resposta(
        400,
        JSON.stringify({ code: "22023", message: "x", details: "Maria" }),
      );
    };
    await expect(
      chamarRpc(CONFIG, "f", {}, { buscar, ...semEspera }),
    ).rejects.toThrow("f respondeu 400: 22023: x");
    expect(chamadas).toBe(1);
  });

  it("repete 5xx e erro de rede até 3 vezes", async () => {
    let chamadas = 0;
    const buscar = async () => {
      chamadas++;
      if (chamadas === 1) throw new TypeError("fetch failed");
      if (chamadas === 2) return resposta(503, "fora");
      return resposta(200, JSON.stringify({ ok: true }));
    };
    await expect(
      chamarRpc(CONFIG, "f", {}, { buscar, ...semEspera }),
    ).resolves.toEqual({ ok: true });
    expect(chamadas).toBe(3);
  });

  it("desiste depois de 3 falhas de rede", async () => {
    const buscar = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(
      chamarRpc(CONFIG, "f", {}, { buscar, ...semEspera }),
    ).rejects.toThrow("f sem resposta: TypeError");
  });
});
