import { describe, expect, it } from "vitest";
import {
  deveAlternarTema,
  OPCOES_DE_TEMA,
  presenceStateFromUi,
  themeControlState,
} from "../src/modules/nielsen-shell-ux.js";

describe("Nielsen shell UX", () => {
  it("expõe o estado e a próxima ação do tema", () => {
    expect(themeControlState(false)).toMatchObject({
      tema: "claro",
      icon: "sun",
      pressed: "false",
      title: "Tema claro",
    });
    expect(themeControlState(true)).toMatchObject({
      tema: "escuro",
      icon: "moon",
      pressed: "true",
      title: "Tema escuro",
    });
  });

  /*
    O seletor Claro/Escuro mora no rodapé da barra. `toggleDarkMode` inverte o
    tema, então clicar no segmento que já vale não pode chamá-lo.
  */
  it("o seletor de tema tem Claro e Escuro, e o segmento ativo não inverte", () => {
    expect(OPCOES_DE_TEMA.map((opcao) => opcao.rotulo)).toEqual([
      "Claro",
      "Escuro",
    ]);
    expect(deveAlternarTema("escuro", false)).toBe(true);
    expect(deveAlternarTema("claro", true)).toBe(true);
    expect(deveAlternarTema("claro", false)).toBe(false);
    expect(deveAlternarTema("escuro", true)).toBe(false);
  });

  it("distingue presença pronta, carregando e indisponível", () => {
    expect(presenceStateFromUi("2 online")).toEqual({
      state: "ready",
      compactLabel: "2 online",
      detail: "2 pessoas online.",
    });

    expect(
      presenceStateFromUi("Sincronizando", { elapsedMs: 2_000 }),
    ).toMatchObject({ state: "loading", compactLabel: "Sincronizando" });

    expect(
      presenceStateFromUi("Sincronizando", { elapsedMs: 15_000 }),
    ).toMatchObject({
      state: "error",
      compactLabel: "Presença indisponível",
    });
  });

  it("informa quando o navegador está offline", () => {
    expect(presenceStateFromUi("Sincronizando", { online: false })).toEqual({
      state: "offline",
      compactLabel: "Offline",
      detail: "Sem conexão com a internet.",
    });
  });
});
