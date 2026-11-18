/*
  Exportação padronizada das tabelas (revisão de 17/11; padrão tirado do
  SIGEPSI em 18/11): toda tabela sai pelos mesmos dois botões, "Exportar em
  Excel" (.xlsx) e "Salvar em PDF" (BotoesDeExportacao, src/ui/), a partir do
  mesmo retrato `TabelaParaExportar` — título, colunas e linhas. Sem DOM: quem
  baixa o arquivo é a tela.

  - Excel: o SpreadsheetML mínimo de gerarXlsx (classificacao/exportacao.ts):
    texto como inlineStr (nunca fórmula: "=1+1" vira texto), número como
    número, cabeçalho em negrito, fixo e com filtro.
  - PDF: A4 deitado (jsPDF + jspdf-autotable, baixados só no clique), título,
    "Emitido em" (Brasília) e o total de registros, a tabela com o cabeçalho
    repetido em cada página e "Página N de M" no rodapé. Texto de verdade
    (pesquisável), com as fontes padrão do PDF.
*/
import type { jsPDF as TipoJsPdf } from "jspdf";
import type { CellHookData } from "jspdf-autotable";
import { gerarXlsx, MIME_XLSX } from "../classificacao/exportacao.ts";
import {
  carregarBibliotecasDoPdf,
  textoParaOPdf,
} from "../avaliacao-documental/espelho-em-pdf.ts";
import type { BibliotecasDoPdf } from "../avaliacao-documental/espelho-em-pdf.ts";

export { MIME_XLSX };
export const MIME_PDF = "application/pdf";

export type CelulaParaExportar = string | number | null | undefined;

export interface TabelaParaExportar {
  /** Título do PDF e nome da planilha ("Seleção — Saúde Indígena"). */
  titulo: string;
  colunas: readonly string[];
  linhas: readonly (readonly CelulaParaExportar[])[];
}

/** "selecao-saude-indigena-2026-11-18.xlsx": sem acento, espaço nem barra. */
export function nomeDoArquivoExportado(
  partes: readonly (string | null | undefined)[],
  extensao: "xlsx" | "pdf",
): string {
  const base = partes
    .map((parte) =>
      String(parte ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean)
    .join("-");
  return `${base || "exportacao"}.${extensao}`;
}

/* Nome de aba do Excel: até 31 caracteres, sem []:*?/\ . */
function nomeDaPlanilha(titulo: string) {
  const limpo = titulo.replace(/[[\]:*?/\\]/g, " ").trim();
  return (limpo || "Dados").slice(0, 31);
}

/* Largura de cada coluna (em caracteres): o maior texto, entre 8 e 60. */
function larguras(tabela: TabelaParaExportar) {
  return tabela.colunas.map((coluna, i) => {
    const maior = tabela.linhas.reduce(
      (atual, linha) => Math.max(atual, String(linha[i] ?? "").length),
      coluna.length,
    );
    return Math.min(60, Math.max(8, maior + 2));
  });
}

/** O .xlsx da tabela (bytes). */
export function xlsxDaTabela(
  tabela: TabelaParaExportar,
  quando = new Date(),
): Uint8Array {
  return gerarXlsx(
    [
      {
        nome: nomeDaPlanilha(tabela.titulo),
        linhas: [tabela.colunas, ...tabela.linhas],
        larguras: larguras(tabela),
        filtro: true,
      },
    ],
    quando,
  );
}

const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** O texto da célula no PDF: número à brasileira, vazio como "—" não (fica em branco). */
export function textoDaCelula(valor: CelulaParaExportar): string {
  if (typeof valor === "number")
    return Number.isFinite(valor) ? NUMERO.format(valor) : "";
  return textoParaOPdf(valor ?? "");
}

export function emissaoEmBrasilia(quando: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(quando);
}

const MM = 72 / 25.4;
const MARGEM = 10 * MM;
const AZUL: [number, number, number] = [0, 59, 113];
const TEXTO: [number, number, number] = [33, 37, 41];
const CINZA: [number, number, number] = [100, 106, 112];
const FUNDO_DO_CABECALHO: [number, number, number] = [232, 238, 245];

/** O PDF da tabela (bytes). `bibliotecas` só nos testes. */
export async function pdfDaTabela(
  tabela: TabelaParaExportar,
  {
    quando = new Date(),
    bibliotecas,
    comprimir = true,
  }: {
    quando?: Date;
    bibliotecas?: BibliotecasDoPdf;
    comprimir?: boolean;
  } = {},
): Promise<Uint8Array> {
  const { jsPDF, autoTable } =
    bibliotecas ?? (await carregarBibliotecasDoPdf());
  const documento: TipoJsPdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
    compress: comprimir,
  });
  const largura = documento.internal.pageSize.getWidth();
  const total = tabela.linhas.length;
  documento.setFont("helvetica", "bold");
  documento.setFontSize(13);
  documento.setTextColor(...AZUL);
  documento.text(textoParaOPdf(tabela.titulo), MARGEM, MARGEM + 6, {
    maxWidth: largura - 2 * MARGEM,
  });
  documento.setFont("helvetica", "normal");
  documento.setFontSize(8);
  documento.setTextColor(...CINZA);
  documento.text(
    `Emitido em ${emissaoEmBrasilia(quando)} (Brasília) · ${NUMERO.format(total)} ${total === 1 ? "registro" : "registros"}`,
    MARGEM,
    MARGEM + 20,
  );
  autoTable(documento, {
    head: [tabela.colunas.map((coluna) => textoParaOPdf(coluna))],
    body: tabela.linhas.map((linha) =>
      tabela.colunas.map((_, i) => textoDaCelula(linha[i])),
    ),
    startY: MARGEM + 30,
    margin: { top: MARGEM, right: MARGEM, bottom: MARGEM + 8, left: MARGEM },
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 2.5,
      textColor: TEXTO,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: FUNDO_DO_CABECALHO,
      textColor: AZUL,
      fontStyle: "bold",
    },
    didParseCell: (celula: CellHookData) => {
      // Números alinhados à direita, como na tela.
      const valor = tabela.linhas[celula.row.index]?.[celula.column.index];
      if (celula.section === "body" && typeof valor === "number")
        celula.cell.styles.halign = "right";
    },
  });
  const paginas = documento.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    documento.setPage(pagina);
    documento.setFontSize(7);
    documento.setTextColor(...CINZA);
    documento.text(
      `Página ${pagina} de ${paginas}`,
      largura - MARGEM,
      documento.internal.pageSize.getHeight() - MARGEM / 2,
      { align: "right" },
    );
  }
  return new Uint8Array(documento.output("arraybuffer"));
}

export type FormatoDaExportacao = "excel" | "pdf";

export interface ArquivoExportado {
  bytes: Uint8Array;
  tipo: string;
  extensao: "xlsx" | "pdf";
}

/** O arquivo no formato pedido (o que os dois botões chamam). */
export async function arquivoDaTabela(
  formato: FormatoDaExportacao,
  tabela: TabelaParaExportar,
  quando = new Date(),
): Promise<ArquivoExportado> {
  if (formato === "pdf")
    return {
      bytes: await pdfDaTabela(tabela, { quando }),
      tipo: MIME_PDF,
      extensao: "pdf",
    };
  return {
    bytes: xlsxDaTabela(tabela, quando),
    tipo: MIME_XLSX,
    extensao: "xlsx",
  };
}
