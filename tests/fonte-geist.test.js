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
  Análises, como fonte variável (um arquivo para 400–900), e chega às regras
  pelo token `--font-sans`, de `tokens.css`.

  13/11/2026: a Geist vinha do Google Fonts e só começava a baixar depois do
  CSS; a cada atualização o texto aparecia na fonte do sistema e trocava para
  a Geist (a tela de acesso "piscava"). Agora o próprio site a serve
  (public/fonts, com a licença OFL ao lado), pedida com preload no <head>, e
  a @font-face usa `font-display: optional` (nunca troca na frente de quem lê).
*/
describe("fonte Geist no sistema todo", () => {
  it("o index.html pede a Geist do próprio site, antes do CSS, e não do Google Fonts", () => {
    const html = ler("index.html");
    const preload = html.indexOf('href="/fonts/geist-latin.woff2"');
    expect(preload).toBeGreaterThan(-1);
    const tag = html.slice(html.lastIndexOf("<link", preload), preload + 120);
    expect(tag).toContain('rel="preload"');
    expect(tag).toContain('as="font"');
    expect(tag).toContain("crossorigin");
    expect(preload).toBeLessThan(html.indexOf('href="/src/styles/app.css"'));
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("family=Inter");
  });

  it("o arquivo e a licença estão em public/fonts", () => {
    const arquivo = readFileSync("public/fonts/geist-latin.woff2");
    expect(arquivo.subarray(0, 4).toString("latin1")).toBe("wOF2");
    expect(ler("public/fonts/LICENSE-Geist.txt")).toContain(
      "SIL Open Font License, Version 1.1",
    );
  });

  it("a @font-face aponta o arquivo e não troca de fonte na frente de quem lê", () => {
    const tokens = ler("src/styles/tokens.css");
    const bloco = tokens.slice(tokens.indexOf("@font-face {"));
    const regra = bloco.slice(0, bloco.indexOf("}"));
    expect(regra).toContain('font-family: "Geist";');
    expect(regra).toContain("font-weight: 400 900;");
    expect(regra).toContain("font-display: optional;");
    expect(regra).toContain(
      'src: url("/fonts/geist-latin.woff2") format("woff2");',
    );
  });

  it("o token --font-sans começa pela Geist", () => {
    expect(ler("src/styles/tokens.css")).toMatch(/--font-sans:\s*"Geist",/);
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

  it("não sobra Inter em CSS, no aviso de sessão nem na página offline", () => {
    const arquivos = [
      ...cssDe("src/styles"),
      "src/lib/session-lifecycle.ts",
      "offline.html",
    ];
    const comInter = arquivos.filter((arquivo) =>
      /["',\s:]Inter["',;\s]/.test(ler(arquivo)),
    );
    expect(comInter).toEqual([]);
  });
});
