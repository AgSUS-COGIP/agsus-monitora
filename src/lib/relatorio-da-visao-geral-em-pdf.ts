import type { jsPDF as TipoJsPdf } from "jspdf";
import type {
  BibliotecasDoPdf,
  MarcaDoPdf,
} from "./avaliacao-documental/espelho-em-pdf.ts";
import type {
  ConteudoDoRelatorio,
  TabelaDoRelatorio,
} from "./relatorio-da-visao-geral.ts";
import { textoParaOPdf } from "./avaliacao-documental/espelho-em-pdf.ts";
import { CABECALHO_PADRAO } from "./cabecalho-dos-documentos.ts";

/*
  O PDF do montador de relatório da Visão geral (A4 deitado): o timbrado
  (logo e cabeçalho de Configurações › Marca), o título, a identificação do
  recorte, os números em caixas e as tabelas, com o cabeçalho repetido a cada
  página. Rodapé em toda página: área, emissão e "Página N de M". Um documento
  desenhado, não a impressão da tela: sem botões, filtros nem mapa cortado.
  O conteúdo vem pronto de relatorio-da-visao-geral.ts.
*/

const MM = 72 / 25.4;
const MARGEM = { topo: 12 * MM, lados: 10 * MM, pe: 12 * MM };
const FONTE = "helvetica";
const TAMANHO = 7.5;
const ALTURA_DA_LINHA = TAMANHO * 1.2;
const RESPIRO = 3;
const AZUL: [number, number, number] = [0, 59, 113];
const TEXTO: [number, number, number] = [33, 37, 41];
const CINZA: [number, number, number] = [100, 106, 112];
const FIO: [number, number, number] = [210, 214, 220];
const FUNDO_DO_CABECALHO: [number, number, number] = [232, 238, 245];
const FUNDO_ZEBRA: [number, number, number] = [247, 249, 251];

