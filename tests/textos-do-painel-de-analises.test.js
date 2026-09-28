import { describe, expect, it } from "vitest";
import {
  haLinhasSemParecer,
  linhaSemParecer,
  mapaDosPareceres,
  mesclarPareceres,
  municipioUfDaLinha,
  municipioUfDaVaga,
  parecerDoDetalhe,
} from "../src/lib/textos-do-painel-de-analises.js";

describe("município/UF da vaga", () => {
  it("lê o município e a UF da UBS móvel", () => {
    expect(
      municipioUfDaVaga(
        "Cargo 2: Enfermeiro - Responsável Técnico - UBS móvel Seropédica/RJ - Cadastro Reserva",
      ),
    ).toBe("Seropédica/RJ");
    expect(
      municipioUfDaVaga(
        "Cargo 1: Médico - UBS movel Cubatão/SP - Projeto Agora tem Especialistas",
      ),
    ).toBe("Cubatão/SP");
  });

  it("devolve null quando a vaga não diz onde fica", () => {
    expect(municipioUfDaVaga("Enfermeiro - DSEI Yanomami")).toBeNull();
    expect(municipioUfDaVaga("UBS móvel Irati/pr")).toBeNull();
    expect(municipioUfDaVaga(null)).toBeNull();
  });

  it("usa o do payload e, sem ele, o do nome da vaga; na Saúde Indígena, nada", () => {
    const linha = { nome_vaga: "Técnico - UBS móvel Palhoça/SC - CR" };
    expect(municipioUfDaLinha(linha, "projetos")).toBe("Palhoça/SC");
    expect(
      municipioUfDaLinha({ ...linha, municipio_uf: "Irati/PR" }, "projetos"),
    ).toBe("Irati/PR");
    expect(municipioUfDaLinha(linha, "saude-indigena")).toBeNull();
  });
});

describe("parecer sob demanda", () => {
  it("sabe quando a linha veio sem o parecer", () => {
    expect(linhaSemParecer({ id: "1" })).toBe(true);
    expect(linhaSemParecer({ id: "1", analise: null })).toBe(false);
    expect(linhaSemParecer({ id: "1", analise: "Apto" })).toBe(false);
    expect(haLinhasSemParecer([{ analise: "" }, { id: "2" }])).toBe(true);
    expect(haLinhasSemParecer([{ analise: "" }])).toBe(false);
    expect(haLinhasSemParecer(null)).toBe(false);
  });

  it("monta o mapa pelos nomes das colunas", () => {
    const mapa = mapaDosPareceres({
      columns: ["id", "analise"],
      rows: [
        ["a", "Apto"],
        ["b", "  texto com espaço  "],
        [null, "sem id"],
      ],
    });
    expect([...mapa]).toEqual([
      ["a", "Apto"],
      ["b", "  texto com espaço  "],
    ]);
    expect(mapaDosPareceres({ columns: ["id"], rows: [["a"]] }).size).toBe(0);
    expect(mapaDosPareceres(null).size).toBe(0);
  });

  it("põe o parecer só nas linhas sem ele, e null para quem não tem no banco", () => {
    const linhas = [{ id: "a" }, { id: "b" }, { id: "c", analise: "já veio" }];
    const alteradas = mesclarPareceres(linhas, new Map([["a", "Apto"]]));
    expect(alteradas).toEqual([linhas[0], linhas[1]]);
    expect(linhas.map((linha) => linha.analise)).toEqual([
      "Apto",
      null,
      "já veio",
    ]);
    expect(mesclarPareceres(linhas, new Map([["a", "outro"]]))).toEqual([]);
  });

  it("lê o parecer do detalhe", () => {
    expect(parecerDoDetalhe({ id: "a", analise: "Apto" })).toBe("Apto");
    expect(parecerDoDetalhe([{ id: "a", analise: "Apto" }])).toBe("Apto");
    expect(parecerDoDetalhe({ id: "a", analise: null })).toBeNull();
    expect(parecerDoDetalhe(null)).toBeNull();
  });
});
