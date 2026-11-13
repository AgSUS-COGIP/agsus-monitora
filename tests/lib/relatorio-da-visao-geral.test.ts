import { readFileSync } from "node:fs";
import { strFromU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { carregarBibliotecasDoPdf } from "../../src/lib/avaliacao-documental/espelho-em-pdf.ts";
import { pdfDoRelatorio } from "../../src/lib/relatorio-da-visao-geral-em-pdf.ts";
import {
  alternarNaEscolha,
  conteudoDoRelatorio,
  MODELOS_DO_RELATORIO,
  modeloDaEscolha,
  nomeDoArquivoDoRelatorio,
  normalizarEscolha,
  planilhasDoRelatorio,
  textoDaColuna,
  xlsxDoRelatorio,
} from "../../src/lib/relatorio-da-visao-geral.ts";
import { filtrosVazios } from "../../src/lib/visao-geral.ts";
import type {
  Indicadores,
  LinhaDaVisaoGeral,
} from "../../src/modulos/visao-geral/tipos.ts";

/*
  O MONTADOR DE RELATÓRIO DA VISÃO GERAL (13/11/2026: "no SIGEPSI você
  consegue montar o relatório do jeito que quiser")

  A escolha (seções, colunas, formato), os modelos prontos, o conteúdo tirado
  do recorte da tela, o Excel com uma aba por seção e o PDF desenhado (não a
  impressão da tela). Dados fictícios.
*/

function linha(parcial: Partial<LinhaDaVisaoGeral>): LinhaDaVisaoGeral {
  return {
    fase: "Concluído",
    atencao: [],
    pos_resultado: [],
    desistentes: 0,
    aprovados: null,
    cadastro_reserva: null,
    primeira_admissao: null,
    ultima_admissao: null,
    admissoes: 0,
    ...parcial,
  };
}

const LINHAS = [
  linha({
    id: "e1",
    edital: "04/2099",
    unidade: "DSEI Exemplo",
    ciclo: "1º ciclo",
    status: "Concluído",
    data_inicio: "2099-02-20",
    data_fim: "2099-06-16",
    vagas_total: 59,
    inscritos: 3256,
    contratados: 110,
    vagas_ociosas: 0,
    aprovados: 2417,
    primeira_admissao: "2099-05-12",
    ultima_admissao: "2100-06-11",
    admissoes: 111,
  }),
  linha({
    id: "e2",
    edital: "70/2099",
    unidade: "DSEI Teste",
    ciclo: "",
    status: "Concluído",
    vagas_total: 10,
    contratados: 4,
    vagas_ociosas: 6,
    inscritos: null,
    atencao: [
      { codigo: "contratacao", rotulo: "Contratação abaixo de 50%", tom: "" },
    ],
  }),
];

const INDICADORES: Indicadores = {
  processos: 2,
  vagas: 69,
  contratadas: 63,
  emSelecao: 0,
  ociosas: 6,
  cadastroReserva: 51,
  criticos: 1,
  inscritos: 3256,
};

const conteudo = (escolha = MODELOS_DO_RELATORIO[1]!.escolha) =>
  conteudoDoRelatorio({
    escolha,
    linhas: LINHAS,
    filtros: { ...filtrosVazios(), ciclo: ["1º ciclo"] },
    area: "saude-indigena",
    rotuloDaArea: "Saúde Indígena",
    indicadores: INDICADORES,
    quem: "Pessoa Exemplo",
    agora: new Date("2099-11-13T15:00:00Z"),
  });

describe("a escolha", () => {
  it("normaliza: só seções e colunas conhecidas, na ordem da tela; formato válido", () => {
    expect(
      normalizarEscolha({
        secoes: ["editais", "invasora", "numeros"],
        colunas: ["status", "edital", "observacoes", "x"],
        formato: "XLSX",
      }),
    ).toEqual({
      secoes: ["numeros", "editais"],
      colunas: ["edital", "status"],
      formato: "XLSX",
    });
    expect(normalizarEscolha(null)).toEqual(MODELOS_DO_RELATORIO[0]!.escolha);
    expect(normalizarEscolha({ formato: "DOC" }).formato).toBe("PDF");
  });

  it("marcar e desmarcar mantém a ordem e ao menos um item", () => {
    const todos = ["a", "b", "c"] as const;
    expect(alternarNaEscolha(todos, ["c"], "a")).toEqual(["a", "c"]);
    expect(alternarNaEscolha(todos, ["a", "c"], "a")).toEqual(["c"]);
    expect(alternarNaEscolha(todos, ["c"], "c")).toEqual(["c"]);
  });

  it("reconhece o modelo pronto; mexeu, vira personalizado", () => {
    const diretoria = MODELOS_DO_RELATORIO.find((m) => m.id === "diretoria")!;
    expect(modeloDaEscolha(diretoria.escolha)).toBe("diretoria");
    expect(modeloDaEscolha({ ...diretoria.escolha, formato: "PDF" })).toBe("");
  });

  it("o modelo da diretoria: número, DSEI, vagas, divulgação, encerramento e ciclo", () => {
    const diretoria = MODELOS_DO_RELATORIO.find((m) => m.id === "diretoria")!;
    expect(diretoria.escolha.colunas).toEqual([
      "edital",
      "unidade",
      "vagas_total",
      "data_inicio",
      "data_fim",
      "ciclo",
    ]);
  });
});

describe("o conteúdo", () => {
  it("identificação com área, recorte, processos, data e quem gerou", () => {
    const c = conteudo();
    expect(Object.fromEntries(c.identificacao)).toMatchObject({
      Área: "Saúde Indígena",
      Recorte: "Ciclo: 1º ciclo",
      Processos: "2",
      "Gerado por": "Pessoa Exemplo",
    });
    expect(c.geradoEm).toBe("13/11/2099, 12:00");
  });

  it("os números com os rótulos dos indicadores", () => {
    const numeros = Object.fromEntries(conteudo().numeros || []);
    expect(numeros["Vagas imediatas"]).toBe("69");
    expect(Object.values(numeros)).toContain("3.256");
  });

  it("as colunas como a tela: datas, '—', contratados com o CR e a taxa de ociosas", () => {
    expect(textoDaColuna("primeira_admissao", LINHAS[0]!)).toBe("12/05/2099");
    expect(textoDaColuna("inscritos", LINHAS[1]!)).toBe("—");
    expect(textoDaColuna("ciclo", LINHAS[1]!)).toBe("—");
    expect(textoDaColuna("contratados", LINHAS[0]!)).toBe("59 +51 CR");
    expect(textoDaColuna("vagas_ociosas", LINHAS[1]!)).toBe("6 (60%)");
    expect(textoDaColuna("duracao", LINHAS[0]!)).toBe("116");
  });

  it("só as seções escolhidas; 'atenção' lista só quem pede atenção", () => {
    const c = conteudo();
    expect(c.tabelas.map((t) => t.titulo)).toEqual([
      "Editais",
      "Editais que pedem atenção",
    ]);
    expect(c.tabelas[1]!.linhas).toEqual([
      ["70/2099", "DSEI Teste", "Concluído", "Contratação abaixo de 50%"],
    ]);
    const soTabela = conteudo({
      secoes: ["editais"],
      colunas: ["edital", "ciclo"],
      formato: "PDF",
    });
    expect(soTabela.numeros).toBeNull();
    expect(soTabela.tabelas[0]!.linhas).toEqual([
      ["04/2099", "1º ciclo"],
      ["70/2099", "—"],
    ]);
  });
});

describe("os arquivos", () => {
  it("Excel: Resumo e uma aba por tabela, com números como número", () => {
    const planilhas = planilhasDoRelatorio(conteudo());
    expect(planilhas.map((p) => p.nome)).toEqual([
      "Resumo",
      "Editais",
      "Editais que pedem atenção",
    ]);
    const editais = planilhas[1]!;
    const vagas = (editais.linhas[0] as string[]).indexOf("Vagas");
    expect(editais.linhas[1]![vagas]).toBe(59);
    const zip = unzipSync(
      xlsxDoRelatorio(conteudo(), (arquivos, opcoes) =>
        zipSync(arquivos, opcoes),
      ),
    );
    expect(strFromU8(zip["xl/workbook.xml"]!)).toContain('name="Editais"');
  });

  it("PDF desenhado: título, área, tabela e rodapé com páginas", async () => {
    const libs = await carregarBibliotecasDoPdf();
    const bytes = await pdfDoRelatorio(conteudo(), libs, { comprimir: false });
    const texto = new TextDecoder("latin1").decode(bytes);
    expect(texto.startsWith("%PDF-")).toBe(true);
    for (const trecho of ["Relat", "04/2099", "DSEI Teste", "gina 1 de 1"])
      expect(texto).toContain(trecho);
  });

  it("o nome do arquivo tem a área, o dia e a extensão do formato", () => {
    const agora = new Date("2099-11-13T15:00:00Z");
    expect(nomeDoArquivoDoRelatorio("saude-indigena", "PDF", agora)).toBe(
      "Yeende_Relatorio_SaudeIndigena_20991113.pdf",
    );
    expect(nomeDoArquivoDoRelatorio("sede", "XLSX", agora)).toMatch(/\.xlsx$/);
  });
});

describe("na tela", () => {
  it("o Exportar da Visão geral e o menu da conta abrem o montador", () => {
    const tela = readFileSync(
      "src/modulos/visao-geral/visao-geral.tsx",
      "utf8",
    );
    expect(tela).toContain("aoExportar={estado.abrirMontador}");
    expect(tela).toContain("<MontadorDeRelatorio");
    const sistema = readFileSync("src/app/sistema.ts", "utf8");
    expect(sistema).toContain("exportPDF: moldura.montarRelatorio");
  });
});
