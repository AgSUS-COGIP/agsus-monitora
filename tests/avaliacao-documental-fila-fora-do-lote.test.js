import { describe, expect, it, vi } from "vitest";
import {
  contadoresComForaDoLote,
  juntarFila,
  lerForaDoLote,
  modalidadesDaFila,
  precisaDoForaDoLote,
  resumoForaDoLote,
} from "../src/lib/avaliacao-documental/fila-fora-do-lote.ts";

/* A fila leve (20261014180000_fila_leve.sql): o núcleo em toda leitura, os de fora do lote sob demanda. */
const c = (id, extra = {}) => ({
  id,
  vaga: "1",
  codigo: id,
  situacao_pre: "NO_LOTE",
  posicao: 1,
  ...extra,
});

describe("fila: os de fora do lote", () => {
  it("só Inscritos e Eliminados precisam da lista de fora", () => {
    expect(precisaDoForaDoLote("inscritos")).toBe(true);
    expect(precisaDoForaDoLote("eliminados")).toBe(true);
    for (const etapa of [
      "lote",
      "pendentes",
      "em_analise",
      "revisao",
      "concluidas",
    ])
      expect(precisaDoForaDoLote(etapa)).toBe(false);
  });

  it("resumo com zeros quando o banco ainda não manda", () => {
    expect(resumoForaDoLote({})).toEqual({
      total: 0,
      eliminados: 0,
      ranqueados: 0,
      modalidades: [],
      versao: "",
    });
    expect(
      resumoForaDoLote({
        fora_do_lote: {
          total: 7,
          eliminados: "5",
          ranqueados: 2,
          modalidades: ["AC", null, "PCD"],
          versao: "x",
        },
      }),
    ).toEqual({
      total: 7,
      eliminados: 5,
      ranqueados: 2,
      modalidades: ["AC", "PCD"],
      versao: "x",
    });
  });

  it("contadores: o núcleo e, em Inscritos e Eliminados, os de fora", () => {
    const nucleo = [
      c("a", { ficha: { id: "f", situacao: "PENDENTE" } }),
      c("b"),
    ];
    const r = contadoresComForaDoLote(
      nucleo,
      resumoForaDoLote({ fora_do_lote: { total: 10, eliminados: 8 } }),
    );
    expect(r).toMatchObject({
      inscritos: 12,
      lote: 2,
      pendentes: 1,
      eliminados: 8,
    });
  });

  it("junta na ordem do banco (vaga, eliminados por último, posição, código), sem repetir", () => {
    const nucleo = [
      c("n1", { vaga: "2", posicao: 1 }),
      c("n2", { vaga: "1", posicao: 2 }),
    ];
    const fora = [
      c("e1", {
        vaga: "1",
        situacao_pre: "ELIMINADO",
        posicao: null,
        codigo: "10",
      }),
      c("e2", {
        vaga: "1",
        situacao_pre: "ELIMINADO",
        posicao: null,
        codigo: "9",
      }),
      c("r1", { vaga: "1", situacao_pre: "RANQUEADO", posicao: 5 }),
      c("n2", { vaga: "1", posicao: 2 }),
    ];
    expect(juntarFila(nucleo, fora).map((x) => x.id)).toEqual([
      "n2",
      "r1",
      "e2",
      "e1",
      "n1",
    ]);
    expect(juntarFila(nucleo, null)).toBe(nucleo);
  });

  it("modalidades do núcleo e de fora, sem repetir", () => {
    expect(
      modalidadesDaFila(
        [c("a", { modalidade: "PCD" }), c("b", { modalidade: "AC" })],
        resumoForaDoLote({ fora_do_lote: { modalidades: ["AC", "PPI"] } }),
      ),
    ).toEqual(["AC", "PCD", "PPI"]);
  });

  it("lê as páginas até o banco dizer que acabou", async () => {
    const rpc = vi.fn(async (_nome, { p_apos }) =>
      p_apos === null
        ? { candidatos: [c("a")], proximo: "a" }
        : { candidatos: [c("b")], proximo: null },
    );
    expect((await lerForaDoLote(rpc, "e1", 1)).map((x) => x.id)).toEqual([
      "a",
      "b",
    ]);
    expect(rpc).toHaveBeenNthCalledWith(1, "obter_fila_fora_do_lote", {
      p_edital: "e1",
      p_apos: null,
      p_limite: 1,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "obter_fila_fora_do_lote", {
      p_edital: "e1",
      p_apos: "a",
      p_limite: 1,
    });
  });
});
