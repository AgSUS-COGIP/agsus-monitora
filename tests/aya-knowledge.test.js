import { describe, expect, it } from "vitest";
import {
  AYA_SOURCE_CATALOG,
  buildAyaSystemPrompt,
  curatedAnswerForQuestion,
  officialSourcesForQuestion,
  questionNeedsAyaAi,
  sanitizeAyaContext,
} from "../src/modules/aya-knowledge.js";

describe("base institucional da Aya", () => {
  it("associa CASAI às fontes do Ministério da Saúde", () => {
    const sources = officialSourcesForQuestion("O que é CASAI?");
    expect(sources.map((source) => source.id)).toEqual(["casai", "sesai"]);
    expect(sources[0].url).toMatch(
      /^https:\/\/.*gov\.br|^https:\/\/bvsms\.saude\.gov\.br/,
    );
  });

  it("associa aldeias e Terras Indígenas à Funai", () => {
    const aldeias = officialSourcesForQuestion(
      "Quais aldeias indígenas existem no Brasil?",
    );
    const terras = officialSourcesForQuestion("O que é uma Terra Indígena?");

    expect(aldeias).toContainEqual(AYA_SOURCE_CATALOG.funai);
    expect(terras).toContainEqual(AYA_SOURCE_CATALOG.funai);
  });

  it("responde diretamente sobre DSEI AL/SE e Kariri-Xocó", () => {
    const answer = curatedAnswerForQuestion(
      "Quantas aldeias tem no DSEI Alagoas? Diga mais sobre o povo Kariri-Xocó",
    );

    expect(answer).toContain("30 aldeias");
    expect(answer).toContain("base de 2023");
    expect(answer).toContain("2.509 pessoas");
    expect(answer).toContain("Ouricuri");
  });

  it("anexa PDSI AL/SE e Funai às perguntas específicas", () => {
    const sources = officialSourcesForQuestion(
      "Quantas aldeias tem no DSEI Alagoas e quem são os Kariri-Xocó?",
    );
    const ids = sources.map((source) => source.id);

    expect(ids).toContain("pdsi-al-se");
    expect(ids).toContain("funai-kariri-xoco");
    expect(ids).toContain("dsei");
    expect(ids).toContain("sesai");
    expect(ids).toContain("funai");
  });

  it("encaminha perguntas institucionais e contextuais para IA", () => {
    expect(questionNeedsAyaAi("O que é DSEI?", true)).toBe(true);
    expect(questionNeedsAyaAi("Quantas vagas o painel mostra?", true)).toBe(
      true,
    );
    expect(questionNeedsAyaAi("Quais aldeias existem?", false)).toBe(true);
    expect(questionNeedsAyaAi("Como uso o mapa?", true)).toBe(false);
  });

  it("limita e preserva o contexto útil enviado pelo navegador", () => {
    const context = sanitizeAyaContext({
      pathname: "/".repeat(300),
      pageTitle: "Saúde Indígena",
      mapSummary: "34 DSEIs · 2 CASAIs",
      activeFilters: ["UF: AM", "Edital: 01/2026"],
      search: "xavante",
      kpis: ["Vagas 120", "Ociosas 35"],
      territories: Array.from({ length: 40 }, (_, index) => `DSEI ${index}`),
      dseis: Array.from({ length: 40 }, (_, index) => `DSEI ${index}`),
      editais: Array.from({ length: 30 }, (_, index) => `Edital ${index}`),
      segredo: "não deve sair",
    });

    expect(context.pathname.length).toBeLessThanOrEqual(160);
    expect(context.mapSummary).toBe("34 DSEIs · 2 CASAIs");
    expect(context.activeFilters).toEqual(["UF: AM", "Edital: 01/2026"]);
    expect(context.kpis).toContain("Vagas 120");
    expect(context.territories).toHaveLength(34);
    expect(context.dseis).toHaveLength(34);
    expect(context.editais).toHaveLength(12);
    expect(context).not.toHaveProperty("segredo");
  });

  it("prioriza o estado atual do MONITORA no prompt", () => {
    const prompt = buildAyaSystemPrompt({
      section: "dashboard",
      title: "Saúde Indígena",
      question: "Quantas aldeias tem no DSEI Alagoas?",
      context: {
        mapSummary: "34 DSEIs · 2 CASAIs",
        activeFilters: ["UF: AM"],
        kpis: ["Vagas 120", "Ociosas 35"],
        dseis: ["DSEI Xavante — 10 vagas"],
        territories: ["DSEI Xavante — 10 vagas"],
        editais: ["Edital 1"],
      },
    });

    expect(prompt).toContain("Nunca invente aldeias");
    expect(prompt).toContain("34 DSEIs · 2 CASAIs");
    expect(prompt).toContain("30 aldeias atendidas");
    expect(prompt).toContain("não 36 DSEIs");
    expect(prompt).toContain("Não substitua uma pergunta factual");
    expect(prompt).toContain("Funai");
    expect(prompt).toContain("Não escreva URLs");
  });
});

