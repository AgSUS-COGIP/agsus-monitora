import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  avaliarMarcosDasAnalises,
  comemorarMetaDoDia,
} from "../src/modulos/analises/marcos.ts";
import { calcularRitmo } from "../src/lib/ritmo-da-analise.ts";
import { carregarComemoracao } from "../src/app/comemoracao-sob-demanda.ts";
import { comemoracoesNaPagina } from "./shows-de-comemoracao.js";

/* O desenho da comemoração chega por import(): espera ele e o aviso. */
async function depoisDoDesenho() {
  await carregarComemoracao();
  await new Promise((resolver) => setTimeout(resolver, 0));
}

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
  comemoracoesNaPagina();

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
      "Edital 05/2026 · SEDE: todas as análises concluídas!",
    );
    expect(comemoracao.itens).toEqual([
      "Fila zerada, nenhuma análise pendente. Obrigado, equipe da SEDE!",
    ]);
    await depoisDoDesenho();
    expect(document.querySelector(".comemoracao")).not.toBeNull();
  });

  it("comemorações desligadas: guarda o estado em silêncio, sem aviso", async () => {
    expect(await avaliar("Pendente", "ativo", false)).toBeNull();
    expect(await avaliar("Reprovado", "ativo", false)).toBeNull();
    await depoisDoDesenho();
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
  comemoracoesNaPagina();

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
      texto: "Meta de hoje batida! Obrigado, equipe.",
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

  it("preferência pessoal desligada: sem aviso", async () => {
    localStorage.setItem("agsus_monitora_comemoracoes_desligadas", "1");
    comemorarMetaDoDia({
      ritmos: batida,
      hoje: HOJE,
      usuario: "u1",
      ligadas: true,
    });
    await depoisDoDesenho();
    expect(document.querySelector(".comemoracao")).toBeNull();
  });

  it("prefers-reduced-motion: só o aviso, sem os fogos", async () => {
    window.matchMedia = () => ({ matches: true });
    comemorarMetaDoDia({
      ritmos: batida,
      hoje: HOJE,
      usuario: "u1",
      ligadas: true,
    });
    await depoisDoDesenho();
    const aviso = document.querySelector(".comemoracao");
    expect(aviso?.textContent).toContain("Meta de hoje batida!");
    expect(document.querySelector("canvas")).toBeNull();
    expect(document.querySelector(".comemoracao__pular")).toBeNull();
  });
});
