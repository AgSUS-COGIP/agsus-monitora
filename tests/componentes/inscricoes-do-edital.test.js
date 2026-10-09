import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { InscricoesDoEdital } from "../../src/modulos/avaliacao-documental/inscricoes-do-edital.tsx";
import { DADOS_114 } from "../fixtures/acompanhamento-das-inscricoes.js";

/*
  Cartão "Inscrições" no topo da Pré-classificação: aparece só durante as
  inscrições, mostra os totais, o mini-gráfico e a tabela por vaga; sem
  retrato, um estado vazio curto; com prévia, o selo.
*/

let raiz;
let alvo;
function montar(dados) {
  alvo = document.createElement("div");
  document.body.append(alvo);
  raiz = createRoot(alvo);
  act(() => raiz.render(createElement(InscricoesDoEdital, { dados })));
  return alvo;
}
afterEach(() => {
  act(() => raiz?.unmount());
  alvo?.remove();
});

describe("cartão Inscrições", () => {
  it("mostra os totais, o gráfico e as vagas durante as inscrições", () => {
    const el = montar(DADOS_114);
    const cartao = el.querySelector("[data-inscricoes]");
    expect(cartao).not.toBeNull();
    expect(cartao.textContent).toContain("até 14/10");
    const total = (nome) =>
      el.querySelector(`[data-total="${nome}"] dd`).textContent;
    expect(total("inscritos")).toBe("21 hoje +3");
    expect(total("finalizados")).toBe("19");
    expect(total("aptos")).toBe("8");
    expect(total("eliminados")).toBe("2");
    expect(el.querySelectorAll("polyline")).toHaveLength(2);
    expect(el.querySelector("svg").getAttribute("aria-label")).toContain(
      "09/10 21",
    );
    const linha = el.querySelector('[data-vaga="181100"]');
    expect(
      [...linha.querySelectorAll("td")].map((td) => td.textContent),
    ).toEqual(["181100 Analista — Belo Horizonte", "18", "7", "+3"]);
    expect(
      el.querySelector('[data-vaga="181101"] td:last-child').textContent,
    ).toBe("—");
    expect(el.querySelector("details").open).toBe(true);
    expect(el.textContent).not.toContain("prévia");
  });

  it("não aparece fora das inscrições", () => {
    const el = montar({ ...DADOS_114, hoje: "2026-10-20" });
    expect(el.querySelector("[data-inscricoes]")).toBeNull();
  });

  it("sem retrato ainda: estado vazio curto", () => {
    const el = montar({ ...DADOS_114, retratos: [] });
    expect(el.querySelector("[data-sem-retrato]").textContent).toBe(
      "Aguardando a primeira carga da Empregare.",
    );
    expect(el.querySelector("table")).toBeNull();
  });

  it("aptos de prévia ganham o selo; depois do fim, 'encerradas'", () => {
    const retratos = DADOS_114.retratos.map((r) => ({ ...r, previa: true }));
    const el = montar({ ...DADOS_114, retratos, hoje: "2026-10-15" });
    expect(el.querySelector(".ui-selo").textContent).toBe("prévia");
    expect(el.textContent).toContain("encerradas em 14/10");
  });
});
