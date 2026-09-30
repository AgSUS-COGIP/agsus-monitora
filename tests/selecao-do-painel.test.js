import { describe, expect, it } from "vitest";
import {
  calcularIndicadores,
  csvDaSelecao,
  FILTROS_VAZIOS,
  filtrarVagas,
  funil,
  motivosDeEliminacao,
  normalizarPayload,
  numerosAConferir,
  opcoesDosFiltros,
  PAINEL_DE_SELECAO,
  payloadMudou,
  pendenciasDaSelecao,
  situacoesDaVaga,
  somar,
  textoDaUltimaCarga,
  topUnidades,
} from "../src/lib/selecao-do-painel.js";

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
      edital_planilha: "06/2026",
      unidade: "DSEI Xingu",
      vaga: "104123",
      vaga_planilha: "104123",
      cargo: "Enfermeiro",
      inscritos: 83,
      aptos: 72,
      cancelados: 2,
      reprovados_questionario: 9,
      eliminados_nota: 0,
      reprovados_analise: 3,
      triados: 69,
      total_eliminados: 14,
      observacao: "1 Interessado",
      convocados: 10,
      origem_convocados: "entrevistas",
      aprovados: 5,
      contratados: 2,
      nao_contratados: 3,
    },
    {
      id: "v2",
      edital_id: "m6",
      edital: "06/2026",
      unidade: "DSEI Yanomami",
      vaga: "104124",
      cargo: "Médico",
      inscritos: 10,
      aptos: 12,
      total_eliminados: 1,
      convocados: 0,
      origem_convocados: "entrevistas",
      aprovados: null,
      contratados: null,
      nao_contratados: null,
    },
    {
      id: "v3",
      edital_id: null,
      edital: "96/2025",
      edital_planilha: "96/2025",
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
const porId = (id) => vagas.find((v) => v.id === id);

describe("payload da seleção", () => {
  it("normaliza números, origem e situações", () => {
    const [v1, v2, v3] = vagas;
    expect(v1).toMatchObject({
      vaga: "104123",
      inscritos: 83,
      eliminadosNota: 0,
      origemConvocados: "entrevistas",
      temLista: true,
      semEdital: false,
      outraBanca: false,
      aConferir: false,
    });
    // Mais aptos que inscritos: a conferir; edital sem lista.
    expect(v2.aConferir).toBe(true);
    expect(situacoesDaVaga(v2)).toEqual(["sem_lista", "a_conferir"]);
    // Outra banca: cargo no lugar da vaga, só inscritos e eliminados.
    expect(v3).toMatchObject({
      vaga: null,
      outraBanca: true,
      semEdital: true,
      aptos: null,
      triados: null,
      origemConvocados: "planilha",
    });
    expect(situacoesDaVaga(v3)).toEqual(["sem_edital", "outra_banca"]);
  });

  it("número negativo é a conferir; vazio não é", () => {
    expect(numerosAConferir({ inscritos: 5, reprovadosAnalise: -1 })).toBe(
      true,
    );
    expect(numerosAConferir({ inscritos: null, aptos: null })).toBe(false);
  });

  it("payload estranho vira lista vazia", () => {
    expect(normalizarPayload(null).vagas).toEqual([]);
    expect(normalizarPayload({ vagas: "x" }).vagas).toEqual([]);
  });

  it("texto da última carga", () => {
    expect(textoDaUltimaCarga(normalizarPayload(PAYLOAD).ultimaCarga)).toBe(
      "Dados da planilha Auditoria · última carga 01/10/2026 09:02",
    );
    expect(textoDaUltimaCarga(null)).toContain("sem carga concluída");
  });
});

describe("filtros", () => {
  it("por unidade, origem, situação e busca", () => {
    const ids = (filtros) =>
      filtrarVagas(vagas, { ...FILTROS_VAZIOS, ...filtros }).map((v) => v.id);
    expect(ids({ unidade: "DSEI Xingu" })).toEqual(["v1"]);
    expect(ids({ origem: "planilha" })).toEqual(["v3"]);
    expect(ids({ situacao: "a_conferir" })).toEqual(["v2"]);
    expect(ids({ situacao: "sem_edital" })).toEqual(["v3"]);
    expect(ids({ busca: "medico" })).toEqual(["v2", "v3"]);
    expect(ids({ busca: "104123" })).toEqual(["v1"]);
  });

  it("opções sem repetição, em ordem", () => {
    const opcoes = opcoesDosFiltros(vagas);
    expect(opcoes.editais.map((o) => o.valor)).toEqual(["06/2026", "96/2025"]);
    expect(opcoes.origens.map((o) => o.valor)).toEqual([
      "entrevistas",
      "planilha",
    ]);
  });
});

describe("indicadores e gráficos", () => {
  it("soma ignora vazio; sem nenhum número é nulo", () => {
    expect(somar(vagas, "inscritos")).toBe(132);
    expect(somar(vagas, "aprovados")).toBe(5);
    expect(somar([porId("v3")], "aptos")).toBeNull();
  });

  it("KPIs do recorte", () => {
    expect(calcularIndicadores(vagas)).toEqual({
      vagas: 3,
      editais: 2,
      inscritos: 132,
      aptos: 84,
      eliminados: 15,
      triados: 69,
      convocados: 14,
      aprovados: 5,
      contratados: 2,
      naoContratados: 3,
    });
    expect(calcularIndicadores([]).inscritos).toBeNull();
  });

  it("funil, motivos e unidades", () => {
    expect(funil(vagas).map((e) => [e.id, e.valor])).toEqual([
      ["inscritos", 132],
      ["aptos", 84],
      ["triados", 69],
      ["convocados", 14],
      ["aprovados", 5],
      ["contratados", 2],
    ]);
    expect(motivosDeEliminacao(vagas).map((m) => m.valor)).toEqual([
      2, 9, 0, 3,
    ]);
    expect(topUnidades(vagas, 2).map((u) => u.rotulo)).toEqual([
      "DSEI Xingu",
      "Projeto Agora Tem Especialistas Caminhoneiros",
    ]);
  });

  it("pendências", () => {
    const valores = Object.fromEntries(
      pendenciasDaSelecao(vagas).map((p) => [p.chave, p.valor]),
    );
    expect(valores).toEqual({ a_conferir: 1, sem_edital: 1, sem_lista: 1 });
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
    expect(csv.startsWith("\uFEFFEdital;Unidade;Vaga;Cargo;Inscritos;")).toBe(
      true,
    );
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain(";3;;");
    expect(csv).toContain("Planilha (dado antigo)");
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
  const { PAGINAS_DO_PAINEL } = await import("../src/lib/pagina-do-painel.js");

  it("Seleção vem depois de Recursos, como beta, com a página própria", () => {
    const ids = ABAS_DO_MENU.map((aba) => aba.id);
    expect(ids.indexOf("selecao")).toBe(ids.indexOf("recursos") + 1);
    expect(ABAS_DO_MENU.find((aba) => aba.id === "selecao")).toMatchObject({
      view: "selecao",
      recurso: "selecao",
      icone: "funnel",
      ordem: 8,
      beta: true,
    });
    expect(NOMES_DE_ICONES).toContain("funnel");
    expect(RESOURCES).toContainEqual(["selecao", "Seleção"]);
    expect(PAGINAS_DO_PAINEL.selecao.endereco).toBe("/selecao.html");
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
