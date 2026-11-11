import type {
  CelulaDaPlanilha,
  PlanilhaDaClassificacao,
} from "./classificacao/tipos-dos-documentos.ts";
import type {
  FormatoDaExportacao,
  PedidoDaExportacao,
  RegistroDaExportacao,
} from "./exportacao-da-lista-de-aprovados.ts";
import type {
  ContagemDoResumo,
  LinhaPlanaDoResumo,
  ResumoPorCargoEStatus,
} from "./resumo-por-cargo-e-status.ts";
import { sanitizeCsvCell } from "./csv-security.ts";
import { arquivosDoXlsx } from "./classificacao/exportacao.ts";
import {
  argumentosDoRegistro,
  identificacaoDaExportacao,
  nomeDoArquivoDaExportacao,
} from "./exportacao-da-lista-de-aprovados.ts";
import {
  CATEGORIAS_DO_RESUMO,
  linhasPlanasDoResumo,
  MOTIVOS_DE_OUTRAS,
  ROTULO_DA_COLUNA,
  ROTULO_DO_MOTIVO,
} from "./resumo-por-cargo-e-status.ts";

/*
  EXPORTAR O RESUMO POR CARGO E STATUS (XLSX, CSV, PDF)

  O mesmo fluxo da exportação da lista (exportacao-da-lista-de-aprovados.ts):
  primeiro o registro no banco (registrar_exportacao_aprovados, agora com
  p_conteudo = 'RESUMO'), que confere permissão, área, editais e o total da
  lista vigente; depois o arquivo, no navegador. O conteúdo sai de
  `linhasPlanasDoResumo` — a mesma estrutura que a tabela da tela desenha
  (critério F). Nenhum dado pessoal: só contagens, cargo, vaga e modalidade.
  Toda célula de texto do CSV passa por sanitizeCsvCell (fórmulas).
*/

/** Os parâmetros do registro: os da lista e o tipo de conteúdo. */
export function argumentosDoRegistroDoResumo(
  pedido: PedidoDaExportacao,
  formato: FormatoDaExportacao,
) {
  return { ...argumentosDoRegistro(pedido, formato), p_conteudo: "RESUMO" };
}

const COLUNAS_FIXAS = [
  "Nível",
  "Edital",
  "Cargo · regime · jornada",
  "Código da vaga",
  "Unidade",
  "Modalidade",
] as const;

export const COLUNAS_DO_ARQUIVO_DO_RESUMO: readonly string[] = Object.freeze([
  ...COLUNAS_FIXAS,
  ROTULO_DA_COLUNA.aprovados,
  ...CATEGORIAS_DO_RESUMO.map((c) => ROTULO_DA_COLUNA[c]),
  "Dos contratados: migração",
  ...MOTIVOS_DE_OUTRAS.map(
    (m) => `Outras: ${ROTULO_DO_MOTIVO[m].toLowerCase()}`,
  ),
  "Sub judice (já incluídos)",
]);

/** Voluntária e tácita sem registro de subtipo saem em branco, não como zero. */
export function numerosDaContagem(
  c: ContagemDoResumo,
  subtipoRegistrado: boolean,
): CelulaDaPlanilha[] {
  return [
    c.aprovados,
    ...CATEGORIAS_DO_RESUMO.map((categoria) =>
      !subtipoRegistrado &&
      (categoria === "desistenciaVoluntaria" ||
        categoria === "desistenciaTacita")
        ? ""
        : c[categoria],
    ),
    c.migracao,
    ...MOTIVOS_DE_OUTRAS.map((m) => c.motivos[m]),
    c.subJudice,
  ];
}

function celulasDaLinha(
  l: LinhaPlanaDoResumo,
  subtipoRegistrado: boolean,
): CelulaDaPlanilha[] {
  const rotulo =
    l.nivel === "Vaga"
      ? "Vaga"
      : l.nivel === "Subtotal"
        ? "Subtotal do grupo"
        : l.nivel === "Edital"
          ? "Total do edital"
          : "Total geral";
  return [
    rotulo,
    l.edital,
    l.grupo,
    l.codigoVaga,
    l.unidade,
    l.modalidade,
    ...numerosDaContagem(l.contagem, subtipoRegistrado),
  ];
}

/** As linhas do arquivo (sem cabeçalho), na ordem da tela. */
export function linhasDoArquivoDoResumo(
  resumo: ResumoPorCargoEStatus,
): CelulaDaPlanilha[][] {
  return linhasPlanasDoResumo(resumo).map((l) =>
    celulasDaLinha(l, resumo.subtipoRegistrado),
  );
}

