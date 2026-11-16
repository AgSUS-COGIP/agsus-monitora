import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  ABA,
  abasDoXlsx,
  dataDaCelula,
  juntarVinculos,
  vinculosDaAba,
} from "../scripts/carregar-admissoes-conciliadas.mjs";

/*
  A CARGA DAS ADMISSÕES CONCILIADAS (13/11/2026)

  O script lê a aba "Vínculos conciliados" das planilhas de conciliação com o
  RH (.xlsx) sem dependência nova e manda ao banco um vínculo por linha: token,
  edital, linha da lista de aprovados e as datas. Dados fictícios.
*/

/* Um .xlsx mínimo: zip com os arquivos dados (comprimidos com deflate). */
function xlsx(arquivos: Record<string, string>): Buffer {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let posicao = 0;
  for (const [nome, texto] of Object.entries(arquivos)) {
    const nomeBuf = Buffer.from(nome, "utf8");
    const dados = deflateRawSync(Buffer.from(texto, "utf8"));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt16LE(nomeBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(dados.length, 20);
    central.writeUInt16LE(nomeBuf.length, 28);
    central.writeUInt32LE(posicao, 42);
    locais.push(local, nomeBuf, dados);
    centrais.push(central, nomeBuf);
    posicao += 30 + nomeBuf.length + dados.length;
  }
  const diretorio = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(Object.keys(arquivos).length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(posicao, 16);
  return Buffer.concat([...locais, diretorio, fim]);
}

const EDITAL = "11111111-2222-4333-8444-555555555555";
const LINHA = "66666666-7777-4888-9999-aaaaaaaaaaaa";

const planilha = xlsx({
  "xl/workbook.xml":
    '<workbook xmlns:r="r"><sheets><sheet name="Resumo" sheetId="1" r:id="rId1"/>' +
    `<sheet name="${ABA}" sheetId="2" r:id="rId2"/></sheets></workbook>`,
  "xl/_rels/workbook.xml.rels":
    '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
  "xl/sharedStrings.xml":
    "<sst><si><t>Token de vínculo</t></si><si><t>Edital</t></si>" +
    "<si><t>Data de admissão</t></si><si><t>Data de desligamento</t></si>" +
    "<si><t>Processo ID</t></si><si><t>Linha origem ID</t></si>" +
    "<si><r><t>Trilha &amp; </t></r><r><t>vínculos</t></r></si></sst>",
  "xl/worksheets/sheet1.xml": "<worksheet><sheetData/></worksheet>",
  "xl/worksheets/sheet2.xml":
    '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>6</v></c></row>' +
    '<row r="3"><c r="A3" t="s"><v>0</v></c><c r="B3" t="s"><v>1</v></c>' +
    '<c r="D3" t="s"><v>2</v></c><c r="F3" t="s"><v>3</v></c>' +
    '<c r="G3" t="s"><v>4</v></c><c r="H3" t="s"><v>5</v></c></row>' +
    `<row r="4"><c r="A4" t="inlineStr"><is><t>AB12cd34ef56</t></is></c><c r="B4" t="inlineStr"><is><t>01/2025</t></is></c>` +
    `<c r="D4" t="inlineStr"><is><t>2025-05-12</t></is></c><c r="F4"/>` +
    `<c r="G4" t="inlineStr"><is><t>${EDITAL}</t></is></c><c r="H4" t="inlineStr"><is><t>${LINHA}</t></is></c></row>` +
    `<row r="5"><c r="A5" t="inlineStr"><is><t>0011223344</t></is></c><c r="D5"><v>45658</v></c>` +
    `<c r="F5" t="inlineStr"><is><t>31/03/2025</t></is></c><c r="G5" t="inlineStr"><is><t>${EDITAL}</t></is></c></row>` +
    `<row r="6"><c r="A6" t="inlineStr"><is><t>99887766</t></is></c><c r="D6" t="inlineStr"><is><t>sem data</t></is></c>` +
    `<c r="G6" t="inlineStr"><is><t>${EDITAL}</t></is></c></row>` +
    "</sheetData></worksheet>",
});

describe("leitura do .xlsx", () => {
  it("acha as abas pelo nome, com texto compartilhado e embutido", () => {
    const abas = abasDoXlsx(planilha);
    expect([...abas.keys()]).toEqual(["Resumo", ABA]);
    expect(abas.get(ABA)?.[0]).toEqual({ A: "Trilha & vínculos" });
  });

  it("data em texto, em DD/MM/AAAA e no número de série do Excel", () => {
    expect(dataDaCelula("2026-09-15")).toBe("2026-09-15");
    expect(dataDaCelula("31/03/2025")).toBe("2025-03-31");
    expect(dataDaCelula("45658")).toBe("2025-01-01");
    expect(dataDaCelula("")).toBe("");
    expect(dataDaCelula("sem data")).toBe("");
  });
});

describe("vínculos da aba", () => {
  const { vinculos, ignoradas } = vinculosDaAba(
    abasDoXlsx(planilha).get(ABA) || [],
  );

  it("um vínculo por linha, com o cabeçalho achado pelo nome", () => {
    expect(vinculos).toEqual([
      {
        vinculo: "ab12cd34ef56",
        edital: EDITAL,
        linha: LINHA,
        admissao: "2025-05-12",
        desligamento: null,
      },
      {
        vinculo: "0011223344",
        edital: EDITAL,
        linha: null,
        admissao: "2025-01-01",
        desligamento: "2025-03-31",
      },
    ]);
    expect(ignoradas).toBe(1);
  });

  it("sem a coluna do token, recusa", () => {
    expect(() => vinculosDaAba([{ A: "Outra coisa" }])).toThrow(
      "Token de vínculo",
    );
  });

  it("junta as planilhas; o mesmo token com dados diferentes é erro", () => {
    expect(juntarVinculos([vinculos, [vinculos[0]]])).toHaveLength(2);
    expect(() =>
      juntarVinculos([vinculos, [{ ...vinculos[0], admissao: "2025-06-01" }]]),
    ).toThrow("dados diferentes");
  });
});
