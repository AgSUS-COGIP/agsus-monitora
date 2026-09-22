import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));

/*
  A conta chegou ao limite de build da Vercel construindo preview de cada
  branch. Como o CI do GitHub já roda build, smoke e a suíte inteira, o preview
  era o item mais caro e o menos necessário.

  A semântica do ignoreCommand é invertida e não perdoa: código de saída 0 PULA
  o build, diferente de zero CONSTRÓI. Inverter a condição sem perceber
  desligaria a produção em vez dos previews, e o sintoma seria o site parar de
  atualizar — coisa que ninguém liga ao vercel.json de imediato.
*/
describe("a Vercel só constrói a main", () => {
  it("o comando está declarado e cabe no limite do schema", () => {
    expect(typeof vercel.ignoreCommand).toBe("string");
    expect(vercel.ignoreCommand.length).toBeLessThanOrEqual(256);
  });

  function saidaPara(ref) {
    try {
      execFileSync("sh", ["-c", vercel.ignoreCommand], {
        env: { ...process.env, VERCEL_GIT_COMMIT_REF: ref },
        stdio: "ignore",
      });
      return 0;
    } catch (erro) {
      return erro.status ?? 1;
    }
  }

  it("constrói a main", () => {
    expect(saidaPara("main")).not.toBe(0);
  });

  it("pula qualquer outra branch", () => {
    for (const ref of [
      "fix/alguma-coisa",
      "Permissões",
      "develop",
      "main-antiga",
      "feature/main",
    ]) {
      expect(saidaPara(ref)).toBe(0);
    }
  });

  it("não confunde branch cujo nome contém main", () => {
    expect(saidaPara("mainline")).toBe(0);
    expect(saidaPara("hotfix/main")).toBe(0);
  });
});
