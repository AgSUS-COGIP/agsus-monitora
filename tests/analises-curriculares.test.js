import { describe, expect, it } from "vitest";
import {
  analisesPorResponsavel,
  apararSelecao,
  calcularKpis,
  csvDasAnalises,
  dataDaPlanilha,
  descricaoDoRecorte,
  detalheDaAnalise,
  editalDaLinha,
  filtrarLinhas,
  filtrarPelaBuscaDaFila,
  FILTROS_VAZIOS,
  formatarData,
  linhasDoPayload,
  marcasDoRecorte,
  normalizarEscopo,
  opcoesDosFiltros,
  pendenciasPrioritarias,
  prepararLinhas,
  quantosFiltros,
  recorteVisual,
  rotuloDoEscopo,
  SEM_RESPONSAVEL,
  temMunicipio,
  tendenciaDiaria,
  tomDoStatus,
  ultimaAtualizacao,
  urlSegura,
  validacaoDaJanela,
} from "../src/lib/analises-curriculares.js";
import { urlDaPlanilhaGoogle } from "../src/lib/planilhas.js";

/*
  As regras da tela de Análises curriculares (src/modulos/analises/): o que o
  antigo painel (analises-app.js e os sete remendos) fazia, agora em funções
  puras — payload, janela oficial, filtros em cascata, KPIs, gráficos,
  pendências, recorte, gaveta e CSV.
*/

const AGORA = new Date(2026, 9, 1, 12); // 01/10/2026

const linha = (extra = {}) => ({
  id: "a1",
  grupo: "Saúde Indígena",
  unidade: "DSEI Yanomami",
  edital: "10/2026",
  codigo_vaga: "V-1",
  nome_vaga: "Enfermeiro 40h",
  candidato: "Ana",
  categoria: "Saúde",
  modalidade_concorrencia: "Ampla concorrência",
  status_consolidado: "Pendente",
  etapa: "",
  responsavel_analise: "Carla",
  data_analise: "",
  ...extra,
});

const prontas = (linhas, opcoes = {}) =>
  prepararLinhas(linhas, { area: "saude-indigena", agora: AGORA, ...opcoes });

describe("situação do processo", () => {
  it("só ativo, inativo ou todos; o resto vira ativo", () => {
    expect(normalizarEscopo("TODOS")).toBe("todos");
    expect(normalizarEscopo("xyz")).toBe("ativo");
    expect(rotuloDoEscopo("inativo")).toBe("Inativo");
  });
});

describe("linhas do payload", () => {
  it("colunas pelo nome, o envelope em cada linha e o responsável em branco", () => {
    const linhas = linhasDoPayload({
      grupo: "SEDE",
      edital_status: "Ativo",
      columns: ["id", "candidato", "responsavel_analise"],
      rows: [
        ["a1", "Ana", "Carla"],
        ["a2", "Bia", "  "],
      ],
    });
    expect(linhas[0]).toEqual({
      id: "a1",
      candidato: "Ana",
      responsavel_analise: "Carla",
      grupo: "SEDE",
      edital_status: "Ativo",
    });
    expect(linhas[1].responsavel_analise).toBe(SEM_RESPONSAVEL);
    expect(linhas[1].responsavel_ausente).toBe(true);
  });

  it("payload sem colunas é erro", () => {
    expect(() => linhasDoPayload({ rows: [] })).toThrow(/inválido/);
  });
});

describe("datas da planilha", () => {
  it("dd/mm/aaaa, aaaa-mm-dd e ISO; outro formato fica sem data", () => {
    expect(dataDaPlanilha("05/09/2026")).toEqual(new Date(2026, 8, 5));
    expect(dataDaPlanilha("2026-09-05")).toEqual(new Date(2026, 8, 5));
    expect(dataDaPlanilha("2026-09-05T10:00:00Z")).toBeInstanceOf(Date);
    expect(dataDaPlanilha("09-05-2026")).toBeNull();
    expect(formatarData("2026-09-05")).toBe("05/09/2026");
    expect(formatarData("semana 3")).toBe("semana 3");
  });
});

