import type { CandidatoDasRegrasDeAprovados } from "./tipos-das-regras-de-aprovados.ts";
import type {
  CelulaDaPlanilha,
  PlanilhaDaClassificacao,
} from "./classificacao/tipos-dos-documentos.ts";
import { sanitizeCsvCell } from "./csv-security.ts";
import { arquivosDoXlsx, MIME_XLSX } from "./classificacao/exportacao.ts";
import {
  filterApprovedCandidates,
  formatarData,
  formatarNota,
  OPCOES_DO_FILTRO_DE_STATUS,
  statusEfetivo,
} from "./lista-aprovados-rules.ts";

/*
  EXPORTAR A LISTA DE APROVADOS (issue #583): o conteúdo do arquivo.

  O botão "Exportar" da aba Aprovados leva a lista que passou pelos filtros da
  tela (área, edital, cargo, modalidade e situação; e o recorte do aviso, quando
  a tela foi aberta por um) — a busca da tabela não entra: ela é "somente na
  tabela". Não confundir com o "Exportar CSV" da Convocação (ordem de chamada,
  lista-convocacao-rules.ts).

  Antes de gerar, a tela registra a exportação no banco
  (registrar_exportacao_aprovados, migration 20261110190000), que confere a
  permissão, recalcula o total da lista vigente e devolve o identificador e a
  data de emissão: os dois saem no arquivo, com os filtros.

  Aqui: as linhas (uma por candidato, sem repetir; na ordem edital → cargo →
  classificação → nome), a identificação, o CSV (`;`, BOM, células protegidas
  contra fórmula por csv-security.ts), as planilhas do XLSX e o nome do
  arquivo. O PDF é desenhado em exportacao-da-lista-de-aprovados-em-pdf.ts.
  Dado pessoal: só o nome, como na tela (sem CPF, contato ou matrícula).
*/

export type FormatoDaExportacao = "XLSX" | "CSV" | "PDF";

export const FORMATOS_DA_EXPORTACAO: readonly {
  valor: FormatoDaExportacao;
  rotulo: string;
  icone: string;
}[] = Object.freeze([
  { valor: "XLSX", rotulo: "Planilha (XLSX)", icone: "fa-file-excel" },
  { valor: "CSV", rotulo: "CSV", icone: "fa-file-csv" },
  { valor: "PDF", rotulo: "PDF", icone: "fa-file-pdf" },
]);

export const MIME_DA_EXPORTACAO: Readonly<Record<FormatoDaExportacao, string>> =
  Object.freeze({
    XLSX: MIME_XLSX,
    CSV: "text/csv;charset=utf-8",
    PDF: "application/pdf",
  });

export interface CandidatoDaExportacao extends CandidatoDasRegrasDeAprovados {
  classificacao?: unknown;
  codigo_vaga?: unknown;
}

export interface EditalDaExportacao {
  id: string;
  rotulo: string;
}

/** O que a tela manda exportar: a lista já filtrada e os filtros que a fizeram. */
export interface PedidoDaExportacao {
  area: string;
  rotuloDaArea: string;
  /** Os candidatos que passaram pelos filtros da tela. */
  candidatos: readonly CandidatoDaExportacao[];
  /** Candidatos da lista nos editais, cargos e modalidades (sem situação e sem o aviso). */
  totalDoRecorte: number;
  /** Os editais da exportação: os escolhidos no filtro, ou todos os da área. */
  editais: readonly EditalDaExportacao[];
  /** Nenhum edital escolhido no filtro: todos os da área. */
  todosOsEditais: boolean;
  cargos: readonly string[];
  modalidades: readonly string[];
  situacoes: readonly string[];
  /** A tela foi aberta por um aviso, só nas vagas da pessoa. */
  recorteDoAviso: boolean;
  /** candidato_id → { data } da convocação (listar_convocacoes_aprovados). */
  convocacoes?: ReadonlyMap<string, { data?: unknown }>;
  /** Quando a tela carregou a lista (ISO). */
  dadosDe?: string;
}

/** A resposta de registrar_exportacao_aprovados. */
export interface RegistroDaExportacao {
  id: string;
  emitidaEm: string;
}

const texto = (valor: unknown) => String(valor ?? "").trim();

/** Os parâmetros de registrar_exportacao_aprovados (nenhum id de candidato vai ao banco). */
export function argumentosDoRegistro(
  pedido: PedidoDaExportacao,
  formato: FormatoDaExportacao,
) {
  return {
    p_area: pedido.area,
    p_formato: formato,
    p_editais: pedido.editais.map((e) => e.id),
    p_cargos: [...pedido.cargos],
    p_modalidades: [...pedido.modalidades],
    p_situacoes: [...pedido.situacoes],
    p_recorte_do_aviso: pedido.recorteDoAviso,
    p_total_na_tela: pedido.totalDoRecorte,
    p_registros: contarRegistros(pedido.candidatos),
  };
}

