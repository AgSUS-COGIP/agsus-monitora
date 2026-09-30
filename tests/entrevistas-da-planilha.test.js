import { describe, expect, it } from "vitest";
import {
  emLotes,
  identificadorDaCarga,
  linhasDaAbaEntrevistados,
  normalizarCabecalho,
} from "../src/lib/entrevistas-da-planilha.js";
import { PLANILHAS } from "../src/lib/planilhas.js";

const CABECALHO = [
  "DSEI",
  "Edital",
  "Link planilha entrevista",
  "Vaga",
  "Nome",
  "Modalidade de concorrência",
  "Cargo",
  "Código",
  "Nota total (0 a 20)",
  "Parecer",
  "Comparecimento",
  "Critério 1",
  "Nota 1",
  "Critério 2",
  "Nota 2",
];

describe("aba Entrevistados -> linhas da carga", () => {
  it("normaliza cabeçalho sem acento, caixa e pontuação", () => {
    expect(normalizarCabecalho(" Modalidade de concorrência ")).toBe(
      "MODALIDADE DE CONCORRENCIA",
    );
    expect(normalizarCabecalho("Nota total (0 a 20)")).toBe(
      "NOTA TOTAL 0 A 20",
    );
    expect(normalizarCabecalho(null)).toBe("");
  });

  it("lê a linha no formato de sincronizar_entrevistas", () => {
    const linhas = linhasDaAbaEntrevistados([
      CABECALHO,
      [
        " DSEI Yanomami ",
        "39/2026 (sanitarista)",
        "https://exemplo/planilha",
        "Vaga 1234",
        "Maria  da Silva",
        "Ampla concorrência",
        "Enfermeiro",
        "cod-0987",
        "17,5",
        "Apto",
        "Sim",
        "Comunicação",
        "8,5",
        "Trabalho em equipe",
        "9",
      ],
    ]);
    expect(linhas).toEqual([
      {
        unidade: "DSEI Yanomami",
        edital: "39/2026 (sanitarista)",
        vaga: "1234",
        candidato: "Maria da Silva",
        codigo: "0987",
        modalidade: "Ampla concorrência",
        cargo: "Enfermeiro",
        nota: "17,5",
        parecer: "Apto",
        compareceu: "Sim",
        link: "https://exemplo/planilha",
        notas: [
          { criterio: "Comunicação", nota: "8,5" },
          { criterio: "Trabalho em equipe", nota: "9" },
        ],
      },
    ]);
  });

  it("aceita linha cortada pela API (células vazias do fim) e tira critério vazio", () => {
    const [linha] = linhasDaAbaEntrevistados([
      CABECALHO,
      [
        "DSEI X",
        "1/2026",
        "",
        "55",
        "João",
        "",
        "",
        "",
        "",
        "",
        "",
        "Critério A",
        "7",
      ],
    ]);
    expect(linha.parecer).toBe("");
    expect(linha.compareceu).toBe("");
    expect(linha.notas).toEqual([{ criterio: "Critério A", nota: "7" }]);
  });

  it("pula linha sem candidato, vaga ou edital", () => {
    const linhas = linhasDaAbaEntrevistados([
      CABECALHO,
      ["DSEI X", "1/2026", "", "55", ""],
      ["DSEI X", "1/2026", "", "sem número", "Ana"],
      ["DSEI X", "", "", "55", "Ana"],
      ["DSEI X", "1/2026", "", "55", "Ana"],
    ]);
    expect(linhas.map((l) => l.candidato)).toEqual(["Ana"]);
  });

  it("para os critérios no primeiro par que falta", () => {
    const [linha] = linhasDaAbaEntrevistados([
      [
        "DSEI",
        "EDITAL",
        "VAGA",
        "NOME",
        "CRITÉRIO 1",
        "NOTA 1",
        "CRITÉRIO 3",
        "NOTA 3",
      ],
      ["D", "1/2026", "9", "Ana", "C1", "5", "C3", "6"],
    ]);
    expect(linha.notas).toEqual([{ criterio: "C1", nota: "5" }]);
    expect(linha.codigo).toBe("");
  });

  it("recusa aba sem coluna obrigatória e devolve vazio sem dados", () => {
    expect(() =>
      linhasDaAbaEntrevistados([
        ["DSEI", "EDITAL", "NOME"],
        ["D", "1/2026", "Ana"],
      ]),
    ).toThrow(/vaga/);
    expect(linhasDaAbaEntrevistados([CABECALHO])).toEqual([]);
    expect(linhasDaAbaEntrevistados(undefined)).toEqual([]);
  });
});

describe("carga", () => {
  it("divide em lotes dentro do limite da RPC", () => {
    const lotes = emLotes(
      Array.from({ length: 1201 }, (_, i) => i),
      500,
    );
    expect(lotes.map((l) => l.length)).toEqual([500, 500, 201]);
  });

  it("gera identificador aceito pelo banco, no horário de Brasília", () => {
    const id = identificadorDaCarga(
      new Date("2026-09-30T12:00:05Z"),
      "a1b2-c3d4-e5f6",
    );
    expect(id).toBe("gh-20260930-090005-a1b2c3d4");
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,80}$/);
  });

  it("a planilha de entrevistados está no catálogo", () => {
    expect(PLANILHAS.entrevistados.idGoogle).toMatch(/^[A-Za-z0-9_-]{10,}$/);
    expect(PLANILHAS.entrevistados.aba).toBe("Entrevistados");
    expect(PLANILHAS.entrevistados.area).toBe("saude-indigena");
  });
});
