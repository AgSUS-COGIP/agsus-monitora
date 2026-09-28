import { describe, expect, it } from "vitest";
import {
  FILTROS_VAZIOS,
  alternarIndicador,
  contarIndicadores,
  evolucaoDiaria,
  experienciaPorExtenso,
  filtrarAnalises,
  filtrarSemIndicador,
  gerarCsv,
  janelaDoEdital,
  linhasDoPayload,
  linkSeguro,
  municipioDaVaga,
  nomeDoCsv,
  opcoesDosFiltros,
  porResponsavel,
  temMunicipio,
  valorDoIndicador,
} from "../src/lib/analises-da-area.js";

/*
  Regras do painel de Análises por área (src/lib/analises-da-area.js): o
  payload posicional da RPC, município pelo nome da vaga, filtros, indicadores,
  gráficos e CSV.
*/

const VAGA_SEROPEDICA =
  "Cargo 2: Enfermeiro - Responsável Técnico - UBS móvel Seropédica/RJ - Cadastro Reserva";

const COLUNAS = [
  "id",
  "unidade",
  "edital",
  "nome_vaga",
  "municipio",
  "uf",
  "candidato",
  "status_consolidado",
  "responsavel_analise",
  "data_analise",
  "nota_final_ajustada",
];

const linha = (id, extra = {}) => ({
  id,
  unidade: "Especialistas Caminhoneiros",
  edital: "30/2026",
  nome_vaga: VAGA_SEROPEDICA,
  municipio: "Seropédica",
  uf: "RJ",
  candidato: `Candidato ${id}`,
  status_consolidado: "Pendente",
  responsavel_analise: "Ana",
  data_analise: null,
  ...extra,
});

describe("município pelo nome da vaga", () => {
  it("lê município e UF de 'UBS móvel Cidade/UF'", () => {
    expect(municipioDaVaga(VAGA_SEROPEDICA)).toEqual({
      municipio: "Seropédica",
      uf: "RJ",
    });
    expect(municipioDaVaga("Cargo 1: Médico - UBS movel Cubatão/SP")).toEqual({
      municipio: "Cubatão",
      uf: "SP",
    });
  });

  it("sem o padrão, devolve vazio", () => {
    expect(municipioDaVaga("Enfermeiro - DSEI Manaus")).toEqual({
      municipio: "",
      uf: "",
    });
    expect(municipioDaVaga(null)).toEqual({ municipio: "", uf: "" });
  });
});

describe("payload posicional", () => {
  it("vira objetos pela ordem de columns", () => {
    const [primeira] = linhasDoPayload({
      columns: COLUNAS,
      rows: [
        [
          "a1",
          "Especialistas Caminhoneiros",
          "30/2026",
          VAGA_SEROPEDICA,
          "Seropédica",
          "RJ",
          "Maria",
          "Aprovado",
          "Ana",
          "2026-06-12",
          30,
        ],
      ],
    });
    expect(primeira).toMatchObject({
      id: "a1",
      candidato: "Maria",
      status_consolidado: "Aprovado",
      nota_final_ajustada: 30,
      municipio: "Seropédica",
    });
    expect(primeira.textoDeBusca).toContain("maria");
  });

  it("sem município no payload, tira do nome da vaga", () => {
    const [primeira] = linhasDoPayload({
      columns: ["id", "nome_vaga", "municipio", "uf"],
      rows: [["b1", "Médico - UBS móvel Irati/PR", null, null]],
    });
    expect(primeira.municipio).toBe("Irati");
    expect(primeira.uf).toBe("PR");
  });

  it("payload vazio ou quebrado não quebra a tela", () => {
    expect(linhasDoPayload(null)).toEqual([]);
    expect(linhasDoPayload({ columns: ["id"], rows: [] })).toEqual([]);
  });

  it("temMunicipio só quando alguma linha tem", () => {
    expect(temMunicipio([linha(1)])).toBe(true);
    expect(temMunicipio([{ id: 1, municipio: null }])).toBe(false);
  });
});

