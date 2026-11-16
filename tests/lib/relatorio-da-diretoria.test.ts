import { describe, expect, it } from "vitest";
import {
  aprovadosNoRecorte,
  chaveDoTexto,
  linhasDeAprovados,
  linhasPorCargo,
  normalizarAprovadosDaDiretoria,
  normalizarVagasPorCargo,
  vagasPeloTexto,
} from "../../src/lib/relatorio-da-diretoria.ts";
import {
  conteudoDoRelatorio,
  MODELOS_DO_RELATORIO,
  normalizarEscolha,
  planilhasDoRelatorio,
  secoesPermitidas,
} from "../../src/lib/relatorio-da-visao-geral.ts";
import { filtrosVazios } from "../../src/lib/visao-geral.ts";

const SI = "e1";
const PROJ = "e2";

/* Dados fictícios no formato de listar_vagas_por_cargo_da_visao_geral. */
const bruto = {
  vagas: [
    {
      monitoramento_id: SI,
      codigo: "178534",
      vaga: "Enfermeiro - CASAI Brasília - 2 vagas (1 AC + 1 Pretos e Pardos + CR)",
      cargo:
        "Enfermeiro - CASAI Brasília - 2 vagas (1 AC + 1 Pretos e Pardos + CR)",
      unidade: "CASAI Brasília",
      inscritos: 1366,
    },
    {
      monitoramento_id: SI,
      codigo: "178532",
      vaga: "Assistente Social 30h - CASAI Brasília - 1 vaga (1 AC + CR)",
      cargo: "Assistente Social 30h - CASAI Brasília - 1 vaga (1 AC + CR)",
      unidade: "CASAI Brasília",
      inscritos: 244,
    },
    {
      monitoramento_id: SI,
      codigo: "178535",
      vaga: "Farmacêutico - CASAI Brasília - Cadastro Reserva",
      cargo: "Farmacêutico - CASAI Brasília - Cadastro Reserva",
      unidade: "CASAI Brasília",
      inscritos: 486,
    },
    {
      monitoramento_id: PROJ,
      codigo: null,
      vaga: "CARGO 1: ASSISTENTE DE PROJETO – GAB DAIS – SEDE AGSUS",
      cargo: "CARGO 1: ASSISTENTE DE PROJETO – GAB DAIS – SEDE AGSUS",
      unidade: "Sede",
      inscritos: 900,
    },
    {
      monitoramento_id: PROJ,
      codigo: "128074",
      vaga: "128074",
      cargo: "Assistente de Projetos",
      unidade: "Sede",
      inscritos: "12",
    },
    { monitoramento_id: "", vaga: "sem edital" },
    "lixo",
  ],
  quadro: [
    {
      monitoramento_id: SI,
      cargo: "Enfermeiro",
      lotacao: "CASAI Brasília",
      vagas: 2,
      reserva: true,
    },
    /* Sem acento e sem carga horária: casa com "Assistente Social 30h". */
    {
      monitoramento_id: SI,
      cargo: "Assistente social",
      lotacao: null,
      vagas: 1,
    },
    { monitoramento_id: SI, cargo: "Farmaceutico", lotacao: "", vagas: 0 },
    { monitoramento_id: SI, cargo: "Psicólogo", lotacao: "", vagas: 1 },
  ],
  lista: [
    {
      monitoramento_id: SI,
      codigo_vaga: "178534",
      cargo: "Enfermeiro …",
      aprovados: 7,
    },
    {
      monitoramento_id: SI,
      codigo_vaga: "178532",
      cargo: "Assistente …",
      aprovados: 2,
    },
    /* Vaga que não está na Seleção: linha própria. */
    {
      monitoramento_id: SI,
      codigo_vaga: "999999",
      cargo: "Nutricionista - CASAI Brasília - Cadastro Reserva",
      aprovados: 3,
    },
    /* Projetos: o texto da vaga no lugar do código. */
    {
      monitoramento_id: PROJ,
      codigo_vaga: "CARGO 1: ASSISTENTE DE PROJETO – GAB DAIS – SEDE AGSUS",
      cargo: "CARGO 1: ASSISTENTE DE PROJETO – GAB DAIS – SEDE AGSUS",
      aprovados: 40,
    },
    /* SEDE: "128074 CARGO" → o número do começo. */
    {
      monitoramento_id: PROJ,
      codigo_vaga: "128074 ASSISTENTE DE PROJETOS",
      cargo: "128074 ASSISTENTE DE PROJETOS",
      aprovados: 5,
    },
    { monitoramento_id: "fora", codigo_vaga: "1", cargo: "x", aprovados: 1 },
  ],
};

