import { describe, expect, it } from "vitest";
import {
  MOTIVOS_DA_REABERTURA,
  textoDaReabertura,
  validarReabertura,
} from "../../src/lib/avaliacao-documental/motivos-da-reabertura.ts";
import {
  erroDoMotivoDaFila,
  motivoPareceTexto,
} from "../../src/lib/avaliacao-documental/qualidade-do-motivo.ts";

/*
  Motivos da reabertura (20261021110000): lista fixa e obrigatória,
  complemento opcional, "Outro" com descrição que pareça texto; e o texto
  mínimo dos motivos livres da fila. Os exemplos aleatórios e os bons são os
  do histórico real (TH_FICHA_ANALISE, 21/10/2026).
*/

const ALEATORIOS = [
  "fhyxjyfhujyu",
  "YUTFDYTSERYHG",
  "dsdfsdfsfsa",
  "DTHGDXGDRXGD",
  "TERERTERTE",
  "6.6.1trtrhytr",
  "dvdddddddddddddd",
  "ioidhgdsoigfsoiuhf",
  "TESTETESTE",
];
const BONS = [
  "Correção da avaliação",
  "Correção do criterio cotas",
  "erro em formação",
  "erro nos cursos",
  "Correção da experiência",
  "erro de digitação",
  "Nova distribuição.",
  "Alteração de pessoa responsável",
  "Remanejamento de análise",
];

describe("texto mínimo do motivo", () => {
  it("as sequências aleatórias do histórico não passam nem com 2 palavras exigidas", () => {
    for (const t of ALEATORIOS) expect(motivoPareceTexto(t, 2), t).toBe(false);
    expect(motivoPareceTexto("TESTE FDFDF", 2)).toBe(false);
    expect(motivoPareceTexto("teste teste teste", 2)).toBe(false);
    // Duas "palavras" com vogais passam nas 2 da fila; nas 3 do Outro, não.
    expect(motivoPareceTexto("ÇGI.OLKJUÇGB", 3)).toBe(false);
  });

  it("os motivos bons passam; siglas curtas contam, sigla sem vogal longa não reprova", () => {
    for (const t of BONS) expect(motivoPareceTexto(t, 2), t).toBe(true);
    expect(motivoPareceTexto("Laudo de PcD sem CID", 3)).toBe(true);
    expect(motivoPareceTexto("Erro na CTPS do candidato", 3)).toBe(true);
  });

  it("motivo da fila: 10 a 2.000 caracteres e 2 palavras", () => {
    expect(erroDoMotivoDaFila("curto")).toBe("De 10 a 2.000 caracteres.");
    expect(erroDoMotivoDaFila("dvdddddddddddddd")).toBe(
      "Escreva o motivo com pelo menos 2 palavras.",
    );
    expect(erroDoMotivoDaFila("Nova distribuição.")).toBe("");
  });
});

describe("motivos da reabertura", () => {
  it("lista fixa, com códigos únicos e Outro por último", () => {
    const codigos = MOTIVOS_DA_REABERTURA.map((m) => m.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    expect(codigos.at(-1)).toBe("OUTRO");
    expect(codigos).toEqual([
      "EXPERIENCIA",
      "CURSOS",
      "FORMACAO",
      "REQUISITO",
      "IDENTIDADE",
      "COTA",
      "ETNICO",
      "DOCUMENTO_NOVO",
      "RECURSO",
      "COORDENACAO",
      "DIGITACAO",
      "OUTRO",
    ]);
    // Cada bloco das regras vigentes cai num motivo só.
    const blocos = MOTIVOS_DA_REABERTURA.flatMap((m) => m.blocos);
    expect(new Set(blocos).size).toBe(blocos.length);
    for (const b of [
      "IDENTIDADE",
      "ESCOLARIDADE",
      "REQUISITO_DO_CARGO",
      "REGISTRO_CONSELHO",
      "COTA_PP",
      "COTA_PI",
      "COTA_PQ",
      "COTA_PCD",
      "FORMACAO",
      "CURSOS",
      "EXPERIENCIA",
    ])
      expect(blocos).toContain(b);
  });

  it("a escolha é obrigatória: vazio ou texto livre (a chamada antiga) não vale", () => {
    for (const codigo of ["", null, "Correção da experiência", "outro"])
      expect(validarReabertura(codigo, "")).toEqual({
        ok: false,
        campo: "motivo",
        erro: "Escolha o motivo da reabertura.",
      });
  });

  it("motivo da lista sem complemento", () => {
    expect(validarReabertura("EXPERIENCIA", "   ")).toEqual({
      ok: true,
      argumentos: { p_motivo: "EXPERIENCIA", p_complemento: null },
      texto: "Correção de experiência",
    });
  });

  it("complemento opcional: limpo no texto; aleatório ou longo demais é recusado", () => {
    expect(validarReabertura("COTA", "  laudo   sem CID ")).toEqual({
      ok: true,
      argumentos: { p_motivo: "COTA", p_complemento: "laudo sem CID" },
      texto: "Correção de cota (PP/PI/PQ/PcD) — laudo sem CID",
    });
    expect(validarReabertura("COTA", "dsdfsdfsfsa")).toMatchObject({
      ok: false,
      campo: "complemento",
    });
    expect(validarReabertura("COTA", "palavra ".repeat(70))).toMatchObject({
      ok: false,
      erro: "Até 500 caracteres.",
    });
  });

  it("Outro exige 15 caracteres e 3 palavras que pareçam texto", () => {
    const erro = {
      ok: false,
      campo: "complemento",
      erro: "Descreva o motivo com pelo menos 15 caracteres e 3 palavras.",
    };
    expect(validarReabertura("OUTRO", "")).toEqual(erro);
    expect(validarReabertura("OUTRO", "erro na nota")).toEqual(erro);
    expect(validarReabertura("OUTRO", "reabertura solicitada")).toEqual(erro);
    expect(
      validarReabertura("OUTRO", "dsdfsdfsfsa TERERTERTE fhyxjyfhujyu"),
    ).toEqual(erro);
    expect(validarReabertura("OUTRO", "Nome da mãe trocado no RG")).toEqual({
      ok: true,
      argumentos: {
        p_motivo: "OUTRO",
        p_complemento: "Nome da mãe trocado no RG",
      },
      texto: "Outro — Nome da mãe trocado no RG",
    });
  });

  it("o texto legível é o que o banco grava", () => {
    expect(textoDaReabertura("DIGITACAO", "")).toBe(
      "Erro de digitação ou lançamento",
    );
    expect(textoDaReabertura("RECURSO", "recurso 12")).toBe(
      "Decisão de recurso — recurso 12",
    );
  });
});
