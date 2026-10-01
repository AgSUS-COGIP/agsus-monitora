import { describe, expect, it } from "vitest";
import {
  alternarColuna,
  compararValoresDoFiltro,
  csvDaVisaoGeral,
  dataCurta,
  diasAte,
  filtroDeRiscoCriticoAtivo,
  filtrosVazios,
  indicadoresDaVisaoGeral,
  linkSeguro,
  nomeDoCsv,
  normalizarColunas,
  normalizarFiltros,
  opcoesDosFiltros,
  podarFiltros,
  podeUsarResumoDoServidor,
  prazoDoEdital,
  processosEmAtencao,
  proximaOrdenacao,
  recortar,
  resumoDoRelatorio,
  resumoPorEtapa,
  riscosCriticos,
  seloDoCronograma,
  statusCanonico,
  statusOperacional,
  taxaDeOciosidade,
  textosDaVisaoGeral,
  unidadesComMaisDeUmProcesso,
  urgenciaDoCronograma,
  valoresDoStatus,
} from "../src/lib/visao-geral.js";

/*
  As regras da Visão geral (src/lib/visao-geral.js), que moravam no
  legacy-app.js (applyFilters, renderKpis, renderStatusSummary,
  renderMultiUnits, renderChart, renderRisks, renderTable, exportCSV) e nos
  remendos health-* da tabela e do gráfico.
*/

