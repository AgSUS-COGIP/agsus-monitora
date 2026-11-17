import { strFromU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  RELATORIOS_DOS_PAINEIS,
  csvDoRelatorio,
  chaveDaPagina,
  definicaoDoRelatorio,
  larguraArrastada,
  linhasDaOrigem,
  lerPaginaDoRelatorio,
  linhasDoRelatorio,
  nomeDoArquivoDoRelatorio,
  paginaDaTabela,
  planilhaDoRelatorio,
  textoDaCelula,
  xlsxDoRelatorio,
} from "../src/lib/relatorios-dos-paineis.ts";
import type { ZiparRelatorio } from "../src/lib/relatorios-dos-paineis.ts";

/*
  Os relatórios dos Painéis (bloco Dados): as colunas pedidas, a leitura da
  resposta das RPCs, o texto da tela e os arquivos CSV e XLSX. Dados fictícios.
*/

const resumo = definicaoDoRelatorio("resumo-dos-editais");
const porCargo = definicaoDoRelatorio("editais-por-cargo");
const aprovados = definicaoDoRelatorio("aprovados");
const zipar: ZiparRelatorio = (arquivos, opcoes) => zipSync(arquivos, opcoes);

describe("as colunas de cada relatório", () => {
  it("são as três seções, na ordem pedida", () => {
    expect(RELATORIOS_DOS_PAINEIS.map((r) => r.rotulo)).toEqual([
      "Resumo dos editais",
      "Editais por cargo",
      "Aprovados",
    ]);
  });

  it("Resumo dos editais: número, DSEI, vagas imediatas e as duas datas", () => {
    expect(resumo.colunas.map((c) => c.rotulo)).toEqual([
      "Número do edital",
      "DSEI / Unidade",
      "Total de vagas imediatas",
      "Data da divulgação do edital",
      "Data final do processo seletivo",
    ]);
  });

  it("Editais por cargo: uma linha por vaga, com o código dela", () => {
    expect(porCargo.colunas.map((c) => c.campo)).toEqual([
      "edital",
      "unidade",
      "codigo_vaga",
      "cargo",
      "vagas_imediatas",
      "inscritos",
      "aprovados",
    ]);
  });

  it("Aprovados: a data de admissão diz que é o registro no sistema", () => {
    expect(aprovados.colunas.map((c) => c.rotulo)).toEqual([
      "Edital",
      "DSEI / Unidade",
      "Cargo da vaga",
      "Nota",
      "Classificação",
      "Nome",
      "Status",
      "Matrícula",
      "Data de admissão (registro no sistema)",
    ]);
  });

  it("id desconhecido cai no primeiro relatório", () => {
    expect(definicaoDoRelatorio("outro").id).toBe("resumo-dos-editais");
  });
});

describe("leitura da resposta", () => {
  it("tipa cada campo e deixa nulo o que falta", () => {
    const linhas = linhasDoRelatorio(aprovados, {
      gerado_em: "2026-11-13T15:00:00Z",
      linhas: [
        {
          edital: " 39/2026 ",
          unidade: "DSEI Teste",
          cargo: "Enfermeiro",
          nota: "87.5",
          classificacao: 2,
          nome: "Pessoa Fictícia",
          status: "Contratado",
          matricula: 12345,
          data_contratacao: "2026-10-01",
        },
        { nome: "Sem nota", nota: "", data_contratacao: "ontem" },
        "não é linha",
        null,
      ],
    });
    expect(linhas).toEqual([
      {
        edital: "39/2026",
        unidade: "DSEI Teste",
        cargo: "Enfermeiro",
        nota: 87.5,
        classificacao: 2,
        nome: "Pessoa Fictícia",
        status: "Contratado",
        matricula: "12345",
        data_contratacao: "2026-10-01",
      },
      {
        edital: null,
        unidade: null,
        cargo: null,
        nota: null,
        classificacao: null,
        nome: "Sem nota",
        status: null,
        matricula: null,
        data_contratacao: null,
      },
    ]);
  });

  it("resposta estranha vira lista vazia", () => {
    expect(linhasDoRelatorio(resumo, null)).toEqual([]);
    expect(linhasDoRelatorio(resumo, { linhas: "x" })).toEqual([]);
    expect(linhasDoRelatorio(resumo, [{ edital: "1/2026" }])).toHaveLength(1);
  });

  it("lê a página: linhas, total, página, tamanho e data do cálculo", () => {
    expect(
      lerPaginaDoRelatorio(resumo, {
        calculado_em: "2026-11-13T15:00:00Z",
        total: 120,
        pagina: 2,
        por_pagina: 50,
        linhas: [{ edital: "51/2026" }],
      }),
    ).toEqual({
      linhas: [expect.objectContaining({ edital: "51/2026" })],
      total: 120,
      pagina: 2,
      porPagina: 50,
      calculadoEm: "2026-11-13T15:00:00Z",
    });
  });

  it("a página tolera resposta vazia ou estranha", () => {
    expect(lerPaginaDoRelatorio(resumo, null)).toEqual({
      linhas: [],
      total: 0,
      pagina: 1,
      porPagina: null,
      calculadoEm: null,
    });
    expect(
      lerPaginaDoRelatorio(resumo, {
        calculado_em: "x",
        total: "dez",
        pagina: -3,
        linhas: [{ edital: "1/2026" }],
      }),
    ).toMatchObject({ total: 1, pagina: 1, calculadoEm: null });
  });

  it("a chave da página junta área, relatório, página e tamanho", () => {
    expect(chaveDaPagina("sede", "aprovados", 2, 25)).toBe(
      "sede|aprovados|2|25",
    );
  });
});