/** A identificação: a da lista, com o documento, a base e as regras do resumo. */
export function identificacaoDoResumo(
  pedido: PedidoDaExportacao,
  registro: RegistroDaExportacao,
  resumo: ResumoPorCargoEStatus,
): [string, string][] {
  const linhas = identificacaoDaExportacao(pedido, registro)
    .filter(([rotulo]) => rotulo !== "Registros")
    .map(([rotulo, valor]): [string, string] =>
      rotulo === "Documento"
        ? [rotulo, "Resumo por cargo e status"]
        : [rotulo, valor],
    );
  const antesDosDados = linhas.findIndex(([r]) => r === "Dados da lista de");
  const base: [string, string][] = [
    [
      "Base",
      `${resumo.total.aprovados} vínculos da lista vigente${
        pedido.situacoes.length ? " (restrita pelo filtro de situação)" : ""
      }${resumo.foraDaListaAtiva ? `; ${resumo.foraDaListaAtiva} de listas inativas ficaram fora` : ""}`,
    ],
    [
      "Unidade de contagem",
      "Vínculo (edital, vaga e modalidade); quem concorre a cota e ampla conta nas duas linhas",
    ],
    [
      "Contratados",
      "Contratado e Migração; Contratado em outra lista vai a Outras situações",
    ],
    [
      "Cadastro de reserva",
      "Pela fila de convocação: na fila, fora das vagas imediatas e ainda não chamado",
    ],
    [
      "Desistência",
      resumo.subtipoRegistrado
        ? "Voluntária e tácita só com o subtipo registrado; sem registro, Desistência sem subtipo"
        : "Subtipo não registrado no sistema: todos os desistentes estão em Desistência sem subtipo",
    ],
  ];
  linhas.splice(antesDosDados < 0 ? linhas.length : antesDosDados, 0, ...base);
  return linhas;
}

/* ── CSV ────────────────────────────────────────────────────────────── */

const BOM = String.fromCharCode(0xfeff);
const celulaDoCsv = (valor: unknown) => {
  const seguro = sanitizeCsvCell(valor ?? "");
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
};

export function csvDoResumo(
  pedido: PedidoDaExportacao,
  registro: RegistroDaExportacao,
  resumo: ResumoPorCargoEStatus,
) {
  const linhas: unknown[][] = [
    ...identificacaoDoResumo(pedido, registro, resumo),
    [],
    [...COLUNAS_DO_ARQUIVO_DO_RESUMO],
    ...linhasDoArquivoDoResumo(resumo),
  ];
  return `${BOM}${linhas.map((l) => l.map(celulaDoCsv).join(";")).join("\r\n")}\r\n`;
}

/* ── XLSX ───────────────────────────────────────────────────────────── */

export function planilhasDoResumo(
  pedido: PedidoDaExportacao,
  registro: RegistroDaExportacao,
  resumo: ResumoPorCargoEStatus,
): PlanilhaDaClassificacao[] {
  return [
    {
      nome: "Resumo",
      linhas: [
        [...COLUNAS_DO_ARQUIVO_DO_RESUMO],
        ...linhasDoArquivoDoResumo(resumo),
      ],
      larguras: [
        16, 28, 48, 14, 24, 28, 11, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12,
        12, 12,
      ],
      filtro: true,
    },
    {
      nome: "Identificação",
      linhas: [
        ["Campo", "Valor"],
        ...identificacaoDoResumo(pedido, registro, resumo),
      ],
      larguras: [24, 100],
    },
  ];
}

export type ZiparResumo = (
  arquivos: Record<string, Uint8Array>,
  opcoes: { level: 6; mtime: Date },
) => Uint8Array;

export function xlsxDoResumo(
  pedido: PedidoDaExportacao,
  registro: RegistroDaExportacao,
  resumo: ResumoPorCargoEStatus,
  zipar: ZiparResumo,
): Uint8Array {
  const codificador = new TextEncoder();
  const arquivos: Record<string, Uint8Array> = {};
  for (const { nome, conteudo } of arquivosDoXlsx(
    planilhasDoResumo(pedido, registro, resumo),
  ))
    arquivos[nome] =
      typeof conteudo === "string" ? codificador.encode(conteudo) : conteudo;
  const quando = new Date(registro.emitidaEm);
  return zipar(arquivos, {
    level: 6,
    mtime: quando.getFullYear() >= 1980 ? quando : new Date(),
  });
}

/** "resumo-por-cargo-e-status-<área>-<edital, se um só>-AAAA-MM-DD-HHMM.<ext>". */
export function nomeDoArquivoDoResumo(
  pedido: Pick<PedidoDaExportacao, "area" | "editais" | "todosOsEditais">,
  formato: FormatoDaExportacao,
  emitidaEm: string,
) {
  return nomeDoArquivoDaExportacao(pedido, formato, emitidaEm).replace(
    /^lista-de-aprovados/,
    "resumo-por-cargo-e-status",
  );
}
