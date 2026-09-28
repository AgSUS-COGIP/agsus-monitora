import { describe, expect, it } from "vitest";
import {
  enderecoDoPainel,
  enderecoDoPainelNaArea,
} from "../src/lib/endereco-do-painel.js";

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

  it("o painel de análises leva a área atual na URL", () => {
    expect(
      enderecoDoPainelNaArea(
        "https://agsus-monitora.vercel.app/analises.html",
        "http://localhost:5173",
        "projetos",
      ),
    ).toBe("http://localhost:5173/analises.html?area=projetos");
    // Troca a área que já estivesse gravada, sem perder outros parâmetros.
    expect(
      enderecoDoPainelNaArea(
        "/analises.html?aba=1&area=sede",
        "https://previa.vercel.app",
        "saude-indigena",
      ),
    ).toBe("https://previa.vercel.app/analises.html?aba=1&area=saude-indigena");
  });

  it("sem área, ou painel de fora, fica o endereço de sempre", () => {
    expect(
      enderecoDoPainelNaArea("/analises.html", "http://localhost:5173", ""),
    ).toBe("http://localhost:5173/analises.html");
    const appsScript = "https://script.google.com/macros/s/abc/exec";
    expect(
      enderecoDoPainelNaArea(appsScript, "http://localhost:5173", "sede"),
    ).toBe(appsScript);
    expect(
      enderecoDoPainelNaArea("javascript:alert(1)", "http://localhost", "sede"),
    ).toBe("");
  });

  it("recusa o que não é http(s)", () => {
    expect(enderecoDoPainel("javascript:alert(1)", "http://localhost")).toBe(
      "",
    );
    expect(enderecoDoPainel("", "http://localhost")).toBe("");
  });
});
