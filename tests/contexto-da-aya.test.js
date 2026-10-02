import { beforeEach, describe, expect, it } from "vitest";
import { collectAyaPageContext } from "../src/modulos/aya/contexto.js";
import {
  contextualAyaAnswer,
  resolverReferencia,
} from "../src/lib/contexto-da-aya.js";

describe("contexto da tela para a Aya", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span class="mapa-si-painel__contagem">34 DSEIs · 2 CASAIs</span>
      <section class="ui-tela visao-geral-tela">
        <div class="visao-geral-filtros"><div class="ui-chips">
          <button class="ui-chip"><b>UF</b> AM</button>
          <button class="ui-chip"><b>Edital</b> 01/2026</button>
        </div></div>
        <section class="ui-kpis visao-geral-kpis">
          <article class="ui-kpi">Vagas 120</article>
          <article class="ui-kpi">Ociosas 35</article>
        </section>
        <input class="ui-tabela-busca" value="Xavante" />
      </section>
      <button class="mapa-si-territorio">
        <strong>DSEI Xavante</strong>
        <small>2 ociosas · 1 processo · 22.000 hab.</small>
        <span class="mapa-si-territorio__vagas"><b>10</b> vagas</span>
      </button>
      <table class="visao-geral-tabela"><tbody>
        <tr><td>Edital 01/2026</td><td>DSEI Xavante</td><td>Aberto</td></tr>
      </tbody></table>
    `;
    document.title = "Saúde Indígena";
  });

  it("coleta mapa, filtros, indicadores, territórios e editais", () => {
    const context = collectAyaPageContext(document);

    expect(context.mapSummary).toBe("34 DSEIs · 2 CASAIs");
    expect(context.activeFilters.join(" ")).toContain("UF AM");
    expect(context.kpis).toEqual(["Vagas 120", "Ociosas 35"]);
    expect(context.search).toBe("Xavante");
    expect(context.territories[0]).toContain("DSEI Xavante");
    expect(context.territories[0]).toContain("10 vagas");
    expect(context.editais[0]).toContain("Edital 01/2026");
  });

  it("responde a própria identidade sem depender do Ollama", () => {
    expect(contextualAyaAnswer("qual é seu nome?", {})).toBe(
      "Eu sou a Aya, assistente do MONITORA da AgSUS.",
    );
    expect(contextualAyaAnswer("Quem é você?", {})).toContain("Aya");
  });

  it("responde a contagem de DSEIs pela lista de DSEIs, não pelo total de pontos", () => {
    document.querySelector(".visao-geral-filtros").textContent = "";
    document.querySelector(".mapa-si-painel__contagem").textContent =
      "36 pontos";
    document.body.insertAdjacentHTML(
      "beforeend",
      Array.from(
        { length: 33 },
        (_, index) =>
          `<button class="mapa-si-territorio"><strong>DSEI ${index + 2}</strong></button>`,
      ).join(""),
    );

    const context = collectAyaPageContext(document);
    const answer = contextualAyaAnswer("Quantos DSEIs tem no Brasil?", context);

    expect(context.territories).toHaveLength(34);
    expect(answer).toContain("34 DSEIs");
    expect(answer).not.toContain("36 DSEIs");
  });

  it("explicita quando a contagem de DSEIs corresponde a filtros ativos", () => {
    const answer = contextualAyaAnswer("Quantos DSEIs aparecem?", {
      mapSummary: "8 pontos",
      activeFilters: ["UF: AM"],
      territories: ["DSEI Alto Rio Negro", "DSEI Manaus"],
    });

    expect(answer).toContain("2 DSEIs");
    expect(answer).toContain("filtros ativos");
  });
});

describe("referência a um turno anterior", () => {
  it("resolve pronome usando a última pergunta do usuário", () => {
    const history = [
      { role: "user", content: "Dsei alagoas" },
      { role: "assistant", content: "..." },
    ];
    const resolvida = resolverReferencia("Diga mais sobre esse DSEI", history);
    expect(resolvida).toContain("Dsei alagoas");
    expect(resolvida).toContain("esse DSEI");
  });

  it("não arrasta assunto anterior para pergunta que já tem o seu", () => {
    const history = [{ role: "user", content: "Dsei alagoas" }];
    expect(resolverReferencia("o que é CASAI?", history)).toBe(
      "o que é CASAI?",
    );
  });

  it("aguenta histórico vazio ou só do assistente", () => {
    expect(resolverReferencia("diga mais sobre isso", [])).toBe(
      "diga mais sobre isso",
    );
    expect(
      resolverReferencia("diga mais sobre isso", [
        { role: "assistant", content: "x" },
      ]),
    ).toBe("diga mais sobre isso");
  });
});
