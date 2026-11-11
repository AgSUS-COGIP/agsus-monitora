import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  Foco visível e borda de campo com contraste (regras de ouro 6, docs/biblioteca/design-e-tokens.md;
  seção 4, "Formulário").

  1. `--focus-ring` é uma COR (tokens.css), não uma sombra:
     `box-shadow: var(--focus-ring)` é declaração inválida e o navegador a
     descarta em silêncio. Seis regras faziam isso junto com `outline: none`;
     o anel que aparecia era o global de `app.css`, e não o que a regra dizia.
     Quem quiser anel próprio usa `outline: 2px solid var(--focus-ring)`.
  2. Campo (input, select, textarea) tem borda `--border-control` (3:1 sobre o
     cartão); `--border-subtle` (#e0e5ec, 1,3:1) some no branco. Achado na
     Convocação e na ficha de Entrevistas no pente fino de 10/11/2026.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");

function cssDe(pasta: string): string[] {
  return fs
    .readdirSync(path.join(RAIZ, pasta), { withFileTypes: true })
    .flatMap((item) => {
      const relativo = `${pasta}/${item.name}`;
      if (item.isDirectory()) return cssDe(relativo);
      return item.name.endsWith(".css") ? [relativo] : [];
    });
}

interface Regra {
  arquivo: string;
  seletor: string;
  corpo: string;
}

function regras(arquivo: string): Regra[] {
  const texto = fs
    .readFileSync(path.join(RAIZ, arquivo), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
  return [...texto.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
    ([, seletor = "", corpo = ""]) => ({
      arquivo,
      seletor: seletor.replace(/\s+/g, " ").trim(),
      corpo,
    }),
  );
}

/*
  Campo preenchido da matriz de notas das Entrevistas: a borda some de
  propósito e o fundo (`--surface-hover`) marca a célula.
*/
const CAMPOS_SEM_BORDA_DE_PROPOSITO = new Set([
  "src/modulos/entrevistas/entrevistas.css .entrevistas-tela .entrevistas-matriz .entrevistas-celula.is-preenchida input.entrevistas-nota",
]);

/* O último seletor simples da lista é um campo de texto ou de escolha? */
function ehCampo(seletor: string): boolean {
  return seletor.split(",").some((parte) => {
    const ultimo =
      parte
        .trim()
        .split(/[\s>+~]+/)
        .pop() ?? "";
    if (/checkbox|radio|range|:disabled/.test(ultimo)) return false;
    return /^(input|select|textarea)\b|-select$/.test(ultimo);
  });
}

describe("foco e borda dos campos", () => {
  const todas = [...cssDe("src/modulos"), ...cssDe("src/ui")].flatMap(regras);

  it("não usa a cor do anel de foco como sombra", () => {
    const invalidas = [...todas, ...cssDe("src/styles").flatMap(regras)]
      .filter((r) => /box-shadow:\s*var\(--focus-ring\)\s*[;}]?/.test(r.corpo))
      .map((r) => `${r.arquivo} ${r.seletor}`);
    expect(invalidas).toEqual([]);
  });

  it("desenha a borda dos campos com --border-control", () => {
    const fracas = todas
      .filter(
        (r) =>
          ehCampo(r.seletor) &&
          /border(-color)?:[^;]*--border-subtle/.test(r.corpo) &&
          !CAMPOS_SEM_BORDA_DE_PROPOSITO.has(`${r.arquivo} ${r.seletor}`),
      )
      .map((r) => `${r.arquivo} ${r.seletor}`);
    expect(fracas).toEqual([]);
  });
});
