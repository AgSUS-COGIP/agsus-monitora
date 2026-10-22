import { describe, expect, it } from "vitest";
import {
  aplicarMudancasDaFila,
  argumentosDaFilaDesde,
} from "../../src/lib/avaliacao-documental/fila-por-mudancas.ts";

/*
  A fila só com o que mudou (supabase/migrations/20261014231000): a junção da
  resposta parcial com a fila que a tela tem, e quando não dá (lê inteira).
*/

const linha = (id, extra = {}) => ({
  id,
  vaga: "182418",
  codigo: id.toUpperCase(),
  situacao_pre: "NO_LOTE",
  ficha: { id: `f-${id}`, situacao: "PENDENTE", versao: 1 },
  ...extra,
});

const ANTERIOR = Object.freeze({
  gerado_em: "2026-10-15T12:00:00Z",
  marca: "m1",
  parcial: false,
  vagas: [{ codigo: "182418" }],
  analistas: [{ id: "u1", pendentes: 3 }],
  candidatos: [linha("a"), linha("b"), linha("c")],
});

describe("argumentosDaFilaDesde", () => {
  it("com gerado_em e marca: pede só o que mudou desde então", () => {
    expect(argumentosDaFilaDesde("e1", ANTERIOR)).toEqual({
      p_edital: "e1",
      p_desde: "2026-10-15T12:00:00Z",
      p_marca: "m1",
    });
  });

  it("sem leitura anterior (ou sem marca): pede a fila inteira", () => {
    const inteira = { p_edital: "e1", p_desde: null, p_marca: null };
    expect(argumentosDaFilaDesde("e1", null)).toEqual(inteira);
    expect(
      argumentosDaFilaDesde("e1", { gerado_em: "2026-10-15T12:00:00Z" }),
    ).toEqual(inteira);
  });
});

describe("aplicarMudancasDaFila", () => {
  it("a fila inteira (parcial false) volta como veio", () => {
    const inteira = { ...ANTERIOR, gerado_em: "2026-10-15T12:05:00Z" };
    expect(aplicarMudancasDaFila(null, inteira)).toBe(inteira);
  });

  it("parcial: troca as linhas no lugar, mantém as vagas e atualiza o resto", () => {
    const b = linha("b", {
      ficha: { id: "f-b", situacao: "EM_ANALISE", versao: 2 },
    });
    const r = aplicarMudancasDaFila(ANTERIOR, {
      gerado_em: "2026-10-15T12:05:00Z",
      marca: "m1",
      parcial: true,
      analistas: [{ id: "u1", pendentes: 2 }],
      candidatos: [b],
      saiu: [],
      total_nucleo: 3,
    });
    expect(r.candidatos.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(r.candidatos[1]).toBe(b);
    expect(r.candidatos[0]).toBe(ANTERIOR.candidatos[0]);
    expect(r.vagas).toBe(ANTERIOR.vagas);
    expect(r.analistas).toEqual([{ id: "u1", pendentes: 2 }]);
    expect(r.gerado_em).toBe("2026-10-15T12:05:00Z");
    expect(r.parcial).toBe(false);
    expect(r).not.toHaveProperty("total_nucleo");
    expect(r).not.toHaveProperty("saiu");
  });

  it("parcial sem mudança: a mesma lista", () => {
    const r = aplicarMudancasDaFila(ANTERIOR, {
      gerado_em: "2026-10-15T12:05:00Z",
      marca: "m1",
      parcial: true,
      candidatos: [],
      saiu: [],
      total_nucleo: 3,
    });
    expect(r.candidatos).toEqual(ANTERIOR.candidatos);
  });

  it("tira as que saíram do núcleo", () => {
    const r = aplicarMudancasDaFila(ANTERIOR, {
      parcial: true,
      candidatos: [],
      saiu: ["c", "z"],
      total_nucleo: 2,
    });
    expect(r.candidatos.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("linha nova no núcleo ou total diferente: null (a tela lê a fila inteira)", () => {
    expect(
      aplicarMudancasDaFila(ANTERIOR, {
        parcial: true,
        candidatos: [linha("d")],
        saiu: [],
        total_nucleo: 4,
      }),
    ).toBeNull();
    expect(
      aplicarMudancasDaFila(ANTERIOR, {
        parcial: true,
        candidatos: [],
        saiu: [],
        total_nucleo: 5,
      }),
    ).toBeNull();
  });

  it("parcial sem fila anterior ou resposta inválida: null", () => {
    expect(
      aplicarMudancasDaFila(null, {
        parcial: true,
        candidatos: [],
        total_nucleo: 0,
      }),
    ).toBeNull();
    expect(aplicarMudancasDaFila(ANTERIOR, null)).toBeNull();
    expect(aplicarMudancasDaFila(ANTERIOR, [])).toBeNull();
  });
});