const editais = [
  { id: PROJ, edital: "04/2026", unidade: "Sede" },
  { id: SI, edital: "100/2026", unidade: "CASAI Brasília" },
];

describe("aba 2: vagas por cargo", () => {
  it("normaliza a resposta e descarta o que não serve", () => {
    const dados = normalizarVagasPorCargo(bruto);
    expect(dados.vagas).toHaveLength(5);
    expect(dados.vagas[4]?.inscritos).toBe(12);
    expect(dados.vagas[3]?.codigo).toBe("");
    expect(dados.quadro).toHaveLength(4);
    expect(dados.quadro[0]?.reserva).toBe(true);
    expect(dados.lista).toHaveLength(6);
    expect(normalizarVagasPorCargo(null)).toEqual({
      vagas: [],
      quadro: [],
      lista: [],
    });
  });

  it("compara textos sem acento, maiúscula nem pontuação", () => {
    expect(chaveDoTexto("  Farmacêutico – CASAI/Brasília ")).toBe(
      "farmaceutico casai brasilia",
    );
  });

  it("lê as vagas imediatas do texto da vaga", () => {
    expect(vagasPeloTexto("Enfermeiro - X - 2 vagas (1 AC + CR)")).toBe(2);
    expect(vagasPeloTexto("Médico - X - 1 vaga (1 AC + CR)")).toBe(1);
    expect(vagasPeloTexto("Pedagogo - X - Cadastro Reserva")).toBe(0);
    expect(vagasPeloTexto("Técnico Químico - Abrangência do DSEI")).toBeNull();
  });

  it("liga lista e quadro a cada vaga, na ordem dos editais do recorte", () => {
    const linhas = linhasPorCargo(normalizarVagasPorCargo(bruto), editais);
    expect(
      linhas.map((l) => [
        l.edital,
        l.vaga,
        l.vagasImediatas,
        l.inscritos,
        l.aprovados,
      ]),
    ).toEqual([
      ["04/2026", "Assistente de Projetos", null, 12, 5],
      [
        "04/2026",
        "CARGO 1: ASSISTENTE DE PROJETO – GAB DAIS – SEDE AGSUS",
        null,
        900,
        40,
      ],
      [
        "100/2026",
        "Assistente Social 30h - CASAI Brasília - 1 vaga (1 AC + CR)",
        1,
        244,
        2,
      ],
      [
        "100/2026",
        "Enfermeiro - CASAI Brasília - 2 vagas (1 AC + 1 Pretos e Pardos + CR)",
        2,
        1366,
        7,
      ],
      [
        "100/2026",
        "Farmacêutico - CASAI Brasília - Cadastro Reserva",
        0,
        486,
        0,
      ],
      [
        "100/2026",
        "Nutricionista - CASAI Brasília - Cadastro Reserva",
        0,
        null,
        3,
      ],
    ]);
    // O edital fora do recorte não entra; a soma dos aprovados bate com a lista.
    expect(linhas.reduce((s, l) => s + l.aprovados, 0)).toBe(57);
  });

  it("liga pelo começo do texto quando a lista acrescenta a modalidade", () => {
    const dados = normalizarVagasPorCargo({
      vagas: [
        {
          monitoramento_id: PROJ,
          codigo: "1",
          vaga: "1",
          cargo: "CARGO 1: ASSISTENTE - PIAUÍ",
          inscritos: 10,
        },
        {
          monitoramento_id: PROJ,
          codigo: "2",
          vaga: "2",
          cargo: "CARGO 1: ASSISTENTE - PIAUÍ - POLO NORTE",
          inscritos: 4,
        },
      ],
      quadro: [],
      lista: [
        {
          monitoramento_id: PROJ,
          codigo_vaga: "CARGO 1: ASSISTENTE - PIAUÍ - AMPLA CONCORRÊNCIA",
          cargo: "CARGO 1: ASSISTENTE - PIAUÍ - AMPLA CONCORRÊNCIA",
          aprovados: 6,
        },
        {
          monitoramento_id: PROJ,
          codigo_vaga: "CARGO 1: ASSISTENTE - PIAUÍ - POLO NORTE - PCD",
          cargo: "x",
          aprovados: 1,
        },
      ],
    });
    expect(
      linhasPorCargo(dados, [{ id: PROJ, edital: "97/2025" }]).map((l) => [
        l.inscritos,
        l.aprovados,
      ]),
    ).toEqual([
      [10, 6],
      [4, 1],
    ]);
  });

  it('casa o quadro pela unidade, sem "(a)" nem carga horária, e pela lotação cortada', () => {
    const dados = normalizarVagasPorCargo({
      vagas: [
        {
          monitoramento_id: SI,
          codigo: "104116",
          vaga: "104116",
          cargo: "Técnico (a) de Enfermagem",
          unidade: "DSEI Alto Rio Solimões",
        },
        {
          monitoramento_id: SI,
          codigo: "104004",
          vaga: "104004",
          cargo: "Cirurgião Dentista (40h)",
          unidade: "DSEI Alto Rio Solimões",
        },
        {
          monitoramento_id: SI,
          codigo: "104005",
          vaga: "104005",
          cargo: "Enfermeiro - Polo Base Barra do Cord...",
          unidade: "DSEI Maranhão",
        },
      ],
      quadro: [
        {
          monitoramento_id: SI,
          cargo: "Enfermeiro",
          lotacao: "Polo Base Barra do Corda",
          vagas: 2,
        },
        {
          monitoramento_id: SI,
          cargo: "Técnico de Enfermagem",
          lotacao: "DSEI Alto Rio Solimões",
          vagas: 4,
        },
        {
          monitoramento_id: SI,
          cargo: "Cirurgião Dentista",
          lotacao: "Polo X",
          vagas: 9,
        },
      ],
      lista: [],
    });
    expect(
      linhasPorCargo(dados, [{ id: SI, edital: "03/2025" }]).map((l) => [
        l.vaga,
        l.vagasImediatas,
      ]),
    ).toEqual([
      ["Cirurgião Dentista (40h)", null],
      ["Enfermeiro - Polo Base Barra do Cord...", 2],
      ["Técnico (a) de Enfermagem", 4],
    ]);
  });

  it("não reparte um item do quadro entre duas vagas: usa o texto de cada uma", () => {
    const dados = normalizarVagasPorCargo({
      vagas: [
        {
          monitoramento_id: SI,
          codigo: "1",
          vaga: "Enfermeiro - Polo A - 1 vaga (1 AC)",
        },
        {
          monitoramento_id: SI,
          codigo: "2",
          vaga: "Enfermeiro - Polo B - Cadastro Reserva",
        },
      ],
      quadro: [
        { monitoramento_id: SI, cargo: "Enfermeiro", lotacao: "", vagas: 5 },
      ],
      lista: [],
    });
    expect(
      linhasPorCargo(dados, [{ id: SI, edital: "1/2026" }]).map(
        (l) => l.vagasImediatas,
      ),
    ).toEqual([1, 0]);
  });
});

