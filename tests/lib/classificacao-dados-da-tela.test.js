import { describe, expect, it } from "vitest";
import {
  avisosAgrupados,
  dataDeCorteDoCronograma,
  filtrosAtivosDoRecorte,
  listaDaFase,
  recortarResultado,
  RECORTE_VAZIO,
} from "../../src/lib/classificacao/dados.js";

/* O que a tela de Classificação precisa em volta do motor. */

describe("data de corte pelo cronograma", () => {
  it("o fim do período de inscrição; com prorrogação, o fim mais tarde", () => {
    expect(
      dataDeCorteDoCronograma([
        {
          atividade: "Publicação do edital",
          inicio: "2026-06-20",
          fim: "2026-06-20",
        },
        {
          atividade:
            "Período de inscrição e envio dos documentos comprobatórios",
          inicio: "2026-06-21",
          fim: "2026-07-10",
        },
        {
          atividade: "Prorrogação das inscrições",
          inicio: "2026-07-11",
          fim: "2026-07-20",
        },
        {
          atividade: "Resultado das inscrições homologadas",
          inicio: "2026-07-30",
          fim: "2026-07-30",
        },
        {
          atividade: "Recurso contra o indeferimento da inscrição",
          inicio: "2026-08-01",
          fim: "2026-08-02",
        },
      ]),
    ).toBe("2026-07-20");
  });

  it("sem etapa de inscrição (ou sem datas), null", () => {
    expect(
      dataDeCorteDoCronograma([
        { atividade: "Entrevistas", fim: "2026-08-10" },
      ]),
    ).toBeNull();
    expect(
      dataDeCorteDoCronograma([{ atividade: "Inscrições", fim: null }]),
    ).toBeNull();
    expect(dataDeCorteDoCronograma(null)).toBeNull();
  });
});

describe("avisos e recorte", () => {
  it("avisos agrupados por tipo, os graves primeiro", () => {
    const grupos = avisosAgrupados([
      { codigo: "DADO_FALTANDO", tom: "warning", texto: "a" },
      { codigo: "EMPATE_PENDENTE", tom: "danger", texto: "b" },
      { codigo: "DADO_FALTANDO", tom: "warning", texto: "c" },
      { codigo: "ENTREVISTA_PELO_NOME", tom: "info", texto: "d" },
    ]);
    expect(grupos.map((g) => [g.codigo, g.itens.length])).toEqual([
      ["EMPATE_PENDENTE", 1],
      ["DADO_FALTANDO", 2],
      ["ENTREVISTA_PELO_NOME", 1],
    ]);
    expect(grupos[0].rotulo).toBe("Empate aguardando sorteio ou decisão");
  });

  const resultado = {
    vagas: [
      {
        chave: "1",
        geral: [{ nome: "José Ávila" }, { nome: "Maria" }],
        porModalidade: { PP: [{ nome: "Maria" }] },
        eliminados: [{ nome: "Zé Eliminado" }],
      },
      {
        chave: "2",
        geral: [{ nome: "Ana" }],
        porModalidade: { PP: [] },
        eliminados: [],
      },
    ],
  };

  it("recorte por vaga, lista e nome (sem acento)", () => {
    expect(
      recortarResultado(resultado, RECORTE_VAZIO).map((v) => v.linhas.length),
    ).toEqual([2, 1]);
    expect(
      recortarResultado(resultado, { ...RECORTE_VAZIO, lista: "PP" }).map(
        (v) => v.linhas.length,
      ),
    ).toEqual([1, 0]);
    const busca = recortarResultado(resultado, {
      ...RECORTE_VAZIO,
      busca: "avila",
    });
    expect(busca.map((v) => [v.chave, v.linhas.map((l) => l.nome)])).toEqual([
      ["1", ["José Ávila"]],
    ]);
    expect(
      recortarResultado(resultado, { ...RECORTE_VAZIO, busca: "eliminado" })[0]
        .eliminadosFiltrados,
    ).toHaveLength(1);
    expect(filtrosAtivosDoRecorte({ vaga: "1", lista: "PP", busca: " " })).toBe(
      2,
    );
    expect(recortarResultado(null)).toEqual([]);
  });
});

describe("listaDaFase", () => {
  it("abre no resultado final só quando já há nota de entrevista", () => {
    expect(listaDaFase(null)).toBe("PRELIMINAR");
    expect(listaDaFase({ entrevistas: [] })).toBe("PRELIMINAR");
    expect(
      listaDaFase({
        entrevistas: [{ nota: null }, { nota: "" }, { nota: "x" }],
      }),
    ).toBe("PRELIMINAR");
    expect(
      listaDaFase({ entrevistas: [{ nota: null }, { nota: "12,5" }] }),
    ).toBe("FINAL");
  });
});
