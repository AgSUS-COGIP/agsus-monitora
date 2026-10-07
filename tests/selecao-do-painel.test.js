import { describe, expect, it } from "vitest";
import {
  aptosEEliminados,
  calcularIndicadores,
  csvDaSelecao,
  eliminadosAntesDaAnalise,
  FILTROS_VAZIOS,
  filtrarVagas,
  filtrosAtivos,
  formatarQuantidade,
  formatarTaxa,
  normalizarPayload,
  observacoesDoRecorte,
  opcoesDosFiltros,
  PAINEL_DE_SELECAO,
  payloadMudou,
  rotuloDaUnidade,
  somar,
  taxaDeContratacao,
  topUnidades,
  triadosEReprovados,
} from "../src/lib/selecao-do-painel.ts";

/* O formato de get_selecao_da_area (20261001090000_selecao.sql). */
const PAYLOAD = {
  schema_version: 1,
  area: "saude-indigena",
  gerado_em: "2026-10-01T12:00:00Z",
  ultima_carga: { em: "2026-10-01T09:02:00", linhas: 3, sem_edital: 1 },
  vagas: [
    {
      id: "v1",
      edital_id: "m6",
      edital: "06/2026",
      unidade: "DSEI Xingu",
      vaga: "104123",
      cargo: "Enfermeiro",
      inscritos: 83,
      aptos: 72,
      cancelados: 2,
      reprovados_questionario: 9,
      eliminados_nota: 0,
      reprovados_analise: 3,
      triados: 69,
      total_eliminados: 11,
      observacao: "1 Interessado",
      convocados: 10,
      origem_convocados: "entrevistas",
      aprovados: 8,
      contratados: 2,
      nao_contratados: 6,
    },
    {
      id: "v2",
      edital_id: "m6",
      edital: "06/2026",
      unidade: "DSEI Yanomami",
      vaga: "104124",
      cargo: "Médico",
      inscritos: 10,
      aptos: 8,
      cancelados: 1,
      reprovados_questionario: 1,
      triados: 6,
      reprovados_analise: 2,
      total_eliminados: 2,
      observacao: "1 interessado",
      convocados: 0,
      origem_convocados: "entrevistas",
      aprovados: null,
      contratados: null,
    },
    {
      id: "v3",
      edital_id: null,
      edital: "96/2025",
      unidade: "Projeto Agora Tem Especialistas Caminhoneiros",
      vaga: null,
      vaga_planilha: "CARGO 1: MÉDICO",
      cargo: "CARGO 1: MÉDICO",
      inscritos: 39,
      total_eliminados: 0,
      convocados: 4,
      origem_convocados: "planilha",
      aprovados: null,
    },
  ],
};

const vagas = normalizarPayload(PAYLOAD).vagas;
const ids = (xs) => xs.map((v) => v.id);

describe("payload da seleção", () => {
  it("normaliza números, vaga e origem dos convocados", () => {
    expect(vagas[0]).toMatchObject({
      vaga: "104123",
      inscritos: 83,
      eliminadosNota: 0,
      aprovados: 8,
      origemConvocados: "entrevistas",
    });
    // Outra banca: cargo no lugar da vaga, sem código e com os números vazios.
    expect(vagas[2]).toMatchObject({
      vaga: null,
      cargo: "CARGO 1: MÉDICO",
      aptos: null,
      origemConvocados: "planilha",
    });
  });

  it("payload estranho vira lista vazia", () => {
    expect(normalizarPayload(null).vagas).toEqual([]);
    expect(normalizarPayload({ vagas: "x" }).vagas).toEqual([]);
  });

  it("ignora entradas que não são objetos e mantém zero separado de número ausente", () => {
    const dados = normalizarPayload({
      vagas: [
        null,
        false,
        7,
        "vaga",
        [],
        {},
        {
          id: "valida",
          inscritos: "12.6",
          aptos: 0,
          triados: "",
          convocados: "não informado",
          aprovados: null,
        },
      ],
    });
    expect(dados.vagas).toHaveLength(1);
    expect(dados.vagas[0]).toMatchObject({
      id: "valida",
      inscritos: 13,
      aptos: 0,
      triados: null,
      convocados: null,
      aprovados: null,
    });
    expect(calcularIndicadores(dados.vagas)).toMatchObject({
      vagas: 1,
      inscritos: 13,
      aptos: 0,
      triados: null,
      taxa: null,
    });
    for (const externo of [undefined, "resposta", 7, false, []]) {
      expect(normalizarPayload(externo)).toMatchObject({ area: "", vagas: [] });
      expect(PAINEL_DE_SELECAO.valido(externo)).toBe(false);
    }
  });
});

