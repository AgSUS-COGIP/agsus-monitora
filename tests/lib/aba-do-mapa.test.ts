import { describe, expect, it } from "vitest";
import type { LinhaDoMonitoramento } from "../../src/componentes/tipos-do-monitoramento.ts";
import {
  chaveDoDseiNoEndereco,
  dseiNoEndereco,
  resumoDoMapa,
} from "../../src/lib/mapas/mapa-saude-indigena/aba-do-mapa.ts";
import { chaveDoDsei } from "../../src/lib/mapas/mapa-saude-indigena/chaves.ts";

/*
  A aba Mapa (src/lib/mapas/mapa-saude-indigena/aba-do-mapa.ts): o DSEI no
  endereço vai e volta pela mesma chave do mapa, e o cartão da Visão geral
  resume o mapa com as contas das bolhas. Dados fictícios.
*/

const edital = (
  unidade: string,
  vagas_total: number,
  contratados: number,
  status = "Concluído",
): LinhaDoMonitoramento => ({ unidade, vagas_total, contratados, status });

describe("o DSEI no endereço", () => {
  it("vira um pedaço de endereço legível", () => {
    expect(dseiNoEndereco("DSEI Yanomami")).toBe("yanomami");
    expect(dseiNoEndereco("Alto Rio Negro")).toBe("alto-rio-negro");
    expect(dseiNoEndereco("Médio Rio Solimões e Afluentes")).toBe(
      "medio-rio-solimoes-afluentes",
    );
    expect(dseiNoEndereco("DSEI Guamá-Tocantins")).toBe("guama-tocantins");
    expect(dseiNoEndereco("")).toBe("");
  });

  it("volta à chave do mapa (a mesma de `chaveDoDsei`)", () => {
    for (const nome of [
      "DSEI Yanomami",
      "DSEI Kaiapó do Mato Grosso",
      "Médio Rio Solimões e Afluentes",
      "DSEI Guamá-Tocantins",
    ])
      expect(chaveDoDseiNoEndereco(dseiNoEndereco(nome))).toBe(
        chaveDoDsei(nome),
      );
    expect(chaveDoDseiNoEndereco("")).toBe("");
  });
});

describe("o cartão do mapa na Visão geral", () => {
  it("conta os DSEIs com edital e acha o de mais ociosas e o menos preenchido", () => {
    const resumo = resumoDoMapa([
      edital("DSEI Yanomami", 20, 5),
      edital("DSEI Yanomami", 10, 10),
      edital("DSEI Ceará", 10, 9),
      edital("DSEI Xingu", 4, 1),
      // Em seleção: conta como edital, mas as vagas ainda não são ociosas.
      edital("DSEI Altamira", 8, 0, "Em andamento"),
      // CASAI nacional não é um dos 34 DSEIs.
      edital("CASAI Nacional Brasília", 5, 0),
    ]);
    expect(resumo.comEdital).toBe(4);
    expect(resumo.total).toBe(34);
    expect(resumo.maisOciosas).toEqual({
      nome: "Yanomami",
      endereco: "yanomami",
      valor: 15,
    });
    // Altamira: 0% preenchido (em seleção) é o menos preenchido.
    expect(resumo.menosPreenchido).toEqual({
      nome: "Altamira",
      endereco: "altamira",
      valor: 0,
    });
  });

  it("sem editais, nenhum destaque", () => {
    expect(resumoDoMapa([])).toEqual({
      comEdital: 0,
      total: 34,
      maisOciosas: null,
      menosPreenchido: null,
    });
  });

  it("empate vai pelo nome", () => {
    const resumo = resumoDoMapa([
      edital("DSEI Xingu", 10, 5),
      edital("DSEI Bahia", 10, 5),
    ]);
    expect(resumo.maisOciosas?.nome).toBe("Bahia");
    expect(resumo.menosPreenchido?.nome).toBe("Bahia");
  });
});
