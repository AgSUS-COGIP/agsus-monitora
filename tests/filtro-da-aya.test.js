import { describe, expect, it } from "vitest";
import {
  filtrosDaSelecao,
  filtrosDasAnalises,
  filtrosDeEntrevistas,
  filtrosDeRecursos,
  opcoesDoEdital,
} from "../src/lib/filtro-da-aya.js";

/*
  O "Abrir" das respostas com número da Aya vira os filtros de cada tela
  (src/lib/filtro-da-aya.js): o edital pelo número, a métrica pelo filtro
  do indicador; o que não casa fica como estava.
*/

describe("filtro pedido pela Aya", () => {
  it("edital pelo número, em opções de objeto ou de texto", () => {
    expect(
      opcoesDoEdital(
        [
          { valor: "10", rotulo: "Edital 93/2026 · DSEI X" },
          { valor: "11", rotulo: "Edital 12/2026" },
        ],
        "93/2026",
      ),
    ).toEqual(["10"]);
    expect(opcoesDoEdital(["93/2025", "93/2026"], "93")).toEqual([
      "93/2025",
      "93/2026",
    ]);
    expect(opcoesDoEdital(["93/2026"], "")).toEqual([]);
  });

  it("Recursos: edital pelo id e o indicador", () => {
    const opcoes = { editais: [{ valor: "7", rotulo: "93/2026 · DSEI" }] };
    expect(
      filtrosDeRecursos(
        { edital: "", situacao: "", pendencia: "" },
        { edital: "93/2026", metrica: "atrasados" },
        opcoes,
      ),
    ).toEqual({ edital: "7", situacao: "", pendencia: "prazo_vencido" });
    expect(
      filtrosDeRecursos({ edital: "1" }, { edital: "5/2020" }, opcoes),
    ).toEqual({ edital: "1" });
  });

  it("Entrevistas e Seleção", () => {
    expect(
      filtrosDeEntrevistas(
        { edital: "", parecer: "" },
        { edital: "93/2026", metrica: "aptos" },
        { editais: [{ valor: "93/2026", rotulo: "93/2026" }] },
      ),
    ).toEqual({ edital: "93/2026", parecer: "APTO" });
    expect(
      filtrosDaSelecao(
        { editais: [], unidades: [] },
        { edital: "93/2026" },
        { editais: ["Edital 93/2026", "Edital 1/2026"] },
      ),
    ).toEqual({ editais: ["Edital 93/2026"], unidades: [] });
  });
});

describe("Análises", () => {
  it("editais pelo valor da linha e o KPI da métrica", () => {
    const linhas = [{ edital: "110/2026" }, { edital: "12/2026" }, {}];
    expect(
      filtrosDasAnalises(
        { edital: [], status: [] },
        { edital: "110/2026", metrica: "pendente" },
        linhas,
      ),
    ).toEqual({
      filtros: { edital: ["110/2026"], status: [] },
      kpi: "pendente",
    });
    expect(
      filtrosDasAnalises(
        { edital: ["x"] },
        { metrica: "total" },
        linhas,
        "revisar",
      ),
    ).toEqual({ filtros: { edital: ["x"] }, kpi: "revisar" });
  });
});