/** Quantos candidatos saem no arquivo (o mesmo candidato_id conta uma vez). */
export function contarRegistros(
  candidatos: readonly CandidatoDaExportacao[] | null | undefined,
) {
  return new Set(
    (candidatos || []).map((c) => texto(c.candidato_id)).filter(Boolean),
  ).size;
}

/**
 * O pedido a partir da tela. Os editais vão explícitos ao banco: os escolhidos
 * no filtro, ou todos os da área — sempre só os que têm candidato na lista da
 * tela (edital com lista vazia não muda o total; o de treinamento não vem no
 * pacote e o banco o recusaria). `totalDoRecorte` é a lista nesses editais,
 * cargos e modalidades, sem a situação e sem o recorte do aviso: é o número
 * que o banco recalcula.
 */
export function montarPedidoDaExportacao({
  area,
  rotuloDaArea,
  candidatosDaArea,
  filtrados,
  filtros,
  opcoesDeEdital = [],
  convocacoes,
  dadosDe,
}: {
  area: string;
  rotuloDaArea: string;
  candidatosDaArea: readonly CandidatoDaExportacao[];
  filtrados: readonly CandidatoDaExportacao[];
  filtros: {
    candidatos: readonly string[];
    editalId: readonly string[];
    cargo: readonly string[];
    modalidade: readonly string[];
    status: readonly string[];
  };
  opcoesDeEdital?: readonly { value: string; label: string }[];
  convocacoes?: ReadonlyMap<string, { data?: unknown }>;
  dadosDe?: string;
}): PedidoDaExportacao {
  const rotulos = new Map(
    opcoesDeEdital.map((o) => [String(o.value), o.label]),
  );
  const comCandidatos = new Map<string, string>();
  for (const c of candidatosDaArea) {
    const id = texto(c.edital_id);
    if (id && !comCandidatos.has(id))
      comCandidatos.set(
        id,
        rotulos.get(id) ||
          [texto(c.edital) || "Edital", texto(c.unidade)]
            .filter(Boolean)
            .join(" · "),
      );
  }
  const todosOsEditais = filtros.editalId.length === 0;
  const ids = todosOsEditais
    ? [...comCandidatos.keys()]
    : filtros.editalId.map(String).filter((id) => comCandidatos.has(id));
  const editais = ids
    .map((id) => ({ id, rotulo: comCandidatos.get(id) ?? id }))
    .sort((a, b) => COLACAO.compare(a.rotulo, b.rotulo));
  const totalDoRecorte = filterApprovedCandidates(candidatosDaArea, {
    editalId: editais.map((e) => e.id),
    cargo: [...filtros.cargo],
    modalidade: [...filtros.modalidade],
  }).length;
  return {
    area,
    rotuloDaArea,
    candidatos: filtrados,
    totalDoRecorte: editais.length ? totalDoRecorte : 0,
    editais,
    todosOsEditais,
    cargos: [...filtros.cargo],
    modalidades: [...filtros.modalidade],
    situacoes: [...filtros.status],
    recorteDoAviso: filtros.candidatos.length > 0,
    ...(convocacoes ? { convocacoes } : {}),
    ...(dadosDe ? { dadosDe } : {}),
  };
}

/** O identificador e a data de emissão confirmados pelo banco; sem eles, nada é gerado. */
export function registroDaResposta(data: unknown): RegistroDaExportacao {
  const r =
    data !== null && typeof data === "object"
      ? (data as Record<string, unknown>)
      : {};
  const id = texto(r.exportacao_id);
  const emitidaEm = texto(r.emitida_em);
  if (
    !/^[0-9a-f-]{36}$/i.test(id) ||
    Number.isNaN(new Date(emitidaEm).getTime())
  )
    throw new Error(
      "O banco não confirmou o registro da exportação. Tente de novo.",
    );
  return { id, emitidaEm };
}

/* ── Linhas ─────────────────────────────────────────────────────────── */

export const COLUNAS_DA_EXPORTACAO = Object.freeze([
  "Edital",
  "Unidade",
  "Código da vaga",
  "Cargo",
  "Classificação",
  "Nome",
  "Modalidade",
  "Nota",
  "Situação",
  "Data da convocação",
  "Sub judice",
  "Antes da decisão judicial",
]);

const numeroOuTexto = (valor: unknown): CelulaDaPlanilha => {
  if (valor === null || valor === undefined || texto(valor) === "") return "";
  const n = Number(valor);
  return Number.isFinite(n) ? n : texto(valor);
};

