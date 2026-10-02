import { describe, expect, it } from "vitest";
import {
  AYA_SOURCE_CATALOG,
  curatedAnswerForQuestion,
  officialSourcesForQuestion,
} from "../src/modules/aya-knowledge.js";
import { responderAya } from "../src/lib/busca-da-aya.js";

const responder = (question) =>
  responderAya({ question, section: "dashboard", area: "saude-indigena" });
const resposta = (question) => responder(question).answer;

describe("fontes oficiais da Aya", () => {
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

  it("anexa PDSI AL/SE e Funai às perguntas específicas", () => {
    const ids = officialSourcesForQuestion(
      "Quantas aldeias tem no DSEI Alagoas e quem são os Kariri-Xocó?",
    ).map((source) => source.id);

    expect(ids).toContain("pdsi-al-se");
    expect(ids).toContain("funai-kariri-xoco");
    expect(ids).toContain("dsei");
    expect(ids).toContain("sesai");
    expect(ids).toContain("funai");
  });

  it("não cita mais fontes de assuntos fora do MONITORA", () => {
    expect(AYA_SOURCE_CATALOG).not.toHaveProperty("anvisaMedicamentos");
    expect(AYA_SOURCE_CATALOG).not.toHaveProperty("ifab");
    expect(officialSourcesForQuestion("O que é medicamento?")).toEqual([]);
  });
});

describe("resposta composta do DSEI Alagoas e Sergipe", () => {
  it("responde as duas perguntas num enunciado só", () => {
    const answer = curatedAnswerForQuestion(
      "Quantas aldeias tem no DSEI Alagoas? Diga mais sobre o povo Kariri-Xocó",
    );

    expect(answer).toContain("30 aldeias");
    expect(answer).toContain("base de 2023");
    expect(answer).toContain("2.509 pessoas");
    expect(answer).toContain("Ouricuri");
  });

  it("deixa a pergunta simples para a busca na base", () => {
    expect(curatedAnswerForQuestion("o que é o DSEI Alagoas?")).toBe("");
    expect(resposta("o que é o DSEI Alagoas?")).toContain("Maceió");
  });
});

describe("base institucional pela busca", () => {
  it("responde a criação da Funai com a fonte institucional", () => {
    const resultado = responder("Quando Criou a Funai ?");
    expect(resultado.answer).toContain("5 de dezembro de 1967");
    expect(resultado.answer).toContain("Lei nº 5.371");
    expect(resultado.sources).toContainEqual(
      AYA_SOURCE_CATALOG.funaiInstitucional,
    );
  });

  it("define vaga ociosa, contratados e taxa de ociosidade", () => {
    expect(resposta("O que significa uma vaga ociosa?")).toContain(
      "sem contratação",
    );
    expect(resposta("o que é taxa de ociosidade?")).toContain(
      "Ociosas dividido pelo total de Vagas",
    );
    expect(resposta("o que é contratados?")).toContain(
      "preenchida por contratação",
    );
  });

  it("não troca pergunta factual pela definição", () => {
    expect(resposta("quantas vagas ociosas o DSEI tem?")).toContain(
      "Não encontrei esse número",
    );
    expect(resposta("quantas vagas o SUS tem aqui?")).toContain(
      "Não encontrei esse número",
    );
  });

  it("nega que MONITORA seja sigla, sem contradição", () => {
    const answer = resposta("O que significa MONITORA? É uma sigla?");
    expect(answer).toContain("Não é uma sigla");
    expect(answer).not.toMatch(/É uma sigla que/);
  });

  it("expande AgSUS, SESAI, SIASI e SUS corretamente", () => {
    expect(resposta("o que é a AgSUS?")).toContain(
      "Agência Brasileira de Apoio à Gestão do Sistema Único de Saúde",
    );
    expect(resposta("o que é SESAI?")).toContain(
      "Secretaria Especial de Saúde Indígena",
    );
    expect(resposta("o que é o SIASI?")).toContain(
      "Sistema de Informação da Atenção à Saúde Indígena",
    );
    const sus = resposta("o que é o SUS ?");
    expect(sus).toContain("Sistema Único de Saúde");
    expect(sus).toContain("1988");
    expect(resposta("o que é o SasiSUS?")).toContain("Subsistema");
  });
});
