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
import { EditorDaRegraDaTriagem } from "../../src/modulos/triagem/editor-da-regra.tsx";
import { abrirRegrasDoEdital } from "../../src/modulos/regras-do-edital/abrir.ts";

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

  it("Editar nas Regras do edital abre Editais nas Regras do edital, na etapa", () => {
    const janela = { navigate: vi.fn() };
    const editais = { abrirRegrasDoEdital: vi.fn() };
    expect(abrirRegrasDoEdital("e93", "triagem", janela, () => editais)).toBe(
      true,
    );
    expect(janela.navigate).toHaveBeenCalledWith("nucleo");
    expect(editais.abrirRegrasDoEdital).toHaveBeenCalledWith("e93", "triagem");
    expect(abrirRegrasDoEdital("e93", "triagem", {}, () => editais)).toBe(
      false,
    );
    expect(abrirRegrasDoEdital("", "triagem", janela, () => editais)).toBe(
      false,
    );
    // Navegação recusada (alteração não salva): as regras não abrem.
    editais.abrirRegrasDoEdital.mockClear();
    expect(
      abrirRegrasDoEdital(
        "e93",
        "triagem",
        { navigate: () => false },
        () => editais,
      ),
    ).toBe(false);
    expect(editais.abrirRegrasDoEdital).not.toHaveBeenCalled();
  });
});

describe("editor da regra da Triagem (Regras do edital, etapa 1)", () => {
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
        createElement(EditorDaRegraDaTriagem, { edital: "e93", cliente }),
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

  it("desempate em lista ordenada: liga, desliga e muda a ordem pelas setas", async () => {
    const chamadas = await montar(true);
    const ordem = () =>
      [...document.querySelectorAll(".triagem-criterio[data-ligado]")].map(
        (li) =>
          `${li.querySelector(".triagem-criterio__ordem").textContent} ${li.dataset.criterio}`,
      );
    const antes = ordem();
    expect(antes.length).toBeGreaterThan(0);
    expect(antes[0]).toMatch(/^1º /);
    const segundo = antes[1]?.split(" ")[1];
    if (segundo) {
      await act(async () =>
        document
          .querySelector(`[data-criterio='${segundo}'] [aria-label^='Subir']`)
          .click(),
      );
      expect(ordem()[0]).toBe(`1º ${segundo}`);
    }
    const desligado = document.querySelector(
      ".triagem-criterio:not([data-ligado]) input[role='switch']",
    );
    if (desligado) {
      await act(async () => desligado.click());
      expect(ordem().at(-1)).toMatch(new RegExp(`^${ordem().length}º `));
    }
    // Requisitos com o botão comum e sem chamar o banco antes de salvar.
    expect(botao("Acrescentar requisito").className).toContain("secondary");
    expect(chamadas.filter(([n]) => n === "salvar_regra_triagem")).toEqual([]);
  });
});
