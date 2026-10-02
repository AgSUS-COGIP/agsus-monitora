import { describe, expect, it } from "vitest";
import {
  acompanhamentoDaResposta,
  alternarColuna,
  compararValoresDoFiltro,
  csvDaVisaoGeral,
  dataCurta,
  diasAte,
  enriquecerLinhas,
  fasesDosProcessos,
  filtrosVazios,
  indicadoresDaVisaoGeral,
  INDICADORES,
  linkSeguro,
  nomeDoCsv,
  normalizarColunas,
  normalizarFiltros,
  opcoesDosFiltros,
  podarFiltros,
  posResultado,
  prazoDoEdital,
  processosPorProjeto,
  proximaOrdenacao,
  recortar,
  resumoDoRelatorio,
  rotuloDoAtalho,
  seloDoCronograma,
  statusCanonico,
  taxaDeOciosidade,
  temProcessosPorProjeto,
  textosDaVisaoGeral,
  urgenciaDoCronograma,
  VALOR_DO_INDICADOR,
} from "../src/lib/visao-geral.js";

/*
  As regras da Visão geral (src/lib/visao-geral.js): filtros, recorte com
  atalho, linhas enriquecidas (fase, crítico, pós-resultado), blocos
  (Fases, Pós-resultado, Processos por projeto),
  tabela e exportação.
*/

const HOJE = "2026-10-01";

const BRUTAS = [
  {
    id: 1,
    unidade: "DSEI Xingu",
    edital: "03/2026",
    etapa: "Entrevistas",
    cronograma_atividade_atual: "Entrevistas",
    status: "Em Andamento",
    risco: "Alto",
    uf: "MT",
    vagas_total: 10,
    contratados: 4,
    vagas_ociosas: 6,
    inscritos: 80,
    data_fim: "2026-11-30",
    cronograma_automatico: true,
    cronograma_dias_para_proxima: 2,
    cronograma_proxima_data: "2026-10-03",
    cronograma_proxima_atividade: "Resultado preliminar das entrevistas",
    observacoes: "Falta médico",
  },
  {
    id: 2,
    unidade: "DSEI Xingu",
    edital: "11/2025",
    etapa: "Análise Curricular",
    status: "em andamento",
    risco: "Médio",
    uf: "MT",
    vagas_total: 5,
    contratados: 5,
    vagas_ociosas: 0,
    inscritos: 20,
    data_fim: "2026-12-30",
  },
  {
    id: 3,
    unidade: "DSEI Yanomami",
    edital: "01/2026",
    etapa: "Resultado final do Processo Seletivo",
    status: "Concluído",
    risco: "Alto",
    uf: "RR",
    vagas_total: 8,
    contratados: 2,
    vagas_ociosas: 6,
    inscritos: 40,
  },
  {
    id: 4,
    unidade: "CASAI Brasília",
    edital: "Edital sem número",
    etapa: "",
    status: "",
    risco: "Baixo",
    uf: "DF",
    vagas_total: 2,
    contratados: 0,
    vagas_ociosas: 2,
    inscritos: 3,
  },
  {
    id: 5,
    unidade: "DSEI Xingu",
    edital: "81/2025",
    etapa: "Resultado final do Processo Seletivo",
    status: "Cancelado",
    risco: "Baixo",
    uf: "MT",
    vagas_total: 6,
    contratados: 0,
    vagas_ociosas: 6,
    inscritos: 1389,
  },
];

const ACOMPANHAMENTO = acompanhamentoDaResposta({
  etapas: [
    {
      monitoramento_id: 1,
      atividade: "Resultado preliminar das entrevistas",
      data_inicio: "2026-10-03",
      data_fim: "2026-10-03",
    },
    {
      monitoramento_id: 1,
      atividade: "Prazo para recursos das entrevistas",
      data_inicio: "2026-10-04",
      data_fim: "2026-10-06",
    },
    {
      monitoramento_id: 2,
      atividade: "Entrevistas",
      data_inicio: "2026-10-20",
      data_fim: "2026-10-25",
    },
  ],
  listas: [
    {
      monitoramento_id: 3,
      aprovados: 43,
      com_status: 0,
      contratados: 2,
      desistentes: 3,
    },
  ],
});

