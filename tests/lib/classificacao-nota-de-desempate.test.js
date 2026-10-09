import { describe, expect, it } from "vitest";
import {
  documentoOficial,
  houveDesempate,
  htmlParaSei,
  NOTA_DE_DESEMPATE_PADRAO,
  notaDeDesempatePadrao,
  textoParaSei,
} from "../../src/lib/classificacao/documento-sei.js";
import { corpoXml } from "../../src/lib/classificacao/documento-docx.js";
import { documentoDaRegra } from "../../src/lib/classificacao/regra.js";

/*
  A nota de desempate abaixo da tabela da vaga: só na vaga em que dois com a
  mesma nota ficaram em posições diferentes (empate resolvido por critério ou
  pelo empate final), na prévia, no HTML do SEI, no texto e no DOCX.
*/

const linha = (posicao, nome, nota) => ({
  posicao,
  analise_id: nome,
  nome,
  nota,
  modalidades: ["AC"],
  situacao: "VAGA",
});

const retrato = (tipo, { rodape = "", vagas } = {}) => ({
  schema: 1,
  tipo,
  edital: { id: "e1", edital: "Edital 50/2026", unidade: "DSEI Xingu" },
  casas: 2,
  rodape,
  modalidades: [],
  vagas: vagas || [
    {
      codigo: "101",
      cabecalho: "VAGA 101 - Enfermeiro",
      // 40 e 40 em 1º e 2º: o empate foi resolvido pelos critérios.
      geral: [linha(1, "Ana", 40), linha(2, "Bia", 40), linha(3, "Caio", 30)],
      listas: {},
      eliminados: [],
    },
    {
      codigo: "102",
      cabecalho: "VAGA 102 - Técnico",
      geral: [linha(1, "Duda", 41), linha(2, "Edu", 39)],
      listas: {},
      eliminados: [],
    },
  ],
});

describe("houveDesempate", () => {
  it("mesma nota em posições diferentes; empate na mesma posição não conta", () => {
    expect(houveDesempate([linha(1, "A", 40), linha(2, "B", 40)])).toBe(true);
    expect(houveDesempate([linha(1, "A", 40), linha(1, "B", 40)])).toBe(false);
    expect(houveDesempate([linha(1, "A", 41), linha(2, "B", 40)])).toBe(false);
    // Na escala das casas publicadas (como o motor agrupa).
    expect(
      houveDesempate([linha(1, "A", 7.501), linha(2, "B", 7.499)], 2),
    ).toBe(true);
    expect(houveDesempate([])).toBe(false);
  });
});

