import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SUPABASE_AUTH_STORAGE_KEY } from "../src/lib/env.js";

/*
  As suítes de navegador semeiam a sessão escrevendo direto no armazenamento, e
  precisam usar a mesma chave que a aplicação lê. Elas não podem importar
  `src/lib/env.js`: esse módulo lê `import.meta.env`, que não existe no runtime do
  Playwright e derruba o ficheiro inteiro ao ser carregado.

  A chave fica, portanto, literal nos specs — e este teste é o que impede a
  divergência. Ele existe porque a divergência já aconteceu: até 08/09/2026 o
  spec de Análises usava "sb-gnudtaxhjfgtvwkwpsel-auth-token", nome anterior à
  unificação do cliente. Quem definisse só a sessão semeava numa chave que
  ninguém consulta, e a corrida seguia por um caminho não autenticado sem avisar.
*/

const specs = readdirSync("tests")
  .filter((nome) => nome.endsWith(".spec.js"))
  .map((nome) => ({ nome, fonte: readFileSync(join("tests", nome), "utf8") }));

describe("chave de armazenamento da sessão nos testes de navegador", () => {
  it("todo spec que semeia sessão usa a chave da aplicação", () => {
    const semeadores = specs.filter(({ fonte }) =>
      fonte.includes("E2E_SUPABASE_STORAGE_KEY"),
    );
    expect(semeadores.length, "nenhum spec semeia sessão").toBeGreaterThan(0);

    for (const { nome, fonte } of semeadores) {
      expect(fonte, `${nome} não usa a chave da aplicação`).toContain(
        `|| "${SUPABASE_AUTH_STORAGE_KEY}"`,
      );
    }
  });

  it("nenhum spec carrega a chave antiga como valor padrão", () => {
    for (const { nome, fonte } of specs) {
      const semComentarios = fonte
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(semComentarios, `${nome} ainda usa a chave antiga`).not.toContain(
        "sb-gnudtaxhjfgtvwkwpsel-auth-token",
      );
    }
  });

  /*
    Um spec autenticado que rodasse sem sessão passaria por vacuidade — verde sem
    ter exercitado nada. Todos precisam pular explicitamente quando falta a
    variável de ambiente.
  */
  it("todo spec autenticado pula quando falta a sessão, em vez de passar vazio", () => {
    const autenticados = specs.filter(({ fonte }) =>
      fonte.includes("E2E_SUPABASE_SESSION_JSON"),
    );
    expect(autenticados.length).toBeGreaterThan(0);
    for (const { nome, fonte } of autenticados) {
      expect(fonte, `${nome} não pula sem sessão`).toMatch(
        /test\.skip\(\s*!sessionJson/,
      );
    }
  });
});
