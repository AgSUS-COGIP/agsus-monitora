import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calcularEntrevista } from "../src/lib/conducao-de-entrevista.js";

/*
  Casos dourados do cálculo da entrevista, compartilhados com o Python
  (tests/python/test_entrevistas_calculo.py, monitora.entrevistas.calculo) e
  escritos pela regra do banco (private."FC_CALCULAR_ENTREVISTA"). Mudou a regra
  num lado sem mudar no outro, um dos testes cai.
*/
const DADOS = JSON.parse(
  readFileSync("tests/fixtures/entrevistas/casos-de-calculo.json", "utf8"),
);

function entrada(caso) {
  const roteiro = { ...DADOS.roteiros[caso.roteiro] };
  if ("nota_minima_total" in caso)
    roteiro.nota_minima_total = caso.nota_minima_total;
  const avaliacoes = Object.entries(caso.notas).flatMap(
    ([competencia, notas]) =>
      notas.map((nota, i) => ({ competencia, avaliador: `a${i + 1}`, nota })),
  );
  return { roteiro, compareceu: caso.compareceu, avaliacoes };
}

describe("cálculo da entrevista: casos dourados JS × Python × banco", () => {
  it("tem casos suficientes", () => {
    expect(DADOS.casos.length).toBeGreaterThanOrEqual(10);
  });

  for (const caso of DADOS.casos) {
    it(caso.nome, () => {
      const r = calcularEntrevista(entrada(caso));
      expect(r.competencias.map((c) => c.nota)).toEqual(caso.esperado.notas);
      expect(r.total).toBe(caso.esperado.total);
      expect(r.parecer).toBe(caso.esperado.parecer);
    });
  }
});
