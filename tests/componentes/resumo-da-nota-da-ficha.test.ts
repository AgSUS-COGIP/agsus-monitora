import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PropriedadesDoResumo } from "../../src/modulos/avaliacao-documental/ficha/resumo-da-nota.tsx";
import type { ParteDaNota } from "../../src/modulos/avaliacao-documental/ficha/tipos.ts";
import { achar } from "../dom.ts";
import { clicar } from "./interacoes.ts";

/*
  A nota na lateral da ficha (resumo-da-nota.tsx): o item sem decisão mostra a
  prévia em tom neutro com "(prévia)", a nota parcial avisa que soma prévias e
  o Inapto diz por quê, com o link para o item.
*/
const { ResumoDaNota } =
  await import("../../src/modulos/avaliacao-documental/ficha/resumo-da-nota.tsx");

let montagem: Root | undefined;
let raiz: HTMLDivElement | undefined;
async function montar(props: PropriedadesDoResumo) {
  const elemento = document.createElement("div");
  raiz = elemento;
  document.body.append(elemento);
  const novaMontagem = createRoot(elemento);
  montagem = novaMontagem;
  await act(async () =>
    novaMontagem.render(createElement(ResumoDaNota, props)),
  );
}
afterEach(async () => {
  await act(async () => montagem?.unmount());
  raiz?.remove();
});

const parte = (extra: Partial<ParteDaNota>): ParteDaNota => ({
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
    const linha = achar(".avd-ficha-parte", raiz);
    expect(linha.dataset.previa).toBe("sim");
    expect(achar(".avd-ficha-parte-valor", linha).textContent).toBe(
      "20 / 35 (prévia)",
    );
    expect(achar(".avd-ficha-nota-total", raiz).textContent).toBe(
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
    const linha = achar(".avd-ficha-parte", raiz);
    expect(linha.dataset.previa).toBeUndefined();
    expect(achar(".avd-ficha-parte-valor", linha).textContent).toBe("15 / 35");
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
    const link = achar(".avd-ficha-motivos-resultado button", raiz);
    expect(link.textContent).toContain("comprovado 0 meses");
    await clicar(link);
    expect(aoIr).toHaveBeenCalledWith("EXPERIENCIA");
  });
});
