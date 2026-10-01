import { describe, expect, it } from "vitest";
import {
  agruparAprovadosSemEntrevista,
  calcularIndicadores,
  contagemPorComparecimento,
  contagemPorParecer,
  csvDasEntrevistas,
  dataHoraBR,
  faixasDeNota,
  FILTROS_VAZIOS,
  filtrarAprovadosSemEntrevista,
  filtrarEntrevistas,
  formatarNota,
  mediaPorCriterio,
  normalizarPayload,
  notaDivergente,
  opcoesDosFiltros,
  pendenciasDasEntrevistas,
  rotuloCurtoDoCriterio,
  topUnidades,
} from "../src/lib/entrevistas-do-painel.js";

const CRITERIOS = [
  "HABILIDADE TÉCNICA INTERCULTURAL (Conhecimentos sobre a saúde indígena)",
  "COMUNICAÇÃO (Clareza, objetividade)",
  "POSTURA",
];

function entrevista(extra = {}) {
  return {
    id: "e1",
    edital_id: "m1",
    edital: "Edital 01/2026",
    edital_planilha: "01/2026",
    unidade: "DSEI Yanomami",
    vaga: "V1",
    cargo: "Enfermeiro",
    candidato: "Ana Clara",
    codigo: "C1",
    modalidade: "Ampla",
    nota: 12,
    parecer: "APTO",
    compareceu: "S",
    link: "https://docs.google.com/x",
    notas: [
      [0, 4],
      [1, 4],
      [2, 4],
    ],
    analise: {
      id: "a1",
      ligacao: "codigo",
      nota: 70,
      resultado: "Aprovado",
      etapa: "Final",
      responsavel: "Fulano",
      ativo: true,
    },
    ...extra,
  };
}

const PAYLOAD = {
  schema_version: 1,
  area: "saude-indigena",
  gerado_em: "2026-09-29T12:00:00Z",
  ultima_carga: {
    em: "2026-09-29T10:30:00",
    linhas: 4,
    ligadas_analise: 3,
    sem_analise: 1,
    sem_edital: 1,
  },
  criterios: CRITERIOS,
  entrevistas: [
    entrevista(),
    entrevista({
      id: "e2",
      candidato: "Bruno Érico",
      codigo: "C2",
      nota: 18,
      notas: [
        [0, 5],
        [1, 5],
        [2, 5],
      ],
      unidade: "DSEI Xingu",
    }),
    entrevista({
      id: "e3",
      candidato: "Carla",
      codigo: null,
      vaga: "V2",
      nota: 4,
      parecer: "INAPTO",
      notas: [],
      analise: null,
      edital_id: null,
    }),
    entrevista({
      id: "e4",
      candidato: "Davi",
      codigo: "C4",
      vaga: "V2",
      nota: null,
      parecer: "qualquer",
      compareceu: "N",
      notas: [],
      modalidade: null,
    }),
  ],
  aprovados_sem_entrevista: [
    {
      analise_id: "a9",
      candidato: "Eva",
      codigo: "C9",
      vaga: "V1",
      cargo: "Enfermeiro",
      edital: "Edital 01/2026",
      unidade: "DSEI Yanomami",
      nota: 80,
      modalidade: "Ampla",
    },
    {
      analise_id: "a10",
      candidato: "Fábio",
      codigo: "C10",
      vaga: "V2",
      cargo: "Médico",
      edital: "Edital 01/2026",
      unidade: "DSEI Xingu",
      nota: 75,
      modalidade: "PcD",
    },
  ],
};

describe("rótulo curto do critério", () => {
  it("corta no primeiro ' (' e mantém o texto sem parênteses", () => {
    expect(rotuloCurtoDoCriterio(CRITERIOS[0])).toBe(
      "HABILIDADE TÉCNICA INTERCULTURAL",
    );
    expect(rotuloCurtoDoCriterio("POSTURA")).toBe("POSTURA");
    expect(rotuloCurtoDoCriterio(null)).toBe("");
  });
});

