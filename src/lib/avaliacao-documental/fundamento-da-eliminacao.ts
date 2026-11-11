/*
  FUNDAMENTO NORMATIVO DA ELIMINAÇÃO NA TRIAGEM (issue #593)

  O item oficial do edital que fundamenta cada motivo de eliminação é escolhido e
  conferido só pelo gestor ou coordenador do edital, ou pelo administrador global
  (conferir_fundamento_da_eliminacao; migration 20261110215930). Aqui, sem DOM e sem
  banco:
    - os motivos administrativos (QUESTIONARIO, CANCELADO, REPROVADO_EMPREGARE), que
      não decorrem de nota, e a diferença para quem ficou fora do lote pela nota;
    - a leitura das respostas do banco (`fundamentoDoBanco`, `quadroDosFundamentos`);
    - a conferência do formulário, igual à do banco (item, fonte, justificativa);
    - a linha do comunicado: só com fundamento CONFERIDO. Nada é presumido.
*/

export const RPC_OBTER_FUNDAMENTOS = "obter_fundamentos_da_eliminacao";
export const RPC_CONFERIR_FUNDAMENTO = "conferir_fundamento_da_eliminacao";

/** Eliminações administrativas: não decorrem de nota (o comunicado não mostra notas). */
export const MOTIVOS_ADMINISTRATIVOS: ReadonlySet<string> = new Set([
  "QUESTIONARIO",
  "CANCELADO",
  "REPROVADO_EMPREGARE",
]);

const texto = (v: unknown) => String(v ?? "").trim();

export const ehEliminacaoAdministrativa = (motivoCodigo: unknown): boolean =>
  MOTIVOS_ADMINISTRATIVOS.has(texto(motivoCodigo));

/**
 * Como a Triagem trata o inscrito no comunicado:
 * ELIMINADO_ADMINISTRATIVO (sem notas), ELIMINADO (outro motivo),
 * FORA_DO_LOTE_POR_NOTA (RANQUEADO: não é eliminado, não recebe comunicado) ou
 * NO_LOTE (no lote ou já analisado).
 */
export type CategoriaNaTriagem =
  | "ELIMINADO_ADMINISTRATIVO"
  | "ELIMINADO"
  | "FORA_DO_LOTE_POR_NOTA"
  | "NO_LOTE";

export function categoriaNaTriagem(inscrito: {
  situacao?: unknown;
  motivo_codigo?: unknown;
}): CategoriaNaTriagem {
  const situacao = texto(inscrito.situacao);
  if (situacao === "ELIMINADO")
    return ehEliminacaoAdministrativa(inscrito.motivo_codigo)
      ? "ELIMINADO_ADMINISTRATIVO"
      : "ELIMINADO";
  if (situacao === "RANQUEADO") return "FORA_DO_LOTE_POR_NOTA";
  return "NO_LOTE";
}

export type SituacaoDoFundamento = "CONFERIDO" | "RECONFERIR";

export interface FundamentoDaEliminacao {
  situacao: SituacaoDoFundamento;
  item_edital: string;
  versao_regra: number;
  fonte: string;
  conferido_em: string | null;
}

/** Item como no texto oficial do edital: 8, 8.2, 8.2.6… (até 7 níveis). */
export const FORMATO_DO_ITEM = /^[0-9]{1,3}(\.[0-9]{1,3}){0,6}$/;

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const inteiro = (v: unknown): number | null =>
  typeof v === "number" && Number.isInteger(v) ? v : null;

/** O fundamento como o banco devolve, ou nulo (ausente ou malformado). */
export function fundamentoDoBanco(v: unknown): FundamentoDaEliminacao | null {
  const o = objeto(v);
  if (!o) return null;
  const situacao = texto(o.situacao);
  const item = texto(o.item_edital);
  const versao = inteiro(o.versao_regra);
  if (
    (situacao !== "CONFERIDO" && situacao !== "RECONFERIR") ||
    !FORMATO_DO_ITEM.test(item) ||
    versao === null ||
    versao < 1
  )
    return null;
  return {
    situacao,
    item_edital: item,
    versao_regra: versao,
    fonte: texto(o.fonte),
    conferido_em: texto(o.conferido_em) || null,
  };
}

/** Só o fundamento CONFERIDO vale para o comunicado. */
export function fundamentoDoComunicado(
  v: unknown,
): FundamentoDaEliminacao | null {
  const f = fundamentoDoBanco(v);
  return f?.situacao === "CONFERIDO" ? f : null;
}

/** A linha do comunicado com o fundamento conferido (nulo = sem linha). */
export function linhaDoFundamento(v: unknown): string | null {
  const f = fundamentoDoComunicado(v);
  return f
    ? `Fundamento normativo: item ${f.item_edital} do edital (conferido pela gestão do edital na regra da triagem, versão ${f.versao_regra}).`
    : null;
}

export interface MotivoDoQuadro {
  codigo: string;
  motivo: string;
  /** O item que a regra traz, só como referência (nunca vira fundamento sozinho). */
  itemNaRegra: string | null;
  eliminados: number;
  administrativo: boolean;
  fundamento: FundamentoDaEliminacao | null;
}

