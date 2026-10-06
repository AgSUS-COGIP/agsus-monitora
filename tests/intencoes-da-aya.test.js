import { describe, expect, it } from "vitest";
import {
  acaoDaIntencao,
  extrairEntidades,
  mesmoEdital,
  numeroDoEdital,
  reconhecerIntencao,
  textoDaIntencao,
} from "../src/lib/intencoes-da-aya.js";

/*
  O catálogo de perguntas com número da Aya (src/lib/intencoes-da-aya.js):
  reconhece a intenção e as entidades (edital, área, métrica), deixa as
  perguntas de "o que é" para a base e escreve a resposta só com números.
*/

const resumo = (pergunta, contexto = { view: "selecao", area: "sede" }) => {
  const r = reconhecerIntencao(pergunta, contexto);
  return r && [r.id, r.metrica?.id || r.tipo, r.entidades.edital || ""];
};

describe("entidades", () => {
  it.each([
    ["quantas pendentes no 93/2026?", "93/2026"],
    ["edital 93-2026", "93/2026"],
    ["nº 7/26", "7/2026"],
    ["edital 12 de 2026", "12/2026"],
    ["sem edital", ""],
  ])("%s → %s", (texto, esperado) => {
    expect(numeroDoEdital(texto)).toBe(esperado);
  });

  it("edital sem ano casa com qualquer ano; com ano, só com ele", () => {
    expect(mesmoEdital("Edital nº 93/2026 - Médico", "93")).toBe(true);
    expect(mesmoEdital("93/2025", "93/2026")).toBe(false);
    expect(mesmoEdital("Edital 93/2026", "93/2026")).toBe(true);
    expect(mesmoEdital("qualquer", "")).toBe(true);
  });

  it("área da pergunta vence a da tela; o edital da tela completa", () => {
    expect(
      extrairEntidades("quantos inscritos na SEDE?", {
        area: "saude-indigena",
        edital: "Edital 5/2026",
      }),
    ).toEqual({
      edital: "5/2026",
      editalExplicito: false,
      area: "sede",
      areaExplicita: true,
    });
  });
});

describe("reconhecer a intenção", () => {
  it.each([
    [
      "quantas análises pendentes tem o 93/2026?",
      ["analises", "pendente", "93/2026"],
    ],
    [
      "quantos recursos aguardando parecer?",
      ["recursos", "aguardandoParecer", ""],
    ],
    ["quantos recursos vencidos", ["recursos", "atrasados", ""]],
    ["quantos convocados sem nota?", ["entrevistas", "semNota", ""]],
    [
      "qual a taxa de contratação do edital 12/2026?",
      ["selecao", "taxa", "12/2026"],
    ],
    ["quantos inscritos?", ["selecao", "inscritos", ""]],
    [
      "quantas reprovadas no edital 5 de 2026",
      ["analises", "reprovado", "5/2026"],
    ],
    ["quando foi a última carga da Seleção?", ["ultima-carga", "carga", ""]],
    ["tem alguma carga atrasada?", ["cargas", "atrasos", ""]],
    ["tem aviso de conferência aqui?", ["conferencias", "conferencia", ""]],
  ])("%s", (pergunta, esperado) => {
    expect(resumo(pergunta)).toEqual(esperado);
  });

  it("sem módulo dito, usa a tela aberta", () => {
    expect(resumo("quantos aprovados tem aqui?", { view: "analises" })).toEqual(
      ["analises", "aprovado", ""],
    );
  });

  it("pergunta de explicação ou da tela não é intenção de dado", () => {
    for (const pergunta of [
      "o que é análise pendente?",
      "como funciona o recurso?",
      "quantos DSEIs aparecem?",
      "o que tem nesta tela?",
      "quantos filtros estão ativos?",
    ])
      expect(
        reconhecerIntencao(pergunta, { view: "analises" }),
        pergunta,
      ).toBeNull();
  });
});

describe("resposta", () => {
  it("só número, com o recorte e o total", () => {
    const intencao = reconhecerIntencao(
      "quantas análises pendentes tem o 93/2026?",
      {
        area: "sede",
      },
    );
    expect(textoDaIntencao(intencao, { valor: 12, total: 40 })).toBe(
      "Há 12 análises pendentes no edital 93/2026 na SEDE, de 40 no total.",
    );
    expect(textoDaIntencao(intencao, { valor: 1, total: 1 })).toContain(
      "1 análise pendente",
    );
  });

  it("o botão Abrir leva à tela com o edital e a métrica", () => {
    const intencao = reconhecerIntencao(
      "quantas análises pendentes tem o 93/2026?",
    );
    expect(acaoDaIntencao(intencao)).toEqual({
      view: "analises",
      filtro: { edital: "93/2026", metrica: "pendente" },
    });
  });

  it("taxa em porcentagem e carga com data de Brasília", () => {
    const taxa = reconhecerIntencao("qual a taxa de contratação?", {
      view: "selecao",
    });
    expect(
      textoDaIntencao(taxa, { valor: 25, contratados: 5, aprovados: 20 }),
    ).toBe("A taxa de contratação é 25% (5 contratados de 20 aprovados).");
    const carga = reconhecerIntencao("quando foi a última carga da seleção?");
    expect(textoDaIntencao(carga, { em: "2026-10-05T13:05:00Z" })).toContain(
      "05/10/2026, 10:05",
    );
    expect(textoDaIntencao(carga, { em: null })).toContain("Não achei");
  });
});
