import type { jsPDF as TipoJsPdf } from "jspdf";
import type {
  BibliotecasDoPdf,
  MarcaDoPdf,
} from "./avaliacao-documental/espelho-em-pdf.ts";
import type {
  PedidoDaExportacao,
  RegistroDaExportacao,
} from "./exportacao-da-lista-de-aprovados.ts";
import { textoParaOPdf } from "./avaliacao-documental/espelho-em-pdf.ts";
import { CABECALHO_PADRAO } from "./cabecalho-dos-documentos.ts";
import {
  dataHoraDeBrasilia,
  identificacaoDaExportacao,
  linhasDaExportacao,
} from "./exportacao-da-lista-de-aprovados.ts";
import { formatarNota } from "./lista-aprovados-rules.ts";

/*
  O PDF da Lista de aprovados (A4 deitado): timbrado (logo e cabeçalho de
  Configurações › Marca) na primeira página, título, a identificação (área,
  editais, filtros, registros, emissão e registro) e a tabela, com o cabeçalho
  repetido em cada página. Rodapé em toda página: "Página N de M", a emissão
  e o registro. Só desenho: o conteúdo é o de exportacao-da-lista-de-aprovados.ts.

  A tabela é desenhada aqui (não pelo jspdf-autotable) para ceder a vez à tela
  a cada lote de linhas: 13 mil candidatos (~330 páginas) levam alguns
  segundos, e numa chamada só a página travava. Um Web Worker resolveria, mas
  levaria a própria cópia do jsPDF (~585 KB a mais no build). `aoProgresso`
  recebe a fração já desenhada, para a tela mostrar.
*/

const MM = 72 / 25.4;
const MARGEM = { topo: 12 * MM, lados: 10 * MM, pe: 12 * MM };
const FONTE = "helvetica";
const TAMANHO = 7;
const ALTURA_DA_LINHA = TAMANHO * 1.18;
const RESPIRO = 2.5;
const AZUL: [number, number, number] = [0, 59, 113];
const TEXTO: [number, number, number] = [33, 37, 41];
const CINZA: [number, number, number] = [100, 106, 112];
const FIO: [number, number, number] = [210, 214, 220];
const FUNDO_DO_CABECALHO: [number, number, number] = [232, 238, 245];
/* Editais listados no topo do PDF; os demais ficam na contagem ("e mais N"). */
const EDITAIS_NO_TOPO = 12;
/* Linhas desenhadas entre uma pausa e outra (a tela respira a cada lote). */
const LOTE = 300;

/* As colunas do PDF: as da planilha, com a Unidade junto do edital. */
const COLUNAS: readonly { titulo: string; peso: number; direita?: boolean }[] =
  [
    { titulo: "Edital", peso: 26 },
    { titulo: "Cód. vaga", peso: 18 },
    { titulo: "Cargo", peso: 40 },
    { titulo: "Clas.", peso: 11, direita: true },
    { titulo: "Nome", peso: 58 },
    { titulo: "Modalidade", peso: 38 },
    { titulo: "Nota", peso: 12, direita: true },
    { titulo: "Situação", peso: 30 },
    { titulo: "Convocação", peso: 20 },
    { titulo: "Observação", peso: 24 },
  ];

export interface OpcoesDoDesenho {
  aoProgresso?: (fracao: number) => void;
  /** A pausa entre os lotes (nos testes, nenhuma). */
  ceder?: () => Promise<void>;
}

const cederAoNavegador = () =>
  new Promise<void>((pronto) => setTimeout(pronto, 0));

/** As células de cada linha do PDF, já no texto que as fontes padrão escrevem. */
export function celulasDoPdf(
  pedido: Pick<PedidoDaExportacao, "candidatos" | "convocacoes">,
): string[][] {
  return linhasDaExportacao(pedido.candidatos, pedido.convocacoes).map(
    ([
      edital,
      unidade,
      vaga,
      cargo,
      clas,
      nome,
      modalidade,
      nota,
      situacao,
      convocacao,
      subJudice,
      antes,
    ]) => [
      textoParaOPdf([edital, unidade].filter(Boolean).join(" · ")),
      textoParaOPdf(vaga),
      textoParaOPdf(cargo),
      textoParaOPdf(clas),
      textoParaOPdf(nome),
      textoParaOPdf(modalidade),
      typeof nota === "number" ? formatarNota(nota) : textoParaOPdf(nota),
      textoParaOPdf(situacao),
      textoParaOPdf(convocacao),
      textoParaOPdf(
        [subJudice ? "Sub judice" : "", antes ? `Antes: ${antes}` : ""]
          .filter(Boolean)
          .join(". "),
      ),
    ],
  );
}