describe("nota de desempate abaixo da tabela da vaga", () => {
  it("vaga com empate resolvido leva a nota; vaga sem empate, não", () => {
    const doc = documentoOficial(retrato("FINAL"), { lista: "geral" });
    expect(doc.blocos[0].notaDeDesempate).toBe(NOTA_DE_DESEMPATE_PADRAO);
    expect(doc.blocos[1].notaDeDesempate).toBe("");
    expect(NOTA_DE_DESEMPATE_PADRAO).toBe(
      "*Os critérios de desempate foram considerados conforme item 10 do referido edital.",
    );

    const html = htmlParaSei(doc);
    expect(html.match(/critérios de desempate/g)).toHaveLength(1);
    // Logo abaixo da tabela da vaga 101, antes do cabeçalho da 102, em itálico e menor.
    const nota = html.indexOf(
      '<p class="Texto_Alinhado_Esquerda"><span style="font-size:10pt"><em>*Os critérios de desempate',
    );
    expect(nota).toBeGreaterThan(html.indexOf("VAGA 101"));
    expect(nota).toBeGreaterThan(html.indexOf("Bia"));
    expect(nota).toBeLessThan(html.indexOf("VAGA 102"));

    const texto = textoParaSei(doc).split("\n");
    const i = texto.indexOf(NOTA_DE_DESEMPATE_PADRAO);
    expect(texto[i - 1]).toContain("Caio");
  });

  it("vale na avaliação documental (preliminar) e na entrevista com critérios", () => {
    for (const tipo of ["PRELIMINAR", "ENTREVISTA"]) {
      const doc = documentoOficial(retrato(tipo), { lista: "geral" });
      expect(doc.blocos.map((b) => Boolean(b.notaDeDesempate))).toEqual([
        true,
        false,
      ]);
    }
  });

  it("empate na mesma posição (entrevista sem critérios) não leva a nota", () => {
    const doc = documentoOficial(
      retrato("ENTREVISTA", {
        vagas: [
          {
            codigo: "101",
            cabecalho: "VAGA 101",
            geral: [linha(1, "Ana", 12), linha(1, "Bia", 12)],
            listas: {},
            eliminados: [],
          },
        ],
      }),
      { lista: "geral" },
    );
    expect(doc.blocos[0].notaDeDesempate).toBe("");
    expect(htmlParaSei(doc)).not.toContain("critérios de desempate");
  });

  it("os eliminados e a convocação não levam a nota", () => {
    expect(
      documentoOficial(retrato("FINAL"), { lista: "eliminados" }).blocos.some(
        (b) => b.notaDeDesempate,
      ),
    ).toBe(false);
    expect(
      documentoOficial(retrato("CONVOCACAO"), { lista: "todas" }).blocos.some(
        (b) => b.notaDeDesempate,
      ),
    ).toBe(false);
  });

  it("o texto personalizado do edital aparece no lugar do padrão", () => {
    const regra = {
      documento: {
        desempate: "*Desempate conforme o item 9.4 do Edital nº {edital}.",
      },
    };
    expect(documentoDaRegra(regra).desempate).toBe(
      "*Desempate conforme o item 9.4 do Edital nº {edital}.",
    );
    const doc = documentoOficial(retrato("FINAL"), { lista: "geral", regra });
    expect(doc.blocos[0].notaDeDesempate).toBe(
      "*Desempate conforme o item 9.4 do Edital nº 50/2026.",
    );
    expect(htmlParaSei(doc)).toContain(
      "<em>*Desempate conforme o item 9.4 do Edital nº 50/2026.</em>",
    );
    expect(htmlParaSei(doc)).not.toContain("item 10 do referido edital");
  });

  it("o rodapé da regra com a frase do desempate é o padrão e não se repete no fim", () => {
    const rodape =
      "Os critérios de desempate foram considerados conforme item 10.4 do edital.";
    expect(notaDeDesempatePadrao(rodape)).toBe(`*${rodape}`);
    expect(notaDeDesempatePadrao("Outro texto qualquer.")).toBe(
      NOTA_DE_DESEMPATE_PADRAO,
    );
    const doc = documentoOficial(retrato("FINAL", { rodape }), {
      lista: "geral",
      regra: { rodape },
    });
    expect(doc.blocos[0].notaDeDesempate).toBe(`*${rodape}`);
    expect(doc.finais.map((i) => i.texto)).not.toContain(rodape);

    // Sem nenhuma vaga com empate, o rodapé segue no fim do resultado final.
    const semEmpate = documentoOficial(
      retrato("FINAL", {
        rodape,
        vagas: [retrato("FINAL").vagas[1]],
      }),
      { lista: "geral", regra: { rodape } },
    );
    expect(semEmpate.finais.map((i) => i.texto)).toContain(rodape);
  });

  it("o DOCX inclui a nota em itálico abaixo da tabela da vaga com empate", () => {
    const doc = documentoOficial(retrato("FINAL"), { lista: "geral" });
    const xml = corpoXml(doc);
    expect(xml.match(/critérios de desempate/g)).toHaveLength(1);
    const nota = xml.indexOf("*Os critérios de desempate");
    expect(xml.lastIndexOf("<w:i/>", nota)).toBeGreaterThan(
      xml.lastIndexOf("</w:tbl>", nota),
    );
    expect(nota).toBeGreaterThan(xml.indexOf("Caio"));
    expect(nota).toBeLessThan(xml.indexOf("VAGA 102"));
    const lido = new DOMParser().parseFromString(xml, "application/xml");
    expect(lido.querySelector("parsererror")).toBeNull();
  });
});
