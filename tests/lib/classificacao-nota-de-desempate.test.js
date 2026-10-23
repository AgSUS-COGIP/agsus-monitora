import { describe, expect, it } from "vitest";
import {
  documentoOficial,
  houveDesempate,
  htmlParaSei,
  NOTA_DE_DESEMPATE_PADRAO,
  notaDeDesempatePadrao,
  textoParaSei,
} from "../../src/lib/classificacao/documento-sei.ts";
import { corpoXml } from "../../src/lib/classificacao/documento-docx.ts";
import { documentoDaRegra } from "../../src/lib/classificacao/regra.ts";

/*
  A nota de desempate logo abaixo de cada tabela (a geral ou a de uma cota)
  em que dois com a mesma nota ficaram em posições diferentes (empate
  resolvido por critério ou pelo empate final), na prévia, no HTML do SEI, no
  texto e no DOCX. Tabela sem empate: sem nota. Regra sem rodapé: sem nota.
*/

const RODAPE =
  "Os critérios de desempate foram considerados conforme item 10.1 do edital.";
const NOTA = `*${RODAPE}`;

const linha = (posicao, nome, nota, modalidades = ["AC"]) => ({
  posicao,
  analise_id: nome,
  nome,
  nota,
  modalidades,
  situacao: "VAGA",
});

const retrato = (tipo, { rodape = RODAPE, vagas, modalidades = [] } = {}) => ({
  schema: 1,
  tipo,
  edital: { id: "e1", edital: "Edital 50/2026", unidade: "DSEI Xingu" },
  casas: 2,
  rodape,
  modalidades,
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

/* Vaga com a geral e duas cotas: empate na geral e na PcD; PN sem empate. */
const comCotas = (rodape = RODAPE) =>
  retrato("PRELIMINAR", {
    rodape,
    modalidades: [
      { codigo: "PCD", nome: "Pessoas com Deficiência" },
      { codigo: "PN", nome: "Pretos e Pardos" },
    ],
    vagas: [
      {
        codigo: "201",
        cabecalho: "VAGA 201 - Médico",
        geral: [
          linha(1, "Ana", 40, ["AC", "PCD"]),
          linha(2, "Bia", 40, ["AC", "PCD"]),
          linha(3, "Caio", 30, ["AC", "PN"]),
          linha(4, "Davi", 20, ["AC", "PN"]),
        ],
        listas: {
          PCD: [
            linha(1, "Ana", 40, ["AC", "PCD"]),
            linha(2, "Bia", 40, ["AC", "PCD"]),
          ],
          PN: [
            linha(1, "Caio", 30, ["AC", "PN"]),
            linha(2, "Davi", 20, ["AC", "PN"]),
          ],
        },
        eliminados: [],
      },
    ],
  });

const notas = (doc) =>
  doc.blocos.map((b) => b.tabelas.map((t) => t.notaDeDesempate || ""));

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

describe("nota de desempate abaixo da tabela com empate", () => {
  it("tabela com empate resolvido leva a nota; tabela sem empate, não", () => {
    const doc = documentoOficial(retrato("FINAL"), { lista: "geral" });
    expect(notas(doc)).toEqual([[NOTA], [""]]);
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
    expect(html.lastIndexOf("</table>", nota)).toBeGreaterThan(
      html.indexOf("Caio"),
    );
    expect(nota).toBeLessThan(html.indexOf("VAGA 102"));
    // Sem asterisco nas linhas dos desempatados.
    expect(html).not.toMatch(/\*(Ana|Bia)|(Ana|Bia)\*|1º\*|2º\*/);

    const texto = textoParaSei(doc).split("\n");
    const i = texto.indexOf(NOTA);
    expect(texto[i - 1]).toContain("Caio");
  });

  it("cota com empate: a nota logo abaixo da geral e da cota com empate; a cota sem empate fica sem", () => {
    const doc = documentoOficial(comCotas(), { lista: "todas" });
    expect(notas(doc)).toEqual([[NOTA, NOTA, ""]]);
    const html = htmlParaSei(doc);
    expect(html.match(/critérios de desempate/g)).toHaveLength(2);
    const tabelas = [...html.matchAll(/<\/table>/g)].map((m) => m.index);
    const nas = [...html.matchAll(/<em>\*Os critérios/g)].map((m) => m.index);
    // A 1ª nota entre a tabela geral e a PcD; a 2ª entre a PcD e a PN.
    expect(nas[0]).toBeGreaterThan(tabelas[0]);
    expect(nas[0]).toBeLessThan(html.indexOf("Pessoas com Deficiência"));
    expect(nas[1]).toBeGreaterThan(tabelas[1]);
    expect(nas[1]).toBeLessThan(html.indexOf("Pretos e Pardos"));

    // Só a lista da cota: a nota abaixo dela.
    expect(notas(documentoOficial(comCotas(), { lista: "PCD" }))).toEqual([
      [NOTA],
    ]);
    expect(notas(documentoOficial(comCotas(), { lista: "PN" }))).toEqual([
      [""],
    ]);
  });

  it("regra sem rodapé (e sem texto do edital): nenhuma nota", () => {
    expect(notaDeDesempatePadrao("")).toBe("");
    const doc = documentoOficial(comCotas(""), { lista: "todas" });
    expect(notas(doc)).toEqual([["", "", ""]]);
    expect(htmlParaSei(doc)).not.toContain("critérios de desempate");
    expect(textoParaSei(doc)).not.toContain("critérios de desempate");
    expect(corpoXml(doc)).not.toContain("critérios de desempate");
  });

  it("vale na avaliação documental (preliminar) e na entrevista com critérios", () => {
    for (const tipo of ["PRELIMINAR", "ENTREVISTA"]) {
      const doc = documentoOficial(retrato(tipo), { lista: "geral" });
      expect(notas(doc)).toEqual([[NOTA], [""]]);
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
    expect(notas(doc)).toEqual([[""]]);
    expect(htmlParaSei(doc)).not.toContain("critérios de desempate");
  });

  it("os eliminados e a convocação não levam a nota", () => {
    expect(
      notas(documentoOficial(retrato("FINAL"), { lista: "eliminados" })).flat(),
    ).not.toContain(NOTA);
    expect(
      notas(documentoOficial(retrato("CONVOCACAO"), { lista: "todas" })).flat(),
    ).not.toContain(NOTA);
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
    expect(notas(doc)[0][0]).toBe(
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
    expect(notas(doc)[0][0]).toBe(`*${rodape}`);
    expect(doc.finais.map((i) => i.texto)).not.toContain(rodape);

    // Sem nenhuma tabela com empate, o rodapé segue no fim do resultado final.
    const semEmpate = documentoOficial(
      retrato("FINAL", {
        rodape,
        vagas: [retrato("FINAL").vagas[1]],
      }),
      { lista: "geral", regra: { rodape } },
    );
    expect(semEmpate.finais.map((i) => i.texto)).toContain(rodape);
  });

  it("o DOCX inclui a nota em itálico logo abaixo de cada tabela com empate", () => {
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

    const cotas = corpoXml(documentoOficial(comCotas(), { lista: "todas" }));
    const nas = [...cotas.matchAll(/\*Os critérios de desempate/g)].map(
      (m) => m.index,
    );
    expect(nas).toHaveLength(2);
    expect(nas[0]).toBeLessThan(cotas.indexOf("Pessoas com Deficiência"));
    expect(nas[1]).toBeGreaterThan(cotas.indexOf("Pessoas com Deficiência"));
    expect(nas[1]).toBeLessThan(cotas.indexOf("Pretos e Pardos"));
  });
});