// Um Collator só: `localeCompare` com opções cria um a cada chamada (13 mil linhas → segundos).
const COLACAO = new Intl.Collator("pt-BR", {
  sensitivity: "base",
  numeric: true,
});
const compararTexto = (a: unknown, b: unknown) =>
  COLACAO.compare(texto(a), texto(b));
const compararClassificacao = (a: unknown, b: unknown) => {
  const x = Number(a);
  const y = Number(b);
  const temX = texto(a) !== "" && Number.isFinite(x);
  const temY = texto(b) !== "" && Number.isFinite(y);
  if (temX && temY) return x - y;
  if (temX !== temY) return temX ? -1 : 1;
  return 0;
};

/** O que a decisão judicial mudou: os valores de antes (vazio sem alteração). */
function antesDaDecisao(c: CandidatoDaExportacao) {
  if (!c.alterado_judicialmente) return "";
  return [
    texto(c.classificacao_original) &&
      `Classificação ${texto(c.classificacao_original)}`,
    texto(c.nota_original) && `Nota ${formatarNota(c.nota_original)}`,
    texto(c.modalidade_original) &&
      `Modalidade ${texto(c.modalidade_original)}`,
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * Uma linha por candidato (o mesmo candidato_id não se repete), na ordem
 * edital → cargo → classificação → nome. Classificação e nota são números
 * (a planilha soma e ordena); o CSV e o PDF os escrevem como a tela.
 */
export function linhasDaExportacao(
  candidatos: readonly CandidatoDaExportacao[] | null | undefined,
  convocacoes: ReadonlyMap<string, { data?: unknown }> = new Map(),
): CelulaDaPlanilha[][] {
  const vistos = new Set<string>();
  const unicos: CandidatoDaExportacao[] = [];
  for (const c of candidatos || []) {
    const id = texto(c.candidato_id);
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    unicos.push(c);
  }
  unicos.sort(
    (a, b) =>
      compararTexto(a.edital, b.edital) ||
      compararTexto(a.unidade, b.unidade) ||
      compararTexto(a.cargo, b.cargo) ||
      compararClassificacao(a.classificacao, b.classificacao) ||
      compararTexto(a.nome, b.nome),
  );
  return unicos.map((c) => [
    texto(c.edital),
    texto(c.unidade),
    texto(c.codigo_vaga),
    texto(c.cargo),
    numeroOuTexto(c.classificacao),
    texto(c.nome),
    texto(c.modalidade),
    numeroOuTexto(c.nota),
    statusEfetivo(c) || "Sem status",
    formatarData(convocacoes.get(texto(c.candidato_id))?.data),
    c.sub_judice ? "Sim" : "",
    antesDaDecisao(c),
  ]);
}

/* ── Identificação ──────────────────────────────────────────────────── */

const ROTULO_DA_SITUACAO = new Map(
  OPCOES_DO_FILTRO_DE_STATUS.map((o) => [o.value, o.label]),
);

/** "10/11/2026 14:30" no horário de Brasília. */
export function dataHoraDeBrasilia(valor: unknown) {
  const d = new Date(String(valor ?? ""));
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

const ou = (lista: readonly string[], todos: string) =>
  lista.length ? lista.join("; ") : todos;

/** As linhas de identificação: [rótulo, valor], na ordem do arquivo. */
export function identificacaoDaExportacao(
  pedido: PedidoDaExportacao,
  registro: RegistroDaExportacao,
): [string, string][] {
  const registros = contarRegistros(pedido.candidatos);
  const linhas: [string, string][] = [
    ["Documento", "Lista de aprovados"],
    ["Área", pedido.rotuloDaArea || pedido.area],
    [
      pedido.editais.length === 1 ? "Edital" : "Editais",
      pedido.todosOsEditais
        ? `Todos os editais da área (${pedido.editais.length}): ${pedido.editais.map((e) => e.rotulo).join("; ")}`
        : pedido.editais.map((e) => e.rotulo).join("; "),
    ],
    ["Cargo", ou(pedido.cargos, "Todos")],
    ["Modalidade", ou(pedido.modalidades, "Todas")],
    [
      "Situação",
      ou(
        pedido.situacoes.map((s) => ROTULO_DA_SITUACAO.get(s) ?? s),
        "Todas",
      ),
    ],
  ];
  if (pedido.recorteDoAviso)
    linhas.push(["Recorte", "Só as vagas da pessoa do aviso"]);
  linhas.push(
    [
      "Registros",
      registros === pedido.totalDoRecorte
        ? String(registros)
        : `${registros} de ${pedido.totalDoRecorte} da lista vigente no recorte`,
    ],
    ["Dados da lista de", dataHoraDeBrasilia(pedido.dadosDe) || "-"],
    ["Emitida em", dataHoraDeBrasilia(registro.emitidaEm)],
    ["Registro da exportação", registro.id],
  );
  return linhas;
}

/* ── CSV ────────────────────────────────────────────────────────────── */

// A marca de ordem dos bytes (BOM): o Excel lê o CSV em UTF-8.
const BOM = String.fromCharCode(0xfeff);
const celulaDoCsv = (valor: unknown) => {
  const seguro = sanitizeCsvCell(valor ?? "");
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
};
const numeroDoCsv = (valor: CelulaDaPlanilha) =>
  typeof valor === "number" ? String(valor).replace(".", ",") : valor;

/**
 * O CSV da lista de aprovados: a identificação no topo (rótulo;valor), uma
 * linha em branco, o cabeçalho e uma linha por candidato. `;` (Excel pt-BR),
 * BOM e CRLF; toda célula passa por sanitizeCsvCell.
 */
export function csvDaExportacao(
  pedido: PedidoDaExportacao,
  registro: RegistroDaExportacao,
) {
  const linhas: unknown[][] = [
    ...identificacaoDaExportacao(pedido, registro),
    [],
    [...COLUNAS_DA_EXPORTACAO],
    ...linhasDaExportacao(pedido.candidatos, pedido.convocacoes).map((l) =>
      l.map(numeroDoCsv),
    ),
  ];
  return `${BOM}${linhas.map((l) => l.map(celulaDoCsv).join(";")).join("\r\n")}\r\n`;
}

/* ── XLSX ───────────────────────────────────────────────────────────── */

const LARGURAS = [12, 28, 14, 30, 13, 40, 30, 8, 24, 16, 10, 40];

/** As duas planilhas: Aprovados (com filtro e cabeçalho fixo) e Identificação. */
export function planilhasDaExportacao(
  pedido: PedidoDaExportacao,
  registro: RegistroDaExportacao,
): PlanilhaDaClassificacao[] {
  return [
    {
      nome: "Aprovados",
      linhas: [
        [...COLUNAS_DA_EXPORTACAO],
        ...linhasDaExportacao(pedido.candidatos, pedido.convocacoes),
      ],
      larguras: LARGURAS,
      filtro: true,
    },
    {
      nome: "Identificação",
      linhas: [
        ["Campo", "Valor"],
        ...identificacaoDaExportacao(pedido, registro),
      ],
      larguras: [24, 100],
    },
  ];
}

export type ZiparComCompressao = (
  arquivos: Record<string, Uint8Array>,
  opcoes: { level: 6; mtime: Date },
) => Uint8Array;

/** O .xlsx, zipado com compressão (fflate.zipSync): com milhares de linhas, ~10× menor. */
export function xlsxDaExportacao(
  pedido: PedidoDaExportacao,
  registro: RegistroDaExportacao,
  zipar: ZiparComCompressao,
): Uint8Array {
  const codificador = new TextEncoder();
  const arquivos: Record<string, Uint8Array> = {};
  for (const { nome, conteudo } of arquivosDoXlsx(
    planilhasDaExportacao(pedido, registro),
  ))
    arquivos[nome] =
      typeof conteudo === "string" ? codificador.encode(conteudo) : conteudo;
  const quando = new Date(registro.emitidaEm);
  return zipar(arquivos, {
    level: 6,
    // O ZIP guarda datas a partir de 1980.
    mtime: quando.getFullYear() >= 1980 ? quando : new Date(),
  });
}

/* ── Nome do arquivo ────────────────────────────────────────────────── */

/** "lista-de-aprovados-<área>-<edital, se um só>-AAAA-MM-DD-HHMM.<ext>", na hora de Brasília. */
export function nomeDoArquivoDaExportacao(
  pedido: Pick<PedidoDaExportacao, "area" | "editais" | "todosOsEditais">,
  formato: FormatoDaExportacao,
  emitidaEm: string,
) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(new Date(emitidaEm))
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  const quando = partes.year
    ? `${partes.year}-${partes.month}-${partes.day}-${partes.hour}${partes.minute}`
    : "";
  const trecho = (valor: string) =>
    valor
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/g, "");
  const edital =
    !pedido.todosOsEditais && pedido.editais.length === 1
      ? trecho(pedido.editais[0]?.rotulo ?? "")
      : "";
  return `${["lista-de-aprovados", trecho(pedido.area), edital, quando]
    .filter(Boolean)
    .join("-")}.${formato.toLowerCase()}`;
}
