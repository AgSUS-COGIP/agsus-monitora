import { describe, expect, it } from "vitest";
import {
  analisarCronograma,
  atividadeLimpa,
  cronogramaParaSalvar,
  novaEtapa,
} from "../src/lib/cronograma-do-edital.ts";

/*
  O cronograma colado do PDF da Cebraspe chega com espaços duplos
  ("Divulgação  do  edital  de  resultado  final"): o aviso dizia que faltava
  a etapa de resultado final (Rio Doce 04/2026, 16/11/2026).
*/

const EDITAL = {
  edital: "04/2026",
  unidade: "Rio Doce",
  cronograma_automatico: true,
};
const etapas = [
  novaEtapa(
    {
      atividade: "Período  de  inscrições",
      data_inicio: "2026-02-10",
      data_fim: "2026-02-17",
    },
    1,
  ),
  novaEtapa(
    {
      atividade:
        "Divulgação  do  edital  de  resultado  final  no  processo  seletivo",
      data_inicio: "2026-04-17",
    },
    2,
  ),
];

describe("atividade com espaços duplos", () => {
  it("limpa os espaços repetidos, inclusive quebra de linha e tabulação", () => {
    expect(atividadeLimpa("  Resultado \n final\t do  edital ")).toBe(
      "Resultado final do edital",
    );
    expect(atividadeLimpa(null)).toBe("");
  });

  it("acha a etapa de resultado final com espaços duplos", () => {
    const { avisos } = analisarCronograma(EDITAL, etapas, "ajuste", {
      exigirMotivo: false,
    });
    expect(avisos).not.toContain(
      "O cronograma não possui uma etapa de resultado final.",
    );
  });

  it("acusa atividade repetida mesmo com espaços diferentes", () => {
    const repetidas = [
      ...etapas,
      novaEtapa(
        { atividade: "Período de inscrições", data_inicio: "2026-02-18" },
        3,
      ),
    ];
    const { erros } = analisarCronograma(EDITAL, repetidas, "ajuste", {
      exigirMotivo: false,
    });
    expect(erros.some((e) => e.includes("atividade duplicada"))).toBe(true);
  });

  it("grava a atividade limpa e renumerada", () => {
    const salvas = cronogramaParaSalvar([etapas[1]!, etapas[0]!]);
    expect(salvas.map((e) => [e.ordem, e.atividade])).toEqual([
      [1, "Divulgação do edital de resultado final no processo seletivo"],
      [2, "Período de inscrições"],
    ]);
    expect(salvas[0]?.data_inicio).toBe("2026-04-17");
  });
});
