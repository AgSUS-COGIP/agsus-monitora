import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assinarDadosDoMonitoramento,
  definirAreaAtual,
  definirAreasDoUsuario,
  esquecerLinhasDoMonitoramento,
  idsDasLinhas,
  obterDadosDoMonitoramento,
  publicarLinhasDoMonitoramento,
  publicarUnidadesDoCatalogo,
  redefinirDadosDoMonitoramento,
  soDosEditais,
} from "../../src/componentes/dados-do-monitoramento.ts";

afterEach(() => {
  redefinirDadosDoMonitoramento();
  sessionStorage.clear();
});

describe("fronteira dos dados compartilhados", () => {
  it("valida linhas externas e preserva colunas extras sem interpretar seu conteúdo", () => {
    publicarLinhasDoMonitoramento([
      null,
      [],
      "linha",
      { id: {} },
      { id: NaN },
      { id: " " },
      { id: 1, unidade: {} },
      { id: 0, unidade: "DSEI Xingu", etapa: null, vagas: 10 },
      {
        id: "uuid",
        CO_AREA: "sede",
        observacoes: null,
        extra: { campo: true },
      },
    ]);
    const snapshot = obterDadosDoMonitoramento();
    expect(snapshot.carregado).toBe(true);
    expect(snapshot.linhas.map((linha) => linha.id)).toEqual([0, "uuid"]);
    expect(snapshot.linhas[0]).toMatchObject({
      unidade: "DSEI Xingu",
      vagas: 10,
    });
    expect(snapshot.linhas[0].etapa).toBeUndefined();
    expect(snapshot.linhas[1]).toMatchObject({ extra: { campo: true } });
    expect(snapshot.linhas[1].observacoes).toBeUndefined();
    publicarLinhasDoMonitoramento({ linhas: [] });
    expect(obterDadosDoMonitoramento()).toMatchObject({
      linhas: [],
      carregado: true,
    });
  });

  it("normaliza o catálogo sem assumir o formato das colunas extras", () => {
    publicarUnidadesDoCatalogo([null, [], 2, { unidade: "Xingu", codigo: 1 }]);
    expect(obterDadosDoMonitoramento().unidades).toEqual([
      { unidade: "Xingu", codigo: 1 },
    ]);
    publicarUnidadesDoCatalogo(null);
    expect(obterDadosDoMonitoramento().unidades).toEqual([]);
  });

  it("mantém o snapshot entre leituras e encerra a assinatura", () => {
    const ouvinte = vi.fn();
    const cancelar = assinarDadosDoMonitoramento(ouvinte);
    const anterior = obterDadosDoMonitoramento();
    expect(obterDadosDoMonitoramento()).toBe(anterior);
    publicarLinhasDoMonitoramento([]);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(obterDadosDoMonitoramento()).not.toBe(anterior);
    cancelar();
    publicarLinhasDoMonitoramento([]);
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  it("sair limpa as linhas e a carga, mantendo a área da aba", () => {
    definirAreasDoUsuario(["sede", "projetos"]);
    definirAreaAtual("projetos");
    publicarLinhasDoMonitoramento([{ id: "uuid", CO_AREA: "projetos" }]);
    esquecerLinhasDoMonitoramento();
    expect(obterDadosDoMonitoramento()).toMatchObject({
      linhas: [],
      carregado: false,
      areaAtual: "projetos",
    });
  });

  it("descarta áreas que não são texto e corrige a área fora do perfil", () => {
    definirAreaAtual("projetos");
    definirAreasDoUsuario([null, {}, 1, " sede "]);
    expect(obterDadosDoMonitoramento()).toMatchObject({
      areas: ["sede"],
      areaAtual: "sede",
    });
  });

  it("ids ausentes e inválidos não ligam registros de outro edital", () => {
    const ids = idsDasLinhas([
      { id: 0 },
      { id: "uuid" },
      {},
      { id: null },
      { id: {} },
    ]);
    expect([...ids]).toEqual(["0", "uuid"]);
    expect(
      soDosEditais(
        [{ edital_id: 0 }, { edital_id: "uuid" }, {}, { edital_id: {} }],
        ids,
      ),
    ).toEqual([{ edital_id: 0 }, { edital_id: "uuid" }]);
    expect(
      soDosEditais(
        [{}, { edital_id: {} }],
        new Set(["undefined", "[object Object]"]),
      ),
    ).toEqual([]);
  });
});
