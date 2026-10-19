/*
  O ESPELHO DE NOTA EM PDF (e o ZIP com um PDF por candidato).

  Por quê: a coordenação manda cada espelho ao candidato; imprimir um documento
  só com centenas de folhas e recortar à mão não servia. Aqui o mesmo objeto
  `Espelho` de montarEspelho (espelho-de-nota.ts, a fonte do conteúdo) vira um
  PDF A4 com texto de verdade (pesquisável e leve: as fontes padrão do PDF,
  sem embutir fonte) na mesma estrutura da página impressa: timbrado, título,
  subtítulo, saudação, Dados do registro, Notas, Pontuação por critério com as
  justificativas, Justificativa / observação e rodapé. Nenhuma regra de
  conteúdo aqui: só desenho.

  jsPDF + jspdf-autotable (tabelas com quebra de página) e fflate (o ZIP) vêm
  por import dinâmico (carregarBibliotecasDoPdf): só baixam quando alguém
  pede o PDF. Nada é gravado no banco nem no Storage.
*/
import type { jsPDF as TipoJsPdf } from "jspdf";
import type { CellInput, RowInput, UserOptions } from "jspdf-autotable";
import { CABECALHO_PADRAO } from "../cabecalho-dos-documentos.js";
import {
  ABERTURA_DO_ESPELHO,
  COLUNAS_DOS_CRITERIOS,
  RODAPE_DO_ESPELHO,
  SECOES_DO_ESPELHO,
  SEM_OBSERVACAO,
  SUBTITULO_DO_ESPELHO,
  type Espelho,
} from "./espelho-de-nota.ts";

type ConstrutorDoPdf = typeof TipoJsPdf;
type DesenharTabela = (documento: TipoJsPdf, opcoes: UserOptions) => void;
type Zipar = (
  arquivos: Record<string, [Uint8Array, { level: 0 }]>,
) => Uint8Array<ArrayBuffer>;

export type BibliotecasDoPdf = {
  jsPDF: ConstrutorDoPdf;
  autoTable: DesenharTabela;
  zipSync: Zipar;
};

/** O logo em PNG (logoEmPng, src/modulos/classificacao/documento-no-navegador.ts). */
export type LogoDoPdf = { bytes: Uint8Array; largura: number; altura: number };
export type MarcaDoPdf = {
  cabecalho?: string;
  logo?: LogoDoPdf | null;
  /** Falso só nos testes, para ler o texto do PDF. */
  comprimir?: boolean;
};

let bibliotecas: Promise<BibliotecasDoPdf> | null = null;

/** jsPDF, autotable e fflate sob demanda (um chunk à parte), uma vez por sessão. */
export function carregarBibliotecasDoPdf(): Promise<BibliotecasDoPdf> {
  bibliotecas ??= Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("fflate"),
  ]).then(([pdf, tabela, zip]) => ({
    jsPDF: pdf.jsPDF,
    autoTable: tabela.autoTable as DesenharTabela,
    zipSync: zip.zipSync as Zipar,
  }));
  bibliotecas.catch(() => {
    bibliotecas = null;
  });
  return bibliotecas;
}

/* ── Texto nas fontes padrão do PDF ────────────────────────────────── */

// O que a WinAnsi (fontes padrão do PDF) tem além do Latin-1.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".split(""));
const TROCAS: Readonly<Record<string, string>> = {
  "≥": ">=",
  "≤": "<=",
  "→": "->",
  "←": "<-",
  "✓": "",
  "✔": "",
  "‐": "-",
  "‑": "-",
  "−": "-",
};

/**
 * O texto que as fontes padrão do PDF escrevem: acentos compostos (NFC), o
 * que a WinAnsi não tem vira equivalente (≥ → >=) ou "?", sem controle.
 */
export function textoParaOPdf(valor: unknown): string {
  return Array.from(
    String(valor ?? "")
      .normalize("NFC")
      .replace(/[\t\r]/g, " "),
  )
    .map((c) => {
      const codigo = c.codePointAt(0) ?? 0;
      if (c === "\n") return c;
      if (codigo >= 0x20 && codigo <= 0x7e) return c;
      if (codigo >= 0xa0 && codigo <= 0xff) return c;
      if (WIN_ANSI_EXTRA.has(c)) return c;
      if (c in TROCAS) return TROCAS[c];
      if (codigo < 0x20 || (codigo >= 0x7f && codigo < 0xa0)) return "";
      return "?";
    })
    .join("");
}

