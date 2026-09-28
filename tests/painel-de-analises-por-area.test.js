import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Saúde Indígena, SEDE e Projetos usam o mesmo painel de análises. Estes testes
  guardam as costuras que não dá para montar no jsdom sem subir o app inteiro:
  o MONITORA manda a área atual na URL e recarrega o quadro quando ela muda; o
  painel manda a área às duas RPCs e ao catálogo de editais.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const legado = ler("src/modules/legacy-app.js");
const trecho = (inicio, fim) =>
  legado.slice(
    legado.indexOf(inicio),
    legado.indexOf(fim, legado.indexOf(inicio)),
  );

describe("o MONITORA abre o painel com a área atual", () => {
  const abrir = trecho(
    "function openPanel(code)",
    "function buildExternalPanel",
  );
  const montar = trecho(
    "function buildExternalPanel",
    "function reloadExternal",
  );

  it("o endereço do quadro e o de 'abrir em nova aba' levam ?area=", () => {
    expect(abrir).toContain("areaDeAberturaDoPainel(");
    expect(abrir).toContain("enderecoDoPainelNaArea(panel.url");
    expect(montar).toContain("enderecoDoPainelNaArea(");
    expect(montar).toContain("holder.dataset.area");
  });

  it("quadro aberto em outra área é refeito com a área nova", () => {
    expect(abrir).toMatch(/holder\.dataset\.area[^\n]*!== areaDoPainel/);
    expect(abrir).toContain("holder.dataset.area = areaDoPainel;");
    expect(legado).toContain(
      "assinarDadosDoMonitoramento(recarregarPainelNaAreaAtual);",
    );
  });
});

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

  it("o cache local usa a chave por área", () => {
    expect(ler("src/analises/analises-app.js")).toContain(
      "chaveDoCacheLocalDeAnalises({",
    );
  });
});
