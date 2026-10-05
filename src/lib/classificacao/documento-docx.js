/*
  O documento oficial da lista em .docx, com papel timbrado, para quem prefere
  anexar ou ajustar no Word antes de subir no SEI. Mesmo modelo de
  documento-sei.js (documentoOficial), sem dependência nova: o ZIP sem
  compressão de documento-da-resposta.js com

    word/header1.xml   o logo da AgSUS (PNG embutido) e o cabeçalho da agência
                       (Configurações › Marca), centralizados;
    word/footer1.xml   "<nome do documento> · SEI <processo> / pg. N" (campo
                       PAGE: o Word numera);
    word/document.xml  título, 1. DISPOSIÇÕES PRELIMINARES (itens numerados
                       aqui, com tabulação de 25 mm como no SEI), um bloco por
                       vaga com a tabela, 2. DISPOSIÇÕES FINAIS e a linha
                       "Brasília, <data por extenso>." — sem assinatura (o SEI
                       assina).

  O logo chega pronto ({ bytes: PNG, largura, altura }); sem logo, o
  cabeçalho vai só com o texto.
*/
import { escaparXml, zipSemCompressao } from "../documento-da-resposta.js";
import { CABECALHO_PADRAO, numeracao, trechos } from "./documento-sei.js";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const WP =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture";

/* A4, margens das publicações: 3 cm à esquerda, 2 cm à direita. */
const LARGURA_UTIL = 11906 - 1701 - 1134;
const RECUO_DO_NUMERO = 1418; // 25 mm, o recuo do número dos itens no SEI

const FONTE = '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>';

export function corrida(
  texto,
  { negrito = false, tamanho = 24, cor = "", caixaAlta = false } = {},
) {
  return `<w:r><w:rPr>${FONTE}${negrito ? "<w:b/>" : ""}${caixaAlta ? "<w:caps/>" : ""}${cor ? `<w:color w:val="${cor}"/>` : ""}<w:sz w:val="${tamanho}"/></w:rPr><w:t xml:space="preserve">${escaparXml(texto)}</w:t></w:r>`;
}

export const corridas = (texto, opcoes = {}) =>
  trechos(texto)
    .map((t) =>
      corrida(t.texto, { ...opcoes, negrito: opcoes.negrito || t.negrito }),
    )
    .join("");

export function paragrafo(
  conteudo,
  {
    alinhamento = "both",
    depois = 120,
    antes = 0,
    sombra = false,
    tabulacao = false,
  } = {},
) {
  return (
    `<w:p><w:pPr>${sombra ? '<w:shd w:val="clear" w:color="auto" w:fill="E6E6E6"/>' : ""}` +
    `${tabulacao ? `<w:tabs><w:tab w:val="left" w:pos="${RECUO_DO_NUMERO}"/></w:tabs>` : ""}` +
    `<w:spacing w:before="${antes}" w:after="${depois}"/><w:jc w:val="${alinhamento}"/>` +
    `</w:pPr>${conteudo}</w:p>`
  );
}

const TAB = `<w:r><w:rPr>${FONTE}</w:rPr><w:tab/></w:r>`;

function item(numero, texto) {
  return paragrafo(`${corrida(numero)}${TAB}${corridas(texto)}`, {
    tabulacao: true,
  });
}

function titulo(n, rotulo) {
  return paragrafo(
    `${corrida(`${n}.`)}${TAB}${corrida(rotulo.toUpperCase(), { negrito: true })}`,
    { sombra: true, tabulacao: true, antes: 240 },
  );
}

const borda = (lado) =>
  `<w:${lado} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`;

function celula(
  texto,
  {
    largura,
    alinhamento = "left",
    negrito = false,
    sombra = false,
    extensao = 0,
  },
) {
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${largura}" w:type="dxa"/>${extensao ? `<w:gridSpan w:val="${extensao}"/>` : ""}` +
    `${sombra ? '<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>' : ""}</w:tcPr>` +
    `<w:p><w:pPr><w:spacing w:before="20" w:after="20"/><w:jc w:val="${alinhamento}"/></w:pPr>${corrida(texto, { negrito, tamanho: 20 })}</w:p></w:tc>`
  );
}

