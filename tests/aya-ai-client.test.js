import { beforeEach, describe, expect, it } from "vitest";
import {
  collectAyaPageContext,
  contextualAyaAnswer,
} from "../src/modules/aya-ai-client.js";

describe("contexto da tela para a Aya", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="masterMapCount">34 territórios</div>
      <div id="activeFiltersBar">UF: AM · Edital: 01/2026</div>
      <div class="kpis kpis-main">
        <div class="kpi">Vagas 120</div>
        <div class="kpi">Ociosas 35</div>
      </div>
      <input id="tableSearch" value="Xavante" />
      <div class="health-map-unit" data-dsei="0">
        <strong>DSEI Xavante</strong>
        <small>10 vagas · 2 ociosas · 1 processo</small>
        <span class="health-map-unit__type">22.000</span>
      </div>
      <table><tbody id="monitorRows">
        <tr><td>Edital 01/2026</td><td>DSEI Xavante</td><td>Aberto</td></tr>
      </tbody></table>
    `;
    document.title = "Saúde Indígena";
  });

  it("coleta mapa, filtros, indicadores, territórios e editais", () => {
    const context = collectAyaPageContext(document);

    expect(context.mapSummary).toBe("34 territórios");
    expect(context.activeFilters.join(" ")).toContain("UF: AM");
    expect(context.kpis).toEqual(["Vagas 120", "Ociosas 35"]);
    expect(context.search).toBe("Xavante");
    expect(context.territories[0]).toContain("DSEI Xavante");
    expect(context.territories[0]).toContain("10 vagas");
    expect(context.editais[0]).toContain("Edital 01/2026");
  });

  it("responde a contagem de DSEIs diretamente do mapa", () => {
    const context = collectAyaPageContext(document);
    const answer = contextualAyaAnswer(
      "Quantos DSEIs tem no Brasil?",
      context,
    );

    expect(answer).toContain("34 DSEIs");
    expect(answer).toContain("visão atual do mapa");
  });

  it("explicita quando a contagem corresponde a filtros ativos", () => {
    const answer = contextualAyaAnswer("Quantos territórios aparecem?", {
      mapSummary: "8 territórios",
      activeFilters: ["UF: AM"],
      territories: [],
    });

    expect(answer).toContain("8 DSEIs");
    expect(answer).toContain("filtros ativos");
  });
});