describe("janela oficial e validação", () => {
  const editais = [
    {
      grupo: "Saúde Indígena",
      unidade: "DSEI A",
      edital: "1/2026",
      ativo: "não",
    },
    { grupo: "SEDE", unidade: "Sede", edital: "2/2026", ativo: false },
    { grupo: "SEDE", unidade: "Outra", edital: "2/2026", ativo: true },
  ];

  it("casa o edital: completo, unidade + edital, único ativo, único", () => {
    expect(
      editalDaLinha(
        { grupo: "saude indigena", unidade: "dsei a", edital: "1/2026" },
        editais,
      ).match,
    ).toBe("full");
    expect(
      editalDaLinha({ unidade: "Sede", edital: "2/2026" }, editais).match,
    ).toBe("unit_edital");
    expect(
      editalDaLinha({ unidade: "X", edital: "2/2026" }, editais).match,
    ).toBe("edital_ativo_unico");
    expect(
      editalDaLinha({ unidade: "X", edital: "1/2026" }, editais).match,
    ).toBe("edital_unico");
    expect(
      editalDaLinha({ unidade: "X", edital: "9/2026" }, editais),
    ).toBeNull();
  });

  it("sem data, no futuro, sem janela, fora e dentro do período", () => {
    const v = (extra) => validacaoDaJanela(extra, AGORA).status;
    expect(v({})).toBe("SEM_DATA");
    expect(v({ data_analise: "02/10/2026" })).toBe("DATA_FUTURA");
    expect(v({ data_analise: "01/10/2026" })).toBe("SEM_JANELA");
    expect(
      v({
        data_analise: "01/09/2026",
        data_inicio_analise: "2026-09-10",
        data_fim_analise: "2026-09-20",
      }),
    ).toBe("FORA_PERIODO");
    expect(
      v({
        data_analise: "15/09/2026",
        data_inicio_analise: "2026-09-10",
        data_fim_analise: "2026-09-20",
      }),
    ).toBe("DENTRO_PERIODO");
    expect(validacaoDaJanela({ data_analise: "02/10/2026" }, AGORA).fora).toBe(
      true,
    );
  });

  it("prepara as linhas: janela do edital, validação, chave e índices (sem mudar a entrada)", () => {
    const entrada = [
      linha({
        unidade: "DSEI A",
        edital: "1/2026",
        data_analise: "15/09/2026",
        analise: "Parecer completo",
      }),
    ];
    const [pronta] = prontas(entrada, {
      editais: [
        {
          grupo: "Saúde Indígena",
          unidade: "DSEI A",
          edital: "1/2026",
          data_inicio_analise: "2026-09-10",
          data_fim_analise: "2026-09-20",
        },
      ],
    });
    expect(pronta.data_inicio_analise).toBe("2026-09-10");
    expect(pronta.data_validacao_status).toBe("DENTRO_PERIODO");
    expect(pronta.__chave).toBe("a1");
    expect(pronta.__busca).toContain("parecer completo");
    expect(pronta.municipio_uf).toBeUndefined();
    expect(entrada[0].data_validacao_status).toBeUndefined();
    expect(prontas([linha({ id: "" })])[0].__chave).toBe("linha-0");
  });

  it("fora da Saúde Indígena, o município/UF sai do nome da vaga", () => {
    const [pronta] = prepararLinhas(
      [linha({ nome_vaga: "Médico UBS móvel Seropédica/RJ 40h" })],
      { area: "projetos", agora: AGORA },
    );
    expect(pronta.municipio_uf).toBe("Seropédica/RJ");
    expect(temMunicipio([pronta], "projetos")).toBe(true);
    expect(temMunicipio([pronta], "saude-indigena")).toBe(false);
  });
});

