// Usa streams e arquivos nativos: exercita a leitura real, sem DOM nem rede.
// @vitest-environment node
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  normalizeApprovedHeaders,
  readApprovedWorkbook,
  validateApprovedRows,
} from "../../src/lib/aprovados-import.ts";
import { zipSemCompressao } from "../../src/lib/documento-da-resposta.js";

const cabecalhos = [
  "Código Vaga",
  "Cargo",
  "Classificação Final",
  "Nota",
  "Candidato",
  "Modalidade",
];
const valores = [
  "VG-01",
  "Enfermeiro",
  "1",
  "87,50",
  "Ana & José",
  "Ampla concorrência",
];
const escapar = (v) =>
  String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const linhaXml = (valores, numero) =>
  `<row r="${numero}">${valores.map((v, i) => `<c r="${String.fromCharCode(65 + i)}${numero}" t="inlineStr"><is><t>${escapar(v)}</t></is></c>`).join("")}</row>`;
const folha = (linhas) =>
  `<worksheet><sheetData>${linhas.map((v, i) => linhaXml(v, i + 1)).join("")}</sheetData></worksheet>`;
const esperado = {
  codigo_vaga: "VG-01",
  cargo: "Enfermeiro",
  classificacao: 1,
  nota: 87.5,
  nome: "Ana & José",
  modalidade: "Ampla concorrência",
};
const arquivo = (arquivos) =>
  new File([zipSemCompressao(arquivos)], "aprovados.xlsx");
const planilha = (linhas) =>
  arquivo([{ nome: "xl/worksheets/sheet1.xml", conteudo: folha(linhas) }]);

// Um ZIP de uma entrada com deflate, independente do descompactador do app.
function planilhaComDeflate(xml) {
  const nome = "xl/worksheets/sheet1.xml";
  const original = zipSemCompressao([{ nome, conteudo: xml }]);
  const tamanhoNome = Buffer.byteLength(nome);
  const tamanhoDados = Buffer.byteLength(xml);
  const inicioCentral = 30 + tamanhoNome + tamanhoDados;
  const local = original.slice(0, 30 + tamanhoNome);
  const dados = deflateRawSync(Buffer.from(xml));
  const central = original.slice(
    inicioCentral,
    inicioCentral + 46 + tamanhoNome,
  );
  const fim = original.slice(-22);
  const vLocal = new DataView(local.buffer);
  vLocal.setUint16(8, 8, true);
  vLocal.setUint32(18, dados.length, true);
  const vCentral = new DataView(central.buffer);
  vCentral.setUint16(10, 8, true);
  vCentral.setUint32(20, dados.length, true);
  new DataView(fim.buffer).setUint32(16, local.length + dados.length, true);
  return new File([local, dados, central, fim], "compactada.xlsx");
}

describe("Importação real de XLSX de Aprovados", () => {
  it("normaliza aliases, acentos e espaços dos cabeçalhos", () => {
    expect(normalizeApprovedHeaders(cabecalhos)).toEqual([
      "codigo_vaga",
      "cargo",
      "classificacao",
      "nota",
      "nome",
      "modalidade",
    ]);
    // Um cabeçalho extra não pode resolver uma propriedade herdada do objeto de aliases.
    expect(normalizeApprovedHeaders(["CONSTRUCTOR"])).toEqual(["constructor"]);
  });
  it.each(["sem compressão", "deflate"])(
    "lê ZIP %s, XML e nota com vírgula",
    async (tipo) => {
      const linhas = [cabecalhos, valores];
      const f =
        tipo === "deflate"
          ? planilhaComDeflate(folha(linhas))
          : planilha(linhas);
      expect(await readApprovedWorkbook(f)).toEqual([esperado]);
    },
  );
  it("segue o relacionamento para outra folha e lê strings compartilhadas", async () => {
    const todos = [...cabecalhos, ...valores];
    const xml = `<worksheet><sheetData>${[0, 1].map((n) => `<row>${Array.from({ length: 6 }, (_, i) => `<c r="${String.fromCharCode(65 + i)}${n + 1}" t="s"><v>${n * 6 + i}</v></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
    const f = arquivo([
      {
        nome: "xl/workbook.xml",
        conteudo: '<workbook><sheets><sheet r:id="rId9"/></sheets></workbook>',
      },
      {
        nome: "xl/_rels/workbook.xml.rels",
        conteudo:
          '<Relationships><Relationship Id="rId9" Target="worksheets/sheet9.xml"/></Relationships>',
      },
      {
        nome: "xl/sharedStrings.xml",
        conteudo: `<sst>${todos.map((v) => `<si><t>${escapar(v)}</t></si>`).join("")}</sst>`,
      },
      { nome: "xl/worksheets/sheet9.xml", conteudo: xml },
    ]);
    expect(await readApprovedWorkbook(f)).toEqual([esperado]);
  });
  it("ignora linha vazia e aceita nota zero sem perder a ordem das pessoas", async () => {
    const segunda = [...valores];
    segunda[3] = "0";
    segunda[4] = "Bia";
    segunda[2] = "2";
    expect(
      await readApprovedWorkbook(planilha([cabecalhos, valores, [], segunda])),
    ).toEqual([
      esperado,
      { ...esperado, classificacao: 2, nota: 0, nome: "Bia" },
    ]);
  });
  it("não entrega lista parcial quando uma linha é inválida", async () => {
    const invalida = [...valores];
    invalida[2] = "0";
    invalida[3] = "-1";
    await expect(
      readApprovedWorkbook(planilha([cabecalhos, valores, invalida])),
    ).rejects.toThrow(/Linha 3:.*classificacao.*nota/);
  });
  it("recusa colunas ausentes e arquivo sem candidatos", async () => {
    await expect(
      readApprovedWorkbook(planilha([cabecalhos.slice(0, -1), valores])),
    ).rejects.toThrow(/Colunas obrigatórias ausentes: modalidade/);
    await expect(readApprovedWorkbook(planilha([cabecalhos]))).rejects.toThrow(
      /Nenhum candidato válido/,
    );
  });
  it("mantém o número da linha e limita a prévia de erros", async () => {
    const invalida = [...valores];
    invalida[3] = "inválida";
    await expect(
      readApprovedWorkbook(
        planilha([cabecalhos, ...Array.from({ length: 14 }, () => invalida)]),
      ),
    ).rejects.toThrow(/Linha 13:.*\n\.\.\. e mais 2 erro\(s\)\./);
    const r = validateApprovedRows([{}, { ...esperado, classificacao: 0 }]);
    expect(r.errors[0]).toMatch(/^Linha 3:/);
  });
  it("recusa extensão errada e ZIP inválido", async () => {
    await expect(
      readApprovedWorkbook(new File(["x"], "lista.csv")),
    ).rejects.toThrow(/formato .xlsx/);
    await expect(
      readApprovedWorkbook(new File(["zip inválido"], "lista.xlsx")),
    ).rejects.toThrow(/ZIP inválido/);
  });
});
