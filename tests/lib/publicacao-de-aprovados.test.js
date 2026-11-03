import { describe, expect, it } from "vitest";
import {
  candidatosDaListaFinal,
  motivoValido,
  origemDaLista,
  resumoDasOrigens,
} from "../../src/lib/publicacao-de-aprovados.ts";

const retrato = {
  tipo: "FINAL",
  modalidades: [{ codigo: "PP", nome: "Pretos e pardos" }],
  vagas: [
    {
      chave: "V1",
      codigo: "V1",
      cargo: "Enfermeiro",
      geral: [
        {
          posicao: 1,
          analise_id: "a1",
          nome: "Ana Souza",
          nota: 90,
          situacao: "VAGA",
          modalidades: ["AC"],
        },
        {
          posicao: 2,
          analise_id: "a2",
          nome: "Bruno Lima",
          nota: 80,
          situacao: "VAGA",
          modalidades: ["AC", "PP"],
        },
        {
          posicao: 3,
          analise_id: "a3",
          nome: "Carla Dias",
          nota: 70,
          situacao: "CR",
          modalidades: ["AC"],
        },
      ],
      listas: {
        PP: [
          {
            posicao: 1,
            analise_id: "a2",
            nome: "Bruno Lima",
            nota: 80,
            situacao: "VAGA",
            modalidades: ["AC", "PP"],
          },
          {
            posicao: 2,
            analise_id: "a4",
            nome: "Davi Rocha",
            nota: 60,
            situacao: "CR",
            modalidades: ["PP"],
          },
        ],
      },
    },
    {
      chave: "quadro:9",
      codigo: "",
      cargo: "Técnico",
      geral: [
        {
          posicao: 1,
          analise_id: "a5",
          nome: "Élio Nunes",
          nota: 75,
          situacao: "VAGA",
          modalidades: ["AC"],
        },
        {
          posicao: 2,
          analise_id: "a1",
          nome: "Ana Souza",
          nota: 70,
          situacao: "CR",
          modalidades: ["AC"],
        },
      ],
      listas: {},
    },
  ],
};

describe("candidatosDaListaFinal", () => {
  it("um por análise, com a posição da geral e a da modalidade para quem só está nela", () => {
    const linhas = candidatosDaListaFinal(retrato, {
      analises: new Map([["a5", { vaga: "T-01", cargo: "Técnico" }]]),
    });
    expect(linhas.map((l) => [l.analise_id, l.posicao, l.codigo_vaga])).toEqual(
      [
        ["a1", 1, "V1"],
        ["a2", 2, "V1"],
        ["a3", 3, "V1"],
        ["a4", 2, "V1"],
        ["a5", 1, "T-01"],
      ],
    );
    expect(linhas[0]).toMatchObject({
      nome: "Ana Souza",
      nota: 90,
      situacao: "VAGA",
      cargo: "Enfermeiro",
    });
    expect(linhas[2].situacao).toBe("CR");
  });

  it("vaga sem código e sem análise conhecida usa a chave da vaga", () => {
    const [, , , , tecnico] = candidatosDaListaFinal(retrato);
    expect(tecnico.codigo_vaga).toBe("quadro:9");
  });

  it("retrato vazio não quebra", () => {
    expect(candidatosDaListaFinal(null)).toEqual([]);
  });
});

describe("motivo", () => {
  it("motivo entre 3 e 500 caracteres", () => {
    expect(motivoValido("ok")).toBe(false);
    expect(motivoValido("Edital sem análise no sistema")).toBe(true);
    expect(motivoValido("x".repeat(501))).toBe(false);
  });
});

describe("origem da lista", () => {
  it("publicada da Classificação traz a data; planilha é manual", () => {
    expect(
      origemDaLista({
        origem: "CLASSIFICACAO",
        importado_em: "2026-10-05T15:00:00Z",
      }),
    ).toEqual({
      tipo: "CLASSIFICACAO",
      texto: "Publicada da Classificação em 05/10",
    });
    expect(origemDaLista({ origem: "XLSX" }).texto).toBe(
      "Lista manual (planilha)",
    );
    expect(origemDaLista({}).tipo).toBe("XLSX");
    expect(origemDaLista(null)).toBeNull();
  });

  it("várias listas: quantas de cada origem", () => {
    expect(resumoDasOrigens([])).toBe("");
    expect(resumoDasOrigens([{ origem: "XLSX" }])).toBe(
      "Lista manual (planilha)",
    );
    expect(
      resumoDasOrigens([
        { origem: "CLASSIFICACAO" },
        { origem: "XLSX" },
        { origem: "XLSX" },
      ]),
    ).toBe("Listas: 1 publicada da Classificação · 2 manuais (planilha)");
  });
});
