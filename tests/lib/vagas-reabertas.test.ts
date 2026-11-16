import { describe, expect, it } from "vitest";
import {
  calcularReaberturas,
  cargosDaResposta,
  chaveDoCargo,
  textoDaReabertura,
} from "../../src/lib/vagas-reabertas.ts";
import {
  indicadoresDoMonitoramento,
  vagasEfetivas,
  vagasSemContratacao,
} from "../../src/lib/indicadores-do-monitoramento.ts";
import {
  acompanhamentoDaResposta,
  enriquecerLinhas,
} from "../../src/lib/visao-geral.ts";
import type { LinhaDoMonitoramento } from "../../src/modulos/visao-geral/tipos.ts";

const edital = (
  campos: Partial<LinhaDoMonitoramento>,
): LinhaDoMonitoramento => ({
  unidade: "DSEI Altamira",
  sigla_unidade: "ALT",
  status: "Concluído",
  contratados: 0,
  ...campos,
});

/* Cargos por edital: cargo → vagas do quadro (null = sem quadro). */
const cargos = (porEdital: Record<string, Record<string, number | null>>) =>
  new Map(
    Object.entries(porEdital).map(([id, c]) => [
      id,
      new Map(Object.entries(c)),
    ]),
  );

describe("chaveDoCargo", () => {
  it("compara o cargo sem lotação, cota, parênteses, carga horária nem cadastro reserva", () => {
    expect(chaveDoCargo("Enfermeiro - PPP")).toBe("enfermeiro");
    expect(chaveDoCargo("Enfermeiro - Pólo Base Aquidauana")).toBe(
      "enfermeiro",
    );
    expect(chaveDoCargo("Antropólogo - Cadastro Reserva")).toBe("antropologo");
    expect(chaveDoCargo("Cirurgião Dentista (40h) -")).toBe(
      "cirurgiao dentista",
    );
    expect(chaveDoCargo("Cirurgião Dentista 40h -")).toBe("cirurgiao dentista");
    expect(chaveDoCargo("Analista Técnico em Saúde Indígena")).toBe(
      chaveDoCargo("Analista Técnico de Saúde Indígena"),
    );
    expect(
      chaveDoCargo("1 | Analista Técnico de Saúde Indígena - Aracruz/ES"),
    ).toBe("analista tecnico saude indigena");
    expect(chaveDoCargo("")).toBe("");
  });
});

describe("cargosDaResposta", () => {
  it("soma o quadro por cargo e acrescenta os cargos da Seleção sem quantidade", () => {
    const porEdital = cargosDaResposta({
      quadro: [
        {
          monitoramento_id: "a",
          cargo: "Enfermeiro",
          lotacao: "Polo 1",
          vagas: 2,
        },
        {
          monitoramento_id: "a",
          cargo: "Enfermeiro",
          lotacao: "Polo 2",
          vagas: 1,
        },
      ],
      vagas: [
        {
          monitoramento_id: "a",
          codigo: "1",
          vaga: "1",
          cargo: "Enfermeiro - PPP",
        },
        { monitoramento_id: "a", codigo: "2", vaga: "2", cargo: "Psicólogo" },
        // Só o código, sem cargo: não serve para comparar.
        { monitoramento_id: "b", codigo: "3", vaga: "117222", cargo: "" },
      ],
      lista: [],
    });
    expect(porEdital.get("a")).toEqual(
      new Map([
        ["enfermeiro", 3],
        ["psicologo", null],
      ]),
    );
    expect(porEdital.has("b")).toBe(false);
  });

  it("resposta torta vira mapa vazio", () => {
    expect(cargosDaResposta(null).size).toBe(0);
    expect(cargosDaResposta([1, 2]).size).toBe(0);
    expect(cargosDaResposta({ vagas: "x", quadro: [null] }).size).toBe(0);
  });
});