describe("normalização do payload", () => {
  const dados = normalizarPayload(PAYLOAD);

  it("resolve as notas pelos índices dos critérios", () => {
    const [primeira] = dados.entrevistas;
    expect(primeira.notas).toEqual([
      {
        indice: 0,
        criterio: CRITERIOS[0],
        curto: "HABILIDADE TÉCNICA INTERCULTURAL",
        nota: 4,
      },
      { indice: 1, criterio: CRITERIOS[1], curto: "COMUNICAÇÃO", nota: 4 },
      { indice: 2, criterio: CRITERIOS[2], curto: "POSTURA", nota: 4 },
    ]);
    expect(primeira.somaDasNotas).toBe(12);
    expect(primeira.divergente).toBe(false);
  });

  it("marca divergência, sem edital, parecer desconhecido e ultima carga", () => {
    const [, segunda, terceira, quarta] = dados.entrevistas;
    expect(segunda.divergente).toBe(true); // 18 x 15
    expect(terceira.semEdital).toBe(true);
    expect(terceira.divergente).toBe(false); // sem notas
    expect(quarta.parecer).toBe("SEM_PARECER");
    expect(dados.ultimaCarga.linhas).toBe(4);
    expect(dados.aprovadosSemEntrevista).toHaveLength(2);
  });

  it("aguenta payload vazio", () => {
    const vazio = normalizarPayload(null);
    expect(vazio.entrevistas).toEqual([]);
    expect(vazio.criterios).toEqual([]);
    expect(vazio.ultimaCarga).toBeNull();
  });

  it("tolera diferença de até 0,05 na soma", () => {
    expect(notaDivergente(12.04, [{ nota: 4 }, { nota: 8 }])).toBe(false);
    expect(notaDivergente(12.06, [{ nota: 4 }, { nota: 8 }])).toBe(true);
    expect(notaDivergente(12, [])).toBe(false);
    expect(notaDivergente(null, [{ nota: 1 }])).toBe(false);
  });
});

describe("filtros", () => {
  const { entrevistas, aprovadosSemEntrevista } = normalizarPayload(PAYLOAD);
  const filtrar = (f) =>
    filtrarEntrevistas(entrevistas, { ...FILTROS_VAZIOS, ...f }).map(
      (e) => e.id,
    );

  it("busca por nome (sem acento) e código", () => {
    expect(filtrar({ busca: "erico" })).toEqual(["e2"]);
    expect(filtrar({ busca: "c4" })).toEqual(["e4"]);
  });

  it("parecer, comparecimento, modalidade e ligação", () => {
    expect(filtrar({ parecer: "INAPTO" })).toEqual(["e3"]);
    expect(filtrar({ comparecimento: "N" })).toEqual(["e4"]);
    expect(filtrar({ comparecimento: "NI" })).toEqual([]);
    expect(filtrar({ ligacao: "sem_analise" })).toEqual(["e3"]);
    expect(filtrar({ ligacao: "sem_edital" })).toEqual(["e3"]);
    expect(filtrar({ ligacao: "divergente" })).toEqual(["e2"]);
    expect(filtrar({ ligacao: "ligado" })).toEqual(["e1", "e2", "e4"]);
    expect(filtrar({ unidade: "DSEI Xingu" })).toEqual(["e2"]);
  });

  it("os aprovados sem entrevista seguem só os filtros que valem para eles", () => {
    const f = { ...FILTROS_VAZIOS, unidade: "DSEI Xingu", parecer: "APTO" };
    expect(
      filtrarAprovadosSemEntrevista(aprovadosSemEntrevista, f).map(
        (a) => a.candidato,
      ),
    ).toEqual(["Fábio"]);
  });

  it("opções distintas e ordenadas", () => {
    const opcoes = opcoesDosFiltros(entrevistas);
    expect(opcoes.unidades.map((o) => o.valor)).toEqual([
      "DSEI Xingu",
      "DSEI Yanomami",
    ]);
    expect(opcoes.modalidades.map((o) => o.valor)).toEqual(["Ampla"]);
    expect(opcoes.comparecimentos.map((o) => o.valor)).toEqual([
      "S",
      "N",
      "NI",
    ]);
  });
});

describe("KPIs e gráficos", () => {
  const { entrevistas, criterios, aprovadosSemEntrevista } =
    normalizarPayload(PAYLOAD);

  it("calcula os indicadores (média só de quem compareceu)", () => {
    const k = calcularIndicadores(entrevistas, aprovadosSemEntrevista);
    expect(k).toEqual({
      vagas: 2,
      candidatos: 4,
      compareceram: 3,
      aptos: 2,
      inaptos: 1,
      media: (12 + 18 + 4) / 3,
      semEntrevista: 2,
    });
    expect(formatarNota(k.media)).toBe("11,33");
    expect(formatarNota(null)).toBe("—");
    expect(calcularIndicadores([]).media).toBeNull();
  });

  it("faixas de nota entre quem compareceu (20 entra na última)", () => {
    const lista = normalizarPayload({
      entrevistas: [
        { id: "a", candidato: "a", nota: 0, compareceu: "S" },
        { id: "b", candidato: "b", nota: 5, compareceu: "S" },
        { id: "c", candidato: "c", nota: 20, compareceu: "S" },
        { id: "d", candidato: "d", nota: 14.99, compareceu: "S" },
        { id: "e", candidato: "e", nota: 10, compareceu: "N" },
      ],
    }).entrevistas;
    expect(faixasDeNota(lista).map((f) => f.valor)).toEqual([1, 1, 1, 1]);
  });

  it("contagens, média por critério e top unidades", () => {
    expect(contagemPorParecer(entrevistas).map((c) => c.valor)).toEqual([
      2, 1, 1,
    ]);
    expect(contagemPorComparecimento(entrevistas).map((c) => c.valor)).toEqual([
      3, 1, 0,
    ]);
    const medias = mediaPorCriterio(entrevistas, criterios);
    expect(medias.map((m) => [m.rotulo, m.media])).toEqual([
      ["HABILIDADE TÉCNICA INTERCULTURAL", 4.5],
      ["COMUNICAÇÃO", 4.5],
      ["POSTURA", 4.5],
    ]);
    expect(topUnidades(entrevistas, 1)).toEqual([
      { rotulo: "DSEI Yanomami", valor: 3 },
    ]);
  });
});

