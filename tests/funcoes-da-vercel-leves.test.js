import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const pyproject = readFileSync("pyproject.toml", "utf8");

/*
  A conta Hobby da Vercel chegou a 100% de "Function Storage": cada deploy
  guarda o pacote de cada função. A função Python levava o repositório inteiro
  (supabase/, tests/, src/, docs/... ~37 MB) e Pillow + pypdfium2 (~27 MB) que
  a leitura do PDF não usa. Estes testes impedem que isso volte sem querer.
*/
describe("funções da Vercel enxutas", () => {
  const funcoesPython = readdirSync("api").filter(
    (nome) => nome.endsWith(".py") && !nome.startsWith("_"),
  );

  it("toda função api/*.py deixa de fora o que não é api/", () => {
    expect(funcoesPython.length).toBeGreaterThan(0);
    for (const nome of funcoesPython) {
      const opcoes = vercel.functions?.[`api/${nome}`];
      expect(opcoes, `api/${nome} sem entrada em vercel.json`).toBeTruthy();
      expect(opcoes.excludeFiles).toBe("{!(api)/**,.*/**,*,api/!(*.py)}");
    }
  });

  it("as dependências vêm do pyproject.toml, sem requirements.txt na raiz", () => {
    // Com os dois, não fica claro qual a Vercel usa; o override só vale no pyproject.
    expect(existsSync("requirements.txt")).toBe(false);
    expect(pyproject).toMatch(/dependencies = \["pdfplumber==/);
  });

  it("Pillow e pypdfium2 ficam fora do pacote", () => {
    expect(pyproject).toContain(`"pillow; sys_platform == 'never'"`);
    expect(pyproject).toContain(`"pypdfium2; sys_platform == 'never'"`);
  });
});
