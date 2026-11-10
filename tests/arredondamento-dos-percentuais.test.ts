import { describe, expect, it } from "vitest";
import { calcularKpis } from "../src/lib/analises-curriculares.ts";
import {
  aptosEEliminados,
  formatarTaxa,
} from "../src/lib/selecao-do-painel.ts";
import type { VagaDaSelecao } from "../src/modulos/selecao/tipos.ts";

/*
  Auditoria dos cálculos (10/11/2026): dividir antes de multiplicar deixava o
  meio abaixo de .5 por causa da vírgula flutuante (29/200 dava 14%, 201/400
  dava 50,2%), e uma taxa de conclusão de 995/1.000 aparecia como 100% com
  itens pendentes.
*/
describe("arredondamento dos percentuais", () => {
  it("a taxa da Seleção arredonda o meio para cima", () => {
    expect(formatarTaxa(201 / 400)).toBe("50,3%");
    expect(formatarTaxa(1 / 3)).toBe("33,3%");
    expect(formatarTaxa(0.25)).toBe("25%");
  });

  it("a conclusão das análises só chega a 100% sem pendência", () => {
    const linhas = (aprovadas: number, pendentes: number) => [
      ...Array.from({ length: aprovadas }, () => ({
        status_consolidado: "Aprovado",
      })),
      ...Array.from({ length: pendentes }, () => ({
        status_consolidado: "Pendente",
      })),
    ];
    expect(calcularKpis(linhas(995, 5)).taxa).toBe(99);
    expect(calcularKpis(linhas(1000, 0)).taxa).toBe(100);
    expect(calcularKpis(linhas(29, 171)).taxa).toBe(15);
  });
});

describe("Aptos na análise e eliminados", () => {
  const vaga = (parcial: Partial<VagaDaSelecao>): VagaDaSelecao => ({
    id: "1",
    edital_id: 1,
    edital: "01/2026",
    edital_planilha: "01/2026",
    unidade: "DSEI X",
    vaga: null,
    vagaPlanilha: "",
    cargo: "Enfermeiro",
    observacao: null,
    origemConvocados: "planilha",
    busca: "",
    inscritos: null,
    aptos: null,
    cancelados: null,
    reprovadosQuestionario: null,
    eliminadosNota: null,
    reprovadosAnalise: null,
    triados: null,
    totalEliminados: null,
    convocados: null,
    aprovados: null,
    contratados: null,
    naoContratados: null,
    ...parcial,
  });

  it("eliminados é a soma de cancelados, questionário e nota, não a coluna da planilha", () => {
    // A coluna da planilha já soma os 40 reprovados na análise.
    const vagas = [
      vaga({
        aptos: 100,
        cancelados: 5,
        reprovadosQuestionario: 10,
        eliminadosNota: 15,
        reprovadosAnalise: 40,
        totalEliminados: 70,
      }),
    ];
    expect(aptosEEliminados(vagas).map((x) => x.valor)).toEqual([100, 30]);
  });
});
