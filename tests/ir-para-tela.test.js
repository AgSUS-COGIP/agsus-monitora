import { describe, expect, it, vi } from "vitest";
import { linkInterno } from "../src/lib/link-interno.ts";
import { irParaTela } from "../src/app/ir-para-tela.ts";

/*
  Os botões "Ir para…" (Entrevistas, Recursos, Lista de aprovados) navegam só
  para telas do app, conferidas (src/lib/link-interno.ts), e com o edital
  ele vai junto no endereço (src/app/ir-para-tela.ts); quem abre a tela já
  nele é a rota (tests/app/telas.test.js).
*/
const EDITAL = "0b7c9a52-2d55-4c4e-9f7a-1c3d5e7f9a1b";

describe("linkInterno", () => {
  it("aceita as telas do menu, com ou sem edital", () => {
    expect(linkInterno({ view: "classificacao" })).toEqual({
      view: "classificacao",
    });
    expect(
      linkInterno({
        view: "classificacao",
        edital: { id: EDITAL, titulo: " 93/2026 " },
      }),
    ).toEqual({
      view: "classificacao",
      edital: { id: EDITAL, titulo: "93/2026" },
    });
  });

  it("recusa endereço, tela que não existe e edital sem uuid", () => {
    for (const ruim of [
      null,
      "classificacao",
      [],
      { view: "https://exemplo.invalid" },
      { view: "chat" },
      { view: "classificacao", edital: { id: "83/2026" } },
    ])
      expect(linkInterno(ruim)).toBeNull();
  });
});

describe("irParaTela", () => {
  it("troca de tela pelo navigate, com o edital junto (vai no endereço)", () => {
    const janela = { navigate: vi.fn() };
    for (const view of [
      "classificacao",
      "conduzir-entrevistas",
      "pre-classificacao",
    ]) {
      expect(
        irParaTela({ view, edital: { id: EDITAL, titulo: "" } }, janela),
      ).toBe(true);
      expect(janela.navigate).toHaveBeenLastCalledWith(view, {
        edital: EDITAL,
      });
    }
  });

  it("sem edital, só a tela", () => {
    const janela = { navigate: vi.fn() };
    expect(irParaTela({ view: "recursos" }, janela)).toBe(true);
    expect(janela.navigate).toHaveBeenCalledWith("recursos");
  });

  it("destino que não vale ou sem navigate: não navega", () => {
    const janela = { navigate: vi.fn() };
    expect(irParaTela({ view: "https://exemplo.invalid" }, janela)).toBe(false);
    expect(janela.navigate).not.toHaveBeenCalled();
    expect(irParaTela({ view: "recursos" }, {})).toBe(false);
  });
});
