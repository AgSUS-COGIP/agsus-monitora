import { describe, expect, it } from "vitest";
import {
  modeloDeReferencia,
  normalizarModelo,
} from "../src/lib/modelo-de-convocacao.ts";
import {
  derivarQuadro,
  montarConvocacaoDaVaga,
  sequenciaDeConvocacao,
} from "../src/lib/lista-convocacao-rules.ts";

/*
  Regra 2 do cabeçalho de lista-convocacao-rules.ts: ser chamado pela ampla
  não gasta a vaga da cota. A auditoria de 10/11/2026 achou o contrário quando
  a posição de reserva vem antes de uma de ampla na sequência: o cotista mais
  bem classificado ocupava a reserva, mesmo estando dentro das vagas da ampla,
  e a Convocação chamava uma pessoa diferente da que a Classificação publica.
*/
const MGI = normalizarModelo(modeloDeReferencia("mgi-simulador"));

const candidato = (nome: string, nota: number, modalidade: string) => ({
  candidato_id: nome,
  nome,
  nota,
  modalidade,
});

const CANDIDATOS = [
  candidato("B", 95, "Ampla concorrência"),
  candidato("A", 90, "Pretos e pardos"),
  candidato("C", 80, "Ampla concorrência"),
  candidato("E", 70, "Ampla concorrência"),
  candidato("D", 60, "Pretos e pardos"),
];

describe("convocação: a ampla antes da cota nas vagas imediatas", () => {
  const quadro = derivarQuadro(4, MGI);
  const resultado = montarConvocacaoDaVaga({
    candidatos: CANDIDATOS,
    quadro,
    modelo: MGI,
  });
  const imediatas = resultado.linhas.filter((l) => l.imediata);

  it("o caso parte da sequência AC, PP, AC, AC", () => {
    const sequencia = sequenciaDeConvocacao(quadro, MGI);
    expect(sequencia).toHaveLength(4);
    expect(sequencia[1]).not.toBe(sequencia[0]);
    expect([sequencia[0], sequencia[2], sequencia[3]]).toEqual([
      sequencia[0],
      sequencia[0],
      sequencia[0],
    ]);
  });

  it("a cotista dentro das vagas da ampla não gasta a vaga da cota", () => {
    expect(imediatas.map((l) => l.candidato.nome).sort()).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
    // E fica no cadastro de reserva.
    expect(
      resultado.linhas.find((l) => l.candidato.nome === "E")?.imediata,
    ).toBe(false);
  });

  it("a ordem de chamada segue a sequência: a ampla na ordem da classificação, a cota com D", () => {
    const sequencia = sequenciaDeConvocacao(quadro, MGI);
    expect(
      imediatas.map((l) => [l.posicao, l.candidato.nome, l.categoria]),
    ).toEqual([
      [1, "B", sequencia[0]],
      [2, "D", sequencia[1]],
      [3, "A", sequencia[2]],
      [4, "C", sequencia[3]],
    ]);
  });
});

describe("convocação: os outros casos do bloco imediato", () => {
  const quadro = derivarQuadro(4, MGI);
  const sequencia = sequenciaDeConvocacao(quadro, MGI);
  const ordem = (candidatos: ReturnType<typeof candidato>[]) =>
    montarConvocacaoDaVaga({ candidatos, quadro, modelo: MGI })
      .linhas.filter((l) => l.imediata)
      .map((l) => [l.candidato.nome, l.categoria]);

  it("cotista fora das vagas da ampla ocupa a reserva, como antes", () => {
    expect(
      ordem([
        candidato("B", 95, "Ampla concorrência"),
        candidato("C", 90, "Ampla concorrência"),
        candidato("E", 85, "Ampla concorrência"),
        candidato("A", 80, "Pretos e pardos"),
        candidato("D", 60, "Pretos e pardos"),
      ]),
    ).toEqual([
      ["B", sequencia[0]],
      ["A", sequencia[1]],
      ["C", sequencia[2]],
      ["E", sequencia[3]],
    ]);
  });

  it("reserva sem cotista reverte para a ampla e a chamada segue a nota", () => {
    const resultado = montarConvocacaoDaVaga({
      candidatos: [
        candidato("B", 95, "Ampla concorrência"),
        candidato("C", 90, "Ampla concorrência"),
        candidato("E", 85, "Ampla concorrência"),
        candidato("F", 80, "Ampla concorrência"),
        candidato("G", 70, "Ampla concorrência"),
      ],
      quadro,
      modelo: MGI,
    });
    const imediatas = resultado.linhas.filter((l) => l.imediata);
    expect(imediatas.map((l) => l.candidato.nome)).toEqual([
      "B",
      "C",
      "E",
      "F",
    ]);
    // A 2ª posição era da reserva e reverteu para a ampla.
    expect(imediatas[1]?.categoriaReservada).toBe(sequencia[1]);
  });

  it("com menos candidatos que vagas, chama todos", () => {
    expect(
      ordem([
        candidato("A", 90, "Pretos e pardos"),
        candidato("B", 80, "Ampla concorrência"),
      ]).map(([nome]) => nome),
    ).toEqual(["A", "B"]);
  });
});
