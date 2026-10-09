import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clicar } from "./interacoes.js";

/*
  A nota na lateral da ficha (resumo-da-nota.tsx): o item sem decisão mostra a
  prévia em tom neutro com "(prévia)", a nota parcial avisa que soma prévias e
  o Inapto diz por quê, com o link para o item.
*/
const { ResumoDaNota } =
  await import("../../src/modulos/avaliacao-documental/ficha/resumo-da-nota.tsx");

let montagem;
let raiz;
async function montar(props) {
  raiz = document.createElement("div");
  document.body.append(raiz);
  montagem = createRoot(raiz);
  await act(async () => montagem.render(createElement(ResumoDaNota, props)));
}
afterEach(async () => {
  await act(async () => montagem?.unmount());
  raiz?.remove();
});

const parte = (extra) => ({
  bloco: "EXPERIENCIA",
  parcial: "EXPERIENCIA",
  rotulo: "Experiência Profissional",
  apurado: null,
  declarado: 15,
  teto: 35,
  divergente: false,
  previa: null,
  ...extra,
});

describe("nota da ficha", () => {
  it("item sem decisão: a prévia, neutra, e a nota parcial com prévias", async () => {
    await montar({
      nota: 20,
      parcial: true,
      comPrevia: true,
      minima: 15,
      selo: { tom: "neutro", texto: "Em análise" },
      partes: [parte({ previa: 20 })],
    });
    const linha = raiz.querySelector(".avd-ficha-parte");
    expect(linha.dataset.previa).toBe("sim");
    expect(linha.querySelector(".avd-ficha-parte-valor").textContent).toBe(
      "20 / 35 (prévia)",
    );
    expect(raiz.querySelector(".avd-ficha-nota-total").textContent).toBe(
      "20 parcial (com prévias)",
    );
  });

  it("conferido: o apurado, sem prévia", async () => {
    await montar({
      nota: 15,
      parcial: false,
      minima: 15,
      selo: { tom: "aprovado", texto: "Apto" },
      partes: [parte({ apurado: 15 })],
    });
    const linha = raiz.querySelector(".avd-ficha-parte");
    expect(linha.dataset.previa).toBeUndefined();
    expect(linha.querySelector(".avd-ficha-parte-valor").textContent).toBe(
      "15 / 35",
    );
  });

  it("Inapto: o motivo com o link para o item", async () => {
    const aoIr = vi.fn();
    await montar({
      nota: 0,
      parcial: false,
      minima: 15,
      selo: { tom: "reprovado", texto: "Inapto (requisito)" },
      resultado: "INAPTO_REQUISITO",
      motivos: [
        {
          bloco: "EXPERIENCIA",
          texto:
            "Experiência mínima de 6 meses não comprovada (comprovado 0 meses) — item 1.1.1 c",
        },
      ],
      aoIr,
      partes: [],
    });
    const link = raiz.querySelector(".avd-ficha-motivos-resultado button");
    expect(link.textContent).toContain("comprovado 0 meses");
    await clicar(link);
    expect(aoIr).toHaveBeenCalledWith("EXPERIENCIA");
  });
});
