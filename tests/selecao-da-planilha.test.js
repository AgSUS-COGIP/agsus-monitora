import { describe, expect, it } from "vitest";
import {
  chaveDaVaga,
  chaveDoEdital,
  inteiroPtBr,
  linhasDaAbaResultado,
} from "../src/lib/selecao-da-planilha.js";
import { PLANILHAS } from "../src/lib/planilhas.js";

/* O cabeçalho de hoje (A–Y), com as colunas que não entram (D, E, M–O, Q–S, W–Y). */
const CABECALHO = [
  "Vaga",
  "Edital",
  "Nome da Unidade",
  "Nome do arquivo",
  "Resultado",
  "Inscritos",
  "Aptos para analise",
  "Cancelados",
  "Reprovados por não finalizar o questionário",
  "Eliminados por nota",
  "Reprovados na Análise",
  "Triados",
  "Reprovados Segunda Extração",
  "Triados Segunda Extração",
  "OUTROS ELIMINADOS",
  "Total de Eliminados",
  "Validação Total de Inscritos",
  "Validação Total de Aptos",
  "Validação Aptos + Eliminados = Inscritos",
  "Observação",
  "Nome do cargo",
  "Total convocados para entrevista",
  "Total de Aprovados",
  "Total de Contratados",
  "Total de não contratados",
];

const linha = (campos) => {
  const l = Array(CABECALHO.length).fill("");
  for (const [coluna, valor] of Object.entries(campos))
    l[CABECALHO.indexOf(coluna)] = valor;
  return l;
};

describe("números da planilha (pt-BR)", () => {
  it.each([
    ["83", 83],
    ["1.234", 1234],
    ["732,00", 732],
    ["19,6", 20],
    ["-1", -1],
    ["", null],
    ["OK", null],
  ])("%s → %s", (bruto, esperado) => {
    expect(inteiroPtBr(bruto)).toBe(esperado);
  });
});

describe("chave da vaga (a mesma regra do banco)", () => {
  it("edital sem zero à esquerda e sem complemento", () => {
    expect(chaveDoEdital("06/2026")).toBe("6/2026");
    expect(chaveDoEdital("39/2026 (sanitarista)")).toBe("39/2026");
    expect(chaveDoEdital("FGV 2025")).toBe("fgv 2025");
  });

  it("código da vaga, ou o nome do cargo nas outras bancas", () => {
    expect(chaveDaVaga("03/2025", "104123")).toBe("3/2025|104123");
    expect(chaveDaVaga("96/2025", "CARGO 1: MÉDICO")).toBe(
      "96/2025|cargo:cargo 1: medico",
    );
  });
});

describe("aba Resultado -> linhas da carga", () => {
  it("lê só as colunas pedidas, com números inteiros", () => {
    const [vaga] = linhasDaAbaResultado([
      CABECALHO,
      linha({
        Vaga: "104123",
        Edital: "03/2025",
        "Nome da Unidade": "DSEI Alto Rio Solimões",
        "Nome do arquivo": "Vaga_104123_TSB",
        Inscritos: "83",
        "Aptos para analise": "72",
        Cancelados: "2",
        "Reprovados por não finalizar o questionário": "9",
        "Reprovados na Análise": "3",
        Triados: "69",
        "Triados Segunda Extração": "999",
        "Total de Eliminados": "11,00",
        Observação: "1 Interessado",
        "Nome do cargo": "Técnico de Saúde Bucal (TSB)",
        "Total convocados para entrevista": "0",
        "Total de Aprovados": "69",
        "Total de Contratados": "1",
      }),
    ]);
    expect(vaga).toEqual({
      edital: "03/2025",
      vaga: "104123",
      unidade: "DSEI Alto Rio Solimões",
      cargo: "Técnico de Saúde Bucal (TSB)",
      observacao: "1 Interessado",
      inscritos: 83,
      aptos: 72,
      cancelados: 2,
      reprovados_questionario: 9,
      eliminados_nota: null,
      reprovados_analise: 3,
      triados: 69,
      total_eliminados: 11,
      convocados: 0,
      repeticao: 1,
    });
    // W, X e Y (aprovados/contratados) não vêm da planilha.
    expect(Object.keys(vaga)).not.toContain("aprovados");
  });

  it("outras bancas: cargo na coluna A, só inscritos e eliminados", () => {
    const [vaga] = linhasDaAbaResultado([
      CABECALHO,
      [
        "CARGO 1: MÉDICO ‐ UBS MÓVEL URUAÇU/GO",
        "96/2025",
        "Projeto Agora Tem Especialistas Caminhoneiros",
        "",
        "",
        "30",
      ],
    ]);
    expect(vaga).toMatchObject({
      vaga: "CARGO 1: MÉDICO ‐ UBS MÓVEL URUAÇU/GO",
      edital: "96/2025",
      inscritos: 30,
      aptos: null,
      total_eliminados: null,
      convocados: null,
    });
  });

  it("cópia idêntica entra uma vez; mesmo nome com números diferentes entra de novo", () => {
    const copia = linha({
      Vaga: "163604",
      Edital: "30/2026",
      Inscritos: "937",
    });
    const cargo = (inscritos) =>
      linha({
        Vaga: "CARGO 3: TÉCNICO",
        Edital: "96/2025",
        Inscritos: inscritos,
      });
    const linhas = linhasDaAbaResultado([
      CABECALHO,
      copia,
      [...copia],
      cargo("4"),
      cargo("8"),
      cargo("4"),
    ]);
    expect(linhas.map((l) => [l.vaga, l.inscritos, l.repeticao])).toEqual([
      ["163604", 937, 1],
      ["CARGO 3: TÉCNICO", 4, 1],
      ["CARGO 3: TÉCNICO", 8, 2],
    ]);
    expect(linhas.copias).toBe(2);
  });

  it("pula linha sem vaga ou sem edital e aceita linha cortada pela API", () => {
    const linhas = linhasDaAbaResultado([
      CABECALHO,
      ["", "03/2025", "X", "", "", "5"],
      ["104", "", "X", "", "", "5"],
      ["105", "03/2025"],
    ]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      vaga: "105",
      inscritos: null,
      unidade: "",
    });
  });

  it("coluna de nome parecido não é confundida (Triados x Triados Segunda Extração)", () => {
    const sem = CABECALHO.filter((c) => c !== "Triados");
    const [vaga] = linhasDaAbaResultado([
      sem,
      sem.map(
        (c) =>
          ({
            Vaga: "1",
            Edital: "1/2026",
            Inscritos: "3",
            "Triados Segunda Extração": "7",
          })[c] ?? "",
      ),
    ]);
    expect(vaga.triados).toBeNull();
  });

  it("recusa aba sem coluna obrigatória e devolve vazio sem dados", () => {
    expect(() =>
      linhasDaAbaResultado([
        ["Vaga", "Edital"],
        ["1", "1/2026"],
      ]),
    ).toThrow(/inscritos/);
    expect(linhasDaAbaResultado([CABECALHO])).toEqual([]);
    expect(linhasDaAbaResultado(null)).toEqual([]);
  });

  it("a planilha da Auditoria está no catálogo", () => {
    expect(PLANILHAS.auditoriaDaSelecao.idGoogle).toMatch(
      /^[A-Za-z0-9_-]{10,}$/,
    );
    expect(PLANILHAS.auditoriaDaSelecao.aba).toBe("Resultado");
  });
});
