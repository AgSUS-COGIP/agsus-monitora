import { describe, expect, it } from "vitest";
import {
  ehResponsavelCores,
  normalizarResponsavel,
  UNIDADES_CORES,
  unidadesDoResponsavel,
} from "../src/lib/responsavel-do-edital.js";

const catalogo = [
  {
    nome_oficial: "DSEI Yanomami",
    id_unidade: "1",
    sigla: "YAN",
    tipo: "DSEI",
    uf_sede: "RR",
  },
  {
    nome_oficial: "CASAI Brasília",
    id_unidade: "2",
    sigla: "CSB",
    tipo: "CASAI",
    uf_sede: "DF",
  },
];

describe("normalizarResponsavel", () => {
  it("aceita as duas opções do select, em qualquer caixa", () => {
    expect(normalizarResponsavel("USI")).toBe("USI");
    expect(normalizarResponsavel("cores")).toBe("CORES");
    expect(normalizarResponsavel("  Usi  ")).toBe("USI");
  });

  /*
    Antes de virar seleção, o campo era texto livre e guardava nomes de
    pessoas. Devolver "" faz o select abrir vazio em vez de inventar uma
    opção — o nome antigo continua gravado até alguém salvar aquele edital.
  */
  it("descarta o que não é USI nem CORES", () => {
    expect(normalizarResponsavel("Maria Silva")).toBe("");
    expect(normalizarResponsavel("")).toBe("");
    expect(normalizarResponsavel(null)).toBe("");
    expect(normalizarResponsavel(undefined)).toBe("");
  });
});

describe("ehResponsavelCores", () => {
  it("só é verdadeiro para CORES", () => {
    expect(ehResponsavelCores("CORES")).toBe(true);
    expect(ehResponsavelCores("cores")).toBe(true);
    expect(ehResponsavelCores("USI")).toBe(false);
    expect(ehResponsavelCores("")).toBe(false);
    expect(ehResponsavelCores("Maria Silva")).toBe(false);
  });
});

describe("unidadesDoResponsavel", () => {
  it("USI continua com o catálogo de TD_UNIDADE", () => {
    expect(unidadesDoResponsavel("USI", catalogo)).toBe(catalogo);
  });

  it("sem responsável escolhido, mantém o catálogo de sempre", () => {
    expect(unidadesDoResponsavel("", catalogo)).toBe(catalogo);
  });

  it("CORES tem as sete unidades próprias, ignorando o catálogo", () => {
    const unidades = unidadesDoResponsavel("CORES", catalogo);
    expect(unidades.map((u) => u.nome_oficial)).toEqual([...UNIDADES_CORES]);
  });

  /*
    Estas unidades não estão em TD_UNIDADE e não pertencem a um estado, então
    o edital do CORES grava só o nome. Se algum dia vierem preenchidas, o
    formulário passaria a gravar vínculos que não existem no catálogo.
  */
  it("CORES não traz id, sigla, tipo nem UF", () => {
    unidadesDoResponsavel("CORES", catalogo).forEach((unidade) => {
      expect(unidade.id_unidade).toBe("");
      expect(unidade.sigla).toBe("");
      expect(unidade.tipo).toBe("");
      expect(unidade.uf_sede).toBe("");
    });
  });

  it("aguenta um catálogo ausente", () => {
    expect(unidadesDoResponsavel("USI", null)).toEqual([]);
    expect(unidadesDoResponsavel("CORES", null)).toHaveLength(
      UNIDADES_CORES.length,
    );
  });
});
