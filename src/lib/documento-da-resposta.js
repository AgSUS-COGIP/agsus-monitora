/*
  O documento da resposta ao recurso, sem dependência: o .docx montado aqui
  (um ZIP "stored", sem compressão, com o mínimo que o Word, o LibreOffice e o
  Google Docs abrem) e a página de impressão (o navegador salva em PDF).

  O texto é o `texto_final` aprovado, texto puro: cada linha vira um parágrafo.
  No .docx ele entra escapado para XML; na impressão, como `textContent` de
  elementos criados um a um — nunca como HTML.
*/

const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export { MIME_DOCX };

/** As linhas do texto (quebras de Windows normalizadas). */
export function linhasDoTexto(texto) {
  return String(texto ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
}

/* Caracteres que o XML 1.0 não aceita (controle, menos tab/LF/CR) saem. */
// eslint-disable-next-line no-control-regex
const FORA_DO_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export function escaparXml(valor) {
  return String(valor ?? "")
    .replace(FORA_DO_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const FONTE =
  '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/>';

function paragrafoXml(linha, { negrito = false } = {}) {
  if (!linha.trim()) return "<w:p/>";
  const propriedades = `<w:rPr>${FONTE}${negrito ? "<w:b/>" : ""}</w:rPr>`;
  return `<w:p><w:pPr><w:spacing w:after="120"/><w:jc w:val="both"/></w:pPr><w:r>${propriedades}<w:t xml:space="preserve">${escaparXml(linha)}</w:t></w:r></w:p>`;
}

/** O `word/document.xml`: a primeira linha (o título) em negrito. */
export function documentoXml(texto) {
  const linhas = linhasDoTexto(texto);
  const corpo = linhas
    .map((linha, indice) => paragrafoXml(linha, { negrito: indice === 0 }))
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${corpo}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
    '<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/>' +
    "</w:sectPr></w:body></w:document>"
  );
}

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
  "</Types>";

const RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
  "</Relationships>";

function propriedadesXml(titulo, quando) {
  const iso = quando.toISOString().replace(/\.\d{3}Z$/, "Z");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${escaparXml(titulo)}</dc:title><dc:creator>AgSUS — MONITORA</dc:creator>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created>` +
    "</cp:coreProperties>"
  );
}

/* ── ZIP sem compressão ──────────────────────────────────────────────── */

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1)
    crc = TABELA_CRC[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dataDos(quando) {
  const hora =
    (quando.getHours() << 11) |
    (quando.getMinutes() << 5) |
    Math.floor(quando.getSeconds() / 2);
  const dia =
    ((Math.max(1980, quando.getFullYear()) - 1980) << 9) |
    ((quando.getMonth() + 1) << 5) |
    quando.getDate();
  return { hora, dia };
}

/** ZIP com os arquivos `{ nome, conteudo }` (texto), sem compressão. */
export function zipSemCompressao(arquivos, quando = new Date()) {
  const codificador = new TextEncoder();
  const { hora, dia } = dataDos(quando);
  const partes = [];
  const central = [];
  let deslocamento = 0;
  for (const { nome, conteudo } of arquivos) {
    const nomeBytes = codificador.encode(nome);
    const dados =
      conteudo instanceof Uint8Array ? conteudo : codificador.encode(conteudo);
    const crc = crc32(dados);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nomes em UTF-8
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, hora, true);
    local.setUint16(12, dia, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, dados.length, true);
    local.setUint32(22, dados.length, true);
    local.setUint16(26, nomeBytes.length, true);
    local.setUint16(28, 0, true);
    partes.push(new Uint8Array(local.buffer), nomeBytes, dados);

    const entrada = new DataView(new ArrayBuffer(46));
    entrada.setUint32(0, 0x02014b50, true);
    entrada.setUint16(4, 20, true);
    entrada.setUint16(6, 20, true);
    entrada.setUint16(8, 0x0800, true);
    entrada.setUint16(10, 0, true);
    entrada.setUint16(12, hora, true);
    entrada.setUint16(14, dia, true);
    entrada.setUint32(16, crc, true);
    entrada.setUint32(20, dados.length, true);
    entrada.setUint32(24, dados.length, true);
    entrada.setUint16(28, nomeBytes.length, true);
    entrada.setUint32(42, deslocamento, true);
    central.push(new Uint8Array(entrada.buffer), nomeBytes);
    deslocamento += 30 + nomeBytes.length + dados.length;
  }
  const tamanhoCentral = central.reduce((soma, p) => soma + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamanhoCentral, true);
  fim.setUint32(16, deslocamento, true);
  const todas = [...partes, ...central, new Uint8Array(fim.buffer)];
  const saida = new Uint8Array(todas.reduce((soma, p) => soma + p.length, 0));
  let posicao = 0;
  for (const parte of todas) {
    saida.set(parte, posicao);
    posicao += parte.length;
  }
  return saida;
}

/** Os bytes do .docx da resposta. */
export function gerarDocx(
  texto,
  { titulo = "Resposta a recurso", quando = new Date() } = {},
) {
  return zipSemCompressao(
    [
      { nome: "[Content_Types].xml", conteudo: CONTENT_TYPES },
      { nome: "_rels/.rels", conteudo: RELS },
      { nome: "docProps/core.xml", conteudo: propriedadesXml(titulo, quando) },
      { nome: "word/document.xml", conteudo: documentoXml(texto) },
    ],
    quando,
  );
}

/** "resposta-recurso-12-ana-ribeiro" (sem extensão). */
export function nomeDoDocumento(recurso) {
  const candidato = String(recurso?.candidato ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return ["resposta-recurso", recurso?.nu, candidato].filter(Boolean).join("-");
}

/* ── Página de impressão ─────────────────────────────────────────────── */

const ESTILO_DA_IMPRESSAO = `
  @page { size: A4; margin: 25mm 25mm 25mm 30mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.5; color: #000; margin: 0; }
  p { margin: 0 0 6pt; text-align: justify; white-space: pre-wrap; }
  p.titulo { font-weight: bold; text-align: center; margin-bottom: 12pt; }
  p.vazio { min-height: 1em; }
`;

/**
 * Monta, no `documento` dado (o de um iframe), a página de impressão da
 * resposta: título na aba (vira o nome sugerido do PDF) e um parágrafo por
 * linha, tudo como texto.
 */
export function montarPaginaDeImpressao(
  documento,
  texto,
  { titulo = "Resposta a recurso" } = {},
) {
  documento.title = titulo;
  const estilo = documento.createElement("style");
  estilo.textContent = ESTILO_DA_IMPRESSAO;
  documento.head.replaceChildren(estilo);
  const titulos = documento.createElement("title");
  titulos.textContent = titulo;
  documento.head.append(titulos);
  const paragrafos = linhasDoTexto(texto).map((linha, indice) => {
    const p = documento.createElement("p");
    if (indice === 0) p.className = "titulo";
    else if (!linha.trim()) p.className = "vazio";
    p.textContent = linha;
    return p;
  });
  documento.body.replaceChildren(...paragrafos);
  return documento;
}
