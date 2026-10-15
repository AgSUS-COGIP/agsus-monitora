import { describe, expect, it } from "vitest";
import {
  assinaturaDoRetrato,
  avisosAgrupados,
  dataDeCorteDoCronograma,
  geracaoDesatualizada,
  filtrosAtivosDoRecorte,
  listaDaFase,
  recortarResultado,
  RECORTE_VAZIO,
} from "../../src/lib/classificacao/dados.ts";
import { instantaneoDaLista } from "../../src/lib/classificacao/exportacao.ts";

/* O que a tela de Classificação precisa em volta do motor. */

describe("data de corte pelo cronograma", () => {
  it("o fim do período de inscrição; com prorrogação, o fim mais tarde", () => {
    expect(
      dataDeCorteDoCronograma([
        {
          atividade: "Publicação do edital",
          inicio: "2026-06-20",
          fim: "2026-06-20",
        },
        {
          atividade:
            "Período de inscrição e envio dos documentos comprobatórios",
          inicio: "2026-06-21",
          fim: "2026-07-10",
        },
        {
          atividade: "Prorrogação das inscrições",
          inicio: "2026-07-11",
          fim: "2026-07-20",
        },
        {
          atividade: "Resultado das inscrições homologadas",
          inicio: "2026-07-30",
          fim: "2026-07-30",
        },
        {
          atividade: "Recurso contra o indeferimento da inscrição",
          inicio: "2026-08-01",
          fim: "2026-08-02",
        },
      ]),
    ).toBe("2026-07-20");
  });

  it("sem etapa de inscrição (ou sem datas), null", () => {
    expect(
      dataDeCorteDoCronograma([
        { atividade: "Entrevistas", fim: "2026-08-10" },
      ]),
    ).toBeNull();
    expect(
      dataDeCorteDoCronograma([{ atividade: "Inscrições", fim: null }]),
    ).toBeNull();
    expect(dataDeCorteDoCronograma(null)).toBeNull();
  });
});

describe("avisos e recorte", () => {
  it("avisos agrupados por tipo, os graves primeiro", () => {
    const grupos = avisosAgrupados([
      { codigo: "DADO_FALTANDO", tom: "warning", texto: "a" },
      { codigo: "EMPATE_PENDENTE", tom: "danger", texto: "b" },
      { codigo: "DADO_FALTANDO", tom: "warning", texto: "c" },
      { codigo: "ENTREVISTA_PELO_NOME", tom: "info", texto: "d" },
    ]);
    expect(grupos.map((g) => [g.codigo, g.itens.length])).toEqual([
      ["EMPATE_PENDENTE", 1],
      ["DADO_FALTANDO", 2],
      ["ENTREVISTA_PELO_NOME", 1],
    ]);
    expect(grupos[0].rotulo).toBe("Empate aguardando sorteio ou decisão");
  });

  const resultado = {
    vagas: [
      {
        chave: "1",
        geral: [{ nome: "José Ávila" }, { nome: "Maria" }],
        porModalidade: { PP: [{ nome: "Maria" }] },
        eliminados: [{ nome: "Zé Eliminado" }],
      },
      {
        chave: "2",
        geral: [{ nome: "Ana" }],
        porModalidade: { PP: [] },
        eliminados: [],
      },
    ],
  };

  it("recorte por vaga, lista e nome (sem acento)", () => {
    expect(
      recortarResultado(resultado, RECORTE_VAZIO).map((v) => v.linhas.length),
    ).toEqual([2, 1]);
    expect(
      recortarResultado(resultado, { ...RECORTE_VAZIO, lista: "PP" }).map(
        (v) => v.linhas.length,
      ),
    ).toEqual([1, 0]);
    const busca = recortarResultado(resultado, {
      ...RECORTE_VAZIO,
      busca: "avila",
    });
    expect(busca.map((v) => [v.chave, v.linhas.map((l) => l.nome)])).toEqual([
      ["1", ["José Ávila"]],
    ]);
    expect(
      recortarResultado(resultado, { ...RECORTE_VAZIO, busca: "eliminado" })[0]
        .eliminadosFiltrados,
    ).toHaveLength(1);
    expect(filtrosAtivosDoRecorte({ vaga: "1", lista: "PP", busca: " " })).toBe(
      2,
    );
    expect(recortarResultado(null)).toEqual([]);
  });
});

