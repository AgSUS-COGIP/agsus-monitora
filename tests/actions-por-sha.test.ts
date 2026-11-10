import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Auditoria de 09/11/2026 (QA-01): Action de terceiro referenciada por tag
  (`@v7`) pode mudar sem aviso se a tag for movida. Toda Action externa fica
  presa ao SHA completo do commit, com a versão no comentário (`# v7`), o
  formato que o Dependabot (`.github/dependabot.yml`, github-actions) mantém
  atualizado. Workflow reutilizável do próprio repositório (`./…`) fica de fora.
*/
const PASTA = ".github/workflows";
const usos = readdirSync(PASTA)
  .filter((nome) => /\.ya?ml$/.test(nome))
  .flatMap((nome) =>
    readFileSync(`${PASTA}/${nome}`, "utf8")
      .split(/\r?\n/)
      .map((linha, i) => ({ onde: `${nome}:${i + 1}`, linha }))
      .filter(({ linha }) => /^\s*(?:-\s*)?uses:/.test(linha)),
  );

describe("Actions presas ao SHA", () => {
  it("há Actions externas para conferir", () => {
    expect(usos.length).toBeGreaterThan(0);
  });

  it("toda Action externa usa o SHA completo e diz a versão", () => {
    const soltas = usos
      .filter(({ linha }) => !/uses:\s*\.\//.test(linha))
      .filter(
        ({ linha }) =>
          !/uses:\s*[\w.-]+\/[\w./-]+@[0-9a-f]{40}\s+#\s*v\d[\w.-]*\s*$/.test(
            linha,
          ),
      )
      .map(({ onde, linha }) => `${onde}: ${linha.trim()}`);
    expect(soltas).toEqual([]);
  });
});
