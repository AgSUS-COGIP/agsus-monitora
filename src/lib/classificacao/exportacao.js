/*
  O retrato da lista gerada e a exportação no padrão das publicações.

  `instantaneoDaLista` reduz o resultado do motor ao que é publicado e
  auditado (TB_LISTA_CLASSIFICACAO."DS_RESULTADO"): por vaga, a lista geral e
  as de cada modalidade com posição, nome e nota, e os eliminados com motivo.
  SÓ NOME — sem CPF, data de nascimento, código de inscrição ou contato.

  `documentoDaLista` monta o documento (título, um bloco por vaga com o
  cabeçalho "VAGA código - cargo - lotação - N vagas (…)", as tabelas
  Classificação | Nome | Nota — e Modalidade na geral quando as sublistas vêm no
  mesmo documento —, "Não houve candidatos aptos." quando vazia, o rodapé da
  regra). Dele saem, sem dependência nova:
    - DOCX: o mesmo ZIP sem compressão de documento-da-resposta.js, com tabelas;
    - XLSX: SpreadsheetML mínimo (duas planilhas: Classificação e Eliminados);
    - PDF: página de impressão (o navegador salva em PDF — window.print), os
      elementos criados um a um, nunca como HTML.
*/
import { escaparXml, zipSemCompressao } from "../documento-da-resposta.js";
import { MOTIVOS_DE_ELIMINACAO, TIPOS_DE_LISTA } from "./catalogo.js";
import { formatarNota, ordinal } from "./numeros.js";
import { normalizarRegra } from "./regra.js";

export const MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const VERSAO_DO_RETRATO = 1;

const TITULOS = Object.freeze({
  PRELIMINAR: "RESULTADO PRELIMINAR - AVALIAÇÃO DOCUMENTAL E DE TÍTULOS",
  CONVOCACAO: "CONVOCAÇÃO PARA ENTREVISTA",
  FINAL: "RESULTADO FINAL - PROCESSO SELETIVO",
});
const VAZIA = "Não houve candidatos aptos.";

/** O retrato que vai para o banco (e de onde sai a exportação). */
export function instantaneoDaLista(
  resultado,
  { edital = {}, regra, versao = null } = {},
) {
  const r = normalizarRegra(regra);
  const linha = (l) => ({
    posicao: l.posicao,
    analise_id: l.analiseId,
    nome: l.nome,
    nota: l.nota,
    modalidades: l.modalidades,
    situacao: l.situacao,
  });
  return {
    schema: VERSAO_DO_RETRATO,
    tipo: resultado.tipo,
    edital: {
      id: edital.id ?? null,
      edital: edital.edital ?? "",
      unidade: edital.unidade ?? "",
    },
    regra_versao: versao,
    casas: resultado.casas,
    data_corte: resultado.dataCorte,
    rodape: r.rodape,
    empate_final: r.empate_final.metodo,
    modalidades: r.modalidades
      .filter((m) => m.lista_propria)
      .map((m) => ({ codigo: m.codigo, nome: m.nome })),
    vagas: resultado.vagas.map((v) => ({
      chave: v.chave,
      codigo: v.codigo,
      cargo: v.cargo,
      lotacao: v.lotacao,
      cabecalho: v.cabecalho,
      geral: v.geral.map(linha),
      listas: Object.fromEntries(
        Object.entries(v.porModalidade).map(([codigo, linhas]) => [
          codigo,
          linhas.map(linha),
        ]),
      ),
      eliminados: v.eliminados.map((e) => ({
        analise_id: e.analiseId,
        nome: e.nome,
        motivo: e.motivo,
        detalhe: e.detalhe || "",
      })),
    })),
    avisos: resultado.avisos.map((a) => ({
      codigo: a.codigo,
      vaga: a.vaga || null,
      texto: a.texto,
    })),
    pendencias: resultado.pendencias.map((p) => ({
      chave: p.chave,
      vaga: p.vaga,
      metodo: p.metodo,
    })),
    totais: resultado.totais,
  };
}

const rotuloDaModalidade = (codigo, modalidades) =>
  codigo === "AC"
    ? "AC"
    : modalidades.find((m) => m.codigo === codigo)?.nome || codigo;

