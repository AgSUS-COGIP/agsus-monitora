import { describe, expect, it } from "vitest";
import {
  ITENS_POR_VEZ,
  gruposAteOLimite,
  totalDosGrupos,
} from "../../src/lib/carga/carga-continua.ts";

/*
  O recorte das listas em blocos (agenda por dia, convocação por vaga,
  aprovados sem entrevista por vaga): até o limite de itens, cortando o grupo
  que passa dele. Desenhar tudo de uma vez travava a tela com milhares.
*/

interface Grupo {
  chave: string;
  itens: number[];
}

const grupo = (chave: string, quantos: number): Grupo => ({
  chave,
  itens: Array.from({ length: quantos }, (_, i) => i),
});
const contar = (g: Grupo) => g.itens.length;
const cortar = (g: Grupo, quantos: number) => ({
  ...g,
  itens: g.itens.slice(0, quantos),
});

describe("gruposAteOLimite", () => {
  it("50 por vez", () => {
    expect(ITENS_POR_VEZ).toBe(50);
  });

  it("devolve os grupos inteiros que cabem e corta o que passa do limite", () => {
    const grupos = [grupo("a", 30), grupo("b", 30), grupo("c", 30)];
    const recorte = gruposAteOLimite(grupos, 50, { contar, cortar });
    expect(recorte.grupos.map((g) => [g.chave, g.itens.length])).toEqual([
      ["a", 30],
      ["b", 20],
    ]);
    expect(recorte.mostrados).toBe(50);
    expect(recorte.total).toBe(90);
  });

  it("um grupo só com milhares desenha só o limite", () => {
    const recorte = gruposAteOLimite([grupo("a", 13_000)], 100, {
      contar,
      cortar,
    });
    expect(recorte.grupos[0]!.itens).toHaveLength(100);
    expect(recorte.mostrados).toBe(100);
    expect(recorte.total).toBe(13_000);
  });

  it("sem `cortar`, o grupo que passa do limite vem inteiro", () => {
    const grupos = [grupo("a", 40), grupo("b", 30), grupo("c", 5)];
    const recorte = gruposAteOLimite(grupos, 50, { contar });
    expect(recorte.grupos.map((g) => g.chave)).toEqual(["a", "b"]);
    expect(recorte.mostrados).toBe(70);
    expect(recorte.total).toBe(75);
  });

  it("grupo vazio conta como um (o cabeçalho dele aparece e entra na conta)", () => {
    const grupos = [grupo("a", 0), grupo("b", 2)];
    expect(totalDosGrupos(grupos, contar)).toBe(3);
    const recorte = gruposAteOLimite(grupos, 1, { contar, cortar });
    expect(recorte.grupos.map((g) => g.chave)).toEqual(["a"]);
    expect(recorte.total).toBe(3);
  });

  it("com o limite acima do total, tudo vem e nada é cortado", () => {
    const grupos = [grupo("a", 3), grupo("b", 4)];
    const recorte = gruposAteOLimite(grupos, 50, { contar, cortar });
    expect(recorte.grupos).toEqual(grupos);
    expect(recorte.mostrados).toBe(recorte.total);
  });
});
