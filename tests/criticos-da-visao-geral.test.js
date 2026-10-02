import { describe, expect, it } from "vitest";
import {
  diaDoCalendario,
  gravidade,
  LIMITES_DO_CRITICO,
  motivosDeAtencao,
  temEtapaEmCurso,
  ultimaMudancaDeEtapa,
} from "../src/lib/criticos-da-visao-geral.js";

/*
  O crítico calculado da Visão geral: cada motivo isolado, com os casos da
  leitura de 02/10/2026 (analise.md): 97/2026 Maranhão com etapa perto,
  108/2026 em andamento sem inscritos, 81/2026 concluído com 1 de 83,
  79/2026 concluído com 0 de 50, risco manual "Baixo" em tudo.
*/

const HOJE = "2026-10-02";
const aberto = (extra = {}) => ({
  status: "Em andamento",
  risco: "Baixo",
  cronograma_automatico: true,
  etapa: "Entrevistas",
  inscritos: 100,
  vagas_total: 10,
  contratados: 0,
  data_fim: "2026-12-01",
  ...extra,
});
const codigos = (linha, opcoes = {}) =>
  motivosDeAtencao(linha, { hoje: HOJE, ...opcoes }).map((m) => m.codigo);

describe("cada motivo", () => {
  it("etapa chegando (hoje, amanhã, em até 3 dias) é agenda, não crítico", () => {
    for (const dias of [0, 1, 3, 5, null])
      expect(codigos(aberto({ cronograma_dias_para_proxima: dias }))).toEqual(
        [],
      );
  });

  it("atrasada: o fim do cronograma passou e o edital não concluiu", () => {
    expect(
      motivosDeAtencao(aberto({ data_fim: "2026-09-27" }), { hoje: HOJE }),
    ).toEqual([
      { codigo: "atrasada", rotulo: "Etapa atrasada há 5 dias", tom: "perigo" },
    ]);
    expect(codigos(aberto({ data_fim: "2026-10-01" }))).toEqual(["atrasada"]);
    expect(
      motivosDeAtencao(aberto({ data_fim: "2026-10-01" }), { hoje: HOJE })[0]
        .rotulo,
    ).toBe("Etapa atrasada há 1 dia");
    expect(codigos(aberto({ data_fim: HOJE }))).toEqual([]);
  });

  it("parado: sem etapa em curso e sem mudança de etapa há 15 dias ou mais", () => {
    const etapas = [
      {
        atividade: "Inscrições",
        data_inicio: "2026-08-01",
        data_fim: "2026-08-20",
      },
      {
        atividade: "Análise",
        data_inicio: "2026-08-21",
        data_fim: "2026-09-16",
      },
      {
        atividade: "Entrevistas",
        data_inicio: "2026-10-20",
        data_fim: "2026-10-30",
      },
    ];
    // Última mudança: 17/09 (dia seguinte ao fim da análise) → 15 dias.
    expect(ultimaMudancaDeEtapa(etapas, HOJE)).toBe(
      diaDoCalendario("2026-09-17"),
    );
    expect(temEtapaEmCurso(etapas, HOJE)).toBe(false);
    expect(
      motivosDeAtencao(aberto({ etapa: "Aguardando: Entrevistas" }), {
        hoje: HOJE,
        etapas,
      }),
    ).toEqual([
      { codigo: "parado", rotulo: "Parado há 15 dias", tom: "alerta" },
    ]);
    // 14 dias ainda não.
    expect(
      codigos(aberto({ etapa: "Aguardando: Entrevistas" }), {
        hoje: "2026-10-01",
        etapas,
      }),
    ).toEqual([]);
    // Etapa em curso não é parado, por mais longa que seja.
    const longa = [
      {
        atividade: "Análise",
        data_inicio: "2026-08-01",
        data_fim: "2026-11-30",
      },
    ];
    expect(codigos(aberto(), { etapas: longa })).toEqual([]);
    // Sem as etapas (banco sem a função), não é avaliado.
    expect(codigos(aberto({ etapa: "Aguardando: Entrevistas" }))).toEqual([]);
  });

  it("sem inscritos: em andamento, depois das inscrições, 0 inscritos", () => {
    // 108/2026: em andamento sem Seleção.
    expect(
      motivosDeAtencao(aberto({ etapa: "Análise Curricular", inscritos: 0 }), {
        hoje: HOJE,
      }),
    ).toEqual([
      { codigo: "sem_inscritos", rotulo: "Sem inscritos", tom: "alerta" },
    ]);
    // Ainda nas inscrições (ou antes), não.
    expect(
      codigos(aberto({ etapa: "Período de inscrição", inscritos: 0 })),
    ).toEqual([]);
    expect(
      codigos(
        aberto({
          status: "Planejado",
          etapa: "Aguardando: Edital",
          inscritos: 0,
        }),
      ),
    ).toEqual([]);
  });

  it("contratação baixa: concluído com menos de 50% das vagas imediatas contratadas", () => {
    // 81/2026: 1 de 83.
    expect(
      motivosDeAtencao(
        { status: "Concluído", vagas_total: 83, contratados: 1 },
        { hoje: HOJE },
      ),
    ).toEqual([
      {
        codigo: "contratacao_baixa",
        rotulo: "Contratação abaixo de 50%",
        tom: "alerta",
      },
    ]);
    // 79/2026: 0 de 50.
    expect(
      codigos({ status: "Concluído", vagas_total: 50, contratados: 0 }),
    ).toEqual(["contratacao_baixa"]);
    // Metade ou mais, não; vagas 0 (só cadastro reserva), não.
    expect(
      codigos({ status: "Concluído", vagas_total: 10, contratados: 5 }),
    ).toEqual([]);
    expect(
      codigos({ status: "Concluído", vagas_total: 0, contratados: 22 }),
    ).toEqual([]);
    // CR não ajuda as imediatas: 130 vagas, 567 contratados é 100%.
    expect(
      codigos({ status: "Concluído", vagas_total: 130, contratados: 567 }),
    ).toEqual([]);
  });
});

describe("regras gerais", () => {
  it("o risco manual não entra; cancelado nunca é crítico", () => {
    expect(codigos(aberto({ risco: "Alto" }))).toEqual([]);
    expect(
      codigos({
        status: "Cancelado",
        data_fim: "2026-01-01",
        cronograma_dias_para_proxima: 1,
        inscritos: 0,
      }),
    ).toEqual([]);
  });

  it("vários motivos, do mais grave ao menos grave; a gravidade ordena a tabela", () => {
    const motivos = motivosDeAtencao(
      aberto({
        etapa: "Análise Curricular",
        inscritos: 0,
        data_fim: "2026-09-30",
        cronograma_dias_para_proxima: 2,
      }),
      { hoje: HOJE },
    );
    expect(motivos.map((m) => m.codigo)).toEqual(["atrasada", "sem_inscritos"]);
    expect(gravidade(motivos)).toBe(1);
    expect(gravidade([])).toBe(99);
  });

  it("os limites são configuráveis", () => {
    expect(LIMITES_DO_CRITICO).toEqual({
      diasDoPrazo: 3,
      diasParado: 15,
      contratacaoMinima: 0.5,
    });
    const limites = { ...LIMITES_DO_CRITICO, contratacaoMinima: 0.8 };
    expect(
      motivosDeAtencao(
        { status: "Concluído", vagas_total: 10, contratados: 7 },
        { hoje: HOJE, limites },
      )[0].rotulo,
    ).toBe("Contratação abaixo de 80%");
  });
});
