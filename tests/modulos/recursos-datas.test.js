import { describe, expect, it } from "vitest";
import { dataHora } from "../../src/modulos/recursos/partes.ts";

/*
  Datas da gaveta de Recursos sempre no horário de Brasília: antes, o fuso do
  computador de quem abria decidia (um recurso das 23h podia aparecer no dia
  seguinte).
*/
describe("data e hora dos Recursos", () => {
  it("mostra o horário de Brasília, qualquer que seja o fuso da máquina", () => {
    const texto = dataHora("2026-10-02T02:30:00Z");
    expect(texto).toContain("01/10/2026");
    expect(texto).toContain("23:30");
  });

  it("vazio fica vazio", () => {
    expect(dataHora(null)).toBe("");
  });
});
