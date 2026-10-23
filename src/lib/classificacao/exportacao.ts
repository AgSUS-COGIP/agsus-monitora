import type { ResultadoDoMotor, LinhaDaLista } from "./tipos-do-resultado.ts";
import type {
  CelulaDaPlanilha,
  LinhaDoRetrato,
  ModalidadeDoRetrato,
  PlanilhaDaClassificacao,
} from "./tipos-dos-documentos.ts";
import { retratoParaDocumento } from "./dados-dos-documentos.ts";
/*
  O retrato da lista gerada e a exportação no padrão das publicações.

  `instantaneoDaLista` reduz o resultado do motor ao que é publicado e
  auditado (TB_LISTA_CLASSIFICACAO."DS_RESULTADO"): por vaga, a lista geral e
  as de cada modalidade com posição, nome e nota, e os eliminados com motivo.
  SÓ NOME — sem CPF, data de nascimento, código de inscrição ou contato.

  O documento oficial (SEI, Word e impressão) sai de documento-sei.ts e
  documento-docx.ts, a partir deste retrato. Aqui ficam a planilha (XLSX:
  SpreadsheetML mínimo, duas planilhas — Classificação e Eliminados) e o
  nome do arquivo.
*/
import { escaparXml, zipSemCompressao } from "../documento-da-resposta.js";
import {
  MOTIVOS_DE_ELIMINACAO,
  TIPOS_DE_LISTA,
  TIPOS_DE_LISTA_DA_PRE_CLASSIFICACAO,
} from "./catalogo.ts";
import { normalizarRegra } from "./regra.ts";
import { ehEditalDeTreinamento } from "../edital-de-treinamento.js";

export const MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const VERSAO_DO_RETRATO = 1;

/** O retrato que vai para o banco (e de onde sai a exportação). */
/** @param {unknown} resultado
 * @param {{edital?: Record<string, unknown>, regra?: Record<string, unknown>, versao?: number | null}} [opcoes]
 */
