import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  errosDaRegraDaTriagem,
  obterRegraDaTriagem,
  resumoDaRegraDaTriagem,
  salvarRegraDaTriagem,
  textoDoLote,
} from "../../src/lib/triagem/regra-da-triagem.ts";
import { CONTRATO_RPC } from "../../src/lib/rpc-contrato.js";
import { ModalDaRegraDaTriagem } from "../../src/modulos/triagem/modal-da-regra.tsx";
import { abrirRegrasDoEdital } from "../../src/modulos/triagem/usar-regra-da-triagem.ts";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/* A seção migrada do 93/2026 no ensaio (tests/fixtures/avaliacao-documental). */
const ENSAIO = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/regras-da-triagem-no-ensaio.json",
    "utf8",
  ),
);
const DO_93 = ENSAIO.find((e) => e.rotulo === "93/2026").triagem;

describe("regra da Triagem: contrato e resumo", () => {
  it("as três RPCs estão no contrato", () => {
    expect(CONTRATO_RPC.obter_regra_triagem.argumentos).toEqual(["p_edital"]);
    expect(CONTRATO_RPC.salvar_regra_triagem.argumentos).toEqual([
      "p_edital",
      "p_configuracao",
      "p_versao_atual",
      "p_motivo",
      "p_nome",
    ]);
    expect(CONTRATO_RPC.conferir_regra_triagem.argumentos).toEqual([
      "p_edital",
      "p_versao",
    ]);
  });

  it("resume a regra migrada do 93/2026 em linhas curtas", () => {
    const linhas = Object.fromEntries(
      resumoDaRegraDaTriagem(DO_93).map((l) => [l.rotulo, l.valor]),
    );
    expect(Object.keys(linhas)).toEqual([
      "Requisitos",
      "Nota da lista",
      "Tolerância ART × declarada",
      "Desempate",
      "Lote",
    ]);
    expect(linhas.Lote).toContain("nota mínima 15 (item 8.2.6)");
    expect(linhas["Nota da lista"]).toMatch(/^nota declarada recalculada/);
    expect(resumoDaRegraDaTriagem(null)).toEqual([]);
  });

  it("o lote sem regra usa o padrão do cálculo (3 × as vagas)", () => {
    expect(textoDoLote(undefined)).toMatch(/^3 × as vagas/);
    expect(textoDoLote({ base: "FIXO", fixo: 120 })).toMatch(
      /^120 inscritos por vaga/,
    );
  });

  it("a validação da tela pega o óbvio; a do banco vale", () => {
    expect(errosDaRegraDaTriagem(DO_93)).toEqual([]);
    expect(
      errosDaRegraDaTriagem({
        formato: 1,
        lote: { base: "FIXO" },
        requisitos: { eliminacao_automatica: [{ codigo: "x", motivo: "" }] },
        nota: { base_da_nota: "DECLARADA", nota_declarada: [] },
      }),
    ).toEqual([
      "Lote: número fixo de 1 a 100.000.",
      "Eliminação 1: código em maiúsculas.",
      "Eliminação 1: informe o motivo.",
      "Base da nota pela declarada: configure a nota declarada.",
    ]);
  });

  it("chama as RPCs com os argumentos do contrato e devolve o erro do banco", async () => {
    const rpc = vi.fn(async () => ({
      data: { regra: { versao: 2 } },
      error: null,
    }));
    await salvarRegraDaTriagem(
      { rpc },
      {
        edital: "e93",
        configuracao: DO_93,
        versaoAtual: 1,
        motivo: "Motivo da mudança",
      },
    );
    expect(rpc).toHaveBeenCalledWith("salvar_regra_triagem", {
      p_edital: "e93",
      p_configuracao: DO_93,
      p_versao_atual: 1,
      p_motivo: "Motivo da mudança",
      p_nome: null,
    });
    const falha = {
      rpc: async () => ({ data: null, error: { message: "Sem permissão" } }),
    };
    await expect(obterRegraDaTriagem(falha, "e93")).rejects.toThrow(
      "Sem permissão",
    );
  });

  it("Editar nas Regras do edital abre Editais com o modal da regra", () => {
    const janela = {
      navigate: vi.fn(),
      nucleoController: { abrirRegrasDaTriagem: vi.fn() },
    };
    expect(abrirRegrasDoEdital("e93", janela)).toBe(true);
    expect(janela.navigate).toHaveBeenCalledWith("nucleo");
    expect(janela.nucleoController.abrirRegrasDaTriagem).toHaveBeenCalledWith(
      "e93",
    );
    expect(abrirRegrasDoEdital("e93", {})).toBe(false);
  });
});

describe("modal das Regras da Triagem", () => {
  let raiz = null;
  afterEach(async () => {
    await act(async () => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });

  async function montar(pode) {
    const chamadas = [];
    let regra = {
      versao: 1,
      situacao: "CONFERIR",
      configuracao: DO_93,
      versoes: [{ versao: 1, nome: "Migrada da regra da análise" }],
    };
    const cliente = {
      rpc: vi.fn(async (nome, args) => {
        chamadas.push([nome, args]);
        if (nome === "obter_regra_triagem")
          return { data: { pode_coordenar: pode, regra }, error: null };
        if (nome === "salvar_regra_triagem") {
          regra = { ...regra, versao: 2, configuracao: args.p_configuracao };
          return { data: { regra }, error: null };
        }
        if (nome === "conferir_regra_triagem") {
          regra = { ...regra, situacao: "CONFERIDA" };
          return { data: { regra }, error: null };
        }
        return { data: null, error: null };
      }),
    };
    const div = document.createElement("div");
    document.body.appendChild(div);
    await act(async () => {
      raiz = createRoot(div);
      raiz.render(
        createElement(ModalDaRegraDaTriagem, {
          edital: "e93",
          titulo: "93/2026",
          cliente,
          aoFechar: () => {},
        }),
      );
    });
    await act(async () => {});
    return chamadas;
  }

  const botao = (texto) =>
    [...document.querySelectorAll("button")].find((b) =>
      b.textContent.includes(texto),
    );

  it("quem não coordena só lê: sem salvar nem conferir", async () => {
    await montar(false);
    expect(document.body.textContent).toContain("só para leitura");
    expect(botao("Salvar versão nova")).toBeUndefined();
    expect(document.querySelector("fieldset").disabled).toBe(true);
  });

  it("quem coordena salva versão nova com motivo e confere", async () => {
    const chamadas = await montar(true);
    await act(async () => botao("Salvar versão nova").click());
    expect(document.body.textContent).toContain("Informe o motivo");
    const motivo = [...document.querySelectorAll("textarea")].at(-1);
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      ).set;
      set.call(motivo, "Ajuste do lote pela coordenação");
      motivo.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => botao("Salvar versão nova").click());
    await act(async () => {});
    const salvar = chamadas.find(([n]) => n === "salvar_regra_triagem");
    expect(salvar[1].p_versao_atual).toBe(1);
    expect(salvar[1].p_configuracao.lote).toEqual(DO_93.lote);
    expect(salvar[1].p_configuracao.requisitos).toEqual(DO_93.requisitos);
    expect(document.body.textContent).toContain("Versão 2 salva");
    await act(async () => botao("Conferir versão 2").click());
    await act(async () => {});
    expect(chamadas.some(([n]) => n === "conferir_regra_triagem")).toBe(true);
  });
});
