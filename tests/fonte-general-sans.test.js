import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ler = (caminho) => readFileSync(caminho, "utf8");
const cssDe = (pasta) =>
  readdirSync(pasta)
    .filter((nome) => nome.endsWith(".css"))
    .map((nome) => join(pasta, nome));

/*
  A fonte do sistema é a General Sans do Manual de Identidade Visual da AgSUS
  (11/11/2026; antes Geist, antes Inter). Fonte variável (200–700) servida pelo
  próprio site (public/fonts, @font-face em tokens.css; a CSP já libera 'self'),
  com preload no index.html e cópia no cache offline (sw.js). Chega às regras
  pelo token `--font-sans`.
*/
const ARQUIVO = "/fonts/general-sans/GeneralSans-Variable.woff2";

describe("fonte General Sans no sistema todo", () => {
  it("o arquivo da fonte existe e é WOFF2", () => {
    const bytes = readFileSync(join("public", ARQUIVO));
    expect(bytes.subarray(0, 4).toString("latin1")).toBe("wOF2");
  });

  it("tokens.css declara a fonte e o token começa por ela", () => {
    const tokens = ler("src/styles/tokens.css");
    expect(tokens).toMatch(/@font-face\s*\{[^}]*font-family:\s*"General Sans"/);
    expect(tokens).toContain(`url("${ARQUIVO}") format("woff2")`);
    expect(tokens).toMatch(/--font-sans:\s*"General Sans",/);
  });

  it("o index pré-carrega a fonte e não chama mais o Google Fonts", () => {
    const html = ler("index.html");
    expect(html).toContain(`href="${ARQUIVO}"`);
    expect(html).not.toContain("fonts.googleapis.com/css2?family=Geist");
    expect(html).not.toContain("family=Inter");
  });

  it("a fonte vai para o cache offline", () => {
    expect(ler("sw.js")).toContain(`"${ARQUIVO}"`);
  });

  it("tokens.css é o primeiro CSS dos pontos de entrada", () => {
    const primeiroCss = (fonte) => fonte.match(/import\s+"([^"]+\.css)"/)?.[1];
    expect(primeiroCss(ler("src/main.ts"))).toBe("./styles/tokens.css");
  });

  it("o corpo do app usa o token", () => {
    expect(ler("src/styles/app.css")).toMatch(
      /body\s*\{[^}]*font-family:\s*var\(--font-sans,/,
    );
  });

  it("não sobra Inter nem Geist em CSS, no aviso de sessão, nos gráficos nem na página offline", () => {
    const arquivos = [
      ...cssDe("src/styles"),
      "src/lib/session-lifecycle.ts",
      "offline.html",
      "src/modulos/selecao/paineis.tsx",
    ];
    const antigas = arquivos.filter((arquivo) =>
      // "Geist Mono" (só código, --font-mono) não conta.
      /["',\s:](Inter|Geist(?! Mono))["',;\s]/.test(ler(arquivo)),
    );
    expect(antigas).toEqual([]);
  });
});
