import { beforeEach, describe, expect, it } from "vitest";
import {
  ayaFailureMessage,
  collectAyaPageContext,
  contextualAyaAnswer,
  resolverReferencia,
} from "../src/modules/aya-ai-client.js";

describe("contexto da tela para a Aya", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="masterMapCount">34 DSEIs · 2 CASAIs</div>
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

    expect(context.mapSummary).toBe("34 DSEIs · 2 CASAIs");
    expect(context.activeFilters.join(" ")).toContain("UF: AM");
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
    document.querySelector("#activeFiltersBar").textContent = "";
    document.querySelector("#masterMapCount").textContent = "36 pontos";
    document.body.insertAdjacentHTML(
      "beforeend",
      Array.from(
        { length: 33 },
        (_, index) =>
          `<div class="health-map-unit" data-dsei="${index + 1}"><strong>DSEI ${index + 2}</strong></div>`,
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

describe("mensagens de falha da Aya", () => {
  it("distingue cada causa de indisponibilidade", () => {
    expect(ayaFailureMessage("local_ai_not_configured")).toContain(
      "AYA_LOCAL_BRIDGE_URL",
    );
    expect(ayaFailureMessage("local_ai_unavailable")).toContain("túnel");
    // Sem número fixo: a mensagem não deve repetir AI_TIMEOUT_MS, senão as duas
    // divergem no primeiro ajuste de limite.
    expect(ayaFailureMessage("timeout")).toContain("cancelada pelo navegador");
    expect(ayaFailureMessage("timeout")).not.toMatch(/d+ segundos/);
    expect(ayaFailureMessage("http_404")).toContain("/api/aya");
    expect(ayaFailureMessage("sessao_expirada")).toContain("sessão expirou");
  });

  it("cai numa mensagem genérica para causa desconhecida", () => {
    expect(ayaFailureMessage("causa_nova")).toBe(
      "A IA da Aya está temporariamente indisponível.",
    );
    expect(ayaFailureMessage()).toBe(
      "A IA da Aya está temporariamente indisponível.",
    );
  });
});

describe("falha de autenticação do servidor", () => {
  it("separa configuração do servidor de sessão do usuário", () => {
    expect(ayaFailureMessage("auth_not_configured")).toContain(
      "configuração do ambiente",
    );
    expect(ayaFailureMessage("auth_not_configured")).toContain(
      "entrar novamente não resolve",
    );
    expect(ayaFailureMessage("unauthorized")).toContain(
      "Entre novamente no MONITORA",
    );
  });
});

describe("máquina que hospeda a IA fora do ar", () => {
  it("distingue serviço não subiu de túnel quebrado", () => {
    expect(ayaFailureMessage("local_ai_offline")).toContain("sem dar sinal");
    expect(ayaFailureMessage("local_ai_offline")).toContain("reiniciado");
    expect(ayaFailureMessage("local_ai_unavailable")).toContain("túnel");
  });
});

describe("detalhe técnico da falha", () => {
  it("acrescenta a razão informada pelo servidor", () => {
    const msg = ayaFailureMessage("unauthorized", "token is expired");
    expect(msg).toContain("Entre novamente no MONITORA");
    expect(msg).toContain("Detalhe técnico: token is expired");
  });

  it("não inventa nota quando o servidor não mandou razão", () => {
    expect(ayaFailureMessage("unauthorized")).not.toContain("Detalhe técnico");
    expect(ayaFailureMessage("unauthorized", "   ")).not.toContain(
      "Detalhe técnico",
    );
  });

  it("trunca detalhe longo em vez de despejar na tela", () => {
    const msg = ayaFailureMessage("unauthorized", "x".repeat(500));
    expect(msg.length).toBeLessThan(400);
  });
});

describe("chave do bridge divergente", () => {
  it("não culpa a sessão do usuário por erro de configuração", () => {
    const msg = ayaFailureMessage("local_ai_key_mismatch");
    expect(msg).toContain("AYA_LOCAL_BRIDGE_KEY");
    expect(msg).toContain("não da sua conta");
    expect(msg).not.toContain("Entre novamente no MONITORA.");
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
