import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ler = (caminho) => readFileSync(caminho, "utf8");
const cssDe = (pasta) =>
  readdirSync(pasta)
    .filter((nome) => nome.endsWith(".css"))
    .map((nome) => join(pasta, nome));

/*
  A fonte do sistema passou de Inter para Geist, no app principal e em
  Análises. Vem do Google Fonts como fonte variável (um arquivo para 400–900;
  a CSP já libera fonts.googleapis.com e fonts.gstatic.com) e chega às regras
  pelo token `--font-sans`, de `tokens.css`.
*/
describe("fonte Geist no sistema todo", () => {
  it("as três páginas carregam Geist, e nenhuma carrega Inter", () => {
    for (const pagina of [
      "index.html",
      "analises.html",
      "src/analises/index.html",
    ]) {
      const html = ler(pagina);
      expect(html, pagina).toContain("family=Geist:wght@400..900&display=swap");
      expect(html, pagina).not.toContain("family=Inter");
    }
  });

  it("o token --font-sans começa pela Geist", () => {
    expect(ler("src/styles/tokens.css")).toMatch(
      /--font-sans:\s*"Geist",\s*"Segoe UI"/,
    );
  });

  it("tokens.css é o primeiro CSS dos dois pontos de entrada", () => {
    const primeiroCss = (fonte) => fonte.match(/import\s+"([^"]+\.css)"/)?.[1];
    expect(primeiroCss(ler("src/main.js"))).toBe("./styles/tokens.css");
    expect(primeiroCss(ler("src/analises/main.js"))).toBe(
      "../styles/tokens.css",
    );
  });

  it("o corpo das duas aplicações usa o token", () => {
    expect(ler("src/styles/app.css")).toMatch(
      /body\s*\{[^}]*font-family:\s*var\(--font-sans,/,
    );
    expect(ler("src/analises/analises.css")).toMatch(
      /font-family:\s*var\(--font-sans,/,
    );
  });

  it("não sobra Inter em CSS, no aviso de sessão nem na página offline", () => {
    const arquivos = [
      ...cssDe("src/styles"),
      ...cssDe("src/analises"),
      "src/lib/session-lifecycle.js",
      "offline.html",
    ];
    const comInter = arquivos.filter((arquivo) =>
      /["',\s:]Inter["',;\s]/.test(ler(arquivo)),
    );
    expect(comInter).toEqual([]);
  });
});