describe("listaDaFase", () => {
  it("abre no resultado final só quando já há nota de entrevista", () => {
    expect(listaDaFase(null)).toBe("PRELIMINAR");
    expect(listaDaFase({ entrevistas: [] })).toBe("PRELIMINAR");
    expect(
      listaDaFase({
        entrevistas: [{ nota: null }, { nota: "" }, { nota: "x" }],
      }),
    ).toBe("PRELIMINAR");
    expect(
      listaDaFase({ entrevistas: [{ nota: null }, { nota: "12,5" }] }),
    ).toBe("FINAL");
  });
});

describe("geração guardada desatualizada em relação aos dados de agora", () => {
  const resultado = (vagas, totais = {}) => ({
    tipo: "PRELIMINAR",
    dataCorte: null,
    casas: 2,
    vagas,
    explicacoes: {},
    pendencias: [],
    avisos: [],
    totais: {
      candidatos: 1,
      elegiveis: 0,
      eliminados: 0,
      aguardando: 1,
      vagas: 1,
      avisos: 0,
      pendencias: 0,
      ...totais,
    },
  });
  const vaga = (geral = [], eliminados = []) => ({
    chave: "182428",
    codigo: "182428",
    cargo: "CARGO 2: BIÓLOGO",
    lotacao: "Belo Horizonte - MG",
    cabecalho: "VAGA 182428 - CARGO 2: BIÓLOGO - Belo Horizonte - MG",
    total: 0,
    vagasPorModalidade: null,
    cadastroReserva: true,
    origemDasVagas: "QUADRO",
    limiteConvocacao: null,
    geral,
    porModalidade: {},
    eliminados,
    aguardando: [],
  });
  const eronilda = {
    analiseId: "a1",
    nome: "Eronilda Castro",
    nota: 45,
    posicao: 1,
    empatados: 1,
    modalidades: ["AC"],
    situacao: null,
    vagaPor: null,
  };
  const agora = resultado([vaga()]);

  it("13/10 com 1 nas listas e 1.576 eliminados × hoje 0 e 0: os dados mudaram", () => {
    expect(
      geracaoDesatualizada(
        { versao_regra: 1, elegiveis: 1, eliminados: 1576 },
        agora,
        1,
      ),
    ).toBe("os dados mudaram");
  });

  it("outra versão da regra: a regra mudou", () => {
    expect(
      geracaoDesatualizada(
        { versao_regra: 1, elegiveis: 0, eliminados: 0 },
        agora,
        2,
      ),
    ).toBe("a regra mudou");
  });

  it("com o retrato lido, compara o conteúdo (mesmas quantidades, outra pessoa)", () => {
    const retratoAntigo = instantaneoDaLista(resultado([vaga([eronilda])]));
    const atual = resultado([vaga([{ ...eronilda, analiseId: "a2" }])], {
      elegiveis: 1,
    });
    const lista = {
      versao_regra: 1,
      elegiveis: 1,
      eliminados: 0,
      retrato: retratoAntigo,
    };
    expect(geracaoDesatualizada(lista, atual, 1)).toBe("os dados mudaram");
    expect(
      geracaoDesatualizada(
        lista,
        resultado([vaga([eronilda])], { elegiveis: 1 }),
        1,
      ),
    ).toBeNull();
  });

  it("a assinatura ignora a ordem das vagas e das listas", () => {
    const a = { tipo: "X", vagas: [{ chave: "2" }, { chave: "1" }] };
    const b = { tipo: "X", vagas: [{ chave: "1" }, { chave: "2" }] };
    expect(assinaturaDoRetrato(a)).toBe(assinaturaDoRetrato(b));
  });

  it("sem geração ou sem resultado: nada a dizer", () => {
    expect(geracaoDesatualizada(null, agora, 1)).toBeNull();
    expect(geracaoDesatualizada({ versao_regra: 1 }, null, 1)).toBeNull();
  });
});