/** A tabela da vaga: larguras em % do modelo convertidas para a largura útil da página. */
export function tabelaXml(t) {
  const larguras = t.colunas.map((c) =>
    Math.round((LARGURA_UTIL * c.largura) / 100),
  );
  const total = larguras.reduce((s, l) => s + l, 0);
  const propriedades =
    `<w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:tblBorders>` +
    ["top", "left", "bottom", "right", "insideH", "insideV"]
      .map(borda)
      .join("") +
    `</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>`;
  if (!t.linhas.length)
    return (
      `<w:tbl>${propriedades}<w:tblGrid><w:gridCol w:w="${total}"/></w:tblGrid>` +
      `<w:tr>${celula(t.vazia, { largura: total, alinhamento: "center" })}</w:tr></w:tbl>`
    );
  const grade = `<w:tblGrid>${larguras.map((l) => `<w:gridCol w:w="${l}"/>`).join("")}</w:tblGrid>`;
  const cabecalho = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${t.colunas
    .map((c, i) =>
      celula(c.rotulo, {
        largura: larguras[i],
        alinhamento: "center",
        negrito: true,
        sombra: true,
      }),
    )
    .join("")}</w:tr>`;
  const corpo = t.linhas
    .map(
      (linha) =>
        `<w:tr><w:trPr><w:cantSplit/></w:trPr>${linha
          .map((valor, i) =>
            celula(String(valor ?? ""), {
              largura: larguras[i],
              alinhamento:
                t.colunas[i].alinhamento === "esquerda" ? "left" : "center",
            }),
          )
          .join("")}</w:tr>`,
    )
    .join("");
  return `<w:tbl>${propriedades}${grade}${cabecalho}${corpo}</w:tbl>`;
}

/** O word/document.xml do documento oficial. */
export function corpoXml(doc) {
  const partes = doc.titulo.map((linha) =>
    paragrafo(corridas(linha, { tamanho: 26, caixaAlta: true }), {
      alinhamento: "center",
      depois: 60,
    }),
  );
  partes.push(titulo(1, "Disposições Preliminares"));
  const numerosPre = numeracao(doc.preliminares, 1);
  doc.preliminares.forEach((i, n) => partes.push(item(numerosPre[n], i.texto)));
  for (const bloco of doc.blocos) {
    if (bloco.cabecalho)
      partes.push(
        paragrafo(corrida(bloco.cabecalho, { negrito: true, tamanho: 20 }), {
          alinhamento: "center",
          antes: 240,
        }),
      );
    for (const t of bloco.tabelas) {
      if (t.titulo)
        partes.push(
          paragrafo(corrida(t.titulo, { negrito: true, tamanho: 20 }), {
            alinhamento: "center",
            antes: 120,
            depois: 60,
          }),
        );
      partes.push(tabelaXml(t));
    }
  }
  partes.push(titulo(2, "Disposições Finais"));
  const numerosFin = numeracao(doc.finais, 2);
  doc.finais.forEach((i, n) => partes.push(item(numerosFin[n], i.texto)));
  partes.push(
    paragrafo(corrida(doc.localDataPorExtenso), {
      alinhamento: "right",
      antes: 360,
    }),
  );
  return documentoComPartes(partes);
}

/** Quebra de página (entre as cartas de um documento com várias). */
export const QUEBRA_DE_PAGINA = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

/**
 * O word/document.xml com os parágrafos já montados: A4, margens das
 * publicações, cabeçalho e rodapé (rIdCabecalho, rIdRodape).
 */
export function documentoComPartes(partes) {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:document xmlns:w="${W}" xmlns:r="${R}">` +
    `<w:body>${partes.join("")}<w:sectPr>` +
    '<w:headerReference w:type="default" r:id="rIdCabecalho"/>' +
    '<w:footerReference w:type="default" r:id="rIdRodape"/>' +
    '<w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1418" w:right="1134" w:bottom="1134" w:left="1701" w:header="567" w:footer="567" w:gutter="0"/>' +
    "</w:sectPr></w:body></w:document>"
  );
}

/* 1 px = 9525 EMU; o logo sai com 2,2 cm de largura. */
const LARGURA_DO_LOGO = 792000;

function logoXml(logo) {
  const altura = Math.round(
    (LARGURA_DO_LOGO * (logo.altura || 1)) / (logo.largura || 1),
  );
  return (
    `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${LARGURA_DO_LOGO}" cy="${altura}"/><wp:docPr id="1" name="Logo da AgSUS"/>` +
    `<a:graphic xmlns:a="${A}"><a:graphicData uri="${PIC}"><pic:pic xmlns:pic="${PIC}">` +
    `<pic:nvPicPr><pic:cNvPr id="0" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${LARGURA_DO_LOGO}" cy="${altura}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>` +
    `</wp:inline></w:drawing></w:r>`
  );
}