describe("filtros de escolha múltipla (DSEI, edital, cargo, vaga)", () => {
  it("vazio é tudo; cada filtro aceita vários valores; a busca olha a observação", () => {
    expect(ids(filtrarVagas(vagas))).toEqual(["v1", "v2", "v3"]);
    expect(
      ids(
        filtrarVagas(vagas, {
          ...FILTROS_VAZIOS,
          unidades: ["DSEI Xingu", "DSEI Yanomami"],
        }),
      ),
    ).toEqual(["v1", "v2"]);
    expect(
      ids(filtrarVagas(vagas, { ...FILTROS_VAZIOS, editais: ["96/2025"] })),
    ).toEqual(["v3"]);
    expect(
      ids(filtrarVagas(vagas, { ...FILTROS_VAZIOS, vagas: ["104124"] })),
    ).toEqual(["v2"]);
    expect(ids(filtrarVagas(vagas, FILTROS_VAZIOS, "interessado"))).toEqual([
      "v1",
      "v2",
    ]);
    expect(ids(filtrarVagas(vagas, FILTROS_VAZIOS, "medico"))).toEqual([
      "v2",
      "v3",
    ]);
  });

  it("as opções de um filtro seguem os outros filtros escolhidos", () => {
    const todas = opcoesDosFiltros(vagas);
    expect(todas.editais).toEqual(["06/2026", "96/2025"]);
    expect(todas.vagas).toEqual(["104123", "104124"]);
    const soXingu = opcoesDosFiltros(vagas, {
      ...FILTROS_VAZIOS,
      unidades: ["DSEI Xingu"],
    });
    expect(soXingu.editais).toEqual(["06/2026"]);
    expect(soXingu.cargos).toEqual(["Enfermeiro"]);
    // O filtro escolhido não limita as próprias opções.
    expect(soXingu.unidades).toHaveLength(3);
  });

  it("os filtros ativos (chips e recorte) dizem o que foi escolhido; fora da SI a unidade não é DSEI", () => {
    const filtros = {
      ...FILTROS_VAZIOS,
      editais: ["06/2026"],
      unidades: ["DSEI Xingu"],
    };
    expect(filtrosAtivos(filtros).map((f) => f.rotulo)).toEqual([
      "Nome DSEI",
      "Edital",
    ]);
    expect(filtrosAtivos(filtros, "sede")[0]).toEqual({
      campo: "unidades",
      rotulo: "Unidade",
      valores: ["DSEI Xingu"],
    });
    expect(filtrosAtivos(FILTROS_VAZIOS)).toEqual([]);
    expect(rotuloDaUnidade("sede")).toBe("Unidade");
  });
});

describe("os 7 KPIs", () => {
  it("soma ignora vazio; taxa = contratados / aprovados", () => {
    expect(somar(vagas, "inscritos")).toBe(132);
    expect(calcularIndicadores(vagas)).toEqual({
      vagas: 3,
      inscritos: 132,
      aptos: 80,
      triados: 75,
      convocados: 14,
      aprovados: 8,
      contratados: 2,
      taxa: 0.25,
    });
    expect(taxaDeContratacao(0, 0)).toBeNull();
  });

  it("formata como o painel antigo (zero sem número, taxa em %)", () => {
    expect(formatarQuantidade(null)).toBe("0");
    expect(formatarQuantidade(1234)).toBe("1.234");
    expect(formatarTaxa(0.25)).toBe("25%");
    expect(formatarTaxa(1 / 3)).toBe("33,3%");
    expect(formatarTaxa(null)).toBe("0%");
  });
});