describe("largura das colunas", () => {
  it("arrastar soma o deslocamento, arredonda e não passa de 60 px para baixo", () => {
    expect(larguraArrastada(120, -100)).toBe(60);
    expect(larguraArrastada(120, 35.6)).toBe(156);
  });
});

describe("origem dos dados", () => {
  it("sem fonte trocada, só o texto fixo do relatório", () => {
    expect(linhasDaOrigem(porCargo, {})).toEqual([
      "Uma linha por vaga. Vaga, cargo e inscritos: Seleção (planilha da Auditoria, aba Resultado). Aprovados: lista de aprovados vigente, casada pelo código da vaga. Vagas imediatas: quadro de vagas do edital; sem ele, a convocação da Lista de aprovados, o local da vaga publicado no edital ou o número no título da vaga. Vagas que só estão na lista e editais sem Seleção também aparecem.",
    ]);
  });

  it("com fonte trocada na área, uma linha por coluna fora do padrão", () => {
    expect(
      linhasDaOrigem(porCargo, {
        vagas_imediatas: {
          padrao: false,
          visao: "VW_EDITAL_QUADRO_DE_VAGAS",
          coluna: "QT_VAGA_IMEDIATA",
          rotulo:
            "Quadro de vagas do edital › Vagas imediatas (soma do quadro)",
        },
        inscritos: {
          padrao: true,
          visao: null,
          coluna: null,
          rotulo: "Padrão",
        },
      })[1],
    ).toBe(
      "Fonte trocada nesta área: Vagas imediatas → Quadro de vagas do edital › Vagas imediatas (soma do quadro)",
    );
  });
});

describe("texto da célula", () => {
  const [, , vagas, divulgacao] = resumo.colunas;
  const nota = aprovados.colunas[3]!;

  it("número em pt-BR, data dd/mm/aaaa e vazio como travessão", () => {
    expect(textoDaCelula(vagas!, 1200)).toBe("1.200");
    expect(textoDaCelula(nota, 87.25)).toBe("87,25");
    expect(textoDaCelula(divulgacao!, "2026-03-05")).toBe("05/03/2026");
    expect(textoDaCelula(vagas!, null)).toBe("—");
  });
});

describe("arquivos", () => {
  const linhas = linhasDoRelatorio(porCargo, [
    {
      edital: "39/2026",
      unidade: "DSEI Teste",
      codigo_vaga: "178962",
      cargo: "=CMD()",
      vagas_imediatas: 3,
      inscritos: 120,
      aprovados: null,
    },
  ]);

  it("CSV: BOM, ponto e vírgula, CRLF e célula protegida contra fórmula", () => {
    const csv = csvDoRelatorio(porCargo, linhas);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      "Número do edital;DSEI / Unidade;Código da vaga;Cargo;Vagas imediatas;Total de inscritos;Total de aprovados",
      "39/2026;DSEI Teste;178962;'=CMD();3;120;",
      "",
    ]);
  });

  it("CSV: decimal com vírgula e data dd/mm/aaaa", () => {
    const csv = csvDoRelatorio(
      aprovados,
      linhasDoRelatorio(aprovados, [
        { nota: 87.5, nome: "A; B", data_contratacao: "2026-10-01" },
      ]),
    );
    expect(csv.split("\r\n")[1]).toBe(';;;87,5;;"A; B";;;01/10/2026');
  });

  it("XLSX: uma aba com o nome do relatório, cabeçalho e números", () => {
    const planilha = planilhaDoRelatorio(porCargo, linhas);
    expect(planilha.nome).toBe("Editais por cargo");
    expect(planilha.filtro).toBe(true);
    expect(planilha.linhas[1]).toEqual([
      "39/2026",
      "DSEI Teste",
      "178962",
      "=CMD()",
      3,
      120,
      "",
    ]);
    const arquivos = unzipSync(
      xlsxDoRelatorio(
        porCargo,
        linhas,
        zipar,
        new Date("2026-11-13T15:00:00Z"),
      ),
    );
    expect(Object.keys(arquivos)).toContain("xl/worksheets/sheet1.xml");
    expect(strFromU8(arquivos["xl/workbook.xml"]!)).toContain(
      'name="Editais por cargo"',
    );
  });

  it("nome do arquivo: relatório, área e a hora de Brasília", () => {
    expect(
      nomeDoArquivoDoRelatorio(
        aprovados,
        "saude-indigena",
        "XLSX",
        new Date("2026-11-13T15:04:00Z"),
      ),
    ).toBe("aprovados-saude-indigena-2026-11-13-1204.xlsx");
  });
});

describe("paginação", () => {
  it("recorta a lista em páginas", () => {
    expect(paginaDaTabela(120, 1, 50)).toEqual({
      pagina: 1,
      paginas: 3,
      inicio: 0,
      fim: 50,
      total: 120,
    });
    expect(paginaDaTabela(120, 3, 50)).toMatchObject({ inicio: 100, fim: 120 });
  });

  it("página fora do intervalo volta para a que existe", () => {
    expect(paginaDaTabela(120, 9, 50).pagina).toBe(3);
    expect(paginaDaTabela(120, 0, 50).pagina).toBe(1);
    expect(paginaDaTabela(0, 4, 50)).toEqual({
      pagina: 1,
      paginas: 1,
      inicio: 0,
      fim: 0,
      total: 0,
    });
  });

  it("tamanho inválido vale o padrão (50)", () => {
    expect(paginaDaTabela(120, 1, 0)).toMatchObject({ paginas: 3, fim: 50 });
  });
});
