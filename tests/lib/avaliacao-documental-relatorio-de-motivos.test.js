import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import {
  agruparPorOutroMotivo,
  argumentosDoRelatorio,
  catalogoDoRelatorio,
  chaveDoTexto,
  csvDoRelatorio,
  FILTROS_INICIAIS,
  filtrosDoAtalho,
  linhasDoRelatorio,
  motivosDoFiltro,
  nomeDoRelatorio,
  textoDoCodigo,
  xlsxDoRelatorio,
} from "../../src/lib/avaliacao-documental/relatorio-de-motivos.ts";

/*
  Relatório de motivos (Avaliação documental › Ações da coordenação): o
  catálogo vem da regra real do 114/2026 (motivos do bloco, requisitos por
  cargo e "Outro motivo"), os filtros viram p_filtros só com o escolhido, os
  atalhos montam os relatórios mais pedidos, as linhas trazem os textos (não
  só os códigos) e o CSV abre no Excel.
*/

const { regra } = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/ficha-114-2026.json",
    "utf8",
  ),
);
const catalogo = catalogoDoRelatorio(regra);

const ficha = (codigo, blocos, extra = {}) => ({
  id: `f-${codigo}`,
  codigo,
  nome: `Candidato ${codigo}`,
  vaga: "182502",
  cargo: "CARGO 13: AUXILIAR ADMINISTRATIVO",
  situacao: "CONCLUIDA",
  resultado: "INAPTO_REQUISITO",
  nota_final: 0,
  avaliador: "Emanuel Serrano",
  concluida_em: "2026-10-16T19:30:22Z",
  blocos,
  ...extra,
});

describe("catálogo da regra", () => {
  it("blocos na ordem da regra, com o Outro motivo por último", () => {
    expect(catalogo.blocos.map((b) => b.codigo).slice(0, 3)).toEqual([
      "IDENTIDADE",
      "ESCOLARIDADE",
      "REQUISITO_DO_CARGO",
    ]);
    const identidade = catalogo.blocos[0];
    expect(identidade.motivos.map((m) => m.codigo)).toEqual([
      "NAO_ACEITO",
      "ILEGIVEL",
      "SEM_IDENTIDADE_6_5",
      "OUTRO",
    ]);
    expect(identidade.motivos.at(-1).texto).toBe("Outro motivo");
  });

  it("os requisitos das diferenças por cargo viram motivos do bloco, sem repetir", () => {
    const requisito = catalogo.blocos.find(
      (b) => b.codigo === "REQUISITO_DO_CARGO",
    );
    const codigos = requisito.motivos.map((m) => m.codigo);
    expect(codigos).toContain("CROMATOGRAFIA");
    expect(codigos).toContain("CNH_D");
    expect(codigos.filter((c) => c === "DIRECAO_DEFENSIVA")).toHaveLength(1);
  });

  it("motivos do filtro: os do critério escolhido (todos sem critério), com Outro motivo", () => {
    expect(
      motivosDoFiltro(catalogo, ["IDENTIDADE"]).map((m) => m.codigo),
    ).toEqual(["NAO_ACEITO", "ILEGIVEL", "SEM_IDENTIDADE_6_5", "OUTRO"]);
    const todos = motivosDoFiltro(catalogo, []).map((m) => m.codigo);
    expect(todos.filter((c) => c === "OUTRO")).toHaveLength(1);
    expect(todos.at(-1)).toBe("OUTRO");
  });

  it("texto do código: do bloco, da observação pronta, senão o próprio código", () => {
    expect(textoDoCodigo(catalogo, "CURSOS", "CURSOS_DIMINUIDA")).not.toBe(
      "CURSOS_DIMINUIDA",
    );
    expect(textoDoCodigo(catalogo, "IDENTIDADE", "OUTRO")).toBe("Outro motivo");
    expect(textoDoCodigo(catalogo, "IDENTIDADE", "SUMIU")).toBe("SUMIU");
  });

  it("sem regra: catálogo vazio, sem quebrar", () => {
    expect(catalogoDoRelatorio(null)).toEqual({ blocos: [], observacoes: {} });
  });
});

