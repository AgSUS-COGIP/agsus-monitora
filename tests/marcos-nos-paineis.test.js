import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initMarcosDoAno } from "../src/modules/marcos-do-ano.js";
import {
  publicarLinhasDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../src/componentes/dados-do-monitoramento.js";
import { avaliarMarcosDasAnalises } from "../src/analises/analises-marcos.js";
import { esquecerComemoracoesDoPainel } from "../src/modules/comemoracao.js";

/*
  Onde os marcos aparecem: o card de marcos do ano na Visão geral e o aviso
  de edital concluído / fila zerada no painel de análises.
*/

const PERFIL = { id: "p1", user_id: "u1", nome: "Ana" };
const ligado = () => ({ comemoracoes: true });

function supabaseComMarcos(concluidas) {
  return {
    rpc: vi.fn(async (nome) =>
      nome === "obter_marcos_da_area"
        ? {
            data: {
              area: "saude-indigena",
              ano: 2026,
              concluidas_no_ano: concluidas,
              concluidas_total: concluidas + 100,
            },
            error: null,
          }
        : { data: { sistema: { comemoracoes: true } }, error: null },
    ),
  };
}

const esperar = () => new Promise((ok) => setTimeout(ok, 0));

describe("marcos do ano na Visão geral", () => {
  let desligar = () => {};
  beforeEach(() => {
    localStorage.clear();
    redefinirDadosDoMonitoramento();
    document.body.innerHTML = '<div id="marcosDoAno" hidden></div>';
  });
  afterEach(() => {
    desligar();
    redefinirDadosDoMonitoramento();
    document.body.innerHTML = "";
  });

  const montar = (supabase, obterSituacao = ligado) => {
    desligar = initMarcosDoAno({
      obterPerfil: () => PERFIL,
      supabase,
      obterSituacao,
    });
  };
  const card = () => document.getElementById("marcosDoAno");

  it("primeira leitura grava a linha de base; o marco novo aparece uma vez e fecha no ×", async () => {
    montar(supabaseComMarcos(7400));
    publicarLinhasDoMonitoramento([]);
    await esperar();
    expect(card().hidden).toBe(true);
    desligar();

    const supabase = supabaseComMarcos(7600);
    montar(supabase);
    publicarLinhasDoMonitoramento([]);
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("obter_marcos_da_area", {
      p_area: "saude-indigena",
    });
    expect(card().hidden).toBe(false);
    expect(card().textContent).toContain(
      "🎉 A equipe da Saúde Indígena passou de 7.500 análises concluídas em 2026!",
    );
    card().querySelector("button").click();
    expect(card().hidden).toBe(true);
    desligar();

    // Voltou: o mesmo marco não aparece de novo.
    montar(supabaseComMarcos(7700));
    publicarLinhasDoMonitoramento([]);
    await esperar();
    expect(card().hidden).toBe(true);
  });

  it("comemorações desligadas: nem consulta o banco", async () => {
    const supabase = supabaseComMarcos(9000);
    montar(supabase, () => ({ comemoracoes: false }));
    publicarLinhasDoMonitoramento([]);
    await esperar();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(card().hidden).toBe(true);
  });
});

describe("marcos do painel de análises", () => {
  beforeEach(() => {
    localStorage.clear();
    esquecerComemoracoesDoPainel();
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
  const avaliar = (status, escopo = "ativo") =>
    avaliarMarcosDasAnalises({
      supabase: supabaseComMarcos(0),
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
      "Fila de análises zerada na SEDE! Parabéns, equipe. 🎉",
    ]);
    expect(document.querySelector(".comemoracao")).not.toBeNull();
  });

  it("fora do escopo Ativo, não avalia", async () => {
    expect(await avaliar("Pendente", "todos")).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});
