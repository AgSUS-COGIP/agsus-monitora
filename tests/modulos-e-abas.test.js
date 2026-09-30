import { describe, expect, it } from "vitest";
import {
  alteracoesDoRascunho,
  estadoDoAlvo,
  linhaDoHistorico,
  motivoValido,
  originaisDaArvore,
  problemasDoRascunho,
  registrarCampo,
  registrarEstado,
  resumoDoRascunho,
  valorDoCampo,
} from "../src/lib/modulos-e-abas.js";

/*
  Rascunho de Configurações › Módulos e abas: guarda só o que difere do lido,
  junta ativo + situação em três estados e monta o `p_alteracoes` de
  `salvar_situacao_modulos` com as regras do banco.
*/

const ARVORE = {
  sistema: { situacao: "ATIVA", mensagem: null, previsao: null },
  areas: [
    {
      co_area: "saude-indigena",
      no_area: "Saúde Indígena",
      ativo: true,
      situacao: "ATIVA",
      mensagem: null,
      previsao: null,
      abas: [
        {
          co_aba: "editais",
          ativo: true,
          situacao: "ATIVA",
          mensagem: null,
          previsao: null,
        },
      ],
    },
    {
      co_area: "sede",
      no_area: "SEDE",
      ativo: true,
      situacao: "MANUTENCAO",
      mensagem: "Ajuste",
      previsao: "2026-10-05",
      abas: [],
    },
  ],
  abas: [
    {
      co_aba: "editais",
      no_aba: "Editais",
      ativo: true,
      situacao: "ATIVA",
      mensagem: null,
      previsao: null,
      beta: false,
    },
  ],
  paineis: [
    { id: "p-1", titulo: "Painel BI", ativo: true, em_manutencao: false },
  ],
  historico: [],
};

const originais = originaisDaArvore(ARVORE);
const SISTEMA = { escopo: "sistema" };
const SAUDE = { escopo: "area", area: "saude-indigena" };
const SEDE = { escopo: "area", area: "sede" };
const EDITAIS = { escopo: "aba", aba: "editais" };
const EDITAIS_NA_SAUDE = {
  escopo: "aba_area",
  area: "saude-indigena",
  aba: "editais",
};
const PAINEL = { escopo: "painel", painel: "p-1" };

