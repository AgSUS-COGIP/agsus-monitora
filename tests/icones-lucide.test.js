import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FA_MODIFICADORES,
  FA_PARA_LUCIDE,
} from "../src/lib/mapa-de-icones-lucide.js";
import { gerarCssDosIcones } from "../scripts/gerar-icones-lucide.mjs";

/*
  O Font Awesome não é mais carregado: um `fa-…` sem par no mapa vira um
  quadrado vazio na tela, em silêncio. Estes testes varrem o código do site.
*/
function arquivos(pasta, extensoes) {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho, extensoes);
    return extensoes.some((ext) => nome.endsWith(ext)) ? [caminho] : [];
  });
}

const fontes = [
  ...arquivos("src", [".js", ".html"]),
  "index.html",
  "analises.html",
  "auth/callback.html",
].filter((f) => !f.replace(/\\/g, "/").endsWith("src/analises/index.html"));

const usados = new Set(
  fontes.flatMap((f) =>
    [...readFileSync(f, "utf8").matchAll(/\bfa-[a-z0-9]+(?:-[a-z0-9]+)*/g)].map(
      (m) => m[0],
    ),
  ),
);

describe("ícones Lucide no lugar do Font Awesome", () => {
  it("todo ícone fa-… usado no código tem equivalente Lucide", () => {
    const semPar = [...usados].filter(
      (classe) =>
        !FA_MODIFICADORES.includes(classe) &&
        !Object.hasOwn(FA_PARA_LUCIDE, classe) &&
        // `fa-chevron-${…}` monta o nome em tempo de execução; os dois
        // resultados possíveis estão no mapa.
        classe !== "fa-chevron",
    );
    expect(semPar).toEqual([]);
  });

  it("icones-lucide.css está atualizado com o mapa (rode npm run icones)", () => {
    const gravado = readFileSync(
      "src/styles/icones-lucide.css",
      "utf8",
    ).replace(/\r\n/g, "\n");
    expect(gravado).toBe(gerarCssDosIcones());
  });

  it("o Font Awesome não é mais carregado", () => {
    for (const pagina of ["index.html", "analises.html"]) {
      expect(readFileSync(pagina, "utf8")).not.toContain("font-awesome");
    }
  });

  it("o CSS dos ícones entra logo depois dos tokens", () => {
    const main = readFileSync("src/main.js", "utf8");
    expect(main.indexOf("icones-lucide.css")).toBeGreaterThan(-1);
    expect(main.indexOf("icones-lucide.css")).toBeLessThan(
      main.indexOf("visual-polish.css"),
    );
    expect(readFileSync("src/analises/main.js", "utf8")).toContain(
      "icones-lucide.css",
    );
  });
});