/*
  O documento: `lista` = "todas" (geral + sublistas no mesmo documento, com a
  coluna Modalidade na geral), "geral" ou o código de uma modalidade.
*/
export function documentoDaLista(
  retrato,
  { lista = "todas", registro = null } = {},
) {
  const casas = retrato.casas ?? 2;
  const modalidades = retrato.modalidades || [];
  const nomeDaLista = (codigo) =>
    codigo === "geral"
      ? "Classificação Geral"
      : modalidades.find((m) => m.codigo === codigo)?.nome || codigo;
  const comModalidade = lista === "todas";
  const tabela = (codigo, linhas, coluna) => ({
    titulo: nomeDaLista(codigo),
    colunas: coluna
      ? ["Classificação", "Nome", "Nota", "Modalidade"]
      : ["Classificação", "Nome", "Nota"],
    linhas: linhas.map((l) => {
      const base = [ordinal(l.posicao), l.nome, formatarNota(l.nota, casas)];
      if (coluna)
        base.push(
          (l.modalidades || [])
            .filter((m) => m !== "AC")
            .map((m) => rotuloDaModalidade(m, modalidades))
            .join(" / ") || "AC",
        );
      return base;
    }),
    vazia: VAZIA,
  });
  const blocos = retrato.vagas.map((v) => {
    const tabelas = [];
    if (lista === "todas" || lista === "geral")
      tabelas.push(tabela("geral", v.geral, comModalidade));
    for (const m of modalidades)
      if (lista === "todas" || lista === m.codigo)
        tabelas.push(tabela(m.codigo, v.listas?.[m.codigo] || [], false));
    return { cabecalho: v.cabecalho, tabelas };
  });
  const edital = retrato.edital?.edital
    ? `EDITAL Nº ${retrato.edital.edital}`
    : "";
  const unidade = retrato.edital?.unidade || "";
  const tituloLista =
    lista !== "todas" && lista !== "geral"
      ? ` - ${nomeDaLista(lista).toUpperCase()}`
      : "";
  const controle = registro
    ? `Lista gerada em ${dataHora(registro.gerada_em)}${registro.por ? ` por ${registro.por}` : ""} · regra versão ${registro.versao_regra ?? retrato.regra_versao ?? "—"} · SHA-256 ${String(registro.hash || "").slice(0, 16)}`
    : "";
  return {
    titulo: `${TITULOS[retrato.tipo] || "CLASSIFICAÇÃO"}${tituloLista}`,
    subtitulo: [edital, unidade].filter(Boolean).join(" - "),
    blocos,
    rodape: retrato.rodape || "",
    controle,
  };
}

