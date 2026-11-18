import { describe, expect, it } from "vitest";
import {
  diaDoCalendario,
  gravidade,
  motivosDeAtencao,
  temEtapaEmCurso,
  ultimaMudancaDeEtapa,
} from "../src/lib/visao-geral/criticos-da-visao-geral.ts";

describe("críticos somente por marcação manual", () => {
  const hoje = "2026-11-18";
  it.each([
    { status: "Em andamento", data_fim: "2026-01-01" },
    { status: "Em andamento", etapa: "Entrevistas", inscritos: 0 },
    { status: "Concluído", vagas_total: 50, contratados: 0 },
    { status: "Suspenso", risco: "Alto" },
  ])("indicadores automáticos não marcam o edital: %o", (linha) => {
    expect(motivosDeAtencao(linha, { hoje })).toEqual([]);
  });
  it("mantém motivo e autoria mesmo com atraso e contratação baixa", () => {
    expect(
      motivosDeAtencao(
        {
          status: "Concluído",
          data_fim: "2026-01-01",
          vagas_total: 50,
          contratados: 0,
        },
        {
          hoje,
          marcacao: {
            motivo: "Cronograma suspenso pela diretoria",
            quem: "Ana Souza",
          },
        },
      ),
    ).toEqual([
      {
        codigo: "marcado",
        rotulo:
          "Marcado como crítico por Ana Souza: Cronograma suspenso pela diretoria",
        tom: "perigo",
      },
    ]);
  });
  it("sem marcação, motivo vazio ou edital ausente não é crítico", () => {
    for (const marcacao of [null, {}, { motivo: "   " }])
      expect(motivosDeAtencao({ status: "Suspenso" }, { marcacao })).toEqual(
        [],
      );
    expect(
      motivosDeAtencao(null, { marcacao: { motivo: "Banca sem quórum" } }),
    ).toEqual([]);
  });
  it("cancelado não entra e retirar a marcação retira o crítico", () => {
    const marcacao = { motivo: "Banca sem quórum" };
    expect(
      motivosDeAtencao({ status: "Em andamento" }, { marcacao }),
    ).toHaveLength(1);
    expect(
      motivosDeAtencao({ status: "Em andamento" }, { marcacao: null }),
    ).toEqual([]);
    expect(motivosDeAtencao({ status: "Cancelado" }, { marcacao })).toEqual([]);
  });
  it("a marcação tem prioridade na fila", () => {
    expect(
      gravidade(
        motivosDeAtencao(
          { status: "Suspenso" },
          {
            marcacao: { motivo: "Cronograma suspenso" },
          },
        ),
      ),
    ).toBe(0);
    expect(gravidade([])).toBe(99);
  });
});

describe("utilitários de datas preservados", () => {
  const etapas = [{ data_inicio: "2026-09-01", data_fim: "2026-09-16" }];
  it("respeita os dias e os limites inclusivos da etapa", () => {
    expect(temEtapaEmCurso(etapas, "2026-09-16")).toBe(true);
    expect(temEtapaEmCurso(etapas, "2026-09-17")).toBe(false);
    expect(ultimaMudancaDeEtapa(etapas, "2026-09-18")).toBe(
      diaDoCalendario("2026-09-17"),
    );
  });
  it("data ausente não vira o início do calendário", () => {
    expect(temEtapaEmCurso(etapas, null)).toBe(false);
    expect(ultimaMudancaDeEtapa(etapas, "sem data")).toBeNull();
  });
});