describe("calcularReaberturas", () => {
  const antigo = edital({
    id: "e1",
    edital: "78/2025",
    data_inicio: "2025-10-27",
    data_fim: "2025-12-08",
    vagas_total: 10,
    contratados: 4,
  });
  const novo = edital({
    id: "e2",
    edital: "79/2026",
    status: "Em andamento",
    data_inicio: "2026-06-26",
    data_fim: "2026-09-23",
    vagas_total: 50,
  });
  const mesmoCargo = cargos({
    e1: { enfermeiro: null, psicologo: null },
    e2: { enfermeiro: null },
  });

  it("a vaga sem contratação reaberta no edital mais novo do mesmo DSEI conta só no novo", () => {
    const r = calcularReaberturas([antigo, novo], mesmoCargo);
    expect(r.get("e1")).toEqual({
      reabertas: 6,
      reabertasEm: [{ edital: "79/2026", vagas: 6 }],
      reabre: [],
    });
    expect(r.get("e2")).toEqual({
      reabertas: 0,
      reabertasEm: [],
      reabre: [{ edital: "78/2025", vagas: 6 }],
    });
  });

  it("cargo diferente, outra unidade, edital cancelado ou sem cargos: a vaga é nova", () => {
    expect(
      calcularReaberturas(
        [antigo, novo],
        cargos({ e1: { enfermeiro: null }, e2: { sanitarista: null } }),
      ).size,
    ).toBe(0);
    expect(
      calcularReaberturas(
        [antigo, { ...novo, unidade: "DSEI Xingu", sigla_unidade: "XIN" }],
        mesmoCargo,
      ).size,
    ).toBe(0);
    expect(
      calcularReaberturas(
        [antigo, { ...novo, status: "Cancelado" }],
        mesmoCargo,
      ).size,
    ).toBe(0);
    expect(
      calcularReaberturas([antigo, novo], cargos({ e1: { enfermeiro: null } }))
        .size,
    ).toBe(0);
    expect(calcularReaberturas([antigo, novo], null).size).toBe(0);
  });

  it("só reabre o edital que já tinha resultado e terminou antes do novo começar", () => {
    // Os dois ao mesmo tempo: não é reabertura.
    expect(
      calcularReaberturas(
        [antigo, { ...novo, data_inicio: "2025-11-01" }],
        mesmoCargo,
      ).size,
    ).toBe(0);
    // O antigo ainda sem resultado: as vagas dele estão em seleção, não sobraram.
    expect(
      calcularReaberturas(
        [{ ...antigo, status: "Em andamento" }, novo],
        mesmoCargo,
      ).size,
    ).toBe(0);
    // O antigo contratou tudo: o novo é necessidade nova (reposição).
    expect(
      calcularReaberturas([{ ...antigo, contratados: 12 }, novo], mesmoCargo)
        .size,
    ).toBe(0);
  });

  it("o novo reabre até as vagas dele nos cargos em comum, pelo quadro", () => {
    const r = calcularReaberturas(
      [antigo, novo],
      cargos({
        e1: { enfermeiro: null, psicologo: null },
        e2: { enfermeiro: 2, sanitarista: 40 },
      }),
    );
    expect(r.get("e1")?.reabertas).toBe(2);
  });

  it("a vaga que sobrou de um edital reaberto em outro segue a cadeia", () => {
    const primeiro = edital({
      id: "e0",
      edital: "14/2025",
      data_inicio: "2025-06-09",
      data_fim: "2025-08-20",
      vagas_total: 30,
      contratados: 24,
    });
    const r = calcularReaberturas(
      [primeiro, antigo],
      cargos({ e0: { enfermeiro: null }, e1: { enfermeiro: null } }),
    );
    expect(r.get("e0")?.reabertas).toBe(6);
    expect(r.get("e1")?.reabre).toEqual([{ edital: "14/2025", vagas: 6 }]);
  });

  it("sem quadro, o novo reabre até o total dele, do antigo mais recente para o mais velho", () => {
    // Termina depois do 78/2025 começar: só o 79/2026 o reabre.
    const outroAntigo = edital({
      id: "e0",
      edital: "14/2025",
      data_inicio: "2025-06-09",
      data_fim: "2025-11-01",
      vagas_total: 30,
      contratados: 24,
    });
    const r = calcularReaberturas(
      [outroAntigo, antigo, { ...novo, vagas_total: 8 }],
      cargos({
        e0: { enfermeiro: null },
        e1: { enfermeiro: null },
        e2: { enfermeiro: null },
      }),
    );
    expect(r.get("e1")?.reabertas).toBe(6);
    expect(r.get("e0")?.reabertas).toBe(2);
    expect(r.get("e2")?.reabre).toEqual([
      { edital: "78/2025", vagas: 6 },
      { edital: "14/2025", vagas: 2 },
    ]);
  });

  it("a vaga reaberta de novo passa adiante: conta só no edital mais recente", () => {
    const terceiro = edital({
      id: "e3",
      edital: "120/2026",
      status: "Em andamento",
      data_inicio: "2026-10-01",
      vagas_total: 3,
    });
    const r = calcularReaberturas(
      [antigo, { ...novo, status: "Concluído", vagas_total: 6 }, terceiro],
      cargos({
        e1: { enfermeiro: null },
        e2: { enfermeiro: null },
        e3: { enfermeiro: null },
      }),
    );
    expect(r.get("e1")?.reabertas).toBe(6);
    expect(r.get("e2")?.reabertas).toBe(3);
    /*
      Vagas: 10 + 6 + 3 = 19 publicadas. Contam 4 contratadas (78/2025), 3
      ociosas (as do 79/2026 que o 120/2026 não reabriu) e 3 em seleção = 10.
    */
    const linhas = [
      antigo,
      { ...novo, status: "Concluído", vagas_total: 6 },
      terceiro,
    ].map((l) => ({
      ...l,
      vagas_reabertas: r.get(String(l.id))?.reabertas ?? 0,
    }));
    const k = indicadoresDoMonitoramento(linhas);
    expect(k.vagas).toBe(10);
    expect(k.reabertas).toBe(9);
    expect(k.contratadas + k.emSelecao + k.ociosas).toBe(k.vagas);
  });
});

