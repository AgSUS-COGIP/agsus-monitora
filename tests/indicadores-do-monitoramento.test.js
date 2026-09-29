import { describe, expect, it } from "vitest";
import {
  ehEditalEncerrado,
  ehRiscoAtivo,
  indicadoresDoMonitoramento,
  somarCampo,
} from "../src/lib/indicadores-do-monitoramento.js";

/*
  A conta da faixa de indicadores é uma só para a Visão geral da Saúde
  Indígena (legado) e para a da SEDE e de Projetos (React).
*/
const LINHAS = [
  {
    status: "Em andamento",
    risco: "Alto",
    vagas_total: 10,
    contratados: 4,
    vagas_ociosas: 6,
    inscritos: 120,
  },
  {
    status: "Em andamento",
    risco: " médio ",
    vagas_total: "5",
    contratados: 5,
    vagas_ociosas: 0,
    inscritos: 30,
  },
  // Encerrado com risco alto não é crítico: não há mais o que salvar.
  {
    status: "Concluído",
    risco: "Alto",
    vagas_total: 3,
    contratados: null,
    vagas_ociosas: 3,
    inscritos: "",
  },
  { status: "cancelada", risco: "Baixo", vagas_total: "abc" },
];

describe("indicadores do monitoramento", () => {
  it("conta os seis números da faixa", () => {
    expect(indicadoresDoMonitoramento(LINHAS)).toEqual({
      processos: 4,
      vagas: 18,
      contratados: 9,
      ociosas: 9,
      criticos: 2,
      inscritos: 150,
    });
  });

  it("sem linhas, tudo zero", () => {
    expect(indicadoresDoMonitoramento(undefined)).toEqual({
      processos: 0,
      vagas: 0,
      contratados: 0,
      ociosas: 0,
      criticos: 0,
      inscritos: 0,
    });
  });

  it("encerrado é concluído ou cancelado, com ou sem acento", () => {
    expect(ehEditalEncerrado({ status: "Concluido" })).toBe(true);
    expect(ehEditalEncerrado({ status: "Cancelado" })).toBe(true);
    expect(ehEditalEncerrado({ status: "Em elaboração" })).toBe(false);
    expect(ehEditalEncerrado(null)).toBe(false);
  });

  it("crítico é risco médio ou alto num edital aberto", () => {
    expect(LINHAS.map(ehRiscoAtivo)).toEqual([true, true, false, false]);
  });

  it("soma ignorando vazio e texto", () => {
    expect(somarCampo(LINHAS, "vagas_total")).toBe(18);
    expect(somarCampo(null, "vagas_total")).toBe(0);
  });
});