describe("filtros", () => {
  const linhas = prontas([
    linha({
      id: "1",
      unidade: "DSEI A",
      edital: "2/2026",
      status_consolidado: "Aprovado",
      modalidade_concorrencia: "Ampla concorrência; Pretos e pardos",
    }),
    linha({
      id: "2",
      unidade: "DSEI B",
      edital: "10/2026",
      status_consolidado: "Pendente",
      candidato: "João",
    }),
    linha({
      id: "3",
      unidade: "DSEI A",
      edital: "10/2026",
      status_consolidado: "Revisar",
      data_analise: "02/10/2026",
    }),
  ]);
  const ids = (lista) => lista.map((l) => l.id);

  it("valores de um filtro somam (ou); filtros diferentes cortam (e); sem acento nem caixa", () => {
    expect(
      ids(filtrarLinhas(linhas, { ...FILTROS_VAZIOS, unidade: ["dsei a"] })),
    ).toEqual(["1", "3"]);
    expect(
      ids(
        filtrarLinhas(linhas, {
          ...FILTROS_VAZIOS,
          unidade: ["DSEI A"],
          edital: ["10/2026"],
        }),
      ),
    ).toEqual(["3"]);
    expect(
      ids(filtrarLinhas(linhas, { ...FILTROS_VAZIOS, busca: "joao" })),
    ).toEqual(["2"]);
    expect(
      ids(
        filtrarLinhas(linhas, {
          ...FILTROS_VAZIOS,
          modalidade: ["Pretos e pardos"],
        }),
      ),
    ).toEqual(["1"]);
    expect(
      ids(
        filtrarLinhas(linhas, {
          ...FILTROS_VAZIOS,
          validacao: ["DATA_FUTURA"],
        }),
      ),
    ).toEqual(["3"]);
  });

  it("opções em cascata: as de um filtro saem das linhas que passam nos outros", () => {
    const opcoes = opcoesDosFiltros(linhas, {
      ...FILTROS_VAZIOS,
      unidade: ["DSEI A"],
    });
    // A própria unidade não se corta.
    expect(opcoes.unidade.map((o) => o.value)).toEqual(["DSEI A", "DSEI B"]);
    // Os editais, sim — e em ordem numérica.
    expect(opcoes.edital.map((o) => o.value)).toEqual(["2/2026", "10/2026"]);
    expect(opcoes.status.map((o) => o.value)).toEqual(["Aprovado", "Revisar"]);
    expect(opcoes.validacao.find((o) => o.value === "DATA_FUTURA").label).toBe(
      "Data no futuro",
    );
    expect(opcoes.modalidade.map((o) => o.value)).toEqual([
      "Ampla concorrência",
      "Pretos e pardos",
    ]);
  });

  it("a seleção fica só com o que existe depois de uma carga nova", () => {
    const filtros = { ...FILTROS_VAZIOS, unidade: ["dsei a", "DSEI Z"] };
    expect(apararSelecao(filtros, linhas).unidade).toEqual(["DSEI A"]);
    const sem = { ...FILTROS_VAZIOS };
    expect(apararSelecao(sem, linhas)).toBe(sem);
  });

  it("conta os filtros em uso (a busca conta um) e só os avançados", () => {
    const filtros = {
      ...FILTROS_VAZIOS,
      unidade: ["A"],
      categoria: ["B"],
      busca: " x ",
    };
    expect(quantosFiltros(filtros)).toBe(3);
    expect(quantosFiltros(filtros, { soAvancados: true })).toBe(2);
    expect(quantosFiltros(FILTROS_VAZIOS)).toBe(0);
  });
});

