import { sanitizeCsvCell } from "./csv-security.ts";
import { arquivosDoXlsx, MIME_XLSX } from "./classificacao/exportacao.ts";
import type {
  CelulaDaPlanilha,
  PlanilhaDaClassificacao,
} from "./classificacao/tipos-dos-documentos.ts";
import type { FonteDaColuna } from "./fontes-dos-paineis.ts";

/*
  RELATÓRIOS DOS PAINÉIS (bloco Dados do menu): três tabelas de conferência
  da área escolhida, para baixar em CSV e XLSX. O banco guarda cada uma pronta
  (recalculada de hora em hora, pelo Sincronizar e na troca de fonte) e a tela
  lê uma página por vez de `ler_relatorio_do_painel` (migration
  20261116160000_relatorios_dos_paineis_prontos.sql):

  - Resumo dos editais — uma linha por edital;
  - Editais por cargo — uma linha por vaga de cada edital (código, cargo,
    vagas imediatas do título da vaga, inscritos da Seleção e aprovados da
    lista vigente, casados pelo código da vaga);
  - Aprovados — uma linha por aprovado da lista vigente.

  Aqui: as colunas de cada relatório, a leitura da resposta (`linhasDoRelatorio`
  e `lerPaginaDoRelatorio`, tolerantes a campo ausente), o texto de cada célula
  na tela, o CSV (`;`, BOM,
  CRLF, células protegidas contra fórmula), as planilhas do XLSX e o nome do
  arquivo. Sem DOM: a tela é src/modulos/paineis-de-dados/.
*/

/* As RPCs (o nome que o contrato de RPC confere). */
export const RPC_LER_RELATORIO_DO_PAINEL = "ler_relatorio_do_painel";
export const RPC_SINCRONIZAR_RELATORIO_DO_PAINEL =
  "sincronizar_relatorio_do_painel";

export type IdDoRelatorio =
  "resumo-dos-editais" | "editais-por-cargo" | "aprovados";
export type FormatoDoRelatorio = "CSV" | "XLSX";
type TipoDaColuna = "texto" | "inteiro" | "decimal" | "data";

export interface ColunaDoRelatorio {
  /** O campo na resposta da RPC. */
  campo: string;
  rotulo: string;
  tipo: TipoDaColuna;
  /** Largura na planilha, em caracteres. */
  largura: number;
}

export interface DefinicaoDoRelatorio {
  id: IdDoRelatorio;
  rotulo: string;
  /** O nome da aba no XLSX (até 31 caracteres) e o começo do nome do arquivo. */
  planilha: string;
  colunas: readonly ColunaDoRelatorio[];
}

const coluna = (
  campo: string,
  rotulo: string,
  tipo: TipoDaColuna,
  largura: number,
): ColunaDoRelatorio => Object.freeze({ campo, rotulo, tipo, largura });

export const RELATORIOS_DOS_PAINEIS: readonly DefinicaoDoRelatorio[] =
  Object.freeze([
    Object.freeze({
      id: "resumo-dos-editais" as const,
      rotulo: "Resumo dos editais",
      planilha: "Resumo dos editais",
      colunas: Object.freeze([
        coluna("edital", "Número do edital", "texto", 16),
        coluna("unidade", "DSEI / Unidade", "texto", 36),
        coluna("vagas_imediatas", "Total de vagas imediatas", "inteiro", 14),
        coluna("data_divulgacao", "Data da divulgação do edital", "data", 14),
        coluna("data_final", "Data final do processo seletivo", "data", 14),
      ]),
    }),
    Object.freeze({
      id: "editais-por-cargo" as const,
      rotulo: "Editais por cargo",
      planilha: "Editais por cargo",
      colunas: Object.freeze([
        coluna("edital", "Número do edital", "texto", 16),
        coluna("unidade", "DSEI / Unidade", "texto", 36),
        coluna("codigo_vaga", "Código da vaga", "texto", 12),
        coluna("cargo", "Cargo", "texto", 50),
        coluna(
          "vagas_imediatas",
          "Vagas imediatas (título da vaga)",
          "inteiro",
          14,
        ),
        coluna("inscritos", "Total de inscritos", "inteiro", 12),
        coluna("aprovados", "Total de aprovados", "inteiro", 12),
      ]),
    }),
    Object.freeze({
      id: "aprovados" as const,
      rotulo: "Aprovados",
      planilha: "Aprovados",
      colunas: Object.freeze([
        coluna("edital", "Edital", "texto", 16),
        coluna("unidade", "DSEI / Unidade", "texto", 30),
        coluna("cargo", "Cargo da vaga", "texto", 40),
        coluna("nota", "Nota", "decimal", 10),
        coluna("classificacao", "Classificação", "inteiro", 12),
        coluna("nome", "Nome", "texto", 40),
        coluna("status", "Status", "texto", 24),
        coluna("matricula", "Matrícula", "texto", 14),
        coluna(
          "data_contratacao",
          "Data de admissão (registro no sistema)",
          "data",
          16,
        ),
      ]),
    }),
  ]);

