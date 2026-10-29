import { describe, expect, it, vi } from "vitest";
import { linkInterno } from "../src/lib/link-interno.ts";
import { irParaTela } from "../src/app/ir-para-tela.ts";

/*
  Os botões "Ir para…" (Entrevistas, Recursos, Lista de aprovados) navegam só
  para telas do app, conferidas (src/lib/link-interno.ts), e com o edital a
  Classificação e Conduzir entrevistas já abrem nele (src/app/ir-para-tela.ts).
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
  it("troca de tela pelo navigate e abre o edital na Classificação", async () => {
    const escolherEdital = vi.fn();
    const janela = {
      navigate: vi.fn(),
      classificacaoController: {
        carregar: vi.fn(async () => {}),
        estado: { escolherEdital },
      },
    };
    expect(
      irParaTela(
        { view: "classificacao", edital: { id: EDITAL, titulo: "" } },
        janela,
      ),
    ).toBe(true);
    expect(janela.navigate).toHaveBeenCalledWith("classificacao");
    await vi.waitFor(() => expect(escolherEdital).toHaveBeenCalledWith(EDITAL));
  });

  it("Conduzir entrevistas abre o edital pelo controle", async () => {
    const abrirEdital = vi.fn();
    const janela = {
      navigate: vi.fn(),
      conduzirEntrevistasController: { abrirEdital },
    };
    irParaTela(
      { view: "conduzir-entrevistas", edital: { id: EDITAL, titulo: "" } },
      janela,
    );
    await vi.waitFor(() => expect(abrirEdital).toHaveBeenCalledWith(EDITAL));
  });

  it("abre o edital na Triagem independente", async () => {
    const carregar = vi.fn(async () => {});
    const abrirEdital = vi.fn(async () => {});
    const janela = {
      navigate: vi.fn(),
      preClassificacaoController: { carregar, abrirEdital },
    };
    expect(
      irParaTela(
        {
          view: "pre-classificacao",
          edital: { id: EDITAL, titulo: "114/2026" },
        },
        janela,
      ),
    ).toBe(true);
    expect(janela.navigate).toHaveBeenCalledWith("pre-classificacao");
    await vi.waitFor(() => expect(abrirEdital).toHaveBeenCalledWith(EDITAL));
    expect(carregar).toHaveBeenCalledOnce();
  });

  it("destino que não vale ou sem navigate: não navega", () => {
    const janela = { navigate: vi.fn() };
    expect(irParaTela({ view: "https://exemplo.invalid" }, janela)).toBe(false);
    expect(janela.navigate).not.toHaveBeenCalled();
    expect(irParaTela({ view: "recursos" }, {})).toBe(false);
  });
});