/* ── Nomes dos arquivos ────────────────────────────────────────────── */

/** Minúsculas sem acento, só letras, números e hífen ("114/2026" → "114-2026"). */
export function trechoDoNome(valor: unknown, maximo = 60): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maximo)
    .replace(/-+$/g, "");
}

/** "espelho-<vaga>-<código>-<nome-sem-acento>.pdf" (o que faltar sai). */
export function nomeDoPdfDoEspelho(espelho: Espelho): string {
  const partes = [
    "espelho",
    trechoDoNome(espelho.codigoDaVaga, 20),
    trechoDoNome(espelho.codigoDoCandidato, 20),
    trechoDoNome(espelho.candidato, 60),
  ].filter(Boolean);
  return `${partes.join("-")}.pdf`;
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** "espelhos-<edital>[-vaga-<vaga>]-<AAAA-MM-DD>.zip". */
export function nomeDoZipDosEspelhos(
  edital: string | null | undefined,
  quando: Date,
  vaga: string | null = null,
): string {
  const data = `${quando.getFullYear()}-${doisDigitos(quando.getMonth() + 1)}-${doisDigitos(quando.getDate())}`;
  const partes = [
    "espelhos",
    trechoDoNome(String(edital ?? "").replace(/^edital\s*/i, ""), 30),
    vaga ? `vaga-${trechoDoNome(vaga, 20)}` : "",
    data,
  ].filter(Boolean);
  return `${partes.join("-")}.zip`;
}

/** Nomes repetidos no mesmo ZIP ganham "-2", "-3"… antes do ".pdf". */
export function nomesSemRepetir(nomes: string[]): string[] {
  const usados = new Set<string>();
  return nomes.map((nome) => {
    let final = nome;
    for (let n = 2; usados.has(final); n += 1)
      final = nome.replace(/(\.[a-z0-9]+)?$/i, `-${n}$1`);
    usados.add(final);
    return final;
  });
}

/* ── A folha em PDF ────────────────────────────────────────────────── */

const MM = 72 / 25.4;
const MARGEM = { topo: 15 * MM, lados: 18 * MM, pe: 18 * MM };
const AZUL: [number, number, number] = [0, 59, 112];
const BORDA: [number, number, number] = [185, 199, 214];
const FUNDO_ROTULO: [number, number, number] = [246, 248, 251];
const FUNDO_SECAO: [number, number, number] = [232, 238, 245];
const TEXTO: [number, number, number] = [17, 17, 17];
const CINZA: [number, number, number] = [68, 68, 68];
const FONTE = "helvetica";
const ALTURA_DA_LINHA = 1.25;

const lista = (textos: string[]) =>
  textos.map((t) => `•  ${textoParaOPdf(t)}`).join("\n");

/** Um espelho em PDF (A4), pronto para baixar ou entrar no ZIP. */
export function pdfDoEspelho(
  espelho: Espelho,
  { jsPDF, autoTable }: Pick<BibliotecasDoPdf, "jsPDF" | "autoTable">,
  {
    cabecalho = CABECALHO_PADRAO,
    logo = null,
    comprimir = true,
  }: MarcaDoPdf = {},
): Uint8Array<ArrayBuffer> {
  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
    compress: comprimir,
    putOnlyUsedFonts: true,
  });
  doc.setProperties({
    title: textoParaOPdf(espelho.nomeDoArquivo),
    subject: textoParaOPdf(espelho.titulo),
    creator: "MONITORA",
  });
  doc.setLanguage?.("pt-BR");
  doc.setLineHeightFactor(ALTURA_DA_LINHA);
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const util = largura - 2 * MARGEM.lados;
  const centro = largura / 2;
  let y = MARGEM.topo;

  const linhaDe = (tamanho: number) => tamanho * ALTURA_DA_LINHA;
  const garantir = (precisa: number) => {
    if (y + precisa > altura - MARGEM.pe) {
      doc.addPage();
      y = MARGEM.topo;
    }
  };
  const fonte = (
    tamanho: number,
    estilo: "normal" | "bold" | "italic" = "normal",
    cor: [number, number, number] = TEXTO,
  ) => {
    doc.setFont(FONTE, estilo);
    doc.setFontSize(tamanho);
    doc.setTextColor(...cor);
  };
  /** Um parágrafo quebrado na largura, com quebra de página entre as linhas. */
  const paragrafo = (
    texto: string,
    tamanho: number,
    {
      estilo = "normal",
      cor = TEXTO,
      alinhar = "left",
    }: {
      estilo?: "normal" | "bold" | "italic";
      cor?: [number, number, number];
      alinhar?: "left" | "center" | "justify";
    } = {},
  ) => {
    fonte(tamanho, estilo, cor);
    const linhas = doc.splitTextToSize(textoParaOPdf(texto), util) as string[];
    linhas.forEach((linha, i) => {
      garantir(linhaDe(tamanho));
      const ultima = i === linhas.length - 1;
      if (alinhar === "center")
        doc.text(linha, centro, y, { align: "center", baseline: "top" });
      else if (alinhar === "justify" && !ultima)
        doc.text(linha, MARGEM.lados, y, {
          align: "justify",
          maxWidth: util,
          baseline: "top",
        });
      else doc.text(linha, MARGEM.lados, y, { baseline: "top" });
      y += linhaDe(tamanho);
    });
  };

  // Timbrado: o logo, as linhas do cabeçalho (a primeira em negrito, azul) e o fio.
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
  String(cabecalho || CABECALHO_PADRAO)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((linha, i) =>
      paragrafo(linha, 8, {
        estilo: i === 0 ? "bold" : "normal",
        cor: i === 0 ? AZUL : TEXTO,
        alinhar: "center",
      }),
    );
  y += 4;
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(0.75);
  doc.line(MARGEM.lados, y, largura - MARGEM.lados, y);
  y += 14;

  paragrafo(espelho.titulo, 15, {
    estilo: "bold",
    cor: AZUL,
    alinhar: "center",
  });
  y += 2;
  paragrafo(SUBTITULO_DO_ESPELHO, 10, { cor: CINZA, alinhar: "center" });
  y += 12;

  // "Prezado(a) <nome em negrito>,"
  fonte(11);
  const inicio = "Prezado(a) ";
  const nome = textoParaOPdf(espelho.candidato);
  garantir(linhaDe(11));
  doc.text(inicio, MARGEM.lados, y, { baseline: "top" });
  const xNome = MARGEM.lados + doc.getTextWidth(inicio);
  fonte(11, "bold");
  doc.text(nome, xNome, y, { baseline: "top" });
  const xVirgula = xNome + doc.getTextWidth(nome);
  fonte(11);
  doc.text(",", xVirgula, y, { baseline: "top" });
  y += linhaDe(11) + 6;
  paragrafo(ABERTURA_DO_ESPELHO, 11, { alinhar: "justify" });

  const base: UserOptions = {
    theme: "grid",
    margin: {
      top: MARGEM.topo,
      bottom: MARGEM.pe,
      left: MARGEM.lados,
      right: MARGEM.lados,
    },
    tableWidth: util,
    rowPageBreak: "avoid",
    styles: {
      font: FONTE,
      fontSize: 10,
      textColor: TEXTO,
      lineColor: BORDA,
      lineWidth: 0.75,
      cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
      valign: "top",
      overflow: "linebreak",
    },
  };
  const fimDaTabela = () =>
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? y;

  /** O título do quadro (faixa azul-clara) preso à primeira linha da tabela. */
  const secao = (titulo: string, tabela: Omit<UserOptions, "startY">) => {
    const faixa = 18;
    y += 12;
    garantir(faixa + 40);
    doc.setFillColor(...FUNDO_SECAO);
    doc.setDrawColor(...BORDA);
    doc.setLineWidth(0.75);
    doc.rect(MARGEM.lados, y, util, faixa, "FD");
    fonte(10.5, "bold", AZUL);
    doc.text(
      textoParaOPdf(titulo).toUpperCase(),
      MARGEM.lados + 6,
      y + faixa / 2,
      {
        baseline: "middle",
      },
    );
    y += faixa;
    autoTable(doc, { ...base, ...tabela, startY: y });
    y = fimDaTabela();
  };

  const linhas = (itens: { rotulo: string; valor: string }[]): RowInput[] =>
    itens.map((l) => [textoParaOPdf(l.rotulo), textoParaOPdf(l.valor)]);
  const colunasDeRotulo: UserOptions["columnStyles"] = {
    0: { cellWidth: util * 0.34, fillColor: FUNDO_ROTULO, fontStyle: "bold" },
  };

  secao(SECOES_DO_ESPELHO.dados, {
    body: linhas(espelho.dados),
    columnStyles: colunasDeRotulo,
  });
  secao(SECOES_DO_ESPELHO.notas, {
    body: linhas(espelho.notas),
    columnStyles: colunasDeRotulo,
  });

  if (espelho.modelo === "COM_PONTOS" && espelho.criterios.length) {
    const corpo: RowInput[] = [];
    for (const c of espelho.criterios) {
      corpo.push([
        textoParaOPdf(c.rotulo),
        textoParaOPdf(c.declarada),
        textoParaOPdf(c.apurada),
        textoParaOPdf(c.teto),
      ]);
      if (c.justificativas.length) {
        const celula: CellInput = {
          content: lista(c.justificativas),
          colSpan: 4,
          styles: {
            fontSize: 9.5,
            textColor: [51, 51, 51],
            fillColor: [252, 252, 253],
          },
        };
        corpo.push([celula]);
      }
    }
    const numero = { cellWidth: util * 0.15, halign: "center" as const };
    secao(SECOES_DO_ESPELHO.criterios, {
      head: [COLUNAS_DOS_CRITERIOS.map((c) => textoParaOPdf(c))],
      body: corpo,
      headStyles: {
        fillColor: FUNDO_ROTULO,
        textColor: TEXTO,
        fontStyle: "bold",
      },
      columnStyles: { 1: numero, 2: numero, 3: numero },
      didParseCell: (dado) => {
        if (dado.section === "head" && dado.column.index > 0)
          dado.cell.styles.halign = "center";
      },
    });
  }

  secao(SECOES_DO_ESPELHO.justificativas, {
    body: [
      [
        espelho.justificativas.length
          ? { content: lista(espelho.justificativas) }
          : {
              content: textoParaOPdf(SEM_OBSERVACAO),
              styles: { fontStyle: "italic", textColor: [85, 85, 85] },
            },
      ],
    ],
  });

  // Rodapé: o fio e a observação.
  y += 16;
  garantir(30);
  doc.setDrawColor(...BORDA);
  doc.setLineWidth(0.75);
  doc.line(MARGEM.lados, y, largura - MARGEM.lados, y);
  y += 6;
  paragrafo(RODAPE_DO_ESPELHO, 8.5, { cor: CINZA });

  return new Uint8Array(doc.output("arraybuffer"));
}

