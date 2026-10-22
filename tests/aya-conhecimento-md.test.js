import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compilarVerbetes,
  gerarModulo,
} from "../scripts/compilar-conhecimento-aya.mjs";
import { VERBETES_AYA } from "../src/modules/aya-conhecimento-gerado.js";
import { responderAya } from "../src/lib/busca-da-aya.js";

const resposta = (question) =>
  responderAya({ question, section: "dashboard", area: "saude-indigena" })
    .answer;

/* Compila uma pasta de exemplo com um só documento. */
function compilarExemplo(conteudo) {
  const pasta = mkdtempSync(join(tmpdir(), "aya-base-"));
  try {
    writeFileSync(join(pasta, "exemplo.md"), conteudo);
    return compilarVerbetes(pasta);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}

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
  it("o módulo gerado está em dia com os .md", async () => {
    const { verbetes } = compilarVerbetes();
    const esperado = await gerarModulo({ verbetes });
    const atual = readFileSync(
      "src/modules/aya-conhecimento-gerado.js",
      "utf8",
    ).replace(/\r\n/g, "\n");
    expect(atual.trim()).toBe(esperado.trim());
  });

  it("todo verbete tem perguntas, resposta e fonte", () => {
    const incompletos = VERBETES_AYA.filter(
      (verbete) =>
        !verbete.perguntas.length || !verbete.resposta || !verbete.fonte,
    ).map((verbete) => verbete.titulo);
    expect(incompletos).toEqual([]);
  });

  it("não guarda mais assuntos gerais (plantas, carros, futebol, remédios)", () => {
    const arquivos = new Set(VERBETES_AYA.map((verbete) => verbete.arquivo));
    expect(arquivos.has("06-assuntos-gerais.md")).toBe(false);
    const texto = VERBETES_AYA.map((v) => v.resposta).join(" ");
    expect(texto).not.toMatch(/futebol|impedimento|fotoss[ií]ntese/i);
  });
});

describe("compilador da base", () => {
  it("acusa verbete sem perguntas, mesmo que só tenha fato", () => {
    const { problemas } = compilarExemplo(
      "# Exemplo\n\n## Sem gatilho\n\n**fato:** Algo.\n**fonte:** interface do MONITORA\n",
    );
    expect(problemas).toEqual([
      "exemplo.md › Sem gatilho: não tem perguntas que o disparem",
    ]);
  });

  it("acusa a mesma pergunta em dois verbetes, como a busca a vê", () => {
    const { problemas } = compilarExemplo(
      [
        "# Exemplo",
        "## Um",
        "**perguntas:** lista de aprovados",
        "**resposta:** Um.",
        "**fonte:** interface do MONITORA",
        "## Dois",
        "**perguntas:** as listas dos aprovados",
        "**resposta:** Dois.",
        "**fonte:** interface do MONITORA",
      ].join("\n\n"),
    );
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('"Um" e "Dois"');
  });

  it("aceita variações da mesma pergunta no mesmo verbete", () => {
    const { problemas } = compilarExemplo(
      "## Edital\n\n**perguntas:** edital | editais\n**resposta:** Edital.\n**fonte:** interface do MONITORA\n",
    );
    expect(problemas).toEqual([]);
  });
});

describe("verbetes que só tinham fato agora têm perguntas", () => {
  it("responde pelos gatilhos novos", () => {
    expect(resposta("por que 36 pontos no mapa?")).toContain("não 36 DSEIs");
    expect(resposta("cores da tabela")).toContain("vermelho");
    expect(resposta("como comparar territórios?")).toContain("comparar");
    expect(resposta("base geoespacial da Funai")).toContain("atualização");
    expect(resposta("plano nacional de saúde")).toContain("2024-2027");
  });
});

describe("saúde indígena pela busca", () => {
  it("responde perguntas inteiras da base", () => {
    expect(resposta("quem atende nas aldeias?")).toContain("EMSI");
    expect(resposta("quantas casai existem?")).toContain("70 CASAIs");
    expect(resposta("qual a diferença entre dsei e terra indígena?")).toContain(
      "Não são a mesma coisa",
    );
  });

  it("deixa pergunta factual sobre a tela fora das definições", () => {
    for (const pergunta of [
      "quantas vagas ociosas o DSEI tem?",
      "quantos editais aparecem aqui?",
    ])
      expect(resposta(pergunta)).toContain("Não encontrei esse número");
  });

  it("responde o distrito pelo nome, não a definição genérica de DSEI", () => {
    for (const pergunta of [
      "Dsei alagoas",
      "Diga mais sobre o DSEI Alagoas",
      "dsei al/se",
    ]) {
      const texto = resposta(pergunta);
      expect(texto).toContain("Maceió");
      expect(texto).toContain("13.480");
    }
    expect(resposta("dsei vale do javari")).toContain("Atalaia do Norte");
  });

  it("mantém a resposta composta quando há duas perguntas juntas", () => {
    const texto = resposta(
      "Quantas aldeias tem no DSEI Alagoas? Diga mais sobre o povo Kariri-Xocó",
    );
    expect(texto).toContain("30 aldeias");
    expect(texto).toContain("Ouricuri");
  });

  it("responde PNASPI, CONDISI, conselho local e as três instâncias", () => {
    expect(resposta("o que é a PNASPI?")).toContain("Portaria 254");
    expect(resposta("o que é CONDISI?")).toContain("paritária");
    expect(resposta("o que é CONDISI?")).toContain("deliberativo");
    expect(resposta("o que é conselho local?")).toContain("consultivo");
    expect(resposta("quais são os conselhos da saúde indígena?")).toContain(
      "FPCONDISI",
    );
  });

  it("responde a lista dos 34 DSEIs", () => {
    const texto = resposta("quais são os 34 DSEIs?");
    for (const nome of ["Yanomami", "Vale do Javari", "Parintins", "Xavante"])
      expect(texto).toContain(nome);
  });
});
