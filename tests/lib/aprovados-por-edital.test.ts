import { describe, expect, it } from "vitest";
import {
  aprovadosPorEdital,
  avisoDaListaDoEdital,
} from "../../src/lib/editais/aprovados-por-edital.ts";

const SEM = {
  tom: "aviso",
  texto: "Nenhum candidato foi aprovado neste edital",
};

describe("aprovados por edital", () => {
  it("conta os candidatos da lista vigente de cada edital", () => {
    const mapa = aprovadosPorEdital([
      { edital_id: "10", total_candidatos: 3 },
      { edital_id: "11", total_candidatos: "0" },
      { edital_id: "", total_candidatos: 5 },
    ]);
    expect(mapa.get("10")).toBe(3);
    expect(mapa.get("11")).toBe(0);
    expect(mapa.size).toBe(2);
  });

  it("resposta que não é lista vira mapa vazio", () => {
    expect(aprovadosPorEdital(null).size).toBe(0);
  });

  it("concluído sem lista ou com lista vazia: amarelo, sem aprovados", () => {
    const mapa = aprovadosPorEdital([
      { edital_id: "10", total_candidatos: 3 },
      { edital_id: "11", total_candidatos: 0 },
    ]);
    expect(avisoDaListaDoEdital(mapa, "10", "Concluído")).toBeNull();
    expect(avisoDaListaDoEdital(mapa, 11, "Concluído")).toEqual(SEM);
    expect(avisoDaListaDoEdital(mapa, "12", " CONCLUIDO ")).toEqual(SEM);
  });

  it("cancelado ou suspenso: vermelho, com o status na legenda", () => {
    const mapa = aprovadosPorEdital([{ edital_id: "10", total_candidatos: 3 }]);
    expect(avisoDaListaDoEdital(mapa, "10", "Cancelado")).toEqual({
      tom: "perigo",
      texto: "Edital cancelado",
    });
    expect(avisoDaListaDoEdital(null, "12", "Suspenso")).toEqual({
      tom: "perigo",
      texto: "Edital suspenso",
    });
  });

  it("edital ainda em curso nunca tem aviso", () => {
    const mapa = aprovadosPorEdital([]);
    expect(avisoDaListaDoEdital(mapa, "12", "Em andamento")).toBeNull();
    expect(avisoDaListaDoEdital(mapa, "12", "Planejado")).toBeNull();
  });

  it("concluído sem as listas carregadas: sem aviso", () => {
    expect(avisoDaListaDoEdital(null, "12", "Concluído")).toBeNull();
  });
});