export async function pdfDaExportacao(
  pedido: PedidoDaExportacao,
  registro: RegistroDaExportacao,
  { jsPDF }: Pick<BibliotecasDoPdf, "jsPDF">,
  {
    cabecalho = CABECALHO_PADRAO,
    logo = null,
    comprimir = true,
  }: MarcaDoPdf = {},
  { aoProgresso = () => {}, ceder = cederAoNavegador }: OpcoesDoDesenho = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const doc: TipoJsPdf = new jsPDF({
    unit: "pt",
    format: "a4",
    orientation: "landscape",
    compress: comprimir,
    putOnlyUsedFonts: true,
  });
  doc.setProperties({
    title: "Lista de aprovados",
    subject: textoParaOPdf(`Lista de aprovados - ${pedido.rotuloDaArea}`),
    creator: "MONITORA",
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

  fonte(13, "bold", AZUL);
  doc.text("Lista de aprovados", centro, y, {
    align: "center",
    baseline: "top",
  });
  y += 20;

  // Identificação: "Rótulo: valor", quebrado na largura (editais demais ficam na contagem).
  for (const [rotulo, valor] of identificacaoDaExportacao(pedido, registro)) {
    if (rotulo === "Documento") continue;
    let v = valor;
    if (
      (rotulo === "Editais" || rotulo === "Edital") &&
      pedido.editais.length > EDITAIS_NO_TOPO
    ) {
      const nomes = pedido.editais
        .slice(0, EDITAIS_NO_TOPO)
        .map((e) => e.rotulo);
      v = `${pedido.todosOsEditais ? "Todos os editais da área" : "Escolhidos"} (${pedido.editais.length}): ${nomes.join("; ")} e mais ${pedido.editais.length - EDITAIS_NO_TOPO}`;
    }
    fonte(8, "bold");
    const r = `${textoParaOPdf(rotulo)}: `;
    const wr = doc.getTextWidth(r);
    doc.text(r, MARGEM.lados, y, { baseline: "top" });
    fonte(8);
    const linhas = doc.splitTextToSize(textoParaOPdf(v), util - wr) as string[];
    for (const linha of linhas) {
      doc.text(linha, MARGEM.lados + wr, y, { baseline: "top" });
      y += 10;
    }
  }
  y += 4;

  // A tabela.
  const soma = COLUNAS.reduce((t, c) => t + c.peso, 0);
  const larguras = COLUNAS.map((c) => (util * c.peso) / soma);
  const xs = larguras.map(
    (_, i) => MARGEM.lados + larguras.slice(0, i).reduce((t, w) => t + w, 0),
  );
  doc.setLineWidth(0.4);

  /* As linhas do texto numa largura: sem quebrar quando cabe (o caso comum, e rápido). */
  const quebrar = (texto: string, w: number): string[] => {
    if (!texto) return [""];
    const cabe = w - 2 * RESPIRO;
    return doc.getTextWidth(texto) <= cabe
      ? [texto]
      : (doc.splitTextToSize(texto, cabe) as string[]);
  };

  const desenharLinha = (
    celulas: readonly string[],
    cabecalhoDaTabela = false,
  ) => {
    fonte(
      TAMANHO,
      cabecalhoDaTabela ? "bold" : "normal",
      cabecalhoDaTabela ? AZUL : TEXTO,
    );
    const quebradas = celulas.map((c, i) => quebrar(c, larguras[i] ?? 0));
    const h =
      Math.max(...quebradas.map((l) => l.length)) * ALTURA_DA_LINHA +
      2 * RESPIRO;
    return {
      h,
      desenhar: () => {
        doc.setDrawColor(...FIO);
        quebradas.forEach((linhas, i) => {
          const x = xs[i] ?? 0;
          const w = larguras[i] ?? 0;
          // No PDF, a cor do texto é a de preenchimento: o fundo volta a cada célula.
          if (cabecalhoDaTabela) doc.setFillColor(...FUNDO_DO_CABECALHO);
          doc.rect(x, y, w, h, cabecalhoDaTabela ? "FD" : "S");
          const direita = COLUNAS[i]?.direita === true;
          linhas.forEach((linha, n) => {
            const ty = y + RESPIRO + n * ALTURA_DA_LINHA;
            if (direita)
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
  const titulos = COLUNAS.map((c) => textoParaOPdf(c.titulo));
  const cabecalhoDaTabela = () => desenharLinha(titulos, true).desenhar();

  cabecalhoDaTabela();
  const corpo = celulasDoPdf(pedido);
  if (!corpo.length) {
    fonte(TAMANHO);
    doc.setDrawColor(...FIO);
    const h = ALTURA_DA_LINHA + 2 * RESPIRO;
    doc.rect(MARGEM.lados, y, util, h, "S");
    doc.text(
      "Nenhum candidato nos filtros escolhidos.",
      MARGEM.lados + RESPIRO,
      y + RESPIRO,
      { baseline: "top" },
    );
    y += h;
  }
  for (let i = 0; i < corpo.length; i += 1) {
    const linha = desenharLinha(corpo[i] ?? []);
    if (y + linha.h > fundo) {
      doc.addPage();
      y = MARGEM.topo;
      cabecalhoDaTabela();
      fonte(TAMANHO);
    }
    linha.desenhar();
    if ((i + 1) % LOTE === 0) {
      aoProgresso((i + 1) / corpo.length);
      await ceder();
    }
  }
  aoProgresso(1);

  // O rodapé de cada página, já sabendo quantas são.
  const rodape = textoParaOPdf(
    `Lista de aprovados · emitida em ${dataHoraDeBrasilia(registro.emitidaEm)} · registro ${registro.id}`,
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