describe("filtros e indicadores", () => {
  const linhas = [
    linha(1, { status_consolidado: "Aprovado", responsavel_analise: "Ana" }),
    linha(2, { status_consolidado: "Reprovado", responsavel_analise: "Bruno" }),
    linha(3, { status_consolidado: "Revisar", responsavel_analise: "Ana" }),
    linha(4, {
      status_consolidado: "Pendente",
      responsavel_analise: "",
      nome_vaga: "Médico - UBS móvel Irati/PR",
      municipio: "Irati",
      uf: "PR",
    }),
  ];

  it("conta como o painel antigo: realizadas = Revisar+Aprovado+Reprovado; taxa = (Apr+Rep)/total", () => {
    expect(contarIndicadores(linhas)).toEqual({
      total: 4,
      realizadas: 3,
      pendentes: 1,
      revisar: 1,
      aprovados: 1,
      reprovados: 1,
      taxa: 50,
    });
    expect(contarIndicadores([]).taxa).toBe(0);
    expect(valorDoIndicador("taxa", { taxa: 50 })).toBe("50%");
  });

  it("indicador filtra pelos status dele; clicar de novo desliga; Total e Taxa não filtram", () => {
    expect(alternarIndicador("", "aprovados")).toBe("aprovados");
    expect(alternarIndicador("aprovados", "aprovados")).toBe("");
    expect(alternarIndicador("aprovados", "total")).toBe("");
    expect(alternarIndicador("", "taxa")).toBe("");

    const realizadas = filtrarAnalises(linhas, {
      ...FILTROS_VAZIOS,
      indicador: "realizadas",
    });
    expect(realizadas.map((l) => l.id)).toEqual([1, 2, 3]);
  });

  it("os indicadores contam o que os outros filtros deixam, sem o do indicador", () => {
    const filtros = {
      ...FILTROS_VAZIOS,
      responsavel: "Ana",
      indicador: "aprovados",
    };
    expect(filtrarSemIndicador(linhas, filtros).map((l) => l.id)).toEqual([
      1, 3,
    ]);
    expect(filtrarAnalises(linhas, filtros).map((l) => l.id)).toEqual([1]);
  });

  it("filtra por município/UF e busca sem acento", () => {
    expect(
      filtrarAnalises(linhas, { ...FILTROS_VAZIOS, municipio: "Irati/PR" }).map(
        (l) => l.id,
      ),
    ).toEqual([4]);
    expect(
      filtrarAnalises(linhas, { ...FILTROS_VAZIOS, busca: "SEROPEDICA" }).map(
        (l) => l.id,
      ),
    ).toEqual([1, 2, 3]);
    expect(
      filtrarAnalises(linhas, { ...FILTROS_VAZIOS, busca: "bruno" }).map(
        (l) => l.id,
      ),
    ).toEqual([2]);
  });

  it("opções sem repetição, status na ordem de sempre", () => {
    const opcoes = opcoesDosFiltros(linhas);
    expect(opcoes.status).toEqual([
      "Aprovado",
      "Reprovado",
      "Revisar",
      "Pendente",
    ]);
    expect(opcoes.responsaveis).toEqual(["Ana", "Bruno"]);
    expect(opcoes.municipios).toEqual(["Irati/PR", "Seropédica/RJ"]);
  });
});

