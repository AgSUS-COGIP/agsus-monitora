import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  avaliarMarcosDasAnalises,
  comemorarMetaDoDia,
} from "../src/modulos/analises/marcos.ts";
import { calcularRitmo } from "../src/lib/ritmo-da-analise.ts";

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

describe("meta de hoje batida pela equipe (Ritmo da análise)", () => {
  const HOJE = "2026-10-19";
  const ritmo = (feitoHoje) =>
    calcularRitmo(
      {
        id: "e1",
        edital: "114/2026",
        situacoes: {
          pendente: 600,
          em_analise: 0,
          revisar: 0,
          concluida: 400,
          fora_lote: 0,
        },
        porDia: [{ dia: HOJE, qt: feitoHoje }],
        qtEquipe: 5,
        qtAvaliadoresRecentes: 5,
        cronograma: [
          {
            ordem: 1,
            atividade: "Análise documental",
            tipo: null,
            inicio: "2026-10-15",
            fim: "2026-10-22",
          },
        ],
      },
      { hoje: HOJE, hora: 15 },
    );
  const batida = [ritmo(400)];

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    document.body.innerHTML = "";
    delete window.matchMedia;
  });

  it("comemora uma vez por dia por pessoa (guardado no navegador)", () => {
    const soltar = vi.fn();
    const chamar = (hoje = HOJE, usuario = "u1") =>
      comemorarMetaDoDia({
        ritmos: batida,
        hoje,
        usuario,
        ligadas: true,
        soltar,
      });
    expect(chamar()).toBe(true);
    expect(chamar()).toBe(false);
    expect(soltar).toHaveBeenCalledTimes(1);
    expect(soltar.mock.calls[0][0]).toMatchObject({
      texto: "Meta de hoje batida pela equipe! 🎉",
      marco: "meta-do-dia",
    });
    expect(chamar(HOJE, "u2")).toBe(true); // outra pessoa
    expect(chamar("2026-10-20")).toBe(true); // outro dia
    expect(soltar).toHaveBeenCalledTimes(3);
  });

  it("sem meta batida, nada", () => {
    const soltar = vi.fn();
    expect(
      comemorarMetaDoDia({
        ritmos: [ritmo(10)],
        hoje: HOJE,
        usuario: "u1",
        ligadas: true,
        soltar,
      }),
    ).toBe(false);
    expect(soltar).not.toHaveBeenCalled();
  });

  it("comemorações desligadas no sistema: nada, e religar no mesmo dia ainda comemora", () => {
    const soltar = vi.fn();
    const chamar = (ligadas) =>
      comemorarMetaDoDia({
        ritmos: batida,
        hoje: HOJE,
        usuario: "u1",
        ligadas,
        soltar,
      });
    expect(chamar(false)).toBe(false);
    expect(localStorage.length).toBe(0);
    expect(chamar(true)).toBe(true);
    expect(soltar).toHaveBeenCalledTimes(1);
  });

  it("preferência pessoal desligada: sem aviso", () => {
    localStorage.setItem("agsus_monitora_comemoracoes_desligadas", "1");
    comemorarMetaDoDia({
      ritmos: batida,
      hoje: HOJE,
      usuario: "u1",
      ligadas: true,
    });
    expect(document.querySelector(".comemoracao")).toBeNull();
  });

  it("prefers-reduced-motion: só o aviso, sem os fogos", () => {
    window.matchMedia = () => ({ matches: true });
    comemorarMetaDoDia({
      ritmos: batida,
      hoje: HOJE,
      usuario: "u1",
      ligadas: true,
    });
    const aviso = document.querySelector(".comemoracao");
    expect(aviso?.textContent).toContain("Meta de hoje batida pela equipe!");
    expect(document.querySelector("canvas")).toBeNull();
    expect(document.querySelector(".comemoracao__pular")).toBeNull();
  });
});