/* ── O ZIP com um PDF por espelho ──────────────────────────────────── */

const esperarUmPouco = () =>
  new Promise<void>((resolver) => setTimeout(resolver, 0));

/**
 * O ZIP com um PDF por espelho (na ordem recebida), em lotes de `porLote`
 * com uma pausa entre eles para a tela não travar. `aoProgredir(feitos,
 * total)` a cada lote; `cancelado()` verdadeiro para no fim do lote (null).
 * Os PDFs já são comprimidos: o ZIP só guarda (nível 0), o que é rápido.
 */
export async function zipDosEspelhos(
  espelhos: Espelho[],
  libs: BibliotecasDoPdf,
  {
    marca = {},
    porLote = 10,
    aoProgredir = () => {},
    cancelado = () => false,
    esperar = esperarUmPouco,
  }: {
    marca?: MarcaDoPdf;
    porLote?: number;
    aoProgredir?: (feitos: number, total: number) => void;
    cancelado?: () => boolean;
    esperar?: () => Promise<void>;
  } = {},
): Promise<{ bytes: Uint8Array<ArrayBuffer>; nomes: string[] } | null> {
  const nomes = nomesSemRepetir(espelhos.map(nomeDoPdfDoEspelho));
  const arquivos: Record<string, [Uint8Array, { level: 0 }]> = {};
  const passo = Math.max(1, Math.floor(porLote));
  aoProgredir(0, espelhos.length);
  for (let i = 0; i < espelhos.length; i += 1) {
    const espelho = espelhos[i];
    const nome = nomes[i];
    if (!espelho || !nome) continue;
    arquivos[nome] = [pdfDoEspelho(espelho, libs, marca), { level: 0 }];
    if ((i + 1) % passo === 0 || i === espelhos.length - 1) {
      aoProgredir(i + 1, espelhos.length);
      await esperar();
      if (cancelado()) return null;
    }
  }
  return { bytes: libs.zipSync(arquivos), nomes };
}
