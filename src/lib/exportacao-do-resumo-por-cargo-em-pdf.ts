import type { jsPDF as TipoJsPdf } from "jspdf";
import type { CelulaDaPlanilha } from "./classificacao/tipos-dos-documentos.ts";
import type {
  BibliotecasDoPdf,
  MarcaDoPdf,
} from "./avaliacao-documental/espelho-em-pdf.ts";
import type {
  PedidoDaExportacao,
  RegistroDaExportacao,
} from "./exportacao-da-lista-de-aprovados.ts";
import type { ResumoPorCargoEStatus } from "./resumo-por-cargo-e-status.ts";
import { textoParaOPdf } from "./avaliacao-documental/espelho-em-pdf.ts";
import { CABECALHO_PADRAO } from "./cabecalho-dos-documentos.ts";
import {
  identificacaoDoResumo,
  numerosDaContagem,
} from "./exportacao-do-resumo-por-cargo.ts";
import {
  CATEGORIAS_DO_RESUMO,
  linhasPlanasDoResumo,
  ROTULO_DA_COLUNA,
} from "./resumo-por-cargo-e-status.ts";

/*
  O PDF do Resumo por cargo e status (A4 deitado): timbrado, título, a
  identificação e a tabela (jspdf-autotable: o resumo tem poucas centenas de
  linhas), com subtotais em negrito e o registro no rodapé. Só desenho: o
  conteúdo é o de exportacao-do-resumo-por-cargo.ts. Carregado por import
  dinâmico, como o da lista, para o jsPDF não entrar no pacote da tela.
*/

/* ── PDF (A4 deitado, autotable: o resumo tem poucas centenas de linhas) ── */

const AZUL: [number, number, number] = [0, 59, 113];
const FUNDO_DO_SUBTOTAL: [number, number, number] = [232, 238, 245];
const MM = 72 / 25.4;

export function pdfDoResumo(
  pedido: PedidoDaExportacao,
  registro: RegistroDaExportacao,
  resumo: ResumoPorCargoEStatus,
  { jsPDF, autoTable }: Pick<BibliotecasDoPdf, "jsPDF" | "autoTable">,
  {
    cabecalho = CABECALHO_PADRAO,
    logo = null,
    comprimir = true,
  }: MarcaDoPdf = {},
): Uint8Array<ArrayBuffer> {
  const doc: TipoJsPdf = new jsPDF({
    unit: "pt",
    format: "a4",
    orientation: "landscape",
    compress: comprimir,
    putOnlyUsedFonts: true,
  });
  doc.setProperties({
    title: "Resumo por cargo e status",
    subject: textoParaOPdf(
      `Resumo por cargo e status - ${pedido.rotuloDaArea}`,
    ),
    creator: "Yeendé",
  });
  doc.setLanguage?.("pt-BR");
  const largura = doc.internal.pageSize.getWidth();
  const centro = largura / 2;
  let y = 12 * MM;
  if (logo && logo.largura > 0 && logo.altura > 0) {
    const w = 22 * MM;
    const h = (w * logo.altura) / logo.largura;
    try {
      doc.addImage(logo.bytes, "PNG", centro - w / 2, y, w, h);
      y += h + 6;
    } catch {
      // Logo ilegível: o timbrado sai só com o texto.
    }
  }
  doc.setFont("helvetica", "bold");
  String(cabecalho || CABECALHO_PADRAO)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((linha, i) => {
      doc.setFont("helvetica", i === 0 ? "bold" : "normal");
      doc.setFontSize(8);
      doc.text(textoParaOPdf(linha), centro, y, {
        align: "center",
        baseline: "top",
      });
      y += 10;
    });
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...AZUL);
  doc.text("Resumo por cargo e status", centro, y, {
    align: "center",
    baseline: "top",
  });
  doc.setTextColor(33, 37, 41);
  y += 22;

  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 110 } },
    body: identificacaoDoResumo(pedido, registro, resumo).map(([r, v]) => [
      textoParaOPdf(r),
      textoParaOPdf(v),
    ]),
  });

  const planas = linhasPlanasDoResumo(resumo);
  const mostrar = (valor: CelulaDaPlanilha) =>
    typeof valor === "number"
      ? valor.toLocaleString("pt-BR")
      : valor === ""
        ? "—"
        : textoParaOPdf(valor);
  const cabecalhoDaTabela = [
    "Cargo / Vaga",
    ROTULO_DA_COLUNA.aprovados,
    ...CATEGORIAS_DO_RESUMO.map((c) => ROTULO_DA_COLUNA[c]),
  ];
  const corpo = planas.map((l) => {
    const rotulo =
      l.nivel === "Vaga"
        ? [
            l.grupo,
            l.modalidade,
            l.codigoVaga && `Vaga ${l.codigoVaga}`,
            l.unidade,
          ]
            .filter(Boolean)
            .join(" · ")
        : l.nivel === "Subtotal"
          ? `Total · ${l.grupo}`
          : l.nivel === "Edital"
            ? `Total do edital · ${l.edital}`
            : "Total geral";
    const numeros = numerosDaContagem(
      l.contagem,
      resumo.subtipoRegistrado,
    ).slice(0, 1 + CATEGORIAS_DO_RESUMO.length);
    return [textoParaOPdf(rotulo), ...numeros.map(mostrar)];
  });
  autoTable(doc, {
    startY:
      ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
        ?.finalY ?? y) + 10,
    head: [cabecalhoDaTabela.map(textoParaOPdf)],
    body: corpo,
    styles: { font: "helvetica", fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: AZUL, textColor: [255, 255, 255] },
    columnStyles: Object.fromEntries(
      cabecalhoDaTabela.map((_, i) => [
        i,
        i === 0 ? { cellWidth: 260 } : { halign: "right" },
      ]),
    ),
    didParseCell: (dados) => {
      const nivel = planas[dados.row.index]?.nivel;
      if (dados.section === "body" && nivel && nivel !== "Vaga") {
        dados.cell.styles.fontStyle = "bold";
        dados.cell.styles.fillColor = FUNDO_DO_SUBTOTAL;
      }
    },
    didDrawPage: () => {
      const altura = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(
        textoParaOPdf(`Registro ${registro.id}`),
        10 * MM,
        altura - 6 * MM,
      );
    },
  });
  return new Uint8Array(doc.output("arraybuffer"));
}