function dataHora(valor) {
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** "classificacao-final-83-2026" (sem extensão). */
export function nomeDoArquivo(retrato, lista = "todas") {
  const tipo =
    TIPOS_DE_LISTA.find(([v]) => v === retrato.tipo)?.[0]?.toLowerCase() ||
    "lista";
  const edital = String(retrato.edital?.edital || "edital")
    .replace(/[^0-9a-z]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return [
    "classificacao",
    tipo,
    edital,
    lista !== "todas" ? lista.toLowerCase() : "",
  ]
    .filter(Boolean)
    .join("-");
}

/* ── DOCX ───────────────────────────────────────────────────────────── */

const FONTE = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>';
const corrida = (texto, { negrito = false, tamanho = 20 } = {}) =>
  `<w:r><w:rPr>${FONTE}${negrito ? "<w:b/>" : ""}<w:sz w:val="${tamanho}"/></w:rPr><w:t xml:space="preserve">${escaparXml(texto)}</w:t></w:r>`;
const paragrafo = (
  texto,
  { negrito = false, centro = false, tamanho = 20, depois = 120 } = {},
) =>
  `<w:p><w:pPr><w:spacing w:after="${depois}"/>${centro ? '<w:jc w:val="center"/>' : '<w:jc w:val="both"/>'}</w:pPr>${corrida(texto, { negrito, tamanho })}</w:p>`;

function celula(
  texto,
  { negrito = false, largura, sombra = false, centro = false } = {},
) {
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${largura}" w:type="dxa"/>${sombra ? '<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>' : ""}</w:tcPr>` +
    `<w:p><w:pPr><w:spacing w:after="0"/>${centro ? '<w:jc w:val="center"/>' : ""}</w:pPr>${corrida(texto, { negrito, tamanho: 18 })}</w:p></w:tc>`
  );
}

function tabelaXml({ colunas, linhas, vazia }) {
  const larguras =
    colunas.length === 4 ? [1500, 4700, 1200, 1600] : [1700, 5700, 1600];
  const borda = (lado) =>
    `<w:${lado} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`;
  const propriedades =
    '<w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders>' +
    ["top", "left", "bottom", "right", "insideH", "insideV"]
      .map(borda)
      .join("") +
    `</w:tblBorders></w:tblPr><w:tblGrid>${larguras.map((l) => `<w:gridCol w:w="${l}"/>`).join("")}</w:tblGrid>`;
  const cabecalho = `<w:tr>${colunas.map((c, i) => celula(c, { negrito: true, largura: larguras[i], sombra: true, centro: true })).join("")}</w:tr>`;
  const corpo = linhas.length
    ? linhas
        .map(
          (l) =>
            `<w:tr>${l.map((c, i) => celula(String(c), { largura: larguras[i], centro: i !== 1 })).join("")}</w:tr>`,
        )
        .join("")
    : `<w:tr><w:tc><w:tcPr><w:tcW w:w="9000" w:type="dxa"/><w:gridSpan w:val="${colunas.length}"/></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="center"/></w:pPr>${corrida(vazia, { tamanho: 18 })}</w:p></w:tc></w:tr>`;
  return `<w:tbl>${propriedades}${cabecalho}${corpo}</w:tbl>`;
}

export function documentoXmlDaLista(doc) {
  const partes = [
    paragrafo(doc.titulo, {
      negrito: true,
      centro: true,
      tamanho: 24,
      depois: 60,
    }),
  ];
  if (doc.subtitulo)
    partes.push(
      paragrafo(doc.subtitulo, {
        negrito: true,
        centro: true,
        tamanho: 22,
        depois: 240,
      }),
    );
  for (const bloco of doc.blocos) {
    partes.push(paragrafo(bloco.cabecalho, { negrito: true, depois: 120 }));
    for (const t of bloco.tabelas) {
      if (bloco.tabelas.length > 1)
        partes.push(paragrafo(t.titulo, { negrito: true, depois: 60 }));
      partes.push(tabelaXml(t), paragrafo("", { depois: 120 }));
    }
  }
  if (doc.rodape) partes.push(paragrafo(doc.rodape, { depois: 120 }));
  if (doc.controle) partes.push(paragrafo(doc.controle, { tamanho: 14 }));
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${partes.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
    '<w:pgMar w:top="1418" w:right="1134" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/>' +
    "</w:sectPr></w:body></w:document>"
  );
}

const TIPOS_DOCX =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  "</Types>";
const RELS_DOCX =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  "</Relationships>";

/** Os bytes do .docx da lista. */
export function gerarDocxDaLista(doc, quando = new Date()) {
  return zipSemCompressao(
    [
      { nome: "[Content_Types].xml", conteudo: TIPOS_DOCX },
      { nome: "_rels/.rels", conteudo: RELS_DOCX },
      { nome: "word/document.xml", conteudo: documentoXmlDaLista(doc) },
    ],
    quando,
  );
}

/* ── XLSX ───────────────────────────────────────────────────────────── */

const colunaExcel = (i) => {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

function planilhaXml(linhas) {
  const corpo = linhas
    .map(
      (linha, l) =>
        `<row r="${l + 1}">${linha
          .map((valor, c) => {
            const ref = `${colunaExcel(c)}${l + 1}`;
            if (typeof valor === "number" && Number.isFinite(valor))
              return `<c r="${ref}"><v>${valor}</v></c>`;
            return `<c r="${ref}" t="inlineStr"${l === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${escaparXml(valor ?? "")}</t></is></c>`;
          })
          .join("")}</row>`,
    )
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${corpo}</sheetData></worksheet>`
  );
}

/** As linhas das duas planilhas (Classificação e Eliminados) do retrato. */
export function linhasDaPlanilha(retrato) {
  const modalidades = retrato.modalidades || [];
  const situacoes = {
    VAGA: "Dentro das vagas",
    CR: "Cadastro reserva",
    CONVOCADO: "Convocado",
  };
  const classificacao = [
    [
      "Vaga",
      "Cargo",
      "Lista",
      "Classificação",
      "Nome",
      "Nota",
      "Modalidade",
      "Situação",
    ],
  ];
  const eliminados = [["Vaga", "Cargo", "Nome", "Motivo", "Detalhe"]];
  for (const v of retrato.vagas) {
    const listas = [
      ["Classificação Geral", v.geral],
      ...modalidades.map((m) => [m.nome, v.listas?.[m.codigo] || []]),
    ];
    for (const [nome, linhas] of listas)
      for (const l of linhas)
        classificacao.push([
          v.codigo || "",
          v.cargo || "",
          nome,
          l.posicao,
          l.nome,
          l.nota,
          (l.modalidades || [])
            .map((m) => rotuloDaModalidade(m, modalidades))
            .join(" / "),
          situacoes[l.situacao] || "",
        ]);
    for (const e of v.eliminados)
      eliminados.push([
        v.codigo || "",
        v.cargo || "",
        e.nome,
        MOTIVOS_DE_ELIMINACAO[e.motivo] || e.motivo,
        e.detalhe || "",
      ]);
  }
  return { classificacao, eliminados };
}

/** Os bytes do .xlsx da lista. */
export function gerarXlsxDaLista(retrato, quando = new Date()) {
  const { classificacao, eliminados } = linhasDaPlanilha(retrato);
  const arquivos = [
    {
      nome: "[Content_Types].xml",
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        "</Types>",
    },
    {
      nome: "_rels/.rels",
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>",
    },
    {
      nome: "xl/workbook.xml",
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Classificação" sheetId="1" r:id="rId1"/><sheet name="Eliminados" sheetId="2" r:id="rId2"/></sheets></workbook>',
    },
    {
      nome: "xl/_rels/workbook.xml.rels",
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        "</Relationships>",
    },
    {
      nome: "xl/styles.xml",
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs>' +
        '<cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>',
    },
    { nome: "xl/worksheets/sheet1.xml", conteudo: planilhaXml(classificacao) },
    { nome: "xl/worksheets/sheet2.xml", conteudo: planilhaXml(eliminados) },
  ];
  return zipSemCompressao(arquivos, quando);
}

/* ── Impressão (PDF pelo navegador) ─────────────────────────────────── */

const ESTILO_DA_IMPRESSAO = `
  @page { size: A4; margin: 20mm 18mm 20mm 22mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; margin: 0; }
  h1 { font-size: 12pt; text-align: center; margin: 0 0 4pt; }
  h2 { font-size: 11pt; text-align: center; margin: 0 0 14pt; }
  h3 { font-size: 10pt; margin: 14pt 0 6pt; }
  h4 { font-size: 10pt; margin: 8pt 0 4pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8pt; page-break-inside: auto; }
  th, td { border: 1px solid #000; padding: 3pt 5pt; text-align: center; }
  th { background: #d9d9d9; }
  td.nome { text-align: left; }
  tr { page-break-inside: avoid; }
  p.rodape { margin-top: 14pt; text-align: justify; }
  p.controle { font-size: 7pt; color: #444; }
`;

/** Monta a página de impressão no `documento` (de um iframe), só com textContent. */
export function montarPaginaDaLista(documento, doc) {
  const criar = (tag, texto, classe) => {
    const el = documento.createElement(tag);
    if (texto !== undefined) el.textContent = texto;
    if (classe) el.className = classe;
    return el;
  };
  documento.title = doc.titulo;
  const estilo = criar("style", ESTILO_DA_IMPRESSAO);
  documento.head.replaceChildren(estilo, criar("title", doc.titulo));
  const corpo = [criar("h1", doc.titulo)];
  if (doc.subtitulo) corpo.push(criar("h2", doc.subtitulo));
  for (const bloco of doc.blocos) {
    corpo.push(criar("h3", bloco.cabecalho));
    for (const t of bloco.tabelas) {
      if (bloco.tabelas.length > 1) corpo.push(criar("h4", t.titulo));
      const tabela = criar("table");
      const cabeca = criar("tr");
      for (const c of t.colunas) cabeca.append(criar("th", c));
      tabela.append(cabeca);
      if (!t.linhas.length) {
        const tr = criar("tr");
        const td = criar("td", t.vazia);
        td.colSpan = t.colunas.length;
        tr.append(td);
        tabela.append(tr);
      }
      for (const l of t.linhas) {
        const tr = criar("tr");
        l.forEach((valor, i) =>
          tr.append(criar("td", String(valor), i === 1 ? "nome" : "")),
        );
        tabela.append(tr);
      }
      corpo.push(tabela);
    }
  }
  if (doc.rodape) corpo.push(criar("p", doc.rodape, "rodape"));
  if (doc.controle) corpo.push(criar("p", doc.controle, "controle"));
  documento.body.replaceChildren(...corpo);
  return documento;
}