export async function pdfDoRelatorio(
  conteudo: ConteudoDoRelatorio,
  { jsPDF }: Pick<BibliotecasDoPdf, "jsPDF">,
  {
    cabecalho = CABECALHO_PADRAO,
    logo = null,
    comprimir = true,
  }: MarcaDoPdf = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const doc: TipoJsPdf = new jsPDF({
    unit: "pt",
    format: "a4",
    orientation: "landscape",
    compress: comprimir,
    putOnlyUsedFonts: true,
  });
  doc.setProperties({
    title: textoParaOPdf(`${conteudo.titulo} - ${conteudo.area}`),
    subject: textoParaOPdf(conteudo.titulo),
    creator: "Yeendé",
  });
  doc.setLanguage?.("pt-BR");
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const util = largura - 2 * MARGEM.lados;
  const centro = largura / 2;
  const fundo = altura - MARGEM.pe - 4;
  let y = MARGEM.topo;

  const fonte = (
    tamanho: number,
    estilo: "normal" | "bold" = "normal",
    cor: [number, number, number] = TEXTO,
  ) => {
    doc.setFont(FONTE, estilo);
    doc.setFontSize(tamanho);
    doc.setTextColor(...cor);
  };
  const novaPagina = () => {
    doc.addPage();
    y = MARGEM.topo;
  };

  // Timbrado.
  if (logo && logo.largura > 0 && logo.altura > 0) {
    const w = 18 * MM;
    const h = (w * logo.altura) / logo.largura;
    try {
      doc.addImage(logo.bytes, "PNG", centro - w / 2, y, w, h);
      y += h + 4;
    } catch {
      // Logo ilegível: o timbrado sai só com o texto.
    }
  }
  String(cabecalho || CABECALHO_PADRAO)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((linha, i) => {
      fonte(7.5, i === 0 ? "bold" : "normal", i === 0 ? AZUL : TEXTO);
      doc.text(textoParaOPdf(linha), centro, y, {
        align: "center",
        baseline: "top",
      });
      y += 9.5;
    });
  y += 3;
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(0.75);
  doc.line(MARGEM.lados, y, largura - MARGEM.lados, y);
  y += 10;

  fonte(14, "bold", AZUL);
  doc.text(textoParaOPdf(conteudo.titulo), centro, y, {
    align: "center",
    baseline: "top",
  });
  y += 18;
  fonte(10, "normal", CINZA);
  doc.text(textoParaOPdf(conteudo.area), centro, y, {
    align: "center",
    baseline: "top",
  });
  y += 18;

  // Identificação: "Rótulo: valor", quebrado na largura.
  for (const [rotulo, valor] of conteudo.identificacao) {
    fonte(8, "bold");
    const r = `${textoParaOPdf(rotulo)}: `;
    const wr = doc.getTextWidth(r);
    doc.text(r, MARGEM.lados, y, { baseline: "top" });
    fonte(8);
    const linhas = doc.splitTextToSize(
      textoParaOPdf(valor),
      util - wr,
    ) as string[];
    for (const linha of linhas) {
      doc.text(linha, MARGEM.lados + wr, y, { baseline: "top" });
      y += 10;
    }
  }
  y += 6;

  // Os números: uma fileira de caixas (quebra em duas quando não cabem).
  if (conteudo.numeros?.length) {
    const porLinha = Math.min(conteudo.numeros.length, 7);
    const espaco = 6;
    const w = (util - espaco * (porLinha - 1)) / porLinha;
    const h = 38;
    conteudo.numeros.forEach(([rotulo, valor], i) => {
      const coluna = i % porLinha;
      if (i > 0 && coluna === 0) y += h + espaco;
      const x = MARGEM.lados + coluna * (w + espaco);
      doc.setDrawColor(...FIO);
      doc.setFillColor(...FUNDO_ZEBRA);
      doc.roundedRect(x, y, w, h, 3, 3, "FD");
      fonte(7, "normal", CINZA);
      doc.text(
        (doc.splitTextToSize(textoParaOPdf(rotulo), w - 10) as string[])[0] ??
          "",
        x + 5,
        y + 6,
        { baseline: "top" },
      );
      fonte(14, "bold", AZUL);
      doc.text(textoParaOPdf(valor), x + 5, y + 18, { baseline: "top" });
    });
    y += h + 14;
  }

  // As tabelas.
  doc.setLineWidth(0.4);
  const desenharTabela = (tabela: TabelaDoRelatorio) => {
    /*
      Cada coluna tem ao menos a largura da palavra mais longa dela, no título
      (em negrito) e nas células: nem o título nem uma data se partem no meio
      ("Encerrament/o", "20/02/20/25"). O que sobra vai pelos pesos; se nem os
      mínimos cabem, tudo encolhe na mesma proporção.
    */
    const maiorPalavra = (texto: string) =>
      Math.max(
        0,
        ...textoParaOPdf(texto)
          .split(/\s+/)
          .map((palavra) => doc.getTextWidth(palavra)),
      );
    fonte(TAMANHO, "bold");
    const minimos = tabela.colunas.map((c) => maiorPalavra(c.rotulo));
    fonte(TAMANHO);
    tabela.linhas.forEach((celulas) =>
      celulas.forEach((celula, i) => {
        minimos[i] = Math.max(minimos[i] ?? 0, maiorPalavra(celula));
      }),
    );
    const minimosComRespiro = minimos.map((m) => m + 2 * RESPIRO + 1);
    const somaDosMinimos = minimosComRespiro.reduce((t, m) => t + m, 0);
    const soma = tabela.colunas.reduce((t, c) => t + c.peso, 0) || 1;
    const sobra = util - somaDosMinimos;
    const larguras =
      sobra >= 0
        ? tabela.colunas.map(
            (c, i) => (minimosComRespiro[i] ?? 0) + (sobra * c.peso) / soma,
          )
        : minimosComRespiro.map((m) => (m * util) / somaDosMinimos);
    const xs = larguras.map(
      (_, i) => MARGEM.lados + larguras.slice(0, i).reduce((t, w) => t + w, 0),
    );
    const quebrar = (texto: string, w: number): string[] => {
      if (!texto) return [""];
      const cabe = w - 2 * RESPIRO;
      return doc.getTextWidth(texto) <= cabe
        ? [texto]
        : (doc.splitTextToSize(texto, cabe) as string[]);
    };
    const linhaDaTabela = (
      celulas: readonly string[],
      tipo: "cabecalho" | "par" | "impar",
    ) => {
      fonte(
        TAMANHO,
        tipo === "cabecalho" ? "bold" : "normal",
        tipo === "cabecalho" ? AZUL : TEXTO,
      );
      const quebradas = celulas.map((c, i) =>
        quebrar(textoParaOPdf(c), larguras[i] ?? 0),
      );
      const h =
        Math.max(1, ...quebradas.map((l) => l.length)) * ALTURA_DA_LINHA +
        2 * RESPIRO;
      return {
        h,
        desenhar: () => {
          // A fonte de novo: o cabeçalho repetido na página nova a trocou.
          fonte(
            TAMANHO,
            tipo === "cabecalho" ? "bold" : "normal",
            tipo === "cabecalho" ? AZUL : TEXTO,
          );
          doc.setDrawColor(...FIO);
          quebradas.forEach((linhas, i) => {
            const x = xs[i] ?? 0;
            const w = larguras[i] ?? 0;
            const fundoDaCelula =
              tipo === "cabecalho"
                ? FUNDO_DO_CABECALHO
                : tipo === "par"
                  ? FUNDO_ZEBRA
                  : null;
            if (fundoDaCelula) doc.setFillColor(...fundoDaCelula);
            doc.rect(x, y, w, h, fundoDaCelula ? "FD" : "S");
            const direita = tabela.colunas[i]?.direita === true;
            linhas.forEach((linha, n) => {
              const ty = y + RESPIRO + n * ALTURA_DA_LINHA;
              if (direita && tipo !== "cabecalho")
                doc.text(linha, x + w - RESPIRO, ty, {
                  align: "right",
                  baseline: "top",
                });
              else doc.text(linha, x + RESPIRO, ty, { baseline: "top" });
            });
          });
          y += h;
        },
      };
    };
    const titulos = tabela.colunas.map((c) => c.rotulo);
    const cabecalhoDaTabela = () =>
      linhaDaTabela(titulos, "cabecalho").desenhar();

    // O título da seção não fica sozinho no pé da página.
    if (y + 60 > fundo) novaPagina();
    fonte(11, "bold", AZUL);
    doc.text(
      textoParaOPdf(`${tabela.titulo} (${tabela.linhas.length})`),
      MARGEM.lados,
      y,
      { baseline: "top" },
    );
    y += 15;
    cabecalhoDaTabela();
    if (!tabela.linhas.length) {
      fonte(TAMANHO, "normal", CINZA);
      doc.setDrawColor(...FIO);
      const h = ALTURA_DA_LINHA + 2 * RESPIRO;
      doc.rect(MARGEM.lados, y, util, h, "S");
      doc.text(
        textoParaOPdf(tabela.vazio),
        MARGEM.lados + RESPIRO,
        y + RESPIRO,
        {
          baseline: "top",
        },
      );
      y += h;
    }
    tabela.linhas.forEach((celulas, i) => {
      const linha = linhaDaTabela(celulas, i % 2 ? "par" : "impar");
      if (y + linha.h > fundo) {
        novaPagina();
        cabecalhoDaTabela();
      }
      linha.desenhar();
    });
    y += 16;
  };
  conteudo.tabelas.forEach(desenharTabela);

  // O rodapé de cada página, já sabendo quantas são.
  const rodape = textoParaOPdf(
    `Yeendé · ${conteudo.area} · gerado em ${conteudo.geradoEm}`,
  );
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p += 1) {
    doc.setPage(p);
    fonte(7, "normal", CINZA);
    doc.text(rodape, MARGEM.lados, altura - MARGEM.pe + 4, { baseline: "top" });
    doc.text(
      `Página ${p} de ${paginas}`,
      largura - MARGEM.lados,
      altura - MARGEM.pe + 4,
      { align: "right", baseline: "top" },
    );
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
