import { describe, expect, it } from "vitest";
import {
  chaveDoEdital,
  editaisDasLinhas,
  editalEstaAtivo,
} from "../src/lib/editais-das-linhas.js";

describe("situação do edital vinda da view ou da planilha", () => {
  /*
    A view devolve booleano; a planilha devolve texto. O resto do painel
    pergunta pela situação com `norm(meta.ativo)`, comparando contra uma lista
    que inclui "true" — ou seja, o booleano só funciona porque a string "true"
    está lá. Estes casos existem para que remover "true" daquela lista, achando
    que é redundante, quebre um teste em vez de tornar todo edital inativo em
    silêncio.
  */
  it("aceita o booleano que a view devolve", () => {
    expect(editalEstaAtivo(true)).toBe(true);
    expect(editalEstaAtivo(false)).toBe(false);
  });

  it("aceita as formas de texto usadas na planilha", () => {
    for (const valor of ["sim", "SIM", "s", "ativo", "1", "true", "x", "X"]) {
      expect(editalEstaAtivo(valor)).toBe(true);
    }
  });

  it("trata ausência e negativa como inativo", () => {
    for (const valor of [null, undefined, "", "   ", "nao", "não", "0", "n"]) {
      expect(editalEstaAtivo(valor)).toBe(false);
    }
  });

  it("ignora acento e espaço em volta", () => {
    expect(editalEstaAtivo("  Ativo  ")).toBe(true);
  });
});

describe("montagem dos editais a partir das linhas", () => {
  it("reduz muitas linhas de candidato a uma linha por edital", () => {
    const editais = editaisDasLinhas([
      {
        grupo: "G1",
        unidade: "DSEI X",
        edital: "01/2026",
        edital_ativo: true,
        data_inicio_analise: "2026-01-10",
        data_fim_analise: "2026-02-10",
        candidato: "Fulano",
      },
      {
        grupo: "G1",
        unidade: "DSEI X",
        edital: "01/2026",
        edital_ativo: true,
        data_inicio_analise: "2026-01-10",
        data_fim_analise: "2026-02-10",
        candidato: "Beltrano",
      },
    ]);

    expect(editais).toHaveLength(1);
    expect(editais[0]).toEqual({
      grupo: "G1",
      unidade: "DSEI X",
      edital: "01/2026",
      ativo: true,
      data_inicio_analise: "2026-01-10",
      data_fim_analise: "2026-02-10",
    });
  });

  it("completa a janela quando a primeira linha não a traz", () => {
    const [edital] = editaisDasLinhas([
      { unidade: "DSEI Y", edital: "02/2026", edital_ativo: false },
      {
        unidade: "DSEI Y",
        edital: "02/2026",
        edital_ativo: true,
        data_inicio_analise: "2026-05-01",
        data_fim_analise: "2026-06-01",
      },
    ]);

    expect(edital.data_inicio_analise).toBe("2026-05-01");
    expect(edital.data_fim_analise).toBe("2026-06-01");
    expect(edital.ativo).toBe(true);
  });

  /*
    Comportamento deliberado, registrado para ninguém mudá-lo por engano: a
    primeira janela vence. Se a view um dia devolver datas divergentes para o
    mesmo edital, a diferença é descartada aqui — e é este teste que revela onde
    a verificação teria de entrar.
  */
  it("mantém a primeira janela quando duas linhas divergem", () => {
    const [edital] = editaisDasLinhas([
      {
        unidade: "DSEI Z",
        edital: "03/2026",
        data_inicio_analise: "2026-01-10",
        data_fim_analise: "2026-02-10",
      },
      {
        unidade: "DSEI Z",
        edital: "03/2026",
        data_inicio_analise: "2026-03-01",
        data_fim_analise: "2026-04-01",
      },
    ]);

    expect(edital.data_inicio_analise).toBe("2026-01-10");
  });

  it("separa editais de unidades diferentes com o mesmo número", () => {
    const editais = editaisDasLinhas([
      { unidade: "DSEI A", edital: "01/2026" },
      { unidade: "DSEI B", edital: "01/2026" },
    ]);
    expect(editais).toHaveLength(2);
  });

  it("descarta linha sem unidade ou sem edital", () => {
    expect(
      editaisDasLinhas([
        { unidade: "", edital: "01/2026" },
        { unidade: "DSEI A", edital: "" },
        { edital: "01/2026" },
        { unidade: "DSEI A" },
      ]),
    ).toEqual([]);
  });

  it("usa o campo ativo quando a view não manda edital_ativo", () => {
    const [edital] = editaisDasLinhas([
      { unidade: "DSEI A", edital: "01/2026", ativo: "SIM" },
    ]);
    expect(edital.ativo).toBe(true);
  });

  it("aguenta entrada ausente ou de outro tipo", () => {
    expect(editaisDasLinhas(null)).toEqual([]);
    expect(editaisDasLinhas(undefined)).toEqual([]);
    expect(editaisDasLinhas("não é lista")).toEqual([]);
    expect(editaisDasLinhas([null, undefined])).toEqual([]);
  });

  it("normaliza a chave, para não duplicar por acento ou caixa", () => {
    expect(chaveDoEdital("G", "DSEI Xavánte", "01/2026")).toBe(
      chaveDoEdital("g", "dsei xavante", "01/2026"),
    );
  });
});
