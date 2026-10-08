import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { avaliarMarcosDasAnalises } from "../src/modulos/analises/marcos.ts";

/*
  Onde os marcos aparecem: o aviso de edital concluído / fila zerada na tela
  de Análises curriculares. O card de marcos do ano na Visão geral (React) é
  testado em tests/modulos/visao-geral.test.js.
*/

describe("marcos de Análises curriculares", () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = () => ({ matches: true });
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete window.matchMedia;
  });

  const linhas = (status) => [
    { edital: "05/2026", unidade: "SEDE", status_consolidado: "Aprovado" },
    { edital: "05/2026", unidade: "SEDE", status_consolidado: status },
  ];
  const avaliar = (status, escopo = "ativo", ligadas = true) =>
    avaliarMarcosDasAnalises({
      ligadas,
      usuarioId: "u1",
      area: "sede",
      nomeDaArea: "SEDE",
      escopo,
      linhas: linhas(status),
    });

  it("edital e fila: linha de base, depois o aviso na transição", async () => {
    expect(await avaliar("Pendente")).toBeNull();
    const comemoracao = await avaliar("Reprovado");
    expect(comemoracao.texto).toBe(
      "Edital 05/2026 · SEDE concluído! 🎉 Todas as análises foram feitas.",
    );
    expect(comemoracao.itens).toEqual([
      "Fila de análises zerada! Obrigado, equipe da SEDE. 🎉",
    ]);
    expect(document.querySelector(".comemoracao")).not.toBeNull();
  });

  it("comemorações desligadas: guarda o estado em silêncio, sem aviso", async () => {
    expect(await avaliar("Pendente", "ativo", false)).toBeNull();
    expect(await avaliar("Reprovado", "ativo", false)).toBeNull();
    expect(document.querySelector(".comemoracao")).toBeNull();
    expect(localStorage.length).toBe(1);
  });

  it("fora do escopo Ativo, não avalia", async () => {
    expect(await avaliar("Pendente", "todos")).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});