describe("filtros e atalhos", () => {
  it("só os filtros escolhidos vão ao banco; o padrão é concluída", () => {
    expect(argumentosDoRelatorio("e1", FILTROS_INICIAIS)).toEqual({
      p_edital: "e1",
      p_filtros: { limite: 500, situacoes_ficha: ["CONCLUIDA"] },
    });
  });

  it("todos os filtros, com Não confere levando junto o Não enviado e Em análise o A revisar", () => {
    const { p_filtros } = argumentosDoRelatorio(
      "e1",
      {
        blocos: ["IDENTIDADE"],
        situacao: "NAO_CONFORME",
        motivo: "OUTRO",
        ajustada: true,
        resultado: "INAPTO_REQUISITO",
        situacaoDaFicha: "EM_ANALISE",
        vaga: "182502",
        avaliador: "u1",
        de: "2026-10-01",
        ate: "2026-10-20",
      },
      "f-9",
    );
    expect(p_filtros).toEqual({
      limite: 500,
      blocos: ["IDENTIDADE"],
      situacoes: ["NAO_CONFORME", "NAO_ENVIADO"],
      motivo: "OUTRO",
      ajustada: true,
      resultados: ["INAPTO_REQUISITO"],
      situacoes_ficha: ["EM_ANALISE", "REVISAR"],
      vagas: ["182502"],
      avaliador: "u1",
      de: "2026-10-01",
      ate: "2026-10-20",
      apos: "f-9",
    });
    expect(
      argumentosDoRelatorio("e1", { ...FILTROS_INICIAIS, situacaoDaFicha: "" })
        .p_filtros.situacoes_ficha,
    ).toBeUndefined();
  });

  it("Outro motivo por critério: Identidade por padrão, ou o critério já escolhido", () => {
    const f = filtrosDoAtalho("outro-por-criterio", catalogo);
    expect(f).toMatchObject({
      blocos: ["IDENTIDADE"],
      motivo: "OUTRO",
      situacaoDaFicha: "CONCLUIDA",
    });
    expect(
      filtrosDoAtalho("outro-por-criterio", catalogo, {
        ...FILTROS_INICIAIS,
        blocos: ["ESCOLARIDADE"],
        vaga: "182502",
      }),
    ).toMatchObject({ blocos: ["ESCOLARIDADE"], vaga: "182502" });
  });

  it("Eliminados por critério e Pontuação ajustada (cursos + experiência)", () => {
    expect(filtrosDoAtalho("eliminados-por-criterio", catalogo)).toMatchObject({
      blocos: ["IDENTIDADE"],
      situacao: "NAO_CONFORME",
      resultado: "INAPTO_REQUISITO",
    });
    expect(filtrosDoAtalho("pontuacao-ajustada", catalogo)).toMatchObject({
      blocos: ["CURSOS", "EXPERIENCIA"],
      ajustada: true,
      motivo: "",
    });
  });
});

