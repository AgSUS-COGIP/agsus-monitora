import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const main = readFileSync("src/main.js", "utf8");
const operational = readFileSync("src/modules/nucleo-operational.js", "utf8");

describe("regressões de performance da Equipe Núcleo", () => {
  it("não carrega mais o inicializador de refresh temporizado", () => {
    expect(main).not.toContain("initNucleoInitialRefresh");
    expect(main).not.toContain('from "./modules/nucleo-initial-refresh.js"');
  });

  it("não volta a decorar a tela com uma rajada de quatro timers", () => {
    expect(operational).not.toContain("[0, 100, 350, 900]");
    expect(operational).not.toContain("scheduleDecoration");
    expect(operational).toContain("requestAnimationFrame");
  });

  it("usa índice por chave em vez de percorrer todo o resumo para cada linha", () => {
    expect(operational).toContain("summaryByKey.get");
    expect(operational).not.toMatch(/state\.summary\.find\s*\(/);
  });

  it("invalida o resumo depois de salvar o cronograma", () => {
    expect(operational).toContain('"agsus:nucleo-cronograma-saved"');
    expect(operational).toContain("invalidate: true");
    expect(operational).toContain("force: true");
  });
});
