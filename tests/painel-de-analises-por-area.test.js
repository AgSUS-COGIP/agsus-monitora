import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Saúde Indígena, SEDE e Projetos usam o mesmo app de análises. Estes testes
  guardam as costuras que não dá para montar no jsdom sem subir o app inteiro:
  o app manda a área às duas RPCs e ao catálogo de editais. O lado do MONITORA
  (a área na URL do quadro, refeito quando ela muda) está em
  `tests/modules/pagina-de-analises.test.js`.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");

describe("o painel pede os dados da sua área", () => {
  it("as duas RPCs recebem p_area", () => {
    expect(ler("src/analises/analises-consolidated-transport.js")).toContain(
      "...parametroDeAreaDaRpc(AREA_DO_PAINEL)",
    );
    expect(ler("src/analises/analises-scope-guard.js")).toContain(
      "...parametroDeAreaDaRpc(AREA_DO_PAINEL)",
    );
  });

  it("o catálogo de editais é o da planilha da área", () => {
    expect(ler("src/analises/analises-scope-guard.js")).toContain(
      '.eq("CO_PLANILHA", AREA_DO_PAINEL)',
    );
  });

  it("a cópia guardada no navegador é por área", () => {
    expect(ler("src/analises/analises-consolidated-transport.js")).toContain(
      "area: AREA_DO_PAINEL,",
    );
  });
});
