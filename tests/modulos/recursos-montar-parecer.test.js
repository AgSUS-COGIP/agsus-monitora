import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Gaveta } from "../../src/ui/index.ts";
import {
  CHAVE_DO_PROTOTIPO,
  SecaoMontarParecer,
} from "../../src/modulos/recursos/parecer-em-blocos/secao-montar-parecer.tsx";
import { EditorDoParecer } from "../../src/modulos/recursos/parecer-em-blocos/montar-parecer.tsx";
import { dadosFicticios } from "../../src/modulos/recursos/parecer-em-blocos/dados-ficticios.ts";
import { linhasVisiveis } from "../../src/modulos/recursos/parecer-em-blocos/simulador.ts";
import {
  comporParecer,
  linhasDeTexto,
  rascunhoInicial,
} from "../../src/lib/parecer-em-blocos.ts";
import { clicar, digitar, esperar, teclar } from "../componentes/interacoes.js";

/*
  "Montar parecer" na gaveta do recurso (protótipo): desligado por padrão; com
  a chave, abre a montagem por cima da gaveta (o Esc fecha só ela), com a
  prévia igual ao texto de comporParecer, que muda quando o formulário muda.
*/

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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
  localStorage.removeItem(CHAVE_DO_PROTOTIPO);
});

const recurso = { id: "r-1", nu: 1, candidato: "Maria Fictícia da Silva" };

describe("Montar parecer na gaveta", () => {
  it("fica escondido sem a chave do protótipo", async () => {
    await montar(h(SecaoMontarParecer, { recurso }));
    expect(document.querySelector('[data-acao="montar-parecer"]')).toBeNull();
  });

  it("abre por cima da gaveta; o Esc fecha só a montagem", async () => {
    localStorage.setItem(CHAVE_DO_PROTOTIPO, "1");
    const fecharGaveta = vi.fn();
    await montar(
      h(
        Gaveta,
        { titulo: "Recurso", aoFechar: fecharGaveta, rotuloDoFechar: "Fechar" },
        h(SecaoMontarParecer, { recurso }),
      ),
    );
    await clicar(document.querySelector('[data-acao="montar-parecer"]'));
    // O módulo da montagem chega por import() e os dados, por promessa.
    for (
      let i = 0;
      i < 20 && !document.querySelector(".parecer-documento");
      i++
    )
      await esperar(() => new Promise((r) => setTimeout(r, 20)));
    expect(document.querySelector(".parecer-documento")).not.toBeNull();
    expect(document.querySelectorAll(".modal")).toHaveLength(2);

    await teclar(document, "Escape");
    expect(document.querySelector(".parecer-documento")).toBeNull();
    expect(fecharGaveta).not.toHaveBeenCalled();
    await teclar(document, "Escape");
    expect(fecharGaveta).toHaveBeenCalledTimes(1);
  });
});

describe("o editor", () => {
  it("a prévia é o texto de comporParecer e acompanha o formulário", async () => {
    await montar(
      h(EditorDoParecer, { fonte: dadosFicticios, recursoId: "ficticio-1" }),
    );
    await esperar(() => new Promise((r) => setTimeout(r, 0)));
    const { rascunho } = rascunhoInicial(
      await dadosFicticios.carregar("ficticio-1"),
    );
    const previa = () =>
      linhasVisiveis(document.querySelector(".parecer-documento"));
    expect(previa()).toEqual(linhasDeTexto(comporParecer(rascunho)));
    // De onde veio: o selo "da ficha" na experiência.
    expect(
      document.querySelector(
        '[data-tour="parecer-bloco-experiencia"] .parecer-fonte',
      ).textContent,
    ).toBe("da ficha");

    await digitar(
      document.querySelector('[aria-label="2. Relatório"] textarea'),
      "o prazo foi cumprido",
    );
    expect(previa().join("\n")).toContain(
      "alega, em síntese, que : o prazo foi cumprido.",
    );

    const intempestivo = [...document.querySelectorAll('[role="radio"]')].find(
      (b) => b.textContent === "Intempestivo",
    );
    await clicar(intempestivo);
    expect(previa().join("\n")).toContain("NÃO CONHECIMENTO");
    expect(previa().join("\n")).not.toContain("4. ANÁLISE DE MÉRITO");
  });

  it("tirar um bloco tira o texto dele; o chip põe de volta", async () => {
    await montar(
      h(EditorDoParecer, { fonte: dadosFicticios, recursoId: "ficticio-1" }),
    );
    await esperar(() => new Promise((r) => setTimeout(r, 0)));
    const texto = () =>
      document.querySelector(".parecer-documento").textContent;
    expect(texto()).toContain("Avaliação Biopsicossocial");
    const cartao = document.querySelector('[data-tour="parecer-bloco-pcd"]');
    await clicar(
      [...cartao.querySelectorAll("button")].find((b) =>
        b.textContent.includes("Tirar"),
      ),
    );
    expect(texto()).not.toContain("Avaliação Biopsicossocial");
    const chip = [...document.querySelectorAll(".parecer-fora .ui-chip")].find(
      (b) => b.textContent.includes("PcD"),
    );
    await clicar(chip);
    expect(
      document.querySelector('[data-tour="parecer-bloco-pcd"]'),
    ).not.toBeNull();
  });
});
