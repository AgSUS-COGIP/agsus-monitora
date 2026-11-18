import { describe, expect, it } from "vitest";
import {
  filaDoQuadro,
  linhasParaEscolher,
  origemDoVinculo,
  pendentesDaFila,
  rotuloDaLinha,
  semLinhaConfirmado,
  separarFila,
  type VinculoDaVaga,
} from "../src/lib/vinculos-do-quadro.ts";

const L1 = { id: "l1", cargo: "Enfermeiro", lotacao: "Polo Base Alfa" };
const L2 = { id: "l2", cargo: "Enfermeiro", lotacao: "Polo Base Beta" };
const L3 = {
  id: "l3",
  cargo: "Cirurgião Dentista 40h",
  lotacao: "Polo Base Vilhena",
};
const L4 = { id: "l4", cargo: "Médico", lotacao: null };

const payload = {
  linhas: [L1, L2, L3, L4, { id: "sem-cargo" }],
  vagas_do_edital: "COM_CODIGO",
  pode_editar: true,
  vinculos: [
    {
      vaga: "1003",
      cargo: "Médico",
      situacao: "CONFIRMADO",
      origem: "AUTOMATICO",
      regra: "NOME",
      quadro: "l4",
      cargo_quadro: "Médico",
    },
    {
      vaga: "1002",
      cargo: "Enfermeiro",
      situacao: "AMBIGUO",
      origem: "AUTOMATICO",
      regra: "NOME",
      candidatas: [L1, L2],
    },
    {
      vaga: "1004",
      cargo: "Cirurgião Dentista - Polo Base Vilhena",
      situacao: "AUSENTE",
      origem: "AUTOMATICO",
      regra: "NOME",
    },
    {
      vaga: "1005",
      cargo: "Agente",
      situacao: "AUSENTE",
      origem: "MANUAL",
      confirmado_por: "Pessoa",
      confirmado_em: "2026-11-18T10:00:00Z",
    },
    {
      vaga: "1006",
      cargo: "Enfermeiro - Polo Base Gama",
      situacao: "AUSENTE",
      origem: "MANUAL",
      pendencia:
        "A linha escolhida (Enfermeiro — Polo Base Gama) saiu do quadro em 18/11/2026.",
      cargo_quadro: "Enfermeiro",
      lotacao_quadro: "Polo Base Gama",
    },
    {
      vaga: "2001",
      cargo: "CARGO 07 - TEC ENF",
      situacao: "CONFIRMADO",
      origem: "AUTOMATICO",
      regra: "TITULO",
      quadro: "l1",
    },
    { vaga: "lixo", situacao: "OUTRA" },
  ],
};

describe("filaDoQuadro", () => {
  it("lê o payload e descarta o que não tem forma", () => {
    const fila = filaDoQuadro(payload);
    expect(fila.linhas.map((l) => l.id)).toEqual(["l1", "l2", "l3", "l4"]);
    expect(fila.vinculos.map((v) => v.vaga)).toEqual([
      "1003",
      "1002",
      "1004",
      "1005",
      "1006",
      "2001",
    ]);
    expect(fila.podeEditar).toBe(true);
    expect(fila.vagasDoEdital).toBe("COM_CODIGO");
    expect(fila.vinculos[1]?.candidatas).toEqual([L1, L2]);
  });

  it("sem payload ou com o do banco de antes da migration: sem fila e sem edição", () => {
    expect(filaDoQuadro(null)).toEqual({
      linhas: [],
      vinculos: [],
      vagasDoEdital: null,
      podeEditar: false,
    });
    // O obter_quadro_de_vagas de antes: vínculos sem situação, sem vagas_do_edital.
    expect(
      filaDoQuadro({
        vinculos: [{ vaga: "1", cargo: "Enfermeiro", quadro: null }],
      }),
    ).toMatchObject({ vinculos: [], vagasDoEdital: null });
    expect(filaDoQuadro({ vagas_do_edital: "EXTERNO" }).vagasDoEdital).toBe(
      "EXTERNO",
    );
  });
});

describe("separarFila", () => {
  it("três situações; nas ausentes, a linha que saiu primeiro e o 'sem linha' confirmado por último", () => {
    const fila = separarFila(filaDoQuadro(payload).vinculos);
    expect(fila.confirmadas.map((v) => v.vaga)).toEqual(["2001", "1003"]);
    expect(fila.ambiguas.map((v) => v.vaga)).toEqual(["1002"]);
    expect(fila.ausentes.map((v) => v.vaga)).toEqual(["1006", "1004", "1005"]);
    expect(pendentesDaFila(fila)).toBe(3);
  });

  it("'sem linha' confirmado é só o manual sem pendência", () => {
    const [, , v1004, v1005, v1006] = filaDoQuadro(payload)
      .vinculos as VinculoDaVaga[];
    expect([v1004, v1005, v1006].map((v) => semLinhaConfirmado(v!))).toEqual([
      false,
      true,
      false,
    ]);
  });
});

describe("linhasParaEscolher", () => {
  it("candidatas primeiro, na ordem do quadro", () => {
    const v = filaDoQuadro(payload).vinculos.find((x) => x.vaga === "1002")!;
    expect(linhasParaEscolher(v, [L4, L3, L2, L1]).map((l) => l.id)).toEqual([
      "l2",
      "l1",
      "l4",
      "l3",
    ]);
  });

  it("sem candidata, a de mais palavras em comum com o nome (o cargo com '40h' que o nome não traz)", () => {
    const v = filaDoQuadro(payload).vinculos.find((x) => x.vaga === "1004")!;
    expect(linhasParaEscolher(v, [L1, L2, L3, L4])[0]).toEqual(L3);
  });
});

describe("textos", () => {
  it("rótulo da linha e origem", () => {
    expect(rotuloDaLinha(L1)).toBe("Enfermeiro — Polo Base Alfa");
    expect(rotuloDaLinha(L4)).toBe("Médico");
    const [v1003, , , v1005, , v2001] = filaDoQuadro(payload)
      .vinculos as VinculoDaVaga[];
    expect([v1003, v1005, v2001].map((v) => origemDoVinculo(v!))).toEqual([
      "Pela regra do nome",
      "Pela equipe",
      "Pelo título da Empregare",
    ]);
  });
});