const LINHAS = enriquecerLinhas(BRUTAS, { hoje: HOJE });
const COM_ACOMPANHAMENTO = enriquecerLinhas(BRUTAS, {
  hoje: HOJE,
  acompanhamento: ACOMPANHAMENTO,
});
const comFiltros = (parcial) => ({ ...filtrosVazios(), ...parcial });
const ids = (lista) => lista.map((l) => l.id);

describe("filtros", () => {
  it("cinco campos; Fase e UF em 'Mais opções'; o Risco manual saiu", () => {
    expect(Object.keys(filtrosVazios())).toEqual([
      "unidade",
      "edital",
      "status",
      "fase",
      "uf",
    ]);
  });

  it("ordena as opções pelo fluxo: edital por ano e número, status e fase", () => {
    expect(
      ["03/2026", "Edital sem número", "11/2025", "01/2026"].sort((a, b) =>
        compararValoresDoFiltro("edital", a, b),
      ),
    ).toEqual(["11/2025", "01/2026", "03/2026", "Edital sem número"]);
    expect(
      ["Concluído", "Entrevistas", "Edital", "Outra"].sort((a, b) =>
        compararValoresDoFiltro("fase", a, b),
      ),
    ).toEqual(["Edital", "Entrevistas", "Concluído", "Outra"]);
  });

  it("as opções seguem os outros filtros; a fase é uma opção", () => {
    const opcoes = opcoesDosFiltros(LINHAS, comFiltros({ uf: ["RR"] }));
    expect(opcoes.unidade).toEqual(["DSEI Yanomami"]);
    expect(opcoes.uf).toEqual(["DF", "MT", "RR"]);
    expect(opcoesDosFiltros(LINHAS, filtrosVazios()).fase).toEqual([
      "Análise curricular",
      "Entrevistas",
      "Concluído",
      "Cancelado",
      "Sem cronograma",
    ]);
  });

  it("poda a seleção que deixou de existir e normaliza o que vem do navegador", () => {
    const filtros = comFiltros({ unidade: ["DSEI Fechado"], uf: ["mt"] });
    expect(podarFiltros(LINHAS, filtros)).toEqual(comFiltros({ uf: ["MT"] }));
    const validos = comFiltros({ uf: ["MT"] });
    expect(podarFiltros(LINHAS, validos)).toBe(validos);
    expect(
      normalizarFiltros({
        unidade: [" A ", "A", ""],
        risco: ["Alto"],
        uf: "MT",
      }),
    ).toEqual(comFiltros({ unidade: ["A"] }));
  });
});

describe("linhas enriquecidas", () => {
  it("fase, motivos de atenção e pendências pós-resultado", () => {
    const [xingu, analise, yanomami, casai, cancelado] = LINHAS;
    expect(xingu.fase).toBe("Entrevistas");
    expect(xingu.atencao.map((m) => m.rotulo)).toEqual(["Etapa em 2 dias"]);
    expect(analise.fase).toBe("Análise curricular");
    expect(analise.atencao).toEqual([]);
    expect(yanomami.fase).toBe("Concluído");
    expect(yanomami.atencao.map((m) => m.codigo)).toEqual([
      "contratacao_baixa",
    ]);
    // Sem o resumo das listas, só a contratação baixa.
    expect(yanomami.pos_resultado).toEqual(["contratacao_baixa"]);
    expect(casai.fase).toBe("Sem cronograma");
    expect(cancelado.atencao).toEqual([]);
    expect(cancelado.pos_resultado).toEqual([]);
    // O original não muda.
    expect(BRUTAS[0].fase).toBeUndefined();
  });

  it("com o acompanhamento: lista sem status e desistências", () => {
    const yanomami = COM_ACOMPANHAMENTO.find((l) => l.id === 3);
    expect(yanomami.pos_resultado).toEqual([
      "sem_status",
      "contratacao_baixa",
      "desistencias",
    ]);
    expect(yanomami.desistentes).toBe(3);
    const semLista = enriquecerLinhas([{ ...BRUTAS[2], id: 9 }], {
      hoje: HOJE,
      acompanhamento: ACOMPANHAMENTO,
    })[0];
    expect(semLista.pos_resultado).toEqual(["sem_lista", "contratacao_baixa"]);
  });
});

