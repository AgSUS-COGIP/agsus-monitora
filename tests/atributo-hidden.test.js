import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Regra `display` vencendo o atributo `hidden` causou, numa só revisão, quatro
  defeitos: filtros da Saúde Indígena abertos ao mesmo tempo, "Alterações não
  salvas" sempre visível, a grade antiga de Configurações sob as seções novas e
  as linhas filtradas de Editais continuando no celular. A regra global em
  app.css resolve todos; este teste impede que ela saia numa limpeza de CSS.
*/
describe("o atributo hidden sempre esconde", () => {
  const app = readFileSync("src/styles/app.css", "utf8").replace(/\r\n/g, "\n");

  it("app.css declara [hidden] com display none !important", () => {
    expect(app).toMatch(/\n\[hidden\] \{\n\s+display: none !important;\n\}/);
  });
});
