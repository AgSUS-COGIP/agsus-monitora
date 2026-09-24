import { describe, expect, it } from "vitest";
import {
  dataPlausivel,
  editaisComDatasARevisar,
  etapaComDatasValidas,
  proximasEtapas,
} from "../src/lib/datas-do-cronograma.js";

const etapa = (atividade, data_inicio, data_fim, extra = {}) => ({
  atividade,
  data_inicio,
  data_fim,
  edital: "05/2026",
  unidade: "DSEI Xavante",
  ordem: 0,
  ...extra,
});

describe("datas do cronograma", () => {
  it("ano digitado errado não é data possível", () => {
    expect(dataPlausivel("2026-10-09")).toBe(true);
    expect(dataPlausivel("0202-10-09")).toBe(false);
    expect(dataPlausivel("2206-03-27")).toBe(false);
    expect(dataPlausivel("")).toBe(false);
  });

  it("fim antes do início também é inválido", () => {
    expect(etapaComDatasValidas(etapa("x", "2026-10-09", "2026-10-01"))).toBe(
      false,
    );
    expect(etapaComDatasValidas(etapa("x", "2026-10-09", "2026-10-10"))).toBe(
      true,
    );
  });

  it("próximas etapas vêm pela data que importa, não pelo início", () => {
    const hoje = "2026-09-24";
    const lista = proximasEtapas(
      [
        etapa("Recurso aberto desde agosto", "2026-08-01", "2026-09-25"),
        etapa("Entrevistas", "2026-09-28", "2026-10-02"),
        etapa("Resultado", "2026-10-09", "2026-10-09"),
        etapa("Ano errado", "0202-10-09", "2026-10-10"),
        etapa("Já acabou", "2026-09-01", "2026-09-10"),
      ],
      hoje,
    );
    expect(lista.map((e) => e.atividade)).toEqual([
      "Recurso aberto desde agosto",
      "Entrevistas",
      "Resultado",
    ]);
  });

  it("lista os editais que precisam de correção", () => {
    expect(
      editaisComDatasARevisar([
        etapa("a", "0202-10-09", "2026-10-10"),
        etapa("b", "2026-03-26", "2206-03-27"),
        etapa("c", "2026-03-26", "2026-03-27", { edital: "06/2026" }),
      ]),
    ).toEqual([{ edital: "05/2026 • DSEI Xavante", etapasComProblema: 2 }]);
  });
});