describe("indicadores com vagas reabertas", () => {
  it("a vaga reaberta sai das vagas e das ociosas do edital antigo; contratadas não mudam", () => {
    const linha = edital({
      vagas_total: 10,
      contratados: 4,
      vagas_reabertas: 6,
    });
    expect(vagasEfetivas(linha)).toBe(4);
    expect(vagasSemContratacao(linha)).toBe(0);
    const k = indicadoresDoMonitoramento([
      linha,
      edital({ status: "Em andamento", vagas_total: 50 }),
    ]);
    expect(k).toMatchObject({
      vagas: 54,
      reabertas: 6,
      contratadas: 4,
      ociosas: 0,
      emSelecao: 50,
    });
  });

  it("sem reabertura, nada muda", () => {
    const k = indicadoresDoMonitoramento([
      edital({ vagas_total: 10, contratados: 4 }),
    ]);
    expect(k).toMatchObject({
      vagas: 10,
      reabertas: 0,
      contratadas: 4,
      ociosas: 6,
    });
  });
});

describe("Visão geral com os cargos das vagas", () => {
  it("o acompanhamento traz os cargos e o enriquecimento marca as reabertas", () => {
    const acompanhamento = acompanhamentoDaResposta({
      etapas: [],
      listas: [],
      vagas_por_cargo: {
        vagas: [
          { monitoramento_id: "e1", cargo: "Enfermeiro" },
          { monitoramento_id: "e2", cargo: "Enfermeiro - PPP" },
        ],
        quadro: [],
        lista: [],
      },
    });
    const [velho, novo] = enriquecerLinhas(
      [
        edital({
          id: "e1",
          edital: "78/2025",
          data_inicio: "2025-10-27",
          data_fim: "2025-12-08",
          vagas_total: 10,
          contratados: 4,
        }),
        edital({
          id: "e2",
          edital: "79/2026",
          status: "Em andamento",
          data_inicio: "2026-06-26",
          vagas_total: 50,
        }),
      ],
      { hoje: "2026-11-16", acompanhamento },
    );
    expect(velho?.vagas_reabertas).toBe(6);
    expect(velho?.reabertas_em).toEqual([{ edital: "79/2026", vagas: 6 }]);
    expect(novo?.vagas_reabertas).toBe(0);
    expect(novo?.reabre).toEqual([{ edital: "78/2025", vagas: 6 }]);
  });

  it("sem os cargos (leitura falhou), as vagas ficam como cada edital publicou", () => {
    const acompanhamento = acompanhamentoDaResposta({ etapas: [], listas: [] });
    expect(acompanhamento?.cargosPorEdital).toBeUndefined();
    const [linha] = enriquecerLinhas([edital({ id: "e1", vagas_total: 10 })], {
      acompanhamento,
    });
    expect(linha?.vagas_reabertas).toBe(0);
  });
});

describe("textoDaReabertura", () => {
  it("uma linha para os detalhes do edital", () => {
    expect(
      textoDaReabertura([{ edital: "79/2026", vagas: 12 }], "reabertas"),
    ).toBe("12 vagas reabertas no edital 79/2026");
    expect(
      textoDaReabertura([{ edital: "79/2026", vagas: 1 }], "reabertas"),
    ).toBe("1 vaga reaberta no edital 79/2026");
    expect(
      textoDaReabertura(
        [
          { edital: "78/2025", vagas: 6 },
          { edital: "14/2025", vagas: 2 },
        ],
        "reabre",
      ),
    ).toBe("Reabre 8 vagas dos editais 78/2025 e 14/2025");
    expect(
      textoDaReabertura(
        [
          { edital: "1/2025", vagas: 1 },
          { edital: "2/2025", vagas: 1 },
        ],
        "reabertas",
      ),
    ).toBe("2 vagas reabertas nos editais 1/2025 e 2/2025");
    expect(textoDaReabertura([], "reabre")).toBe("");
    expect(textoDaReabertura(undefined, "reabre")).toBe("");
  });
});