describe("pendências, datas e CSV", () => {
  const { entrevistas, aprovadosSemEntrevista, ultimaCarga } =
    normalizarPayload(PAYLOAD);

  it("conta as quatro pendências", () => {
    const p = pendenciasDasEntrevistas(entrevistas, aprovadosSemEntrevista);
    expect(Object.fromEntries(p.map((x) => [x.chave, x.valor]))).toEqual({
      sem_entrevista: 2,
      sem_analise: 1,
      sem_edital: 1,
      divergente: 1,
    });
  });

  it("agrupa os aprovados sem entrevista por edital e vaga", () => {
    const grupos = agruparAprovadosSemEntrevista(aprovadosSemEntrevista);
    expect(grupos.map((g) => [g.vaga, g.candidatos.length])).toEqual([
      ["V1", 1],
      ["V2", 1],
    ]);
  });

  it("formata a última carga", () => {
    expect(dataHoraBR("2026-09-29T10:30:00")).toBe("29/09/2026 10:30");
    expect(dataHoraBR("x")).toBe("");
  });

  it("gera o CSV com ; e BOM, protegido contra fórmula", () => {
    const perigosa = normalizarPayload({
      entrevistas: [{ id: "z", candidato: "=HYPERLINK(1)", nota: 10.5 }],
    }).entrevistas;
    const csv = csvDasEntrevistas(perigosa);
    expect(csv.startsWith("\uFEFFCandidato;Código;")).toBe(true);
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain("10,50");
    expect(csv).toContain("Sem análise");
  });
});

describe("registro da aba", async () => {
  const { ABAS_DO_MENU } = await import("../src/lib/menu-lateral.js");
  const { RESOURCES } = await import("../src/lib/permissoes-recursos.js");
  const { canViewEntrevistas, paginasPermitidas } =
    await import("../src/lib/access-roles.js");
  const { NOMES_DE_ICONES } = await import("../src/modules/icones.js");

  it("Entrevistas vem depois de Recursos e antes da Lista de aprovados, como beta", () => {
    const ids = ABAS_DO_MENU.map((aba) => aba.id);
    expect(ids.indexOf("entrevistas")).toBe(ids.indexOf("recursos") + 1);
    expect(ids.indexOf("aprovados")).toBe(ids.indexOf("entrevistas") + 1);
    expect(ABAS_DO_MENU.find((aba) => aba.id === "entrevistas")).toMatchObject({
      view: "entrevistas",
      recurso: "entrevistas",
      icone: "messages-square",
      ordem: 6,
      beta: true,
    });
    expect(ABAS_DO_MENU.find((aba) => aba.id === "recursos").ordem).toBe(5);
    expect(NOMES_DE_ICONES).toContain("messages-square");
    expect(RESOURCES).toContainEqual(["entrevistas", "Entrevistas"]);
  });

  it("leitor vê; sem a chave na matriz, a aba some", () => {
    const perfil = (nivel) => ({
      perfil: "usuario",
      permissoes: { entrevistas: nivel },
    });
    expect(canViewEntrevistas(perfil("leitor"))).toBe(true);
    expect(canViewEntrevistas(perfil("sem_acesso"))).toBe(false);
    expect(canViewEntrevistas({ perfil: "admin", permissoes: {} })).toBe(false);
    expect(paginasPermitidas(perfil("leitor")).entrevistas).toBe(true);
  });
});

describe("cópia guardada", async () => {
  const { PAINEL_DE_ENTREVISTAS, payloadMudou } =
    await import("../src/lib/entrevistas-do-painel.js");

  it("chave por área, esquema 1 e payload com a lista", () => {
    expect(PAINEL_DE_ENTREVISTAS.chave({ area: "sede" })).toBe(
      "entrevistas:sede",
    );
    expect(PAINEL_DE_ENTREVISTAS.esquema(PAYLOAD)).toBe(1);
    expect(PAINEL_DE_ENTREVISTAS.valido(PAYLOAD)).toBe(true);
    expect(PAINEL_DE_ENTREVISTAS.valido({})).toBe(false);
  });

  it("gerado_em não conta como mudança", () => {
    expect(payloadMudou(PAYLOAD, { ...PAYLOAD, gerado_em: "2030-01-01" })).toBe(
      false,
    );
    expect(payloadMudou(PAYLOAD, { ...PAYLOAD, entrevistas: [] })).toBe(true);
  });
});