const LINHAS = [
  {
    id: 1,
    unidade: "DSEI Xingu",
    edital: "03/2026",
    etapa: "Entrevistas",
    status: "Em Andamento",
    risco: "Alto",
    uf: "MT",
    vagas_total: 10,
    contratados: 4,
    vagas_ociosas: 6,
    inscritos: 80,
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
    contratados: 8,
    vagas_ociosas: 0,
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
];

const comFiltros = (parcial) => ({ ...filtrosVazios(), ...parcial });

describe("filtros", () => {
  it("ordena as opções pelo fluxo: edital por ano e número, etapa, status e risco", () => {
    expect(
      ["03/2026", "Edital sem número", "11/2025", "01/2026"].sort((a, b) =>
        compararValoresDoFiltro("edital", a, b),
      ),
    ).toEqual(["11/2025", "01/2026", "03/2026", "Edital sem número"]);
    expect(
      ["Entrevistas", "Elaboração do Edital", "Análise Curricular"].sort(
        (a, b) => compararValoresDoFiltro("etapa", a, b),
      ),
    ).toEqual(["Elaboração do Edital", "Análise Curricular", "Entrevistas"]);
    expect(
      ["Baixo", "Alto", "Médio"].sort((a, b) =>
        compararValoresDoFiltro("risco", a, b),
      ),
    ).toEqual(["Alto", "Médio", "Baixo"]);
  });

  it("as opções de um campo seguem os outros filtros (encadeiam)", () => {
    const opcoes = opcoesDosFiltros(LINHAS, comFiltros({ uf: ["RR"] }));
    expect(opcoes.unidade).toEqual(["DSEI Yanomami"]);
    // O próprio campo não se recorta: a UF continua oferecendo todas.
    expect(opcoes.uf).toEqual(["DF", "MT", "RR"]);
    // "em andamento" e "Em Andamento" são uma opção só (sem acento, sem caixa).
    expect(opcoesDosFiltros(LINHAS, filtrosVazios()).status).toHaveLength(2);
  });

  it("poda a seleção que deixou de existir, e devolve os mesmos filtros se nada mudou", () => {
    const filtros = comFiltros({ unidade: ["DSEI Fechado"], uf: ["mt"] });
    // A seleção que sobrevive fica com o rótulo da opção ("mt" → "MT").
    expect(podarFiltros(LINHAS, filtros)).toEqual(comFiltros({ uf: ["MT"] }));
    const validos = comFiltros({ uf: ["MT"] });
    expect(podarFiltros(LINHAS, validos)).toBe(validos);
  });

  it("normaliza o que vem do navegador", () => {
    expect(
      normalizarFiltros({ unidade: [" A ", "A", ""], outro: ["x"], uf: "MT" }),
    ).toEqual(comFiltros({ unidade: ["A"] }));
    expect(normalizarFiltros("lixo")).toEqual(filtrosVazios());
  });
});

describe("recorte", () => {
  it("filtra por campo, pela busca (sem acento) e pelo DSEI aberto no mapa", () => {
    const ids = (lista) => lista.map((l) => l.id).sort();
    expect(
      ids(recortar(LINHAS, { filtros: comFiltros({ uf: ["mt"] }) })),
    ).toEqual([1, 2]);
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
  });

  it("sem ordenação, a fila do Núcleo (risco, depois ociosas); com ela, a coluna", () => {
    const fila = recortar(LINHAS, { filtros: filtrosVazios() });
    expect(fila.map((l) => l.id)).toEqual([1, 3, 2, 4]);
    const porVagas = recortar(LINHAS, {
      filtros: filtrosVazios(),
      ordenacao: { campo: "vagas_total", direcao: "desc" },
    });
    expect(porVagas.map((l) => l.id)).toEqual([1, 3, 2, 4]);
    const porUnidade = recortar(LINHAS, {
      filtros: filtrosVazios(),
      ordenacao: { campo: "unidade", direcao: "asc" },
    });
    expect(porUnidade[0].unidade).toBe("CASAI Brasília");
  });

  it("o cabeçalho alterna crescente, decrescente e sem ordem", () => {
    let o = proximaOrdenacao({ campo: "", direcao: "" }, "edital");
    expect(o).toEqual({ campo: "edital", direcao: "asc" });
    o = proximaOrdenacao(o, "edital");
    expect(o).toEqual({ campo: "edital", direcao: "desc" });
    expect(proximaOrdenacao(o, "edital")).toEqual({ campo: "", direcao: "" });
    expect(proximaOrdenacao(o, "risco")).toEqual({
      campo: "risco",
      direcao: "asc",
    });
  });
});

describe("indicadores", () => {
  it("conta o recorte", () => {
    expect(indicadoresDaVisaoGeral(LINHAS)).toEqual({
      processos: 4,
      vagas: 25,
      contratados: 17,
      ociosas: 8,
      // Concluído não é crítico, mesmo com risco Alto.
      criticos: 2,
      inscritos: 143,
    });
  });

  it("o resumo do servidor troca os números, menos Críticos, e só sem recorte com a área inteira", () => {
    const resumo = {
      kpis: {
        processos_ativos: 9,
        vagas_total: 90,
        contratados: 30,
        vagas_ociosas: 60,
        inscritos: 900,
      },
    };
    expect(indicadoresDaVisaoGeral(LINHAS, resumo)).toMatchObject({
      processos: 9,
      vagas: 90,
      criticos: 2,
    });
    const base = {
      resumo,
      temRecorte: false,
      linhasDaArea: 4,
      totalDeLinhas: 4,
    };
    expect(podeUsarResumoDoServidor(base)).toBe(true);
    expect(podeUsarResumoDoServidor({ ...base, temRecorte: true })).toBe(false);
    expect(podeUsarResumoDoServidor({ ...base, totalDeLinhas: 7 })).toBe(false);
    expect(podeUsarResumoDoServidor({ ...base, resumo: null })).toBe(false);
  });

  it("o KPI Críticos filtra por Médio/Alto", () => {
    expect(riscosCriticos(["Alto", "Baixo", "Medio"])).toEqual([
      "Alto",
      "Medio",
    ]);
    expect(filtroDeRiscoCriticoAtivo(comFiltros({ risco: ["Alto"] }))).toBe(
      true,
    );
    expect(
      filtroDeRiscoCriticoAtivo(comFiltros({ risco: ["Alto", "Baixo"] })),
    ).toBe(false);
    expect(filtroDeRiscoCriticoAtivo(filtrosVazios())).toBe(false);
  });
});

describe("blocos", () => {
  it("resumo por etapa: contagem, porcentagem e tom; vazio vira 'Não informado'", () => {
    const etapas = resumoPorEtapa(LINHAS);
    expect(etapas).toHaveLength(4);
    expect(etapas.find((e) => e.etapa === "Entrevistas")).toEqual({
      etapa: "Entrevistas",
      quantos: 1,
      pct: 25,
      tom: "info",
    });
    expect(etapas.some((e) => e.etapa === "Não informado")).toBe(true);
  });

  it("status operacional agrupa grafias e chama o vazio de 'Cronograma pendente'", () => {
    const { total, itens } = statusOperacional(LINHAS);
    expect(total).toBe(4);
    expect(itens[0]).toEqual({
      status: "Em andamento",
      quantos: 2,
      pct: 50,
      tom: "info",
    });
    expect(statusCanonico("")).toBe("Cronograma pendente");
    expect(statusCanonico("Cancelada")).toBe("Cancelado");
    expect(
      valoresDoStatus("Em andamento", ["Em Andamento", "em andamento", "X"]),
    ).toEqual(["Em Andamento", "em andamento"]);
  });

  it("unidades com mais de um processo e processos em atenção", () => {
    expect(unidadesComMaisDeUmProcesso(LINHAS)).toEqual([
      { unidade: "DSEI Xingu", quantos: 2 },
    ]);
    expect(processosEmAtencao(LINHAS).map((l) => l.id)).toEqual([1, 2]);
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
    expect(prazoDoEdital({ data_fim: "2026-09-20" }, hoje).rotulo).toBe(
      "Prazo do edital encerrado",
    );
    expect(prazoDoEdital({ status: "Cancelada" }, hoje).rotulo).toBe(
      "Processo cancelado",
    );
    expect(prazoDoEdital({ data_fim: "" }, hoje)).toBeNull();
  });

  it("cronograma: atrasado, perto, sem cronograma; o selo some em concluído", () => {
    const base = { status: "Em andamento", cronograma_automatico: true };
    expect(
      urgenciaDoCronograma({ ...base, cronograma_dias_para_proxima: -2 }),
    ).toEqual({ tom: "danger", rotulo: "Etapa atrasada há 2 dia(s)" });
    expect(
      urgenciaDoCronograma({ ...base, cronograma_dias_para_proxima: 6 }).tom,
    ).toBe("warning");
    expect(
      urgenciaDoCronograma({
        ...base,
        cronograma_dias_para_proxima: null,
        cronograma_proxima_atividade: "Entrevistas",
      }),
    ).toEqual({ tom: "info", rotulo: "Próxima: Entrevistas" });
    expect(seloDoCronograma({ status: "Em andamento" })).toMatchObject({
      rotulo: "Sem cronograma",
      titulo: "Cronograma ainda não cadastrado em Editais",
    });
    expect(seloDoCronograma({ status: "Concluído" })).toBeNull();
  });

  it("taxa de ociosas e datas", () => {
    expect(taxaDeOciosidade({ vagas_total: 10, vagas_ociosas: 6 })).toEqual({
      pct: 60,
      nivel: "critical",
    });
    expect(taxaDeOciosidade({ vagas_total: 0, vagas_ociosas: 3 }).pct).toBe(0);
    expect(dataCurta("2026-10-01T10:00:00")).toBe("01/10/2026");
  });

  it("colunas: só as conhecidas, na ordem da tabela, nunca nenhuma", () => {
    expect(normalizarColunas(["risco", "edital", "x"])).toEqual([
      "edital",
      "risco",
    ]);
    expect(normalizarColunas(null)).toHaveLength(11);
    expect(alternarColuna(["edital"], "edital", false)).toEqual(["edital"]);
    expect(alternarColuna(["risco"], "unidade", true)).toEqual([
      "unidade",
      "risco",
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
  it("CSV com ; e aspas, sem fórmula de planilha", () => {
    const csv = csvDaVisaoGeral([
      { unidade: '=HYPERLINK("x")', edital: 'A "B"', observacoes: "1\n2" },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [cabecalho, linha] = csv.slice(1).split("\n");
    expect(cabecalho.split(";")[0]).toBe('"Unidade"');
    expect(linha).toContain(`"'=HYPERLINK(""x"")"`);
    expect(linha).toContain('"A ""B"""');
    expect(linha).toContain('"1 2"');
  });

  it("nome do arquivo pela área e pelo dia", () => {
    expect(nomeDoCsv("saude-indigena", new Date(2026, 9, 1))).toBe(
      "AgSUS_Monitora_SaudeIndigena_20261001.csv",
    );
  });

  it("o cabeçalho do PDF diz os filtros e os números do recorte", () => {
    expect(
      resumoDoRelatorio({
        filtros: comFiltros({ uf: ["MT"] }),
        busca: "médico",
        linhas: LINHAS.slice(0, 2),
      }),
    ).toEqual({
      filtros: "UF: MT · Busca: médico",
      processos: 2,
      vagas: 15,
      contratados: 9,
      ociosas: 6,
      pctOciosas: 40,
    });
    expect(resumoDoRelatorio({ filtros: filtrosVazios() }).filtros).toBe(
      "Nenhum filtro aplicado (todos os processos)",
    );
  });
});

describe("textos de Configurações", () => {
  it("vale o publicado; vazio cai no padrão", () => {
    const valores = new Map([
      ["kpi_vagas_label", "Vagas imediatas"],
      ["filter_title", "  "],
      ["filter_subtitle", "Escolha o recorte"],
    ]);
    const textos = textosDaVisaoGeral((chave) => valores.get(chave));
    expect(textos.rotulos.kpi_vagas_label).toBe("Vagas imediatas");
    expect(textos.rotulos.kpi_processos_label).toBe("Processos");
    expect(textos.filtros).toBe("Refinar resultados");
    expect(textos.filtrosSubtitulo).toBe("Escolha o recorte");
    expect(textos.mostrarFiltros).toBe("Mostrar filtros");
  });
});