describe("recorte", () => {
  it("filtra por campo, pela busca (sem acento), pelo DSEI e pelo atalho", () => {
    expect(
      ids(recortar(LINHAS, { filtros: comFiltros({ uf: ["mt"] }) })).sort(),
    ).toEqual([1, 2, 5]);
    expect(
      ids(recortar(LINHAS, { filtros: filtrosVazios(), busca: "MEDICO" })),
    ).toEqual([1]);
    expect(
      ids(
        recortar(LINHAS, {
          filtros: filtrosVazios(),
          dsei: "yanomami",
          chaveDsei: (l) => l.unidade.replace("DSEI ", "").toLowerCase(),
        }),
      ),
    ).toEqual([3]);
    expect(
      ids(recortar(LINHAS, { filtros: filtrosVazios(), atalho: "criticos" })),
    ).toEqual([1, 3]);
    expect(
      ids(
        recortar(COM_ACOMPANHAMENTO, {
          filtros: filtrosVazios(),
          atalho: "pos:sem_status",
        }),
      ),
    ).toEqual([3]);
    expect(
      ids(recortar(LINHAS, { filtros: comFiltros({ fase: ["Entrevistas"] }) })),
    ).toEqual([1]);
    expect(rotuloDoAtalho("criticos")).toBe("Críticos");
    expect(rotuloDoAtalho("pos:sem_lista")).toBe("Sem lista de aprovados");
  });

  it("sem ordenação, os críticos primeiro, depois mais vagas sem contratação", () => {
    const fila = recortar(LINHAS, { filtros: filtrosVazios() });
    // 1 (prazo, peso 2), 3 (contratação baixa, peso 5), depois 5 (6 sem
    // contratação), 4 (2) e 2 (0).
    expect(ids(fila)).toEqual([1, 3, 5, 4, 2]);
    const porVagas = recortar(LINHAS, {
      filtros: filtrosVazios(),
      ordenacao: { campo: "vagas_total", direcao: "desc" },
    });
    expect(ids(porVagas)).toEqual([1, 3, 5, 2, 4]);
    const porAtencao = recortar(LINHAS, {
      filtros: filtrosVazios(),
      ordenacao: { campo: "atencao", direcao: "asc" },
    });
    expect(ids(porAtencao).slice(0, 2)).toEqual([1, 3]);
  });

  it("o cabeçalho alterna crescente, decrescente e sem ordem", () => {
    let o = proximaOrdenacao({ campo: "", direcao: "" }, "edital");
    expect(o).toEqual({ campo: "edital", direcao: "asc" });
    o = proximaOrdenacao(o, "edital");
    expect(o).toEqual({ campo: "edital", direcao: "desc" });
    expect(proximaOrdenacao(o, "edital")).toEqual({ campo: "", direcao: "" });
  });
});

describe("indicadores", () => {
  it("sete, com as chaves de Configurações e o valor de cada um", () => {
    expect(INDICADORES.map(([chave, rotulo]) => [chave, rotulo])).toEqual([
      ["kpi_vagas_label", "Vagas imediatas"],
      ["kpi_contratadas_label", "Contratadas"],
      ["kpi_em_selecao_label", "Em seleção"],
      ["kpi_ociosas_label", "Ociosas"],
      ["kpi_cadastro_reserva_label", "Cadastro reserva"],
      ["kpi_criticos_label", "Críticos"],
      ["kpi_inscritos_label", "Inscritos"],
    ]);
    expect(Object.keys(VALOR_DO_INDICADOR)).toEqual(
      INDICADORES.map(([chave]) => chave),
    );
  });

  it("contam o recorte e fecham", () => {
    const k = indicadoresDaVisaoGeral(LINHAS);
    expect(k).toEqual({
      processos: 5,
      vagas: 25,
      contratadas: 11,
      emSelecao: 8,
      ociosas: 6,
      cadastroReserva: 0,
      criticos: 2,
      inscritos: 143,
    });
    expect(k.contratadas + k.emSelecao + k.ociosas).toBe(k.vagas);
  });
});