describe("KPIs, gráficos e pendências", () => {
  const linhas = prontas([
    linha({
      id: "1",
      status_consolidado: "Aprovado",
      responsavel_analise: "Carla",
      data_analise: "10/09/2026",
    }),
    linha({
      id: "2",
      status_consolidado: "Reprovado",
      responsavel_analise: "Carla",
      data_analise: "10/09/2026",
    }),
    linha({
      id: "3",
      status_consolidado: "Revisar",
      responsavel_analise: "Diego",
      data_analise: "02/10/2026",
    }),
    linha({
      id: "4",
      status_consolidado: "Pendente",
      responsavel_analise: SEM_RESPONSAVEL,
      responsavel_ausente: true,
      etapa: "Triagem",
    }),
    linha({
      id: "5",
      status_consolidado: "Outro",
      responsavel_analise: "Diego",
      data_analise: "09/09/2026",
      data_inicio_analise: "2026-09-10",
    }),
  ]);

  it("os KPIs e a taxa de conclusão", () => {
    expect(calcularKpis(linhas)).toEqual({
      total: 5,
      analisado: 3,
      pendente: 1,
      revisar: 1,
      aprovado: 1,
      reprovado: 1,
      taxa: 40,
    });
    expect(calcularKpis([]).taxa).toBe(0);
  });

  it("o recorte do KPI (status) e da barra do gráfico (responsável)", () => {
    expect(
      recorteVisual(linhas, { kpi: "analisado" }).map((l) => l.id),
    ).toEqual(["1", "2", "3"]);
    expect(
      recorteVisual(linhas, { responsavel: "Diego" }).map((l) => l.id),
    ).toEqual(["3", "5"]);
    expect(recorteVisual(linhas, {})).toHaveLength(5);
  });

  it("carga por responsável empilhada; status desconhecido conta como Pendente", () => {
    const carga = analisesPorResponsavel(linhas);
    expect(carga[0]).toEqual({
      rotulo: "Carla",
      Pendente: 0,
      Revisar: 0,
      Aprovado: 1,
      Reprovado: 1,
      total: 2,
    });
    expect(carga.find((c) => c.rotulo === "Diego")).toMatchObject({
      Revisar: 1,
      Pendente: 1,
    });
    expect(analisesPorResponsavel(linhas, 1)).toHaveLength(1);
  });

  it("tendência diária em ordem, com fora do período e data no futuro", () => {
    expect(tendenciaDiaria(linhas)).toEqual([
      expect.objectContaining({
        rotulo: "09/09/2026",
        valor: 1,
        fora: 1,
        futuras: 0,
      }),
      expect.objectContaining({ rotulo: "10/09/2026", valor: 2, fora: 0 }),
      expect.objectContaining({ rotulo: "02/10/2026", valor: 1, futuras: 1 }),
    ]);
  });

  it("pendências na ordem de gravidade, com o atalho de cada uma (inclui sem responsável)", () => {
    const pendencias = pendenciasPrioritarias(linhas);
    expect(pendencias.map((p) => [p.chave, p.tom, p.atalho])).toEqual([
      ["data-futura", "perigo", { tipo: "validacao", valor: "DATA_FUTURA" }],
      [
        "fora-do-periodo",
        "perigo",
        { tipo: "validacao", valor: "FORA_PERIODO" },
      ],
      [
        "sem-responsavel",
        "perigo",
        { tipo: "responsavel", valor: SEM_RESPONSAVEL },
      ],
      ["pendentes", "alerta", { tipo: "kpi", valor: "pendente" }],
      ["em-revisao", "alerta", { tipo: "kpi", valor: "revisar" }],
      ["etapa-sem-data", "alerta", { tipo: "validacao", valor: "SEM_DATA" }],
    ]);
    expect(pendencias[0].detalhe).toBe(
      "1 análise(s) com data depois de hoje. Corrija na planilha de origem.",
    );
    expect(pendenciasPrioritarias([])).toEqual([]);
  });
});

describe("recorte ativo", () => {
  it("a frase com situação, filtros, busca, KPI e responsável do gráfico", () => {
    expect(
      descricaoDoRecorte({
        escopo: "todos",
        filtros: {
          ...FILTROS_VAZIOS,
          unidade: ["A", "B"],
          validacao: ["FORA_PERIODO"],
          busca: "ana",
        },
        kpi: "pendente",
        responsavel: "Carla",
      }),
    ).toBe(
      "Recorte ativo: Situação do processo: Todos · Unidade: A, B · Validação da janela: Fora do período · Busca: ana · KPI: Pendentes · Responsável no gráfico: Carla",
    );
    expect(
      descricaoDoRecorte({ escopo: "ativo", filtros: FILTROS_VAZIOS }),
    ).toBe("Recorte ativo: Situação do processo: Ativo");
  });

  it("as marcas: janela única ou várias, fora do período e sem janela", () => {
    const uma = prontas([
      linha({
        data_inicio_analise: "2026-09-01",
        data_fim_analise: "2026-09-30",
        data_analise: "15/10/2025",
      }),
    ]);
    expect(marcasDoRecorte(uma).map((m) => [m.texto, m.tom])).toEqual([
      ["Janela oficial: 01/09/2026 a 30/09/2026", undefined],
      ["1 análise(s) fora do período", "alerta"],
    ]);
    const varias = prontas([
      linha({ data_inicio_analise: "2026-09-01" }),
      linha({ data_inicio_analise: "2026-08-01" }),
      linha({ data_analise: "01/09/2026" }),
    ]);
    expect(marcasDoRecorte(varias).map((m) => [m.texto, m.tom])).toEqual([
      ["2 janelas oficiais no recorte", undefined],
      ["0 análise(s) fora do período", "sucesso"],
      ["1 sem janela configurada", "alerta"],
    ]);
  });
});

