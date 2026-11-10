import { describe, expect, it } from "vitest";
describe("cache das respostas do proxy da Funai", () => {
  function respostaFalsa() {
    const cabecalhos = {};
    return {
      cabecalhos,
      status() {
        return this;
      },
      setHeader(nome, valor) {
        cabecalhos[nome] = valor;
      },
      end() {},
    };
  }

  it("erro não vai para o cache compartilhado", async () => {
    const { default: handler } = await import("../api/funai-geodata.ts");
    const res = respostaFalsa();
    await handler({ method: "GET", headers: {}, query: { dataset: "x" } }, res);
    expect(res.cabecalhos["Cache-Control"]).toBe("no-store");
  });
});

/*
  A Funai deixou de publicar Funai:areas_dsei (502 a cada página, OPE-01 da
  auditoria de 09/11/2026): o proxy não oferece mais `dsei` e nem chega a
  chamar a Funai. O contorno dos DSEIs vem de public/data/contornos-dos-dseis.json.
*/
describe("o proxy não pede mais o DSEI à Funai", () => {
  it("dataset=dsei responde 400 sem chamar a rede", async () => {
    const { default: handler } = await import("../api/funai-geodata.ts");
    const chamadas = [];
    const original = globalThis.fetch;
    globalThis.fetch = (...args) => {
      chamadas.push(args);
      return Promise.reject(new Error("não devia chamar"));
    };
    try {
      let status = 0;
      let corpo = "";
      const res = {
        status(s) {
          status = s;
          return this;
        },
        setHeader() {},
        end(texto) {
          corpo = texto;
        },
      };
      await handler(
        { method: "GET", headers: {}, query: { dataset: "dsei" } },
        res,
      );
      expect(status).toBe(400);
      expect(JSON.parse(corpo)).toEqual({ error: "invalid_dataset" });
      expect(chamadas).toHaveLength(0);
    } finally {
      globalThis.fetch = original;
    }
  });
});