describe("blocos", () => {
  it("Fases: as do fluxo sempre, as de fora só com edital", () => {
    const fases = fasesDosProcessos(LINHAS);
    expect(fases.map((f) => f.fase)).toEqual([
      "Edital",
      "Inscrições",
      "Análise curricular",
      "Recursos",
      "Entrevistas",
      "Resultado",
      "Contratação",
      "Concluído",
      "Cancelado",
      "Sem cronograma",
    ]);
    expect(fases.find((f) => f.fase === "Entrevistas")).toEqual({
      fase: "Entrevistas",
      quantos: 1,
      pct: 20,
      tom: "info",
    });
    expect(fases.reduce((s, f) => s + f.quantos, 0)).toBe(LINHAS.length);
  });

  it("Pós-resultado: com e sem o resumo das listas", () => {
    expect(posResultado(LINHAS)).toEqual([
      {
        codigo: "contratacao_baixa",
        rotulo: "Contratação abaixo de 50%",
        quantos: 1,
        pessoas: null,
      },
    ]);
    expect(
      posResultado(COM_ACOMPANHAMENTO, { comListas: true }).map((p) => [
        p.codigo,
        p.quantos,
        p.pessoas,
      ]),
    ).toEqual([
      ["sem_lista", 0, null],
      ["sem_status", 1, null],
      ["contratacao_baixa", 1, null],
      ["desistencias", 1, 3],
    ]);
  });

  it("Processos por projeto (só Projetos)", () => {
    expect(temProcessosPorProjeto("projetos")).toBe(true);
    expect(temProcessosPorProjeto("sede")).toBe(false);
    expect(processosPorProjeto(LINHAS)[0]).toEqual({
      projeto: "DSEI Xingu",
      processos: 3,
      abertos: 2,
      vagas: 15,
      contratadas: 9,
    });
  });
});

describe("tabela", () => {
  const hoje = new Date(2026, 9, 1);

  it("prazo do edital: encerrado, perto do fim, concluído e cancelado", () => {
    expect(diasAte("2026-10-04", hoje)).toBe(3);
    expect(prazoDoEdital({ data_fim: "2026-10-04" }, hoje)).toMatchObject({
      tom: "perigo",
      rotulo: "Edital encerra em 3 dias",
    });
    expect(prazoDoEdital({ data_fim: "2026-10-20" }, hoje).tom).toBe("alerta");
    expect(prazoDoEdital({ data_fim: "2026-12-20" }, hoje)).toBeNull();
    // Vencido sem concluir: o selo do cronograma diz "Etapa atrasada".
    expect(prazoDoEdital({ data_fim: "2026-09-20" }, hoje)).toBeNull();
    expect(prazoDoEdital({ status: "Cancelada" }, hoje).rotulo).toBe(
      "Processo cancelado",
    );
  });

  it("cronograma: atrasado pelo fim do cronograma, perto, sem cronograma; o selo some em concluído", () => {
    const base = {
      status: "Em andamento",
      cronograma_automatico: true,
      data_fim: "2026-12-01",
    };
    expect(
      urgenciaDoCronograma({ ...base, data_fim: "2026-09-29" }, hoje),
    ).toEqual({ tom: "danger", rotulo: "Etapa atrasada há 2 dia(s)" });
    // Sem cronograma estruturado também atrasa pela data do edital.
    expect(
      urgenciaDoCronograma(
        { status: "Em andamento", data_fim: "2026-09-30" },
        hoje,
      ).rotulo,
    ).toBe("Etapa atrasada há 1 dia(s)");
    expect(
      urgenciaDoCronograma({ ...base, cronograma_dias_para_proxima: 3 }, hoje)
        .tom,
    ).toBe("danger");
    expect(
      urgenciaDoCronograma({ ...base, cronograma_dias_para_proxima: 6 }, hoje)
        .tom,
    ).toBe("warning");
    expect(
      urgenciaDoCronograma(
        {
          ...base,
          cronograma_dias_para_proxima: null,
          cronograma_proxima_atividade: "Entrevistas",
        },
        hoje,
      ),
    ).toEqual({ tom: "info", rotulo: "Próxima: Entrevistas" });
    expect(seloDoCronograma({ status: "Em andamento" }, hoje)).toMatchObject({
      rotulo: "Sem cronograma",
    });
    expect(seloDoCronograma({ status: "Concluído" }, hoje)).toBeNull();
    expect(statusCanonico("")).toBe("Cronograma pendente");
    expect(statusCanonico("Cancelada")).toBe("Cancelado");
  });

  it("taxa sem contratação e datas", () => {
    expect(taxaDeOciosidade({ vagas_total: 10, contratados: 4 })).toEqual({
      pct: 60,
      nivel: "critical",
    });
    expect(taxaDeOciosidade({ vagas_total: 0, contratados: 3 }).pct).toBe(0);
    expect(dataCurta("2026-10-01T10:00:00")).toBe("01/10/2026");
  });

  it("colunas: só as conhecidas, na ordem da tabela, nunca nenhuma", () => {
    expect(normalizarColunas(["atencao", "edital", "risco"])).toEqual([
      "edital",
      "atencao",
    ]);
    expect(normalizarColunas(null)).toHaveLength(11);
    expect(alternarColuna(["edital"], "edital", false)).toEqual(["edital"]);
    expect(alternarColuna(["atencao"], "unidade", true)).toEqual([
      "unidade",
      "atencao",
    ]);
  });

  it("link do edital só se for http(s)", () => {
    expect(linkSeguro("https://agsus.org.br/e.pdf")).toBe(
      "https://agsus.org.br/e.pdf",
    );
    expect(linkSeguro("javascript:alert(1)")).toBe("");
  });
});

