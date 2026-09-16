import { describe, expect, it } from "vitest";
import {
  AYA_SOURCE_CATALOG,
  buildAyaSystemPrompt,
  officialSourcesForQuestion,
  questionNeedsAyaAi,
  sanitizeAyaContext,
} from "../src/modules/aya-knowledge.js";

describe("base institucional da Aya", () => {
  it("associa CASAI às fontes do Ministério da Saúde", () => {
    const sources = officialSourcesForQuestion("O que é CASAI?");
    expect(sources.map((source) => source.id)).toEqual(["casai", "sesai"]);
    expect(sources[0].url).toMatch(/^https:\/\/.*gov\.br|^https:\/\/bvsms\.saude\.gov\.br/);
  });

  it("associa aldeias e Terras Indígenas à Funai", () => {
    const aldeias = officialSourcesForQuestion(
      "Quais aldeias indígenas existem no Brasil?",
    );
    const terras = officialSourcesForQuestion("O que é uma Terra Indígena?");

    expect(aldeias).toContainEqual(AYA_SOURCE_CATALOG.funai);
    expect(terras).toContainEqual(AYA_SOURCE_CATALOG.funai);
  });

  it("encaminha perguntas institucionais e desconhecidas para IA", () => {
    expect(questionNeedsAyaAi("O que é DSEI?", true)).toBe(true);
    expect(questionNeedsAyaAi("Quais aldeias existem?", false)).toBe(true);
    expect(questionNeedsAyaAi("Como uso o mapa?", true)).toBe(false);
  });

  it("limita o contexto enviado pelo navegador", () => {
    const context = sanitizeAyaContext({
      pathname: "/".repeat(300),
      dseis: Array.from({ length: 30 }, (_, index) => `DSEI ${index}`),
      editais: Array.from({ length: 30 }, (_, index) => `Edital ${index}`),
      segredo: "não deve sair",
    });

    expect(context.pathname.length).toBeLessThanOrEqual(160);
    expect(context.dseis).toHaveLength(10);
    expect(context.editais).toHaveLength(10);
    expect(context).not.toHaveProperty("segredo");
  });

  it("instrui o modelo a não inventar listas de aldeias", () => {
    const prompt = buildAyaSystemPrompt({
      section: "dashboard",
      title: "Saúde Indígena",
      context: { dseis: ["DSEI Xavante"], editais: ["Edital 1"] },
    });

    expect(prompt).toContain("Nunca invente aldeias");
    expect(prompt).toContain("DSEI Xavante");
    expect(prompt).toContain("Funai");
    expect(prompt).toContain("Não escreva URLs");
  });
});
