import { describe, expect, it } from "vitest";
import {
  compilarVerbetes,
} from "../scripts/compilar-conhecimento-aya.mjs";
import { VERBETES_AYA } from "../src/modules/aya-conhecimento-gerado.js";
import {
  buildAyaSystemPrompt,
  curatedAnswerForQuestion,
} from "../src/modules/aya-knowledge.js";

describe("base de conhecimento em docs/aya", () => {
  it("não tem verbete malformado", () => {
    const { problemas } = compilarVerbetes();
    expect(problemas).toEqual([]);
  });

  /*
    O módulo gerado é o que o código lê. Se alguém editar um `.md` e não rodar
    `npm run aya:conhecimento`, a Aya responde com a base velha e nada avisa.
    Este teste é o aviso.
  */
  it("o módulo gerado está em dia com os .md", () => {
    const { verbetes } = compilarVerbetes();
    const esperado = verbetes.map((verbete) => ({
      titulo: verbete.titulo,
      perguntas: verbete.perguntas,
      resposta: verbete.resposta,
      fato: verbete.fato,
      fonte: verbete.fonte,
    }));
    expect(VERBETES_AYA).toEqual(esperado);
  });

  it("toda resposta direta declara fonte", () => {
    const semFonte = VERBETES_AYA.filter(
      (verbete) => verbete.resposta && !verbete.fonte,
    ).map((verbete) => verbete.titulo);
    expect(semFonte).toEqual([]);
  });

  it("leva os fatos dos verbetes ao prompt", () => {
    const prompt = buildAyaSystemPrompt({ section: "saude-indigena" });
    const fatos = VERBETES_AYA.filter((verbete) => verbete.fato);
    expect(fatos.length).toBeGreaterThan(15);
    for (const verbete of fatos) {
      expect(prompt).toContain(verbete.fato);
    }
  });

  /*
    Cada 1.000 tokens de prompt custam cerca de 8 segundos de avaliação nesta
    máquina sem GPU. O cache de prefixo absorve isso depois da primeira
    pergunta, mas o aquecimento inicial cresce junto. O limite é folgado de
    propósito: serve para avisar quem dobrar a base de uma vez, não para
    impedir que ela cresça.
  */
  it("mantém o prompt dentro de um tamanho defensável", () => {
    const prompt = buildAyaSystemPrompt({
      section: "saude-indigena",
      context: { mapSummary: "34 territórios" },
    });
    const tokensAproximados = Math.round(prompt.length / 3.5);
    expect(tokensAproximados).toBeLessThan(6000);
  });
});

describe("quando o verbete dispensa o verbo de definição", () => {
  it("atende gatilho que já é pergunta inteira", () => {
    expect(curatedAnswerForQuestion("quem atende nas aldeias?")).toContain(
      "EMSI",
    );
    expect(curatedAnswerForQuestion("quantas casai existem?")).toContain(
      "70 CASAIs",
    );
    expect(
      curatedAnswerForQuestion("qual a diferença entre dsei e terra indígena?"),
    ).toContain("Não são a mesma coisa");
  });

  it("continua deixando pergunta factual ler a tela", () => {
    expect(curatedAnswerForQuestion("quantas vagas ociosas o DSEI tem?")).toBe(
      "",
    );
    expect(curatedAnswerForQuestion("quantos editais aparecem aqui?")).toBe("");
    expect(curatedAnswerForQuestion("me mostre as vagas ociosas")).toBe("");
  });
});

describe("perfil do DSEI quando o nome é dito", () => {
  it("responde o distrito, não a definição genérica de DSEI", () => {
    for (const pergunta of [
      "Dsei alagoas",
      "Diga mais sobre o DSEI Alagoas",
      "dsei al/se",
    ]) {
      const resposta = curatedAnswerForQuestion(pergunta);
      expect(resposta).toContain("Maceió");
      expect(resposta).toContain("13.480");
    }
  });

  it("mantém a resposta composta quando há duas perguntas juntas", () => {
    const resposta = curatedAnswerForQuestion(
      "Quantas aldeias tem no DSEI Alagoas? Diga mais sobre o povo Kariri-Xocó",
    );
    expect(resposta).toContain("30 aldeias");
    expect(resposta).toContain("Ouricuri");
  });
});

describe("política e controle social", () => {
  it("responde PNASPI, CONDISI e as três instâncias", () => {
    expect(curatedAnswerForQuestion("o que é a PNASPI?")).toContain(
      "Portaria 254",
    );
    expect(curatedAnswerForQuestion("o que é CONDISI?")).toContain("paritária");
    expect(
      curatedAnswerForQuestion("quais são os conselhos da saúde indígena?"),
    ).toContain("FPCONDISI");
  });

  it("não confunde conselho local com distrital", () => {
    expect(curatedAnswerForQuestion("o que é conselho local?")).toContain(
      "consultivo",
    );
    expect(curatedAnswerForQuestion("o que é CONDISI?")).toContain(
      "deliberativo",
    );
  });
});

describe("lista dos 34 DSEIs", () => {
  it("responde a lista completa sem passar pelo modelo", () => {
    const resposta = curatedAnswerForQuestion("quais são os 34 DSEIs?");
    for (const nome of ["Yanomami", "Vale do Javari", "Parintins", "Xavante"]) {
      expect(resposta).toContain(nome);
    }
  });

  /*
    A lista tem 34 nomes e não ajuda o modelo a redigir nada. Deixá-la fora do
    prompt mantém o prefixo estático enxuto — é para isso que `resposta` e
    `fato` são campos separados.
  */
  it("mantém a lista fora do prompt", () => {
    const prompt = buildAyaSystemPrompt({ section: "saude-indigena" });
    expect(prompt).not.toContain("Parintins");
  });

  it("nomear um distrito dispensa o verbo de definição", () => {
    expect(curatedAnswerForQuestion("dsei vale do javari")).toContain(
      "Atalaia do Norte",
    );
    expect(curatedAnswerForQuestion("quantos DSEIs aparecem na tela?")).toBe(
      "",
    );
  });
});