describe("glossário do MONITORA", () => {
  it("define vaga ociosa sem depender do modelo", () => {
    const answer = curatedAnswerForQuestion("O que significa uma vaga ociosa?");
    expect(answer).toContain("sem contratação");
    expect(answer).toContain("Ociosas dividido por Vagas");
  });

  it("define contratados e taxa de ociosidade", () => {
    expect(curatedAnswerForQuestion("o que é contratados?")).toContain(
      "preenchida por contratação",
    );
    expect(curatedAnswerForQuestion("o que é taxa de ociosidade?")).toContain(
      "porcentagem",
    );
  });

  it("não sequestra perguntas que apenas citam o termo", () => {
    expect(curatedAnswerForQuestion("quantas vagas ociosas o DSEI tem?")).toBe(
      "",
    );
  });

  it("leva o glossário ao prompt do modelo", () => {
    const prompt = buildAyaSystemPrompt({ section: "saude-indigena" });
    expect(prompt).toContain("Vagas, Contratados e Ociosas");
    expect(prompt).toContain("Nunca invente siglas");
  });
});

describe("siglas institucionais respondidas sem o modelo", () => {
  it("nega que MONITORA seja sigla, sem contradição", () => {
    const answer = curatedAnswerForQuestion(
      "O que significa MONITORA? É uma sigla?",
    );
    expect(answer).toContain("Não é uma sigla");
    expect(answer).not.toMatch(/É uma sigla que/);
  });

  it("expande AgSUS, SESAI e SIASI corretamente", () => {
    expect(curatedAnswerForQuestion("o que é a AgSUS?")).toContain(
      "Agência Brasileira de Apoio à Gestão do Sistema Único de Saúde",
    );
    expect(curatedAnswerForQuestion("o que é SESAI?")).toContain(
      "Secretaria Especial de Saúde Indígena",
    );
    expect(curatedAnswerForQuestion("o que é o SIASI?")).toContain(
      "Sistema de Informação da Atenção à Saúde Indígena",
    );
  });

  it("não confunde SIASI com SasiSUS", () => {
    expect(curatedAnswerForQuestion("o que é o SIASI?")).toContain("SasiSUS");
  });
});

describe("siglas do SUS respondidas sem o modelo", () => {
  it("responde SUS corretamente, sem 'Sistema Universo'", () => {
    const answer = curatedAnswerForQuestion("o que é o SUS ?");
    expect(answer).toContain("Sistema Único de Saúde");
    expect(answer).toContain("1988");
    expect(answer).not.toMatch(/Universo/i);
  });

  it("não confunde SUS com AgSUS nem com SasiSUS", () => {
    expect(curatedAnswerForQuestion("O que é a AgSUS?")).toContain("Agência");
    expect(curatedAnswerForQuestion("o que é o SasiSUS?")).toContain(
      "Subsistema",
    );
  });

  it("deixa pergunta factual seguir para o caminho normal", () => {
    expect(curatedAnswerForQuestion("quantas vagas o SUS tem aqui?")).toBe("");
  });
});

describe("ordem do prompt e cache de prefixo", () => {
  it("mantém o conteúdo estático antes do variável", () => {
    const prompt = buildAyaSystemPrompt({
      section: "saude-indigena",
      question: "o que é DSEI?",
      context: { mapSummary: "34 territórios" },
    });
    // Os títulos abrem linha. Buscar sem âncora pegaria as citações que as
    // próprias regras fazem a essas seções.
    const secao = (titulo) => prompt.indexOf(`\n${titulo}`);
    const regras = secao("REGRAS DE CONFIABILIDADE");
    const base = secao("BASE INSTITUCIONAL CURADA");
    const exemplos = secao("EXEMPLOS DE COMPORTAMENTO");
    const pagina = secao("CONTEXTO FIXO DA PÁGINA");
    const curado = secao("CONHECIMENTO CURADO ESPECÍFICO");
    const tela = secao("CONTEXTO DA TELA DO MONITORA");

    // Tudo que não muda vem primeiro: é esse prefixo que o llama.cpp reaproveita
    // entre perguntas. Inverter a ordem custa mais de 20s por pergunta.
    expect(regras).toBeGreaterThan(-1);
    expect(base).toBeGreaterThan(regras);
    expect(exemplos).toBeGreaterThan(base);
    expect(pagina).toBeGreaterThan(exemplos);
    expect(curado).toBeGreaterThan(pagina);
    expect(tela).toBeGreaterThan(curado);
  });

  it("dois prompts diferentes compartilham o mesmo prefixo estático", () => {
    const a = buildAyaSystemPrompt({
      question: "o que é DSEI?",
      context: { mapSummary: "34 territórios" },
    });
    const b = buildAyaSystemPrompt({
      question: "quantas vagas?",
      context: { mapSummary: "7 territórios", activeFilters: ["UF: AL"] },
    });
    const prefixoA = a.slice(0, a.indexOf("\nCONTEXTO FIXO DA PÁGINA"));
    const prefixoB = b.slice(0, b.indexOf("\nCONTEXTO FIXO DA PÁGINA"));
    expect(prefixoA).toBe(prefixoB);
    expect(prefixoA.length).toBeGreaterThan(2000);
  });
});
