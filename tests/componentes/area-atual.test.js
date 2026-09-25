import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  areaDaLinha,
  definirAreaAtual,
  definirAreasDoUsuario,
  idsDasLinhas,
  linhasDaArea,
  obterDadosDoMonitoramento,
  redefinirDadosDoMonitoramento,
  soDosEditais,
} from "../../src/componentes/dados-do-monitoramento.js";
import { resumoDasLinhas } from "../../src/lib/editais-do-nucleo.js";

/*
  A área atual (Saúde Indígena, SEDE ou Projetos) mora no store dos dados do
  monitoramento: o menu a define, e Editais, Cronograma e Lista de aprovados
  recortam por ela.
*/

const CHAVE = "agsus_monitora_area_atual_v1";

beforeEach(() => sessionStorage.clear());
afterEach(() => redefinirDadosDoMonitoramento());

describe("linhasDaArea", () => {
  const LINHAS = [
    { id: 1, CO_AREA: "saude-indigena" },
    { id: 2, CO_AREA: "sede" },
    { id: 3, CO_AREA: "projetos" },
    // Sem CO_AREA (cache antigo): a regra local reconhece a Saúde Indígena…
    { id: 4, unidade: "DSEI Manaus", responsavel: "USI" },
    // …e nada mais: unidade do CORES fica fora de todas as áreas.
    { id: 5, unidade: "SEDE", responsavel: "CORES" },
  ];

  it("filtra por CO_AREA; sem a coluna, só a Saúde Indígena é reconhecida", () => {
    expect(
      linhasDaArea(LINHAS, "saude-indigena").map((linha) => linha.id),
    ).toEqual([1, 4]);
    expect(linhasDaArea(LINHAS, "sede").map((linha) => linha.id)).toEqual([2]);
    expect(linhasDaArea(LINHAS, "projetos").map((linha) => linha.id)).toEqual([
      3,
    ]);
    expect(areaDaLinha(LINHAS[4])).toBe("");
    expect(linhasDaArea(undefined, "sede")).toEqual([]);
  });

  it("o recorte de cronograma e listas é pelo conjunto de ids", () => {
    const ids = idsDasLinhas(linhasDaArea(LINHAS, "sede"));
    expect([...ids]).toEqual(["2"]);
    // O id vem número numa fonte e texto na outra.
    expect(
      soDosEditais(
        [
          { editalId: "1", atividade: "a" },
          { editalId: "2", atividade: "b" },
        ],
        ids,
        "editalId",
      ).map((etapa) => etapa.atividade),
    ).toEqual(["b"]);
    expect(
      soDosEditais(
        [
          { lista_id: "L1", edital_id: 1 },
          { lista_id: "L2", edital_id: 2 },
        ],
        ids,
      ).map((lista) => lista.lista_id),
    ).toEqual(["L2"]);
    expect(soDosEditais(null, ids)).toEqual([]);
  });
});

describe("a área atual", () => {
  it("começa na Saúde Indígena e vira a primeira área do usuário", () => {
    expect(obterDadosDoMonitoramento().areaAtual).toBe("saude-indigena");
    definirAreasDoUsuario(["sede", "projetos"]);
    expect(obterDadosDoMonitoramento()).toMatchObject({
      areas: ["sede", "projetos"],
      areaAtual: "sede",
    });
  });

  it("continua a mesma se o usuário a tem, e fica guardada na aba", () => {
    definirAreasDoUsuario(["saude-indigena", "sede", "projetos"]);
    definirAreaAtual("projetos");
    expect(sessionStorage.getItem(CHAVE)).toBe("projetos");

    definirAreasDoUsuario(["saude-indigena", "projetos"]);
    expect(obterDadosDoMonitoramento().areaAtual).toBe("projetos");

    definirAreasDoUsuario([]);
    expect(obterDadosDoMonitoramento().areaAtual).toBe("saude-indigena");
  });
});

describe("resumoDasLinhas", () => {
  it("os indicadores do Núcleo contam só os editais da tabela", () => {
    const resumo = [
      { id: 1, unidade: "DSEI Manaus", edital: "10/2026" },
      { id: 2, unidade: "SEDE", edital: "11/2026" },
      { id: 9, unidade: "DSEI Xingu", edital: "12/2026" },
    ];
    expect(
      resumoDasLinhas(resumo, [
        { id: 2 },
        // Casa por unidade + edital, como a tabela.
        { id: 77, unidade: "DSEI Xingu", edital: "12/2026" },
      ]).map((item) => item.id),
    ).toEqual([2, 9]);
    expect(resumoDasLinhas(resumo, [])).toEqual([]);
  });
});