describe("linhas, agrupamento e exportação", () => {
  const fichas = [
    ficha("3989940", {
      IDENTIDADE: {
        situacao: "NAO_CONFORME",
        motivos: ["SEM_IDENTIDADE_6_5", "OUTRO"],
        motivo_livre: "Documento não apresentado de forma integral.",
      },
    }),
    ficha("4000001", {
      IDENTIDADE: {
        situacao: "NAO_CONFORME",
        motivos: ["OUTRO"],
        motivo_livre: "  documento NÃO apresentado de forma integral ",
      },
    }),
    ficha(
      "5179000",
      {
        CURSOS: {
          situacao: "CONFORME",
          nota_ajustada: 6,
          justificativas: ["CURSOS_DIMINUIDA", "OUTRO"],
          motivo_livre: "Nota ajustada conforme análise",
        },
        EXPERIENCIA: {
          situacao: "CONFORME",
          nota_ajustada: 10.5,
          justificativas: ["EXPERIENCIA_DIMINUIDA"],
        },
      },
      { resultado: "APTO", nota_final: 41.5 },
    ),
  ];
  const linhas = linhasDoRelatorio(fichas, catalogo);

  it("uma linha por ficha, com os textos dos motivos e o outro motivo separado", () => {
    expect(linhas[0]).toMatchObject({
      codigo: "3989940",
      resultado: "Inapto (requisito)",
      criterio: "Documento de identificação oficial com foto",
      situacaoDoBloco: "Não confere",
      outroMotivo: "Documento não apresentado de forma integral",
      concluidaPor: "Emanuel Serrano",
      concluidaEm: "16/10/2026 16:30",
    });
    expect(linhas[0].demaisMotivos).not.toContain("SEM_IDENTIDADE_6_5");
    expect(linhas[0].demaisMotivos.length).toBeGreaterThan(5);
  });

  it("dois blocos na linha: cada parte leva o nome do bloco; a nota ajustada só com justificativa", () => {
    const l = linhas[2];
    expect(l.criterio).toBe(
      "Cursos de Aperfeiçoamento, Experiência Profissional",
    );
    expect(l.outroMotivo).toBe(
      "Cursos de Aperfeiçoamento: Nota ajustada conforme análise",
    );
    expect(l.notaAjustada).toBe(
      "Cursos de Aperfeiçoamento: 6 | Experiência Profissional: 10,5",
    );
    expect(l.justificativas).toMatch(
      /^Cursos de Aperfeiçoamento: .+ \| Experiência Profissional: /,
    );
  });

  it("agrupa os textos iguais (acento, caixa, espaços, ponto final) e ordena por repetição", () => {
    expect(chaveDoTexto(" Ílegível. ")).toBe("ilegivel");
    const grupos = agruparPorOutroMotivo(linhas);
    expect(grupos[0]).toEqual({
      texto: "Documento não apresentado de forma integral",
      quantidade: 2,
      codigos: ["3989940", "4000001"],
    });
    expect(grupos).toHaveLength(2);
  });

  it("CSV: BOM, ponto e vírgula, CRLF, aspas quando precisa e fórmula neutralizada", () => {
    const csv = csvDoRelatorio([
      ...linhas,
      {
        ...linhas[0],
        id: "x",
        candidato: '=HYPERLINK("x")',
        outroMotivo: "a;b",
      },
    ]);
    expect(csv.startsWith("﻿Código;Candidato;Vaga;Cargo;")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    const partes = csv.trimEnd().split("\r\n");
    expect(partes).toHaveLength(5);
    expect(partes[0]).toContain("Texto do outro motivo;Demais motivos");
    expect(partes[3]).toContain(";41,5;");
    expect(partes[4]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(partes[4]).toContain('"a;b"');
    expect(csv).not.toMatch(/cpf|e-mail|telefone/i);
  });

  it("XLSX com as fichas e a planilha dos textos do outro motivo", () => {
    const arquivos = unzipSync(xlsxDoRelatorio(linhas, new Date(2026, 9, 20)));
    const livro = strFromU8(arquivos["xl/workbook.xml"]);
    expect(livro).toContain('name="Fichas"');
    expect(livro).toContain('name="Outro motivo"');
    const fichasXml = strFromU8(arquivos["xl/worksheets/sheet1.xml"]);
    expect(fichasXml).toContain("3989940");
    expect(fichasXml).toContain("<v>41.5</v>");
  });

  it("nome do arquivo com o edital, o critério (um só) e a data", () => {
    const d = new Date(2026, 9, 20);
    expect(nomeDoRelatorio("114/2026", ["IDENTIDADE"], d)).toBe(
      "relatorio-de-motivos-114-2026-identidade-2026-10-20",
    );
    expect(nomeDoRelatorio(null, ["CURSOS", "EXPERIENCIA"], d)).toBe(
      "relatorio-de-motivos-edital-2026-10-20",
    );
  });
});