describe("aba 3: aprovados", () => {
  const resposta = {
    exportacao_id: "reg-1",
    emitida_em: "2026-11-16T12:00:00Z",
    registros: 3,
    aprovados: [
      {
        monitoramento_id: SI,
        cargo: "Enfermeiro - CASAI Brasília",
        nota: 87.5,
        classificacao: 1,
        nome: "Pessoa Fictícia Um",
        status: "Contratado",
        matricula: "000123",
        admissao: "2026-03-02",
      },
      {
        monitoramento_id: SI,
        cargo: "Enfermeiro - CASAI Brasília",
        nota: null,
        classificacao: null,
        nome: "Pessoa Fictícia Dois",
        status: null,
        matricula: null,
        admissao: null,
      },
      { monitoramento_id: "fora", cargo: "x", nome: "Fora do recorte" },
    ],
  };

  it("recusa a resposta sem o registro do download", () => {
    expect(() => normalizarAprovadosDaDiretoria({ aprovados: [] })).toThrow(
      /não registrou/,
    );
  });

  it("monta as linhas com nota, status, matrícula e admissão", () => {
    const exportacao = normalizarAprovadosDaDiretoria(resposta);
    expect(exportacao.id).toBe("reg-1");
    expect(linhasDeAprovados(exportacao.aprovados, editais)).toEqual([
      [
        "100/2026",
        "Enfermeiro - CASAI Brasília",
        "87,5",
        "1",
        "Pessoa Fictícia Um",
        "Contratado",
        "000123",
        "02/03/2026",
      ],
      [
        "100/2026",
        "Enfermeiro - CASAI Brasília",
        "—",
        "—",
        "Pessoa Fictícia Dois",
        "Sem status",
        "—",
        "—",
      ],
    ]);
  });

  it("soma os aprovados do recorte pela contagem de cada edital", () => {
    expect(
      aprovadosNoRecorte([
        { aprovados: 10 },
        { aprovados: null },
        {},
        { aprovados: 5 },
      ]),
    ).toBe(15);
  });
});