export interface ConferenciaDoHistorico {
  id: number;
  motivoCodigo: string;
  itemEdital: string;
  versaoRegra: number;
  fonte: string;
  justificativa: string | null;
  papel: string;
  por: string;
  em: string;
}

export interface QuadroDosFundamentos {
  podeConferir: boolean;
  regra: {
    versao: number;
    situacao: string;
    itemDaNota: string | null;
  } | null;
  motivos: MotivoDoQuadro[];
  foraDaRegra: { codigo: string; motivo: string; eliminados: number }[];
  foraDoLotePorNota: number;
  historico: ConferenciaDoHistorico[];
}

const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const contagem = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;

/** O quadro de obter_fundamentos_da_eliminacao, normalizado. */
export function quadroDosFundamentos(v: unknown): QuadroDosFundamentos {
  const o = objeto(v) ?? {};
  const regra = objeto(o.regra);
  const versao = inteiro(regra?.versao);
  return {
    podeConferir: o.pode_conferir === true,
    regra:
      regra && versao !== null
        ? {
            versao,
            situacao: texto(regra.situacao),
            itemDaNota: texto(regra.item_da_nota) || null,
          }
        : null,
    motivos: lista(o.motivos).flatMap((m) => {
      const x = objeto(m);
      const codigo = texto(x?.codigo);
      if (!x || !codigo) return [];
      return [
        {
          codigo,
          motivo: texto(x.motivo) || codigo,
          itemNaRegra: texto(x.item_na_regra) || null,
          eliminados: contagem(x.eliminados),
          administrativo: ehEliminacaoAdministrativa(codigo),
          fundamento: fundamentoDoBanco(x.fundamento),
        },
      ];
    }),
    foraDaRegra: lista(o.fora_da_regra).flatMap((m) => {
      const x = objeto(m);
      const codigo = texto(x?.codigo);
      return x && codigo
        ? [
            {
              codigo,
              motivo: texto(x.motivo) || codigo,
              eliminados: contagem(x.eliminados),
            },
          ]
        : [];
    }),
    foraDoLotePorNota: contagem(o.fora_do_lote_por_nota),
    historico: lista(o.historico).flatMap((h) => {
      const x = objeto(h);
      const id = inteiro(x?.id);
      if (!x || id === null) return [];
      return [
        {
          id,
          motivoCodigo: texto(x.motivo_codigo),
          itemEdital: texto(x.item_edital),
          versaoRegra: inteiro(x.versao_regra) ?? 0,
          fonte: texto(x.fonte),
          justificativa: texto(x.justificativa) || null,
          papel: texto(x.papel),
          por: texto(x.por),
          em: texto(x.em),
        },
      ];
    }),
  };
}

export const ROTULO_DO_PAPEL: Readonly<Record<string, string>> = Object.freeze({
  EDITAL_GESTOR: "Gestor do edital",
  COORDENADOR: "Coordenador do edital",
  ADMIN_GLOBAL: "Administrador global",
});

export interface EntradaDoFundamento {
  item: string;
  fonte: string;
  justificativa: string;
}

export type MotivoDaJustificativa = "RETIFICACAO" | "ITEM_DA_NOTA";

/**
 * Confere o formulário como o banco confere. A justificativa é exigida para
 * retificar (item ou fonte diferentes da conferência anterior) e para usar o item
 * da nota mínima do lote numa eliminação da Triagem.
 */
export function conferirEntrada(
  entrada: EntradaDoFundamento,
  {
    anterior,
    itemDaNota,
  }: {
    anterior: Pick<FundamentoDaEliminacao, "item_edital" | "fonte"> | null;
    itemDaNota: string | null;
  },
): {
  erros: Partial<Record<keyof EntradaDoFundamento, string>>;
  exigeJustificativa: MotivoDaJustificativa[];
} {
  const item = entrada.item.trim();
  const fonte = entrada.fonte.trim();
  const justificativa = entrada.justificativa.trim();
  const erros: Partial<Record<keyof EntradaDoFundamento, string>> = {};
  const exigeJustificativa: MotivoDaJustificativa[] = [];
  if (!FORMATO_DO_ITEM.test(item))
    erros.item = "Informe o item como no texto oficial (ex.: 6.4 ou 8.2.6).";
  if (fonte.length < 10 || fonte.length > 500)
    erros.fonte =
      "Informe o documento oficial conferido (10 a 500 caracteres).";
  if (anterior && (anterior.item_edital !== item || anterior.fonte !== fonte))
    exigeJustificativa.push("RETIFICACAO");
  if (itemDaNota && item === itemDaNota)
    exigeJustificativa.push("ITEM_DA_NOTA");
  if (
    justificativa &&
    (justificativa.length < 15 || justificativa.length > 500)
  )
    erros.justificativa = "A justificativa tem de 15 a 500 caracteres.";
  else if (exigeJustificativa.length && !justificativa)
    erros.justificativa = exigeJustificativa.includes("ITEM_DA_NOTA")
      ? `O item ${itemDaNota} é o da nota mínima do lote; a eliminação na triagem não decorre da nota. Justifique para usá-lo.`
      : "Já há fundamento conferido: justifique a retificação.";
  return { erros, exigeJustificativa };
}
