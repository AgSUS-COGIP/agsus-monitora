import { act, createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  erroDoNomeDaVersao,
  nomeDaVersaoNaLista,
  nomeParaGravar,
  normalizarNomeDaVersao,
  partesDaVersao,
  rotuloDaVersao,
  rotuloDaVersaoNaLista,
  sugerirNomeDaVersao,
  trechoDoMotivo,
} from "../src/lib/nome-da-versao.ts";
import {
  CampoNomeDaVersao,
  NomeDaVersao,
  nomeDoCampo,
  RenomearVersao,
} from "../src/ui/index.js";
import { clicar, digitar } from "./componentes/interacoes.js";

/*
  O nome das versões das regras (avaliação documental, classificação e
  roteiro): exibição "Nome · v7" / "Versão 7", a sugestão do campo ao salvar e
  o diálogo de renomear (só o nome, com motivo).
*/

describe("exibição: nome em destaque, número discreto", () => {
  it("com nome: 'Nome · v7'; sem nome: 'Versão 7'", () => {
    expect(rotuloDaVersao({ versao: 7, nome: "Decisão CORES" })).toBe(
      "Decisão CORES · v7",
    );
    expect(rotuloDaVersao({ versao: 7, nome: null })).toBe("Versão 7");
    expect(rotuloDaVersao({ versao: 7, nome: "   " })).toBe("Versão 7");
    expect(rotuloDaVersao({ versao: "3" })).toBe("Versão 3");
    expect(rotuloDaVersao(null)).toBe("");
    expect(partesDaVersao({ versao: 2, nome: "Banca" })).toEqual({
      nome: "Banca",
      numero: "v2",
    });
    expect(partesDaVersao({ versao: 2 })).toEqual({
      nome: null,
      numero: "Versão 2",
    });
  });

  it("acha o nome pelo número no histórico (versões antigas sem nome continuam)", () => {
    const versoes = [
      { versao: 3, nome: "Decisão CORES" },
      { versao: 2, nome: null },
      { versao: 1 },
    ];
    expect(nomeDaVersaoNaLista(versoes, 3)).toBe("Decisão CORES");
    expect(nomeDaVersaoNaLista(versoes, 2)).toBeNull();
    expect(rotuloDaVersaoNaLista(versoes, "3")).toBe("Decisão CORES · v3");
    expect(rotuloDaVersaoNaLista(versoes, 1)).toBe("Versão 1");
    expect(rotuloDaVersaoNaLista(null, 5)).toBe("Versão 5");
  });
});

describe("nome: validação e o que vai para o banco", () => {
  it("3 a 80 caracteres, espaços normalizados; vazio = sem nome", () => {
    expect(normalizarNomeDaVersao("  Regra   do  edital ")).toBe(
      "Regra do edital",
    );
    expect(erroDoNomeDaVersao("")).toBe("");
    expect(erroDoNomeDaVersao("ab")).toBe("De 3 a 80 caracteres.");
    expect(erroDoNomeDaVersao("x".repeat(81))).toBe("De 3 a 80 caracteres.");
    expect(erroDoNomeDaVersao("abc")).toBe("");
    expect(nomeParaGravar("   ")).toBeNull();
    expect(nomeParaGravar(" Decisão  CORES ")).toBe("Decisão CORES");
    expect(nomeDoCampo(null, "Sugestão")).toBe("Sugestão");
    expect(nomeDoCampo("", "Sugestão")).toBe("");
  });
});

describe("sugestão automática", () => {
  it("edital + começo do motivo, com a inicial minúscula (menos sigla)", () => {
    expect(
      sugerirNomeDaVersao({
        tipo: "regra",
        edital: "93/2026",
        motivo: "Decisão CORES de 07/10: aceitar o diploma estrangeiro",
      }),
    ).toBe("Regra do edital 93/2026 – decisão CORES de 07/10");
    expect(trechoDoMotivo("CORES decidiu manter o corte. Outra frase")).toBe(
      "CORES decidiu manter o corte",
    );
    expect(
      sugerirNomeDaVersao({
        tipo: "classificacao",
        edital: "93/2026",
        motivo: "",
      }),
    ).toBe("Classificação do edital 93/2026");
    expect(sugerirNomeDaVersao({ tipo: "regra" })).toBe("Regra da avaliação");
  });

  it("roteiro: o nome dele e a data; nunca passa de 80", () => {
    expect(
      sugerirNomeDaVersao({
        tipo: "roteiro",
        roteiro: "Entrevista individual",
        data: new Date("2026-10-08T15:00:00Z"),
      }),
    ).toBe("Entrevista individual – 08/10/2026");
    const longa = sugerirNomeDaVersao({
      tipo: "regra",
      edital: "93/2026",
      motivo: "palavra ".repeat(40),
    });
    expect(longa.length).toBeLessThanOrEqual(80);
    expect(erroDoNomeDaVersao(longa)).toBe("");
    const roteiroLongo = sugerirNomeDaVersao({
      tipo: "roteiro",
      roteiro: "Roteiro ".repeat(20),
      data: new Date(),
    });
    expect(roteiroLongo.length).toBeLessThanOrEqual(80);
  });
});