describe("as abas no montador", () => {
  const base = {
    linhas: [],
    filtros: filtrosVazios(),
    area: "saude-indigena",
    rotuloDaArea: "Saúde Indígena",
    indicadores: {
      processos: 0,
      vagas: 0,
      reabertas: 0,
      contratadas: 0,
      emSelecao: 0,
      ociosas: 0,
      cadastroReserva: 0,
      criticos: 0,
      inscritos: 0,
    },
    agora: new Date("2026-11-16T12:00:00Z"),
  } satisfies Omit<Parameters<typeof conteudoDoRelatorio>[0], "escolha">;

  it("o modelo Diretoria leva editais, vagas por cargo e aprovados em Excel", () => {
    const diretoria = MODELOS_DO_RELATORIO.find((m) => m.id === "diretoria");
    expect(diretoria?.escolha.secoes).toEqual([
      "editais",
      "cargos",
      "aprovados",
    ]);
    expect(diretoria?.escolha.formato).toBe("XLSX");
    expect(normalizarEscolha(diretoria?.escolha).secoes).toEqual([
      "editais",
      "cargos",
      "aprovados",
    ]);
  });

  it("só quem vê a Lista de aprovados pode gerar a aba Aprovados", () => {
    expect(secoesPermitidas(false)).not.toContain("aprovados");
    expect(secoesPermitidas(true)).toContain("aprovados");
  });

  it("as abas viram tabelas e planilhas, com número como número", () => {
    const conteudo = conteudoDoRelatorio({
      ...base,
      escolha: {
        secoes: ["cargos", "aprovados"],
        colunas: ["edital"],
        formato: "XLSX",
      },
      porCargo: linhasPorCargo(normalizarVagasPorCargo(bruto), editais),
      aprovados: {
        linhas: [
          [
            "100/2026",
            "Enfermeiro",
            "87,5",
            "1",
            "Pessoa Fictícia",
            "Contratado",
            "000123",
            "02/03/2026",
          ],
        ],
        registro: "reg-1",
      },
    });
    expect(conteudo.tabelas.map((t) => t.titulo)).toEqual([
      "Vagas por cargo",
      "Aprovados",
    ]);
    expect(conteudo.identificacao).toContainEqual([
      "Registro do download",
      "reg-1",
    ]);
    const [, cargos, aprovados] = planilhasDoRelatorio(conteudo);
    expect(cargos?.nome).toBe("Vagas por cargo");
    expect(cargos?.linhas[0]).toEqual([
      "Edital",
      "Unidade",
      "Vaga",
      "Vagas imediatas",
      "Inscritos",
      "Aprovados",
    ]);
    // "—" vira célula vazia; inscritos e aprovados, números.
    expect(cargos?.linhas[1]?.slice(3)).toEqual(["", 12, 5]);
    expect(aprovados?.linhas[1]).toEqual([
      "100/2026",
      "Enfermeiro",
      87.5,
      1,
      "Pessoa Fictícia",
      "Contratado",
      "000123",
      "02/03/2026",
    ]);
  });

  it("sem as linhas do banco, a seção não sai (nem o registro)", () => {
    const conteudo = conteudoDoRelatorio({
      ...base,
      escolha: {
        secoes: ["cargos", "aprovados"],
        colunas: ["edital"],
        formato: "PDF",
      },
    });
    expect(conteudo.tabelas).toEqual([]);
    expect(conteudo.identificacao.map(([r]) => r)).not.toContain(
      "Registro do download",
    );
  });
});