describe("exportação", () => {
  it("CSV com ; e aspas, sem fórmula de planilha, com fase e atenção", () => {
    const csv = csvDaVisaoGeral([
      {
        unidade: '=HYPERLINK("x")',
        edital: 'A "B"',
        observacoes: "1\n2",
        fase: "Entrevistas",
        atencao: [{ rotulo: "Etapa hoje" }, { rotulo: "Sem inscritos" }],
      },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [cabecalho, linha] = csv.slice(1).split("\n");
    expect(cabecalho.split(";")[0]).toBe('"Unidade"');
    expect(cabecalho).toContain('"Fase";"Etapa";"Atenção"');
    expect(linha).toContain(`"'=HYPERLINK(""x"")"`);
    expect(linha).toContain('"A ""B"""');
    expect(linha).toContain('"1 2"');
    expect(linha).toContain('"Etapa hoje; Sem inscritos"');
  });

  it("nome do arquivo pela área e pelo dia", () => {
    expect(
      nomeDoCsv("saude-indigena", new Date("2026-10-01T22:30:00-03:00")),
    ).toBe("AgSUS_Monitora_SaudeIndigena_20261001.csv");
  });

  it("o cabeçalho do PDF diz os filtros e os números do recorte (contas novas)", () => {
    expect(
      resumoDoRelatorio({
        filtros: comFiltros({ uf: ["MT"] }),
        busca: "médico",
        atalho: "criticos",
        linhas: LINHAS.slice(0, 3),
      }),
    ).toEqual({
      filtros: "UF: MT · Busca: médico · Críticos",
      processos: 3,
      vagas: 23,
      contratados: 11,
      ociosas: 6,
      pctOciosas: 26,
    });
    expect(resumoDoRelatorio({ filtros: filtrosVazios() }).filtros).toBe(
      "Nenhum filtro aplicado (todos os processos)",
    );
  });
});

describe("textos de Configurações", () => {
  it("vale o publicado; vazio cai no padrão; o rótulo antigo de Contratações não vale para Contratadas", () => {
    const valores = new Map([
      ["kpi_vagas_label", "Vagas Imediatas Previstas"],
      ["kpi_contratados_label", "Contratações de Vagas Imediatas + CR"],
      ["filter_title", "  "],
      ["filter_subtitle", "Escolha o recorte"],
    ]);
    const textos = textosDaVisaoGeral((chave) => valores.get(chave));
    expect(textos.rotulos.kpi_vagas_label).toBe("Vagas Imediatas Previstas");
    expect(textos.rotulos.kpi_contratadas_label).toBe("Contratadas");
    expect(textos.rotulos.kpi_em_selecao_label).toBe("Em seleção");
    expect(textos.rotulos).not.toHaveProperty("kpi_contratados_label");
    expect(textos.filtros).toBe("Refinar resultados");
    expect(textos.filtrosSubtitulo).toBe("Escolha o recorte");
  });
});