export function instantaneoDaLista(
  resultado: ResultadoDoMotor,
  {
    edital = {},
    regra,
    versao = null,
  }: {
    edital?: Record<string, unknown>;
    regra?: unknown;
    versao?: number | null;
  } = {},
) {
  const r = normalizarRegra(regra);
  // Só as parciais que a regra publica, e só na avaliação documental.
  const parciais = resultado.tipo === "PRELIMINAR" ? r.documental.parciais : [];
  const soParciais = (valores: Record<string, number | null> | undefined) =>
    parciais.length && valores
      ? {
          parciais: Object.fromEntries(
            parciais.map((p) => [p, valores[p] ?? null]),
          ),
        }
      : {};
  const linha = (l: LinhaDaLista) => ({
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
      // Só no edital de treinamento (o retrato dos reais não muda).
      ...(ehEditalDeTreinamento(edital) ? { treinamento: true } : {}),
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
      // As vagas e o limite da convocação como a Classificação os contou (Entrevistas mostra).
      total: v.total ?? null,
      cadastro_reserva: Boolean(v.cadastroReserva),
      origem_das_vagas: v.origemDasVagas ?? null,
      ...(v.limiteConvocacao ? { limite_convocacao: v.limiteConvocacao } : {}),
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
      // Quem ainda aguarda a análise documental (fora das listas e dos eliminados).
      ...(v.aguardando?.length
        ? {
            aguardando: v.aguardando.map((a) => ({
              analise_id: a.analiseId,
              nome: a.nome,
              situacao: a.situacao,
            })),
          }
        : {}),
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

const rotuloDaModalidade = (
  codigo: string,
  modalidades: ModalidadeDoRetrato[],
) =>
  codigo === "AC"
    ? "AC"
    : modalidades.find((m) => m.codigo === codigo)?.nome || codigo;

/** "classificacao-final-83-2026" (sem extensão). */
export function nomeDoArquivo(entrada: unknown, lista = "todas") {
  const retrato = retratoParaDocumento(entrada);
  const tipo =
    [...TIPOS_DE_LISTA, ...TIPOS_DE_LISTA_DA_PRE_CLASSIFICACAO]
      .find(([v]) => v === retrato.tipo)?.[0]
      ?.toLowerCase() || "lista";
  const lote =
    retrato.tipo === "LOTE" && retrato.lote ? `lote-${retrato.lote}` : "";
  const edital = String(retrato.edital?.edital || "edital")
    .replace(/[^0-9a-z]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return [
    ehEditalDeTreinamento(retrato.edital) ? "treinamento" : "",
    "classificacao",
    tipo,
    lote,
    edital,
    lista !== "todas" ? lista.toLowerCase() : "",
  ]
    .filter(Boolean)
    .join("-");
}

/* ── XLSX ───────────────────────────────────────────────────────────── */

const colunaExcel = (i: number) => {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/* A área do filtro: do cabeçalho até a última linha, na largura da linha mais larga. */
function areaDoFiltro(linhas: PlanilhaDaClassificacao["linhas"]) {
  const largura = Math.max(1, ...linhas.map((l) => l.length));
  return `A1:${colunaExcel(largura - 1)}${Math.max(1, linhas.length)}`;
}

function planilhaXml(
  linhas: PlanilhaDaClassificacao["linhas"],
  larguras: PlanilhaDaClassificacao["larguras"] = [],
  filtro = false,
) {
  // Com filtro, o cabeçalho fica fixo ao rolar.
  const vista = filtro
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : "";
  // Larguras em caracteres (proporcionais ao conteúdo de cada coluna).
  const colunas = larguras.length
    ? `<cols>${larguras
        .map(
          (w, i) =>
            `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`,
        )
        .join("")}</cols>`
    : "";
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
    `${vista}${colunas}<sheetData>${corpo}</sheetData>` +
    (filtro ? `<autoFilter ref="${areaDoFiltro(linhas)}"/>` : "") +
    "</worksheet>"
  );
}

/* Larguras (em caracteres) das colunas de cada planilha. */
export const LARGURAS_DA_PLANILHA = Object.freeze({
  classificacao: [10, 48, 22, 13, 40, 9, 28, 18],
  eliminados: [10, 48, 40, 42, 60],
  aguardando: [10, 48, 40, 18],
});

/** As linhas das planilhas (Classificação, Eliminados e Aguardando análise) do retrato. */
export function linhasDaPlanilha(entrada: unknown) {
  const retrato = retratoParaDocumento(entrada, true);
  const modalidades = retrato.modalidades || [];
  const situacoes: Readonly<Record<string, string | undefined>> = {
    VAGA: "Dentro das vagas",
    CR: "Cadastro reserva",
    CONVOCADO: "Convocado",
    APTO: "Apto",
  };
  const classificacao: CelulaDaPlanilha[][] = [
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
  const eliminados: CelulaDaPlanilha[][] = [
    ["Vaga", "Cargo", "Nome", "Motivo", "Detalhe"],
  ];
  const aguardando: CelulaDaPlanilha[][] = [
    ["Vaga", "Cargo", "Nome", "Situação na análise"],
  ];
  for (const v of retrato.vagas) {
    const listas: [string, LinhaDoRetrato[]][] = [
      ["Classificação Geral", v.geral],
      ...modalidades.map((m): [string, LinhaDoRetrato[]] => [
        m.nome,
        v.listas?.[m.codigo] || [],
      ]),
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
          situacoes[l.situacao ?? ""] || "",
        ]);
    for (const e of v.eliminados)
      eliminados.push([
        v.codigo || "",
        v.cargo || "",
        e.nome,
        motivos[e.motivo] || e.motivo,
        e.detalhe || "",
      ]);
    for (const a of v.aguardando || [])
      aguardando.push([v.codigo || "", v.cargo || "", a.nome, a.situacao]);
  }
  return { classificacao, eliminados, aguardando };
}

/** Os bytes do .xlsx da lista. */
export function gerarXlsxDaLista(retrato: unknown, quando = new Date()) {
  const { classificacao, eliminados, aguardando } = linhasDaPlanilha(retrato);
  return gerarXlsx(
    [
      {
        nome: "Classificação",
        linhas: classificacao,
        larguras: LARGURAS_DA_PLANILHA.classificacao,
      },
      {
        nome: "Eliminados",
        linhas: eliminados,
        larguras: LARGURAS_DA_PLANILHA.eliminados,
      },
      ...(aguardando.length > 1
        ? [
            {
              nome: "Aguardando análise",
              linhas: aguardando,
              larguras: LARGURAS_DA_PLANILHA.aguardando,
            },
          ]
        : []),
    ],
    quando,
  );
}

/* O nome oculto que o Excel usa para lembrar o filtro de cada planilha. */
function nomesDosFiltros(
  folhas: readonly (PlanilhaDaClassificacao & { n: number })[],
) {
  const com = folhas.filter((f) => f.filtro === true);
  if (!com.length) return "";
  return `<definedNames>${com
    .map(
      (f) =>
        `<definedName name="_xlnm._FilterDatabase" localSheetId="${f.n - 1}" hidden="1">'${escaparXml(f.nome.replace(/'/g, "''"))}'!${areaDoFiltro(f.linhas).replace(/([A-Z]+)(\d+)/g, "$$$1$$$2")}</definedName>`,
    )
    .join("")}</definedNames>`;
}

/**
 * Um .xlsx (SpreadsheetML mínimo) com as planilhas dadas: [{ nome, linhas }],
 * a primeira linha de cada uma em negrito. Também usado pela agenda das
 * entrevistas.
 */
export function gerarXlsx(
  planilhas: readonly PlanilhaDaClassificacao[],
  quando = new Date(),
) {
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
        `<sheets>${folhas.map((f) => `<sheet name="${escaparXml(f.nome)}" sheetId="${f.n}" r:id="rId${f.n}"/>`).join("")}</sheets>` +
        nomesDosFiltros(folhas) +
        "</workbook>",
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
      conteudo: planilhaXml(f.linhas, f.larguras, f.filtro === true),
    })),
  ];
  return zipSemCompressao(arquivos, quando);
}

const motivos: Readonly<Record<string, string | undefined>> =
  MOTIVOS_DE_ELIMINACAO;