describe("gráficos", () => {
  it("por responsável: empilha por status, ordena pelo total e corta no limite", () => {
    const linhas = [
      linha(1, { responsavel_analise: "Ana", status_consolidado: "Aprovado" }),
      linha(2, { responsavel_analise: "Ana", status_consolidado: "Reprovado" }),
      linha(3, {
        responsavel_analise: "Bruno",
        status_consolidado: "Aprovado",
      }),
      linha(4, { responsavel_analise: "", status_consolidado: "Pendente" }),
    ];
    const grupos = porResponsavel(linhas, 2);
    expect(grupos).toEqual([
      { responsavel: "Ana", total: 2, status: { Aprovado: 1, Reprovado: 1 } },
      { responsavel: "Bruno", total: 1, status: { Aprovado: 1 } },
    ]);
    expect(porResponsavel(linhas).at(-1).responsavel).toBe("Sem responsável");
  });

  it("evolução diária: por data, em ordem, só os últimos N dias com análise", () => {
    const linhas = [
      linha(1, { data_analise: "2026-06-12" }),
      linha(2, { data_analise: "2026-06-11T10:00:00" }),
      linha(3, { data_analise: "2026-06-12" }),
      linha(4, { data_analise: null }),
    ];
    expect(evolucaoDiaria(linhas)).toEqual([
      { dia: "2026-06-11", total: 1 },
      { dia: "2026-06-12", total: 2 },
    ]);
    expect(evolucaoDiaria(linhas, 1)).toEqual([
      { dia: "2026-06-12", total: 2 },
    ]);
  });
});

describe("detalhe", () => {
  it("experiência por extenso", () => {
    expect(experienciaPorExtenso(8, 2, 15)).toBe("8 anos, 2 meses e 15 dias");
    expect(experienciaPorExtenso(1, 1, null)).toBe("1 ano e 1 mês");
    expect(experienciaPorExtenso(null, null, null)).toBe("");
  });

  it("janela do edital: pela unidade, ou pelo número quando é o único", () => {
    const editais = [
      {
        unidade: "Agora tem Especialistas Caminhoneiros",
        edital: "30/2026",
        data_inicio_analise: "2026-06-11",
      },
    ];
    expect(janelaDoEdital(editais, linha(1))?.data_inicio_analise).toBe(
      "2026-06-11",
    );
    const dois = [
      { unidade: "DSEI A", edital: "10/2026", data_inicio_analise: "a" },
      { unidade: "DSEI B", edital: "10/2026", data_inicio_analise: "b" },
    ];
    expect(
      janelaDoEdital(dois, { unidade: "dsei b", edital: "10/2026" })
        ?.data_inicio_analise,
    ).toBe("b");
    expect(
      janelaDoEdital(dois, { unidade: "DSEI C", edital: "10/2026" }),
    ).toBeNull();
  });

  it("só aceita link http(s)", () => {
    expect(linkSeguro("https://drive.google.com/x")).toBe(
      "https://drive.google.com/x",
    );
    expect(linkSeguro("javascript:alert(1)")).toBe("");
  });
});

describe("CSV", () => {
  it("usa ; e BOM, aspas escapadas, vírgula decimal e neutraliza fórmula", () => {
    const csv = gerarCsv(
      [
        linha(1, {
          candidato: '=HYPERLINK("x")',
          nota_final_ajustada: 30.5,
          experiencia_profissional_anos: 8,
        }),
      ],
      { area: "projetos", comMunicipio: true },
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const [cabecalho, corpo] = csv.slice(1).split("\r\n");
    expect(cabecalho).toContain('"Município";"UF"');
    expect(cabecalho).toContain('"Experiência (anos)"');
    expect(cabecalho).not.toContain("Critério étnico");
    expect(corpo).toContain(`"'=HYPERLINK(""x"")"`);
    expect(corpo).toContain('"30,5"');
  });

  it("Saúde Indígena leva critério étnico e experiências SI/AB, sem município", () => {
    const [cabecalho] = gerarCsv([], { area: "saude-indigena" })
      .slice(1)
      .split("\r\n");
    expect(cabecalho).toContain("Pontuação critério étnico");
    expect(cabecalho).toContain("Experiência saúde indígena");
    expect(cabecalho).not.toContain("Município");
  });

  it("nome do arquivo com a área e a data", () => {
    expect(nomeDoCsv("projetos", new Date(2026, 8, 28))).toBe(
      "analises-projetos-2026-09-28.csv",
    );
  });
});
