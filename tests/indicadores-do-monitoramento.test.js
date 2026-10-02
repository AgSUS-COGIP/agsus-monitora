import { describe, expect, it } from "vitest";
import {
  contratacoesDoCadastroReserva,
  contratadasImediatas,
  ehCancelado,
  ehConcluido,
  ehEditalEncerrado,
  indicadoresDoMonitoramento,
  somarCampo,
  temResultado,
  vagasSemContratacao,
} from "../src/lib/indicadores-do-monitoramento.js";

/*
  Os KPIs da Visão geral fecham: Vagas imediatas = Contratadas + Em seleção +
  Ociosas. Os casos são os da leitura de 02/10/2026 (analise.md): FGV da SEDE
  com 567 contratados para 130 vagas (cadastro reserva), 81/2026 concluído
  com 1 contratado de 83, editais só de cadastro reserva (vagas 0) e
  cancelados com inscritos antigos.
*/

const SEDE = [
  // FGV: concluído, mais contratados que vagas → 130 contratadas + 437 CR.
  {
    id: "fgv",
    edital: "FGV",
    status: "Concluído",
    vagas_total: 130,
    contratados: 567,
    inscritos: 0,
  },
  // 35/2025: concluído, 7 contratados para 4 vagas.
  {
    id: "35",
    edital: "35/2025",
    status: "Concluido",
    vagas_total: 4,
    contratados: 7,
    inscritos: 300,
  },
  // 81/2026: concluído com 1 de 83 → 82 ociosas.
  {
    id: "81",
    edital: "81/2026",
    status: "Concluído",
    vagas_total: 83,
    contratados: 1,
    inscritos: 3055,
  },
  // 91/2026: em andamento, nenhum contratado → 27 em seleção.
  {
    id: "91",
    edital: "91/2026",
    status: "Em andamento",
    vagas_total: 27,
    contratados: 0,
    inscritos: 3961,
  },
  // 70/2025: só cadastro reserva (vagas 0) → 22 de CR, nada nas vagas.
  {
    id: "70",
    edital: "70/2025",
    status: "Concluído",
    vagas_total: 0,
    contratados: 22,
    inscritos: 500,
  },
  // 81/2025: cancelado com inscritos antigos → fora de tudo.
  {
    id: "c",
    edital: "81/2025",
    status: "Cancelado",
    vagas_total: 10,
    contratados: 0,
    inscritos: 1389,
  },
];

describe("as contas da faixa de indicadores fecham", () => {
  it("Vagas imediatas = Contratadas + Em seleção + Ociosas; CR à parte; cancelado fora", () => {
    const k = indicadoresDoMonitoramento(SEDE);
    expect(k).toEqual({
      processos: 6,
      vagas: 130 + 4 + 83 + 27 + 0,
      contratadas: 130 + 4 + 1 + 0 + 0,
      emSelecao: 27,
      ociosas: 82,
      cadastroReserva: 437 + 3 + 22,
      criticos: 0,
      inscritos: 0 + 300 + 3055 + 3961 + 500,
    });
    expect(k.contratadas + k.emSelecao + k.ociosas).toBe(k.vagas);
  });

  it("o caso da leitura: a soma simples de antes não fechava, a de agora fecha", () => {
    const validas = SEDE.slice(0, 5);
    // Antes: Σ contratados (com CR) e Σ max(vagas − contratados, 0).
    const contratadosAntes = somarCampo(validas, "contratados");
    const ociosasAntes = validas.reduce(
      (soma, l) => soma + Math.max(0, l.vagas_total - l.contratados),
      0,
    );
    const vagas = somarCampo(validas, "vagas_total");
    expect(vagas - contratadosAntes).not.toBe(ociosasAntes);
    const k = indicadoresDoMonitoramento(validas);
    expect(k.vagas - k.contratadas).toBe(k.emSelecao + k.ociosas);
  });

  it("fase Contratação conta como resultado (ociosa); em andamento sem ela, em seleção", () => {
    const contratacao = {
      status: "Em andamento",
      etapa: "Convocação para admissão",
      vagas_total: 10,
      contratados: 4,
    };
    const analise = { ...contratacao, etapa: "Análise Curricular" };
    expect(temResultado(contratacao)).toBe(true);
    expect(temResultado(analise)).toBe(false);
    expect(indicadoresDoMonitoramento([contratacao, analise])).toMatchObject({
      vagas: 20,
      contratadas: 8,
      ociosas: 6,
      emSelecao: 6,
    });
  });

  it("Críticos conta as linhas com motivo de atenção (o recorte preenche `atencao`)", () => {
    const linhas = [
      { status: "Em andamento", atencao: [{ codigo: "prazo" }] },
      { status: "Em andamento", atencao: [] },
      { status: "Concluído" },
    ];
    expect(indicadoresDoMonitoramento(linhas).criticos).toBe(1);
  });

  it("sem linhas, tudo zero", () => {
    expect(indicadoresDoMonitoramento(undefined)).toEqual({
      processos: 0,
      vagas: 0,
      contratadas: 0,
      emSelecao: 0,
      ociosas: 0,
      cadastroReserva: 0,
      criticos: 0,
      inscritos: 0,
    });
  });
});

describe("por edital", () => {
  it("contratadas, cadastro reserva e vagas sem contratação", () => {
    const fgv = SEDE[0];
    expect(contratadasImediatas(fgv)).toBe(130);
    expect(contratacoesDoCadastroReserva(fgv)).toBe(437);
    expect(vagasSemContratacao(fgv)).toBe(0);
    expect(vagasSemContratacao(SEDE[2])).toBe(82);
    expect(contratadasImediatas({ vagas_total: "x", contratados: null })).toBe(
      0,
    );
  });

  it("status em qualquer grafia", () => {
    expect(ehConcluido({ status: "Concluido" })).toBe(true);
    expect(ehConcluido({ status: "ConcluÃ­do" })).toBe(true);
    expect(ehCancelado({ status: "Cancelada" })).toBe(true);
    expect(ehEditalEncerrado({ status: "Em elaboração" })).toBe(false);
    expect(ehEditalEncerrado(null)).toBe(false);
  });

  it("soma ignora vazio e texto", () => {
    expect(somarCampo([{ v: 2 }, { v: "x" }, {}, { v: "3" }], "v")).toBe(5);
  });
});