export function definicaoDoRelatorio(id: unknown): DefinicaoDoRelatorio {
  return (
    RELATORIOS_DOS_PAINEIS.find((r) => r.id === id) ??
    (RELATORIOS_DOS_PAINEIS[0] as DefinicaoDoRelatorio)
  );
}

/* ── Largura das colunas e origem dos dados ────────────────────────── */

/** A coluna não estreita além disto (px), ao arrastar a borda. */
export const LARGURA_MINIMA_DA_COLUNA = 60;

/** A largura depois de arrastar a borda `deslocamento` px a partir de `inicial`. */
export function larguraArrastada(
  inicial: number,
  deslocamento: number,
): number {
  return Math.max(LARGURA_MINIMA_DA_COLUNA, Math.round(inicial + deslocamento));
}

/** De onde vêm os dados de cada relatório (o ⓘ ao lado das abas). */
export const ORIGEM_DOS_DADOS: Readonly<Record<IdDoRelatorio, string>> =
  Object.freeze({
    "resumo-dos-editais":
      "Uma linha por edital da área, sem os de treinamento. Vagas imediatas: cadastro do edital. Datas: cronograma do edital (início da 1ª etapa e fim da última) ou, sem cronograma, as datas do cadastro.",
    "editais-por-cargo":
      "Uma linha por vaga. Vaga, cargo e inscritos: Seleção (planilha da Auditoria, aba Resultado). Aprovados: lista de aprovados vigente, casada pelo código da vaga. Vagas imediatas: o número no título da vaga. Vagas que só estão na lista e editais sem Seleção também aparecem.",
    aprovados:
      "Uma linha por aprovado da lista de aprovados vigente de cada edital. Status: situação registrada no sistema. Data de admissão: dia em que o aprovado virou Contratado no sistema.",
  });

/**
 * O texto do ⓘ: a origem fixa do relatório e, para cada coluna com fonte
 * diferente do padrão na área (na ordem das colunas), a fonte em uso.
 */
export function linhasDaOrigem(
  definicao: DefinicaoDoRelatorio,
  fontes: Readonly<Record<string, FonteDaColuna>>,
): string[] {
  return [
    ORIGEM_DOS_DADOS[definicao.id],
    ...definicao.colunas.flatMap((c) => {
      const fonte = fontes[c.campo];
      return fonte && !fonte.padrao
        ? [`Fonte trocada nesta área: ${c.rotulo} → ${fonte.rotulo}`]
        : [];
    }),
  ];
}

/** Uma linha do relatório: os campos das colunas, já no tipo de cada uma. */
export type LinhaDoRelatorio = Readonly<Record<string, string | number | null>>;

const texto = (valor: unknown) =>
  typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor);