describe("os 5 gráficos", () => {
  it("eliminados antes da análise, aptos × eliminados, triados × reprovados", () => {
    expect(eliminadosAntesDaAnalise(vagas).map((x) => x.valor)).toEqual([
      3, 10, 0,
    ]);
    expect(aptosEEliminados(vagas).map((x) => x.valor)).toEqual([80, 13]);
    expect(triadosEReprovados(vagas).map((x) => x.valor)).toEqual([75, 5]);
  });

  it("top DSEIs por inscritos", () => {
    expect(topUnidades(vagas, 2)).toEqual([
      { rotulo: "DSEI Xingu", valor: 83 },
      { rotulo: "Projeto Agora Tem Especialistas Caminhoneiros", valor: 39 },
    ]);
  });
});

describe("alertas da coluna Observação", () => {
  it("cada observação uma vez (sem diferenciar caixa), com onde aparece", () => {
    expect(observacoesDoRecorte(vagas)).toEqual([
      {
        texto: "1 Interessado",
        vagas: 2,
        unidades: ["DSEI Xingu", "DSEI Yanomami"],
        editais: ["06/2026"],
      },
    ]);
    expect(observacoesDoRecorte([vagas[2]])).toEqual([]);
  });
});

describe("CSV e cópia guardada", () => {
  it("CSV com ; BOM, vazio em branco e célula protegida", () => {
    const perigosa = normalizarPayload({
      vagas: [
        { id: "z", edital: "1/2026", cargo: "=HYPERLINK(1)", inscritos: 3 },
      ],
    }).vagas;
    const csv = csvDaSelecao(perigosa);
    expect(
      csv.startsWith(
        String.fromCharCode(0xfeff) + "DSEI / Unidade;Edital;Cargo;Vaga;",
      ),
    ).toBe(true);
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain("Planilha Auditoria (dado antigo)");
  });

  it("tipo da cópia e mudança sem contar gerado_em", () => {
    expect(PAINEL_DE_SELECAO.chave({ area: "sede" })).toBe("selecao:sede");
    expect(PAINEL_DE_SELECAO.valido(PAYLOAD)).toBe(true);
    expect(PAINEL_DE_SELECAO.valido({ vagas: null })).toBe(false);
    expect(payloadMudou(PAYLOAD, { ...PAYLOAD, gerado_em: "2026-10-02" })).toBe(
      false,
    );
    expect(payloadMudou(PAYLOAD, { ...PAYLOAD, vagas: [] })).toBe(true);
  });
});

describe("registro da aba", async () => {
  const { ABAS_DO_MENU } = await import("../src/lib/menu-lateral.js");
  const { RESOURCES } = await import("../src/lib/permissoes-recursos.js");
  const { canViewSelecao, paginasPermitidas } =
    await import("../src/lib/access-roles.js");
  const { NOMES_DE_ICONES } = await import("../src/modules/icones.js");

  it("Seleção é a última etapa, depois da Lista de aprovados, como beta", () => {
    const lista = ABAS_DO_MENU.map((aba) => aba.id);
    expect(lista.indexOf("selecao")).toBe(lista.indexOf("aprovados") + 1);
    expect(ABAS_DO_MENU.find((aba) => aba.id === "selecao")).toMatchObject({
      view: "selecao",
      recurso: "selecao",
      icone: "funnel",
      ordem: 11,
      beta: true,
    });
    expect(NOMES_DE_ICONES).toContain("funnel");
    expect(RESOURCES).toContainEqual(["selecao", "Seleção"]);
  });

  it("leitor vê; sem a chave na matriz, a aba some", () => {
    const perfil = (nivel) => ({
      perfil: "usuario",
      permissoes: { selecao: nivel },
    });
    expect(canViewSelecao(perfil("leitor"))).toBe(true);
    expect(canViewSelecao(perfil("sem_acesso"))).toBe(false);
    expect(canViewSelecao({ perfil: "admin", permissoes: {} })).toBe(false);
    expect(paginasPermitidas(perfil("leitor")).selecao).toBe(true);
  });
});
