import { describe, expect, it } from "vitest";
import {
  PENDENTE,
  aplicarDatasEmLote,
  analisarCronograma,
  estadoDoCronograma,
  etapasDoModeloPadrao,
  lerLinhaDeDatas,
  novaEtapa,
  situacaoNaLinhaDoTempo,
} from "../src/lib/cronograma-do-edital.js";

const etapa = (atividade, data_inicio, data_fim = data_inicio, ordem = 1) =>
  novaEtapa({ atividade, data_inicio, data_fim }, ordem);

const EDITAL = {
  edital: "10/2026",
  unidade: "DSEI Manaus",
  cronograma_automatico: true,
};

describe("datas coladas em lote", () => {
  it.each([
    ["17/06/2026", "2026-06-17", "2026-06-17"],
    ["17-06-26", "2026-06-17", "2026-06-17"],
    ["18/06/2026 a 20/06/2026", "2026-06-18", "2026-06-20"],
    ["25/06/2026 – 03/07/2026", "2026-06-25", "2026-07-03"],
    ["18 até 20/06/2026", "2026-06-18", "2026-06-20"],
  ])("lê %s", (linha, inicio, fim) => {
    expect(lerLinhaDeDatas(linha)).toEqual({ inicio, fim });
  });

  /*
    O intervalo curto contém uma data completa ("20/06/2026"). Lido como data
    única, o primeiro dia sumia — e era o formato mais comum nos editais.
  */
  it("o intervalo curto não perde o primeiro dia", () => {
    expect(lerLinhaDeDatas("18 a 20/06/2026")).toEqual({
      inicio: "2026-06-18",
      fim: "2026-06-20",
    });
  });

  it("recusa data que não existe", () => {
    expect(lerLinhaDeDatas("31/02/2026")).toBeNull();
    expect(lerLinhaDeDatas("amanhã")).toBeNull();
  });

  it("aplica na ordem e diz o que ficou por preencher", () => {
    const { etapas, aviso } = aplicarDatasEmLote(
      etapasDoModeloPadrao(),
      "17/06/2026",
    );
    expect(etapas[0]).toMatchObject({
      data_inicio: "2026-06-17",
      data_fim: "2026-06-17",
    });
    expect(etapas[1].data_inicio).toBe("");
    expect(aviso).toEqual({
      texto: "1 datas aplicadas. Ainda faltam 11 etapas para preencher.",
      tom: "warning",
    });
  });

  it("não muda nada quando alguma linha não se lê", () => {
    const antes = etapasDoModeloPadrao();
    const { etapas, aviso } = aplicarDatasEmLote(antes, "17/06/2026\nxx");
    expect(etapas).toBe(antes);
    expect(aviso.texto).toBe("Não foi possível interpretar a linha 2.");
  });
});

describe("estado calculado pelo cronograma", () => {
  const etapas = [
    etapa("Inscrições", "2026-09-01", "2026-09-10", 1),
    etapa("Entrevistas", "2026-09-20", "2026-09-25", 2),
  ];

  it("planejado, em andamento e concluído saem só das datas", () => {
    expect(
      estadoDoCronograma(etapas, { hoje: new Date(2026, 7, 1) }),
    ).toMatchObject({
      status: "Planejado",
      etapa: "Aguardando: Inscrições",
    });
    expect(
      estadoDoCronograma(etapas, { hoje: new Date(2026, 8, 15) }),
    ).toMatchObject({
      status: "Em andamento",
      etapa: "Aguardando: Entrevistas",
      proxima: "Entrevistas — 20/09/2026",
      percentual: 50,
    });
    expect(
      estadoDoCronograma(etapas, { hoje: new Date(2026, 9, 1) }),
    ).toMatchObject({
      status: "Concluído",
      percentual: 100,
    });
  });

  it("o status excepcional vence o calculado", () => {
    expect(
      estadoDoCronograma(etapas, {
        hoje: new Date(2026, 8, 15),
        statusExcepcional: "Suspenso",
      }).status,
    ).toBe("Suspenso");
  });

  it("sem automático, ou sem etapa completa, fica pendente", () => {
    expect(estadoDoCronograma(etapas, { automatico: false }).status).toBe(
      PENDENTE,
    );
    expect(estadoDoCronograma([etapa("Sem data", "")]).status).toBe(PENDENTE);
  });
});

describe("validação antes de salvar", () => {
  it("erros impedem salvar", () => {
    const { erros } = analisarCronograma(
      { ...EDITAL, unidade: "", status_override: "Suspenso" },
      [etapa("A", "2026-09-10", "2026-09-01"), etapa("a", "2026-09-11")],
      "",
    );
    expect(erros).toEqual([
      "Informe pelo menos edital e unidade.",
      "Etapa 1: a data final é anterior à inicial.",
      "Etapa 2: atividade duplicada.",
      "Status excepcional exige motivo e data da decisão.",
      "Informe o motivo da alteração do cronograma.",
    ]);
  });

  it("avisos pedem confirmação", () => {
    const { erros, avisos } = analisarCronograma(
      EDITAL,
      [
        etapa("Inscrições", "2025-09-01", "2025-09-10"),
        etapa("Entrevistas", "2026-09-05", "2026-09-06"),
      ],
      "Cadastro inicial",
    );
    expect(erros).toEqual([]);
    expect(avisos).toEqual([
      "Etapa 1: data fora do ano 2026.",
      "O cronograma não possui uma etapa de resultado final.",
    ]);
  });
});

describe("linha do tempo", () => {
  it("marca concluída, em andamento e só a primeira futura como próxima", () => {
    const etapas = [
      etapa("A", "2026-09-01", "2026-09-05"),
      etapa("B", "2026-09-14", "2026-09-16"),
      etapa("C", "2026-09-20"),
      etapa("D", "2026-09-25"),
    ];
    expect(
      etapas.map((item, i) =>
        situacaoNaLinhaDoTempo(item, i, etapas, "2026-09-15"),
      ),
    ).toEqual(["done", "current", "next", "future"]);
  });
});