/** O word/header1.xml: logo e as linhas do cabeçalho da agência. */
export function cabecalhoXml(cabecalho, logo) {
  const linhas = String(cabecalho || CABECALHO_PADRAO)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const partes = [];
  if (logo?.bytes?.length)
    partes.push(
      paragrafo(logoXml(logo), { alinhamento: "center", depois: 80 }),
    );
  linhas.forEach((linha, i) =>
    partes.push(
      paragrafo(corrida(linha, { tamanho: 16 }), {
        alinhamento: "center",
        depois: i === linhas.length - 1 ? 200 : 0,
      }),
    ),
  );
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:hdr xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="${WP}">${partes.join("")}</w:hdr>`
  );
}

/** O word/footer1.xml: "<nome> · SEI <processo> / pg. N" (N = campo PAGE). */
export function rodapeXml(doc) {
  const texto = [doc.nome, doc.processo ? `SEI ${doc.processo}` : ""]
    .filter(Boolean)
    .join(" · ");
  const pagina =
    `<w:r><w:rPr>${FONTE}<w:color w:val="808080"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>` +
    `<w:r><w:rPr>${FONTE}<w:color w:val="808080"/><w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>` +
    `<w:r><w:rPr>${FONTE}<w:color w:val="808080"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>` +
    `${corrida("1", { tamanho: 16, cor: "808080" })}` +
    `<w:r><w:rPr>${FONTE}<w:color w:val="808080"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:ftr xmlns:w="${W}" xmlns:r="${R}">` +
    paragrafo(
      `${corrida(`${texto} / pg. `, { tamanho: 16, cor: "808080" })}${pagina}`,
      {
        alinhamento: "center",
        depois: 0,
      },
    ) +
    "</w:ftr>"
  );
}

const relacao = (id, tipo, alvo) =>
  `<Relationship Id="${id}" Type="${R}/${tipo}" Target="${alvo}"/>`;

/**
 * Os bytes do .docx com papel timbrado.
 *   doc        documentoOficial(...)
 *   cabecalho  o texto do cabeçalho da agência (linhas)
 *   logo       { bytes: Uint8Array PNG, largura, altura } ou null
 */
export function gerarDocxOficial(doc, opcoes = {}) {
  return pacoteDocx(
    { nome: doc.nome, processo: doc.processo, documento: corpoXml(doc) },
    opcoes,
  );
}

/**
 * Os arquivos do .docx (para zipar), com o word/document.xml já pronto
 * (`documento`, de documentoComPartes), o timbrado e o rodapé
 * "<nome> · SEI <processo> / pg. N". A carta de convocação também o usa.
 */
export function arquivosDoDocx(
  { nome, processo = "", documento },
  { cabecalho = CABECALHO_PADRAO, logo = null, quando = new Date() } = {},
) {
  const doc = { nome, processo };
  const comLogo = Boolean(logo?.bytes?.length);
  const arquivos = [
    {
      nome: "[Content_Types].xml",
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Default Extension="png" ContentType="image/png"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
        '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        "</Types>",
    },
    {
      nome: "_rels/.rels",
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        relacao("rId1", "officeDocument", "word/document.xml") +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        "</Relationships>",
    },
    {
      nome: "docProps/core.xml",
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
        'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        `<dc:title>${escaparXml(doc.nome)}</dc:title><dc:creator>AgSUS — MONITORA</dc:creator>` +
        `<dcterms:created xsi:type="dcterms:W3CDTF">${quando.toISOString().replace(/\.\d{3}Z$/, "Z")}</dcterms:created>` +
        "</cp:coreProperties>",
    },
    {
      nome: "word/_rels/document.xml.rels",
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        relacao("rIdCabecalho", "header", "header1.xml") +
        relacao("rIdRodape", "footer", "footer1.xml") +
        "</Relationships>",
    },
    { nome: "word/document.xml", conteudo: documento },
    {
      nome: "word/header1.xml",
      conteudo: cabecalhoXml(cabecalho, comLogo ? logo : null),
    },
    { nome: "word/footer1.xml", conteudo: rodapeXml(doc) },
  ];
  if (comLogo)
    arquivos.push(
      {
        nome: "word/_rels/header1.xml.rels",
        conteudo:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          relacao("rIdLogo", "image", "media/logo.png") +
          "</Relationships>",
      },
      { nome: "word/media/logo.png", conteudo: logo.bytes },
    );
  return arquivos;
}

/** Os bytes do .docx (arquivosDoDocx zipado). */
export function pacoteDocx(partes, opcoes = {}) {
  const quando = opcoes.quando || new Date();
  return zipSemCompressao(arquivosDoDocx(partes, { ...opcoes, quando }), quando);
}
