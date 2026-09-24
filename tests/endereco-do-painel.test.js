import { describe, expect, it } from "vitest";
import { enderecoDoPainel } from "../src/lib/endereco-do-painel.js";

describe("endereço do painel externo", () => {
  it("página do próprio app abre no domínio atual", () => {
    expect(
      enderecoDoPainel(
        "https://agsus-monitora.vercel.app/analises.html",
        "http://localhost:5173",
      ),
    ).toBe("http://localhost:5173/analises.html");
    expect(
      enderecoDoPainel("/analises.html?aba=1", "https://previa.vercel.app"),
    ).toBe("https://previa.vercel.app/analises.html?aba=1");
  });

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
  });
});
