import { describe, expect, it } from "vitest";
import {
  gerarXlsxDaLista,
  linhasDaPlanilha,
} from "../../src/lib/classificacao/exportacao.ts";
import { documentoOficial } from "../../src/lib/classificacao/documento-sei.ts";
import { tabelaXml } from "../../src/lib/classificacao/documento-docx.ts";
import { colunasDisponiveis } from "../../src/lib/classificacao/colunas-do-documento.ts";

const retrato = () => ({
  tipo: "PRELIMINAR",
  edital: { edital: "83/2026", unidade: "DSEI Xingu" },
  modalidades: [],
  vagas: [
    {
      codigo: "123",
      cargo: "Analista",
      geral: [{ nome: "Ana", nota: 12.5, posicao: 1 }],
      listas: {},
      eliminados: [],
    },
  ],
});
describe("entrada dos documentos da Classificação", () => {
  it("uma linha inválida impede exportar uma planilha parcial", () => {
    const r = retrato();
    r.vagas[0].geral.push(null);
    expect(() => gerarXlsxDaLista(r)).toThrow(/Dados do documento inválidos/);
  });
  it("valida também as modalidades fora do recorte escolhido", () => {
    const r = retrato();
    r.vagas[0].listas.PCD = {};
    expect(() => documentoOficial(r, { lista: "geral" })).toThrow(
      /Dados do documento inválidos/,
    );
  });
  it.each(["12,5", Number.NaN, Number.POSITIVE_INFINITY])(
    "recusa nota não normalizada: %s",
    (nota) => {
      const r = retrato();
      r.vagas[0].geral[0].nota = nota;
      expect(() => linhasDaPlanilha(r)).toThrow(
        /Nota ou posição do documento inválida/,
      );
    },
  );
  it("não transforma a ausência do quadro em uma publicação vazia", () => {
    expect(() => documentoOficial({ tipo: "FINAL" })).toThrow(
      /Quadro de vagas/,
    );
    expect(() => gerarXlsxDaLista({ tipo: "FINAL" })).toThrow(
      /Quadro de vagas/,
    );
    expect(() => documentoOficial({ tipo: "CONVOCACAO", vagas: [{}] })).toThrow(
      /Convocados/,
    );
  });
  it("preserva a diferença entre nota ausente e nota nula nos eliminados", () => {
    const r = retrato();
    r.vagas[0].eliminados = [{ nome: "Ana", motivo: "SEM_NOTA_DOCUMENTAL" }];
    expect(colunasDisponiveis(r, "eliminados").map((c) => c.id)).toEqual([
      "NOME",
      "JUSTIFICATIVA",
    ]);
    r.vagas[0].eliminados[0].nota = null;
    expect(colunasDisponiveis(r, "eliminados").map((c) => c.id)).toEqual([
      "NOME",
      "NOTA",
      "JUSTIFICATIVA",
    ]);
  });
  it("recusa uma agenda com horários malformados", () => {
    expect(() =>
      documentoOficial(retrato(), {
        agenda: new Map([["a1", { data: 123, inicio: "08:30" }]]),
      }),
    ).toThrow(/Horário da agenda/);
  });
  it("recusa uma tabela com mais células do que colunas", () => {
    expect(() =>
      tabelaXml({
        colunas: [{ rotulo: "Nome", largura: 100, alinhamento: "esquerda" }],
        linhas: [["Ana", "extra"]],
        vazia: "",
      }),
    ).toThrow(/Tabela do documento inconsistente/);
  });
});