describe("rascunho de módulos e abas", () => {
  it("lê os valores como o banco compara", () => {
    const vazio = new Map();
    expect(valorDoCampo(vazio, originais, SEDE, "situacao")).toBe("MANUTENCAO");
    expect(valorDoCampo(vazio, originais, SEDE, "previsao")).toBe("2026-10-05");
    expect(valorDoCampo(vazio, originais, SISTEMA, "mensagem")).toBe("");
    expect(valorDoCampo(vazio, originais, EDITAIS, "beta")).toBe("N");
    expect(valorDoCampo(vazio, originais, PAINEL, "situacao")).toBe("ATIVA");
    expect(estadoDoAlvo(vazio, originais, SEDE)).toBe("manutencao");
    expect(estadoDoAlvo(vazio, originais, SISTEMA)).toBe("ativa");
  });

  it("voltar ao valor lido tira a alteração", () => {
    let rascunho = registrarCampo(new Map(), originais, EDITAIS, "beta", "S");
    expect(rascunho.size).toBe(1);
    rascunho = registrarCampo(rascunho, originais, EDITAIS, "beta", "N");
    expect(rascunho.size).toBe(0);
    rascunho = registrarCampo(
      rascunho,
      originais,
      SEDE,
      "mensagem",
      "  Ajuste ",
    );
    expect(rascunho.size).toBe(0);
  });

  it("três estados: ativa, manutenção, desativada", () => {
    let rascunho = registrarEstado(new Map(), originais, SAUDE, "manutencao");
    expect(alteracoesDoRascunho(rascunho)).toEqual([
      {
        escopo: "area",
        area: "saude-indigena",
        campo: "situacao",
        valor: "MANUTENCAO",
      },
    ]);
    rascunho = registrarEstado(rascunho, originais, SAUDE, "desativada");
    // Desativar devolve a situação à lida: só o ativo muda.
    expect(alteracoesDoRascunho(rascunho)).toEqual([
      { escopo: "area", area: "saude-indigena", campo: "ativo", valor: "N" },
    ]);
    expect(estadoDoAlvo(rascunho, originais, SAUDE)).toBe("desativada");
    rascunho = registrarEstado(rascunho, originais, SAUDE, "ativa");
    expect(rascunho.size).toBe(0);
  });

  it("o sistema inteiro não desativa", () => {
    expect(
      registrarEstado(new Map(), originais, SISTEMA, "desativada").size,
    ).toBe(0);
    const rascunho = registrarEstado(
      new Map(),
      originais,
      SISTEMA,
      "manutencao",
    );
    expect(alteracoesDoRascunho(rascunho)).toEqual([
      { escopo: "sistema", campo: "situacao", valor: "MANUTENCAO" },
    ]);
  });

  it("monta os itens de cada escopo com os campos do banco", () => {
    let rascunho = registrarEstado(
      new Map(),
      originais,
      EDITAIS_NA_SAUDE,
      "manutencao",
    );
    rascunho = registrarCampo(
      rascunho,
      originais,
      EDITAIS_NA_SAUDE,
      "mensagem",
      " Volta já ",
    );
    rascunho = registrarCampo(
      rascunho,
      originais,
      EDITAIS_NA_SAUDE,
      "previsao",
      "2026-10-10",
    );
    rascunho = registrarEstado(rascunho, originais, PAINEL, "desativada");
    rascunho = registrarCampo(rascunho, originais, SEDE, "previsao", "");
    expect(alteracoesDoRascunho(rascunho)).toEqual([
      {
        escopo: "aba_area",
        area: "saude-indigena",
        aba: "editais",
        campo: "situacao",
        valor: "MANUTENCAO",
      },
      {
        escopo: "aba_area",
        area: "saude-indigena",
        aba: "editais",
        campo: "mensagem",
        valor: "Volta já",
      },
      {
        escopo: "aba_area",
        area: "saude-indigena",
        aba: "editais",
        campo: "previsao",
        valor: "2026-10-10",
      },
      { escopo: "painel", painel: "p-1", campo: "ativo", valor: "N" },
      { escopo: "area", area: "sede", campo: "previsao", valor: "" },
    ]);
  });

  it("aponta o que o banco recusaria: todas as áreas desativadas", () => {
    let rascunho = registrarEstado(new Map(), originais, SAUDE, "desativada");
    expect(problemasDoRascunho(ARVORE, rascunho, originais)).toEqual([]);
    rascunho = registrarEstado(rascunho, originais, SEDE, "desativada");
    expect(problemasDoRascunho(ARVORE, rascunho, originais)).toEqual([
      "Pelo menos uma área precisa ficar ativa.",
    ]);
    const longa = registrarCampo(
      new Map(),
      originais,
      SISTEMA,
      "mensagem",
      "x".repeat(501),
    );
    expect(problemasDoRascunho(ARVORE, longa, originais)[0]).toContain("500");
  });

  it("motivo de 3 a 500 caracteres", () => {
    expect(motivoValido("ok")).toBe(false);
    expect(motivoValido(" ok ")).toBe(false);
    expect(motivoValido("ajuste")).toBe(true);
    expect(motivoValido("x".repeat(501))).toBe(false);
  });

  it("revisão e histórico em português", () => {
    const rascunho = registrarEstado(
      new Map(),
      originais,
      EDITAIS,
      "manutencao",
    );
    expect(resumoDoRascunho(ARVORE, rascunho, originais)).toEqual([
      {
        chave: "aba||editais||situacao",
        onde: "Aba Editais (todas as áreas)",
        campo: "Situação",
        de: "Ativa",
        para: "Em manutenção",
      },
    ]);
    expect(
      linhaDoHistorico(ARVORE, {
        escopo: "aba_area",
        area: "sede",
        aba: "editais",
        campo: "ativo",
        anterior: "S",
        novo: "N",
        motivo: "teste",
        quando: "not a date",
        autor: "adm@agenciasus.org.br",
      }),
    ).toEqual({
      quando: "",
      onde: "Aba Editais em SEDE",
      campo: "Ativo",
      de: "Ativo",
      para: "Desativado",
      motivo: "teste",
      autor: "adm@agenciasus.org.br",
    });
  });
});