describe("fila, status e atualização", () => {
  it("a busca da fila procura também a etapa", () => {
    const linhas = prontas([
      linha({ id: "1", etapa: "Triagem" }),
      linha({ id: "2" }),
    ]);
    expect(filtrarPelaBuscaDaFila(linhas, "triagem").map((l) => l.id)).toEqual([
      "1",
    ]);
    expect(filtrarPelaBuscaDaFila(linhas, "")).toBe(linhas);
  });

  it("tom do selo de status", () => {
    expect(tomDoStatus("Aprovado")).toBe("aprovado");
    expect(tomDoStatus("REPROVADO")).toBe("reprovado");
    expect(tomDoStatus("x")).toBe("neutro");
  });

  it("a hora do dado mais novo: das linhas ou do envelope", () => {
    expect(
      ultimaAtualizacao([
        { updated_at: "2026-09-01T10:00:00Z" },
        { updated_at: "2026-09-03T10:00:00Z" },
      ]),
    ).toBe("2026-09-03T10:00:00Z");
    expect(
      ultimaAtualizacao([], { atualizado_em: "2026-09-30T08:00:00Z" }),
    ).toBe("2026-09-30T08:00:00Z");
    expect(ultimaAtualizacao([], null)).toBeNull();
  });
});

describe("detalhe da gaveta", () => {
  it("só link http(s) absoluto", () => {
    expect(urlSegura("https://drive.google.com/x")).toBe(
      "https://drive.google.com/x",
    );
    expect(urlSegura("javascript:alert(1)")).toBe("");
    expect(urlSegura("/relativo.pdf")).toBe("");
    expect(urlSegura("")).toBe("");
  });

  it("Saúde Indígena: critério étnico e experiências; pares vazios saem", () => {
    const [pronta] = prontas([
      linha({
        etapa: "Análise",
        data_analise: "15/09/2026",
        data_inicio_analise: "2026-09-10",
        nota_final_ajustada: 7.5,
        pontuacao_escolaridade: "3",
        pontuacao_criterio_etnico: "-",
        experiencia_saude_indigena_total: "2",
        origem_arquivo_id: "1AbcDefGhijKlm",
        link_pdf: "javascript:alert(1)",
      }),
    ]);
    const d = detalheDaAnalise(pronta, "saude-indigena");
    expect(d.titulo).toBe("Ana");
    expect(d.responsavel).toBe("Carla");
    expect(d.contexto.map(([r]) => r)).toEqual([
      "Grupo",
      "Unidade",
      "Edital",
      "Código da vaga",
      "Vaga",
    ]);
    expect(d.origem).toBe(urlDaPlanilhaGoogle("1AbcDefGhijKlm"));
    expect(d.pdf).toBe("");
    expect(d.secoes.map((s) => [s.chave, s.itens])).toEqual([
      [
        "status",
        [
          ["Etapa", "Análise"],
          ["Data da análise", "15/09/2026"],
          ["Validação", "Dentro do período configurado"],
          ["Janela oficial", "10/09/2026 a --"],
        ],
      ],
      [
        "result",
        [
          ["Nota final", "7.5"],
          ["Modalidade", "Ampla concorrência"],
        ],
      ],
      [
        "score",
        [
          ["Escolaridade", "3"],
          ["Exp. Saúde Indígena", "2"],
        ],
      ],
    ]);
  });

  it("SEDE e Projetos: tempo de experiência profissional e município", () => {
    const d = detalheDaAnalise(
      linha({
        municipio_uf: "Seropédica/RJ",
        experiencia_profissional_anos: 2,
        experiencia_profissional_meses: 3,
      }),
      "projetos",
    );
    expect(d.contexto.at(-1)).toEqual(["Município/UF", "Seropédica/RJ"]);
    expect(d.secoes.find((s) => s.chave === "score").itens).toEqual([
      ["Tempo de experiência profissional", "2 anos e 3 meses"],
    ]);
  });
});

describe("CSV", () => {
  it("colunas da Saúde Indígena; quebra, ; e aspas saem; fórmula ganha apóstrofo", () => {
    const csv = csvDasAnalises(
      [
        linha({
          candidato: '=HYPERLINK("x")',
          analise: "linha 1\nlinha 2; fim",
        }),
      ],
      "saude-indigena",
    );
    const [cabecalho, primeira] = csv.split("\n");
    expect(cabecalho.split(";")).toHaveLength(16);
    expect(cabecalho).not.toContain("municipio_uf");
    expect(primeira).toContain("'=HYPERLINK('x')");
    expect(primeira).toContain("linha 1 linha 2  fim");
  });

  it("fora da Saúde Indígena, as colunas de experiência e município", () => {
    const [cabecalho] = csvDasAnalises([], "sede").split("\n");
    expect(cabecalho).toContain("experiencia_profissional_total;municipio_uf");
  });
});
