import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  compilarVerbetes,
  gerarModulo,
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
    const esperado = gerarModulo({ verbetes });
    const atual = readFileSync(
      "src/modules/aya-conhecimento-gerado.js",
      "utf8",
    ).replace(/\r\n/g, "\n");
    expect(atual.trim()).toBe(esperado.trim());
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
