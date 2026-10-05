/*
  O retrato da lista gerada e a exportação no padrão das publicações.

  `instantaneoDaLista` reduz o resultado do motor ao que é publicado e
  auditado (TB_LISTA_CLASSIFICACAO."DS_RESULTADO"): por vaga, a lista geral e
  as de cada modalidade com posição, nome e nota, e os eliminados com motivo.
  SÓ NOME — sem CPF, data de nascimento, código de inscrição ou contato.

  O documento oficial (SEI, Word e impressão) sai de documento-sei.js e
  documento-docx.js, a partir deste retrato. Aqui ficam a planilha (XLSX:
  SpreadsheetML mínimo, duas planilhas — Classificação e Eliminados) e o
  nome do arquivo.
*/
import { escaparXml, zipSemCompressao } from "../documento-da-resposta.js";
import { MOTIVOS_DE_ELIMINACAO, TIPOS_DE_LISTA } from "./catalogo.js";
import { normalizarRegra } from "./regra.js";

export const MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const VERSAO_DO_RETRATO = 1;

/** O retrato que vai para o banco (e de onde sai a exportação). */
export function instantaneoDaLista(
  resultado,
  { edital = {}, regra, versao = null } = {},
) {
  const r = normalizarRegra(regra);
  // Só as parciais que a regra publica, e só na avaliação documental.
  const parciais = resultado.tipo === "PRELIMINAR" ? r.documental.parciais : [];
  const soParciais = (valores) =>
    parciais.length && valores
      ? {
          parciais: Object.fromEntries(
            parciais.map((p) => [p, valores[p] ?? null]),
          ),
        }
      : {};
  const linha = (l) => ({
    posicao: l.posicao,
    analise_id: l.analiseId,
    nome: l.nome,
    nota: l.nota,
    modalidades: l.modalidades,
    situacao: l.situacao,
    ...soParciais(l.parciais),
    // Nota alterada em recurso (ajuste aprovado): o número do recurso.
    ...(l.recursos?.length ? { recursos: l.recursos } : {}),
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
    ...(parciais.length ? { parciais } : {}),
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
        ...(e.recursos?.length ? { recursos: e.recursos } : {}),
        ...((parciais.length || resultado.tipo === "ENTREVISTA") &&
        e.nota !== undefined
          ? { nota: e.nota ?? null, ...soParciais(e.parciais) }
          : {}),
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
    APTO: "Apto",
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
  return gerarXlsx(
    [
      { nome: "Classificação", linhas: classificacao },
      { nome: "Eliminados", linhas: eliminados },
    ],
    quando,
  );
}

/**
 * Um .xlsx (SpreadsheetML mínimo) com as planilhas dadas: [{ nome, linhas }],
 * a primeira linha de cada uma em negrito. Também usado pela agenda das
 * entrevistas.
 */
export function gerarXlsx(planilhas, quando = new Date()) {
  const folhas = planilhas.map((p, i) => ({ ...p, n: i + 1 }));
  const arquivos = [
    {
      nome: "[Content_Types].xml",
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        folhas
          .map(
            (f) =>
              `<Override PartName="/xl/worksheets/sheet${f.n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join("") +
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
        `<sheets>${folhas.map((f) => `<sheet name="${escaparXml(f.nome)}" sheetId="${f.n}" r:id="rId${f.n}"/>`).join("")}</sheets></workbook>`,
    },
    {
      nome: "xl/_rels/workbook.xml.rels",
      conteudo:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        folhas
          .map(
            (f) =>
              `<Relationship Id="rId${f.n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${f.n}.xml"/>`,
          )
          .join("") +
        `<Relationship Id="rId${folhas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
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
    ...folhas.map((f) => ({
      nome: `xl/worksheets/sheet${f.n}.xml`,
      conteudo: planilhaXml(f.linhas),
    })),
  ];
  return zipSemCompressao(arquivos, quando);
}
