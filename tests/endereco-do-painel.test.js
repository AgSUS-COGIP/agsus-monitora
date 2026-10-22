import { describe, expect, it } from "vitest";
import { enderecoDoPainel } from "../src/lib/endereco-do-painel.js";

describe("endereço do painel externo", () => {
  it("painel de fora fica como está", () => {
    const appsScript = "https://script.google.com/macros/s/abc/exec";
    expect(enderecoDoPainel(appsScript, "http://localhost:5173")).toBe(
      appsScript,
    );
  });

  it("recusa o que não é http(s)", () => {
    expect(enderecoDoPainel("javascript:alert(1)", "http://localhost")).toBe(
      "",
    );
    expect(enderecoDoPainel("", "http://localhost")).toBe("");
    expect(enderecoDoPainel("http://[x", "http://localhost")).toBe("");
  });

  it("recusa endereço relativo e o do próprio MONITORA", () => {
    const origem = "https://monitora.exemplo";
    expect(enderecoDoPainel("/analises.html", origem)).toBe("");
    expect(enderecoDoPainel("analises.html", origem)).toBe("");
    expect(enderecoDoPainel("//monitora.exemplo/x", origem)).toBe("");
    expect(
      enderecoDoPainel("https://monitora.exemplo/analises.html", origem),
    ).toBe("");
    expect(enderecoDoPainel("https://monitora.exemplo:8443/x", origem)).toBe(
      "https://monitora.exemplo:8443/x",
    );
  });
});