function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** "2026-03-05" (ou com hora) → "2026-03-05"; o resto, nulo. */
function dataIso(valor: unknown): string | null {
  const m = texto(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function valorDaColuna(coluna: ColunaDoRelatorio, valor: unknown) {
  if (coluna.tipo === "inteiro" || coluna.tipo === "decimal")
    return numero(valor);
  if (coluna.tipo === "data") return dataIso(valor);
  return texto(valor) || null;
}

/**
 * As linhas da resposta da RPC (`{ linhas: [...] }`, ou a lista direto).
 * Linha que não é objeto fica de fora; campo ausente vira nulo.
 */
export function linhasDoRelatorio(
  definicao: DefinicaoDoRelatorio,
  resposta: unknown,
): LinhaDoRelatorio[] {
  const bruto = Array.isArray(resposta)
    ? resposta
    : resposta && typeof resposta === "object"
      ? (resposta as { linhas?: unknown }).linhas
      : null;
  if (!Array.isArray(bruto)) return [];
  return bruto
    .filter(
      (linha): linha is Record<string, unknown> =>
        Boolean(linha) && typeof linha === "object" && !Array.isArray(linha),
    )
    .map((linha) =>
      Object.freeze(
        Object.fromEntries(
          definicao.colunas.map((c) => [
            c.campo,
            valorDaColuna(c, linha[c.campo]),
          ]),
        ),
      ),
    );
}

/** Uma página lida do banco (`ler_relatorio_do_painel`). */
export interface PaginaLida {
  linhas: LinhaDoRelatorio[];
  /** Quantas linhas o relatório tem para quem lê (com o recorte da coordenação). */
  total: number;
  pagina: number;
  /** Nulo: todas as linhas (o download). */
  porPagina: number | null;
  /** Quando o banco calculou o relatório. */
  calculadoEm: string | null;
}

const inteiroPositivo = (valor: unknown) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * A página da resposta: as linhas (como `linhasDoRelatorio`), o total, a
 * página, o tamanho e a data do cálculo. Total ausente ou inválido vale o
 * número de linhas; página inválida, 1; data inválida, nula.
 */
export function lerPaginaDoRelatorio(
  definicao: DefinicaoDoRelatorio,
  resposta: unknown,
): PaginaLida {
  const linhas = linhasDoRelatorio(definicao, resposta);
  const bruto =
    resposta && typeof resposta === "object" && !Array.isArray(resposta)
      ? (resposta as Record<string, unknown>)
      : {};
  const total = Number(bruto.total);
  const calculadoEm = texto(bruto.calculado_em);
  return {
    linhas,
    total: Number.isInteger(total) && total >= 0 ? total : linhas.length,
    pagina: inteiroPositivo(bruto.pagina) ?? 1,
    porPagina: inteiroPositivo(bruto.por_pagina),
    calculadoEm:
      calculadoEm && !Number.isNaN(Date.parse(calculadoEm))
        ? calculadoEm
        : null,
  };
}

/** A chave de uma página no cache da tela. */
export const chaveDaPagina = (
  area: string,
  relatorio: IdDoRelatorio,
  pagina: number,
  porPagina: number,
) => `${area}|${relatorio}|${pagina}|${porPagina}`;

const NUMERO_INTEIRO = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});
const NUMERO_DECIMAL = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 3,
});

/** O texto da célula na tela: número em pt-BR, data dd/mm/aaaa, vazio "—". */
export function textoDaCelula(
  coluna: ColunaDoRelatorio,
  valor: string | number | null | undefined,
): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "number")
    return (coluna.tipo === "decimal" ? NUMERO_DECIMAL : NUMERO_INTEIRO).format(
      valor,
    );
  if (coluna.tipo === "data") {
    const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
  }
  return valor;
}

/* A célula do arquivo: número como número, data dd/mm/aaaa, vazio vazio. */
function celulaDoArquivo(
  coluna: ColunaDoRelatorio,
  valor: string | number | null | undefined,
): CelulaDaPlanilha {
  if (valor === null || valor === undefined || valor === "") return "";
  if (typeof valor === "number") return valor;
  return coluna.tipo === "data" ? textoDaCelula(coluna, valor) : valor;
}

function tabelaDoArquivo(
  definicao: DefinicaoDoRelatorio,
  linhas: readonly LinhaDoRelatorio[],
): CelulaDaPlanilha[][] {
  return [
    definicao.colunas.map((c) => c.rotulo),
    ...linhas.map((linha) =>
      definicao.colunas.map((c) => celulaDoArquivo(c, linha[c.campo])),
    ),
  ];
}

const BOM = String.fromCharCode(0xfeff);

