import { describe, expect, it } from "vitest";
import {
  presenceStateFromUi,
  themeControlState,
} from "../src/modules/nielsen-shell-ux.js";

describe("Nielsen shell UX", () => {
  it("expõe o estado e a próxima ação do tema", () => {
    expect(themeControlState(false)).toMatchObject({
      icon: "fa-sun",
      pressed: "false",
      title: "Tema claro",
    });
    expect(themeControlState(true)).toMatchObject({
      icon: "fa-moon",
      pressed: "true",
      title: "Tema escuro",
    });
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
