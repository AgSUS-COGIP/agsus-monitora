// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VinculosDoQuadro } from "../../src/modulos/editais/vinculos-do-quadro.tsx";
import type { EstadoDosVinculos } from "../../src/modulos/editais/vinculos-do-quadro.tsx";
import { clicar, escolher, esperar } from "./interacoes.ts";
import { desenharNoTeste } from "../montar-tela.ts";

/*
  A fila do vínculo vaga ↔ linha do quadro no quadro salvo do edital (20261118120000): as três
  situações, a equipe confirma ou marca "sem linha" pela RPC, e o edital sem vaga com código diz
  por quê, sem inventar vaga.
*/

const L1 = { id: "l1", cargo: "Enfermeiro", lotacao: "Polo Base Alfa" };
const L2 = { id: "l2", cargo: "Enfermeiro", lotacao: "Polo Base Beta" };

const quadro = (vinculos: unknown[], extra: Record<string, unknown> = {}) => ({
  linhas: [L1, L2],
  vagas_do_edital: "COM_CODIGO",
  pode_editar: true,
  vinculos,
  ...extra,
});

const AMBIGUA = {
  vaga: "1002",
  cargo: "Enfermeiro",
  situacao: "AMBIGUO",
  origem: "AUTOMATICO",
  regra: "NOME",
  candidatas: [L1, L2],
};
const CONFIRMADA = {
  vaga: "1001",
  cargo: "Enfermeiro - Polo Base Alfa",
  situacao: "CONFIRMADO",
  origem: "AUTOMATICO",
  regra: "NOME",
  quadro: "l1",
  cargo_quadro: "Enfermeiro",
  lotacao_quadro: "Polo Base Alfa",
};

let desmontar = () => {};
afterEach(() => {
  act(() => desmontar());
  document.body.innerHTML = "";
});

function montar(inicial: unknown, estado: EstadoDosVinculos) {
  document.body.innerHTML = `<div id="raiz"></div>`;
  function Casca() {
    const [dados, setDados] = useState<unknown>(inicial);
    return createElement(VinculosDoQuadro, {
      estado,
      idEdital: "e1",
      dados,
      aoMudar: setDados,
    });
  }
  act(() => {
    ({ desmontar } = desenharNoTeste(
      document.getElementById("raiz")!,
      createElement(Casca),
    ));
  });
}

const texto = () => document.body.textContent ?? "";

describe("VinculosDoQuadro", () => {
  it("resume as três situações e abre nas ambíguas", async () => {
    montar(quadro([CONFIRMADA, AMBIGUA]), { confirmar: () => true });
    await esperar();
    expect(texto()).toContain("1 confirmada · 1 ambígua · 0 ausentes");
    await clicar(document.getElementById("vinculosVer"));
    expect(document.querySelector('tr[data-vaga="1002"]')).not.toBeNull();
    expect(document.querySelector('tr[data-vaga="1001"]')).toBeNull();
    expect(texto()).toContain("2 linhas possíveis");
  });

  it("confirma a linha escolhida e mostra o quadro devolvido", async () => {
    const gravarVinculoDoQuadro = vi.fn(async () =>
      quadro([
        CONFIRMADA,
        {
          ...AMBIGUA,
          situacao: "CONFIRMADO",
          origem: "MANUAL",
          quadro: "l2",
          cargo_quadro: "Enfermeiro",
          lotacao_quadro: "Polo Base Beta",
        },
      ]),
    );
    montar(quadro([CONFIRMADA, AMBIGUA]), {
      confirmar: () => true,
      gravarVinculoDoQuadro,
    });
    await esperar();
    await clicar(document.getElementById("vinculosVer"));
    const linha = document.querySelector('tr[data-vaga="1002"]')!;
    await escolher(linha.querySelector("select"), "l2");
    const confirmar = [...linha.querySelectorAll("button")].find(
      (b) => b.textContent === "Confirmar",
    );
    await clicar(confirmar);
    await esperar();
    expect(gravarVinculoDoQuadro).toHaveBeenCalledWith(
      "e1",
      "1002",
      "CONFIRMAR",
      "l2",
    );
    expect(texto()).toContain("2 confirmadas · 0 ambíguas · 0 ausentes");
    expect(texto()).toContain("Vaga 1002 ligada à linha escolhida.");
  });

  it("'sem linha' pede confirmação antes de gravar", async () => {
    const gravarVinculoDoQuadro = vi.fn(async () => quadro([AMBIGUA]));
    const confirmar = vi.fn(() => false);
    montar(quadro([AMBIGUA]), { confirmar, gravarVinculoDoQuadro });
    await esperar();
    await clicar(document.getElementById("vinculosVer"));
    const sem = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === "Sem linha",
    );
    await clicar(sem);
    expect(confirmar).toHaveBeenCalledWith(
      "A vaga 1002 não tem linha no quadro de vagas?",
    );
    expect(gravarVinculoDoQuadro).not.toHaveBeenCalled();
  });

  it("quem não edita só vê", async () => {
    montar(quadro([AMBIGUA], { pode_editar: false }), {
      confirmar: () => true,
      gravarVinculoDoQuadro: vi.fn(),
    });
    await esperar();
    await clicar(document.getElementById("vinculosVer"));
    expect(document.querySelector("tr[data-vaga] select")).toBeNull();
    expect(document.getElementById("vinculosAtualizar")).toBeNull();
  });

  it("banco antes da migration (sem vagas_do_edital): a fila não aparece", async () => {
    montar(
      {
        linhas: [L1],
        vinculos: [{ vaga: "1", cargo: "Enfermeiro", quadro: null }],
      },
      { confirmar: () => true },
    );
    await esperar();
    expect(texto()).toBe("");
  });

  it("edital sem vaga com código: o motivo, sem vaga inventada", async () => {
    montar(quadro([], { vagas_do_edital: "EXTERNO" }), {
      confirmar: () => true,
    });
    await esperar();
    expect(texto()).toContain("Externo: vagas de outra origem, sem código.");
    expect(document.getElementById("vinculosVer")).toBeNull();
  });
});