function celulaDoCsv(valor: CelulaDaPlanilha) {
  const bruto =
    typeof valor === "number" ? String(valor).replace(".", ",") : valor;
  const seguro = sanitizeCsvCell(bruto ?? "");
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** O CSV: cabeçalho e uma linha por registro; `;` (Excel pt-BR), BOM e CRLF. */
export function csvDoRelatorio(
  definicao: DefinicaoDoRelatorio,
  linhas: readonly LinhaDoRelatorio[],
): string {
  return `${BOM}${tabelaDoArquivo(definicao, linhas)
    .map((l) => l.map(celulaDoCsv).join(";"))
    .join("\r\n")}\r\n`;
}

/** A planilha do XLSX: uma aba, com filtro e cabeçalho fixo. */
export function planilhaDoRelatorio(
  definicao: DefinicaoDoRelatorio,
  linhas: readonly LinhaDoRelatorio[],
): PlanilhaDaClassificacao {
  return {
    nome: definicao.planilha.slice(0, 31),
    linhas: tabelaDoArquivo(definicao, linhas),
    larguras: definicao.colunas.map((c) => c.largura),
    filtro: true,
  };
}

/* ── Paginação da tabela ───────────────────────────────────────────── */

/** Quantas linhas por página a pessoa pode escolher; a primeira é o padrão. */
export const LINHAS_POR_PAGINA: readonly number[] = Object.freeze([
  50, 25, 100,
]);

export interface PaginaDaTabela {
  /** A página à vista, de 1 a `paginas` (1 quando não há linhas). */
  pagina: number;
  paginas: number;
  /** O recorte da lista: `linhas.slice(inicio, fim)`. */
  inicio: number;
  fim: number;
  total: number;
}

/**
 * A página `pedida` de uma lista com `total` linhas, `porPagina` por vez.
 * Página fora do intervalo (a lista encolheu, a pessoa trocou o tamanho)
 * volta para a última que existe; tamanho inválido vale o padrão.
 */
export function paginaDaTabela(
  total: number,
  pedida: number,
  porPagina: number,
): PaginaDaTabela {
  const tamanho =
    Number.isInteger(porPagina) && porPagina > 0
      ? porPagina
      : (LINHAS_POR_PAGINA[0] as number);
  const linhas = Math.max(0, Math.trunc(Number(total) || 0));
  const paginas = Math.max(1, Math.ceil(linhas / tamanho));
  const pagina = Math.min(
    paginas,
    Math.max(1, Math.trunc(Number(pedida) || 1)),
  );
  const inicio = (pagina - 1) * tamanho;
  return {
    pagina,
    paginas,
    inicio,
    fim: Math.min(linhas, inicio + tamanho),
    total: linhas,
  };
}

export type ZiparRelatorio = (
  arquivos: Record<string, Uint8Array>,
  opcoes: { level: 6; mtime: Date },
) => Uint8Array;

/**
 * A aba "Fontes": de onde veio cada coluna do relatório. Coluna sem fonte
 * escolhida (inclusive as fixas) é "Padrão".
 */
export function planilhaDasFontes(
  definicao: DefinicaoDoRelatorio,
  fontes: Readonly<Record<string, FonteDaColuna>>,
): PlanilhaDaClassificacao {
  return {
    nome: "Fontes",
    linhas: [
      ["Coluna", "Fonte"],
      ...definicao.colunas.map((c) => [
        c.rotulo,
        fontes[c.campo]?.rotulo || "Padrão",
      ]),
    ],
    larguras: [40, 70],
  };
}

/**
 * O .xlsx, zipado por quem chama (fflate.zipSync). Com `fontes` (a resposta
 * do relatório), ganha a aba "Fontes".
 */
export function xlsxDoRelatorio(
  definicao: DefinicaoDoRelatorio,
  linhas: readonly LinhaDoRelatorio[],
  zipar: ZiparRelatorio,
  quando: Date = new Date(),
  fontes?: Readonly<Record<string, FonteDaColuna>>,
): Uint8Array {
  const codificador = new TextEncoder();
  const arquivos: Record<string, Uint8Array> = {};
  for (const { nome, conteudo } of arquivosDoXlsx([
    planilhaDoRelatorio(definicao, linhas),
    ...(fontes ? [planilhaDasFontes(definicao, fontes)] : []),
  ]))
    arquivos[nome] =
      typeof conteudo === "string" ? codificador.encode(conteudo) : conteudo;
  return zipar(arquivos, { level: 6, mtime: quando });
}

export const MIME_DO_RELATORIO: Readonly<Record<FormatoDoRelatorio, string>> =
  Object.freeze({ CSV: "text/csv;charset=utf-8", XLSX: MIME_XLSX });

const trecho = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** "<relatório>-<área>-AAAA-MM-DD-HHMM.<ext>", na hora de Brasília. */
export function nomeDoArquivoDoRelatorio(
  definicao: DefinicaoDoRelatorio,
  area: string,
  formato: FormatoDoRelatorio,
  quando: Date = new Date(),
): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(quando)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  const momento = partes.year
    ? `${partes.year}-${partes.month}-${partes.day}-${partes.hour}${partes.minute}`
    : "";
  return `${[trecho(definicao.planilha), trecho(area), momento]
    .filter(Boolean)
    .join("-")}.${formato.toLowerCase()}`;
}