let raiz = null;
async function montar(elemento) {
  document.body.innerHTML = `<div id="raiz"></div>`;
  await act(async () => {
    raiz = createRoot(document.getElementById("raiz"));
    raiz.render(elemento);
  });
}
afterEach(async () => {
  await act(async () => raiz?.unmount());
  raiz = null;
  document.body.innerHTML = "";
});

describe("componentes", () => {
  it("NomeDaVersao: nome forte e número discreto; trocas no título", async () => {
    await montar(
      h("div", null, [
        h(NomeDaVersao, {
          key: 1,
          versao: 7,
          nome: "Decisão CORES",
          trocas: [
            { de: "Antigo", para: "Decisão CORES", motivo: "Mais claro" },
          ],
        }),
        h(NomeDaVersao, { key: 2, versao: 2 }),
      ]),
    );
    const [com, sem] = document.querySelectorAll(".ui-nome-da-versao");
    expect(com.querySelector("strong").textContent).toBe("Decisão CORES");
    expect(com.querySelector(".ui-nome-da-versao-numero").textContent).toBe(
      "· v7",
    );
    expect(com.querySelector("[data-trocas]").title).toContain("“Antigo”");
    expect(sem.textContent).toBe("Versão 2");
    expect(sem.querySelector(".ui-nome-da-versao-numero")).toBeNull();
  });

  it("CampoNomeDaVersao: vem com a sugestão e aceita edição", async () => {
    function Teste() {
      const [valor, setValor] = useState(null);
      return h("div", null, [
        h(CampoNomeDaVersao, {
          key: "c",
          valor,
          sugestao: "Regra do edital 93/2026",
          aoMudar: setValor,
          mostrarErro: true,
        }),
        h(
          "output",
          { key: "o" },
          nomeDoCampo(valor, "Regra do edital 93/2026"),
        ),
      ]);
    }
    await montar(h(Teste));
    const campo = document.querySelector("[data-campo='nome-da-versao']");
    expect(campo.value).toBe("Regra do edital 93/2026");
    await digitar(campo, "ab");
    expect(document.querySelector(".ui-campo-erro").textContent).toContain(
      "De 3 a 80",
    );
    await digitar(campo, "Decisão CORES");
    expect(document.querySelector("output").textContent).toBe("Decisão CORES");
    expect(document.querySelector(".ui-campo-erro")).toBeNull();
  });

  it("RenomearVersao: pede motivo, recusa nome igual e manda só nome e motivo", async () => {
    const aoRenomear = vi.fn(async () => ({ ok: true }));
    await montar(h(RenomearVersao, { versao: 3, nome: "Antigo", aoRenomear }));
    await clicar(document.querySelector("[data-acao='renomear-versao']"));
    const [nome, motivo] = document.querySelectorAll(".modal input");
    expect(nome.value).toBe("Antigo");
    await clicar(document.querySelector("[data-acao='salvar-nome-da-versao']"));
    expect(aoRenomear).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("O nome não mudou.");
    expect(document.body.textContent).toContain("De 10 a 500 caracteres.");
    await digitar(nome, "  Decisão   CORES ");
    await digitar(motivo, "Nome mais claro para a banca");
    await clicar(document.querySelector("[data-acao='salvar-nome-da-versao']"));
    expect(aoRenomear).toHaveBeenCalledWith(
      "Decisão CORES",
      "Nome mais claro para a banca",
    );
    expect(document.querySelector(".modal")).toBeNull();
  });

  it("RenomearVersao: nome vazio tira o nome; erro do banco fica no diálogo", async () => {
    const aoRenomear = vi.fn(async () => ({
      ok: false,
      erro: "Sem permissão",
    }));
    await montar(h(RenomearVersao, { versao: 3, nome: "Antigo", aoRenomear }));
    await clicar(document.querySelector("[data-acao='renomear-versao']"));
    const [nome, motivo] = document.querySelectorAll(".modal input");
    await digitar(nome, "");
    await digitar(motivo, "Volta a ficar sem nome");
    await clicar(document.querySelector("[data-acao='salvar-nome-da-versao']"));
    expect(aoRenomear).toHaveBeenCalledWith(null, "Volta a ficar sem nome");
    expect(document.querySelector(".modal").textContent).toContain(
      "Sem permissão",
    );
  });
});
