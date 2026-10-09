import { describe, expect, it } from "vitest";
import {
  acompanhamentoDasInscricoes,
  diasEntre,
  textoDoHoje,
} from "../../src/lib/avaliacao-documental/acompanhamento-das-inscricoes.ts";
import {
  dataDeCorteDoCronograma,
  janelaDasInscricoes,
} from "../../src/lib/classificacao/dados.js";
import {
  CRONOGRAMA_114,
  DADOS_114,
  r,
} from "../fixtures/acompanhamento-das-inscricoes.js";

/*
  O acompanhamento das inscrições (cartão "Inscrições" da Pré-classificação):
  a janela pelo cronograma (a "Validação das inscrições" dos Projetos não é
  inscrição), os totais do último retrato de cada vaga, a série diária com o
  retrato de cada vaga valendo até o próximo e o "hoje +N" por vaga.
*/

describe("janela das inscrições", () => {
  it("a validação das inscrições não conta como inscrição", () => {
    expect(janelaDasInscricoes(CRONOGRAMA_114)).toEqual({
      inicio: "2026-10-05",
      fim: "2026-10-14",
    });
    expect(dataDeCorteDoCronograma(CRONOGRAMA_114)).toBe("2026-10-14");
    expect(janelaDasInscricoes(null)).toEqual({ inicio: null, fim: null });
  });

  it("o cartão aparece da véspera do início a 3 dias depois do fim", () => {
    const em = (hoje) =>
      acompanhamentoDasInscricoes({ ...DADOS_114, hoje }).mostrar;
    expect(em("2026-10-03")).toBe(false);
    expect(em("2026-10-04")).toBe(true);
    expect(em("2026-10-17")).toBe(true);
    expect(em("2026-10-18")).toBe(false);
    expect(acompanhamentoDasInscricoes({ hoje: "2026-10-09" }).mostrar).toBe(
      false,
    );
    expect(acompanhamentoDasInscricoes(null).mostrar).toBe(false);
  });
});

describe("totais, série e vagas", () => {
  const a = acompanhamentoDasInscricoes(DADOS_114);

  it("os totais somam o último retrato de cada vaga", () => {
    expect(a.totais).toMatchObject({
      inscritos: 21,
      finalizados: 19,
      aptos: 8,
      eliminados: 2,
      hoje: 3,
      previa: false,
      em: "2026-10-09T13:00:00Z",
    });
    expect(a.encerradas).toBe(false);
  });

  it("a série vai do início ao fim; o retrato vale até o próximo; depois de hoje, vazio", () => {
    expect(a.serie).toHaveLength(10);
    const por = Object.fromEntries(a.serie.map((p) => [p.data, p]));
    expect(por["2026-10-05"]).toEqual({
      data: "2026-10-05",
      inscritos: null,
      aptos: null,
    });
    expect(por["2026-10-06"].inscritos).toBe(10);
    expect(por["2026-10-07"]).toMatchObject({ inscritos: 13, aptos: 5 });
    expect(por["2026-10-09"]).toMatchObject({ inscritos: 21, aptos: 8 });
    expect(por["2026-10-10"].inscritos).toBeNull();
  });

  it("por vaga: inscritos, aptos e hoje +N (só com retrato de hoje)", () => {
    expect(a.vagas).toEqual([
      {
        codigo: "181100",
        cargo: "Analista — Belo Horizonte",
        inscritos: 18,
        aptos: 7,
        hoje: 3,
      },
      {
        codigo: "181101",
        cargo: "Motorista — Vitória",
        inscritos: 3,
        aptos: 1,
        hoje: null,
      },
    ]);
  });

  it("sem regra os aptos ficam vazios; com prévia, avisa", () => {
    const semRegra = acompanhamentoDasInscricoes({
      ...DADOS_114,
      retratos: [r("181100", "2026-10-09", 5, null, { eliminados: null })],
    });
    expect(semRegra.totais).toMatchObject({
      inscritos: 5,
      aptos: null,
      eliminados: null,
      previa: false,
      hoje: 5,
    });
    const previa = acompanhamentoDasInscricoes({
      ...DADOS_114,
      retratos: [r("181100", "2026-10-09", 5, 2, { previa: true })],
    });
    expect(previa.totais.previa).toBe(true);
  });

  it("sem retrato ainda: cartão sem totais; vaga do edital aparece sem números", () => {
    const vazio = acompanhamentoDasInscricoes({ ...DADOS_114, retratos: [] });
    expect(vazio.mostrar).toBe(true);
    expect(vazio.totais).toBeNull();
    expect(vazio.vagas[0]).toMatchObject({ inscritos: null, hoje: null });
  });
});

describe("auxiliares", () => {
  it("textoDoHoje e diasEntre", () => {
    expect([
      textoDoHoje(3),
      textoDoHoje(0),
      textoDoHoje(-1),
      textoDoHoje(null),
    ]).toEqual(["+3", "0", "-1", "—"]);
    expect(diasEntre("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });
});
