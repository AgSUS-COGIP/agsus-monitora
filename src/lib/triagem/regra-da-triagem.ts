/*
  A regra própria da Triagem (antiga Pré-classificação), versionada por edital
  (TB_REGRA_TRIAGEM × TH_REGRA_TRIAGEM, migration
  20261029160000_regras_proprias_da_triagem.sql). Antes, estas regras moravam
  na regra da análise (provisoria, lote, bloco MODALIDADE) e na regra da
  Classificação (nível por cargo e cotas).

  Formato 1 da configuração (o mesmo que o job Python lê em
  python/monitora/avaliacao_documental/regra_da_triagem.py):
    requisitos.eliminacao_automatica   requisitos e motivos de eliminação
    nota.{nota_declarada, base_da_nota, divergencia_tolerancia}
    desempate.{criterios, pergunta_experiencia}
    modalidade.{perguntas, acumulo, percentuais}
    nivel.{niveis_por_cargo, nivel_padrao}
    lote.{base, multiplo, fixo, nota_minima, item_edital, inclui_cr,
          por_modalidade, inclui_empatados, linha_anda, publica_reposicao, por_vaga}

  Aqui ficam o contrato (tipos), as RPCs, o resumo só-leitura e as contas
  pequenas da tela (sem DOM). A validação que vale é a do banco
  (FC_VALIDAR_REGRA_TRIAGEM); a da tela só evita mandar o óbvio.
*/

export const RPC_OBTER_REGRA_DA_TRIAGEM = "obter_regra_triagem";
export const RPC_SALVAR_REGRA_DA_TRIAGEM = "salvar_regra_triagem";
export const RPC_CONFERIR_REGRA_DA_TRIAGEM = "conferir_regra_triagem";

export type BaseDoLote = "MULTIPLO_VAGAS" | "FIXO" | "NOTA_MINIMA";
export type CriterioDeDesempate =
  | "IDOSO"
  | "EXPERIENCIA_DECLARADA"
  | "MAIOR_IDADE"
  | "MAIS_VELHO"
  | "CANDIDATURA";

export interface EliminacaoAutomatica {
  codigo: string;
  coluna?: string;
  coluna_prefixo?: string;
  pergunta?: string;
  quando?: string[];
  exceto?: string[];
  motivo: string;
}

export interface LoteDaTriagem {
  base?: BaseDoLote | string;
  multiplo?: number | null;
  fixo?: number | null;
  nota_minima?: number | null;
  item_edital?: string | null;
  inclui_cr?: boolean;
  por_modalidade?: boolean;
  inclui_empatados?: boolean;
  linha_anda?: boolean;
  publica_reposicao?: boolean;
  por_vaga?: Record<string, number> | null;
  [chave: string]: unknown;
}

export interface ConfiguracaoDaTriagem {
  formato: 1;
  requisitos?: { eliminacao_automatica?: EliminacaoAutomatica[] };
  nota?: {
    nota_declarada?: unknown[];
    base_da_nota?: "DECLARADA" | "ART" | null;
    divergencia_tolerancia?: number | null;
  };
  desempate?: {
    criterios?: CriterioDeDesempate[];
    pergunta_experiencia?: string | string[] | null;
  };
  modalidade?: {
    perguntas?: unknown[];
    acumulo?: string | null;
    percentuais?: Record<string, number>;
  };
  nivel?: {
    niveis_por_cargo?: { termo: string; nivel: string }[];
    nivel_padrao?: string | null;
  };
  lote?: LoteDaTriagem;
}

export interface VersaoDaRegraDaTriagem {
  versao: number;
  nome?: string | null;
  motivo?: string | null;
  criada_em?: string | null;
  origem?: Record<string, unknown> | null;
}

export interface RegraDaTriagem {
  versao: number;
  nome?: string | null;
  situacao: "CONFERIR" | "CONFERIDA" | string;
  configuracao: ConfiguracaoDaTriagem;
  hash?: string;
  atualizada_em?: string | null;
  conferida_em?: string | null;
  versoes: VersaoDaRegraDaTriagem[];
}

export interface RespostaDaRegraDaTriagem {
  edital?: { id: string; edital?: string | null; numero?: string | null };
  papel?: string | null;
  pode_coordenar: boolean;
  regra: RegraDaTriagem | null;
}

/** O mínimo de um cliente Supabase que as chamadas usam. */
export interface ClienteDaRegra {
  rpc(
    nome: string,
    argumentos: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

function mensagem(erro: unknown) {
  if (erro && typeof erro === "object" && "message" in erro)
    return String((erro as { message: unknown }).message || "erro");
  return String(erro || "erro");
}

async function chamar(
  cliente: ClienteDaRegra | null | undefined,
  nome: string,
  argumentos: Record<string, unknown>,
) {
  if (!cliente) throw new Error("Supabase indisponível.");
  const { data, error } = await cliente.rpc(nome, argumentos);
  if (error) throw new Error(mensagem(error));
  return data;
}

export async function obterRegraDaTriagem(
  cliente: ClienteDaRegra | null | undefined,
  edital: string,
): Promise<RespostaDaRegraDaTriagem> {
  const data = (await chamar(cliente, RPC_OBTER_REGRA_DA_TRIAGEM, {
    p_edital: edital,
  })) as Partial<RespostaDaRegraDaTriagem> | null;
  return {
    ...(data || {}),
    pode_coordenar: Boolean(data?.pode_coordenar),
    regra: data?.regra ?? null,
  };
}

export async function salvarRegraDaTriagem(
  cliente: ClienteDaRegra | null | undefined,
  {
    edital,
    configuracao,
    versaoAtual,
    motivo,
    nome = null,
  }: {
    edital: string;
    configuracao: ConfiguracaoDaTriagem;
    versaoAtual: number;
    motivo: string;
    nome?: string | null;
  },
): Promise<RegraDaTriagem | null> {
  const data = (await chamar(cliente, RPC_SALVAR_REGRA_DA_TRIAGEM, {
    p_edital: edital,
    p_configuracao: configuracao,
    p_versao_atual: versaoAtual,
    p_motivo: motivo,
    p_nome: nome,
  })) as { regra?: RegraDaTriagem | null } | null;
  return data?.regra ?? null;
}

export async function conferirRegraDaTriagem(
  cliente: ClienteDaRegra | null | undefined,
  edital: string,
  versao: number,
): Promise<RegraDaTriagem | null> {
  const data = (await chamar(cliente, RPC_CONFERIR_REGRA_DA_TRIAGEM, {
    p_edital: edital,
    p_versao: versao,
  })) as { regra?: RegraDaTriagem | null } | null;
  return data?.regra ?? null;
}

// ── Resumo só-leitura ──────────────────────────────────────────────────────

export const NOME_DO_CRITERIO: Readonly<Record<CriterioDeDesempate, string>> =
  Object.freeze({
    IDOSO: "idoso (60 anos ou mais)",
    EXPERIENCIA_DECLARADA: "experiência declarada",
    MAIOR_IDADE: "maior idade",
    MAIS_VELHO: "mais velho",
    CANDIDATURA: "candidatura mais antiga",
  });

/* Os padrões do cálculo quando a regra não diz (normalizar_regra do Python). */
const DESEMPATE_PADRAO: readonly CriterioDeDesempate[] = [
  "IDOSO",
  "CANDIDATURA",
];
const LOTE_PADRAO = Object.freeze({ base: "MULTIPLO_VAGAS", multiplo: 3 });

const numero = (valor: unknown) =>
  typeof valor === "number" && Number.isFinite(valor)
    ? valor.toLocaleString("pt-BR")
    : "—";

/** "3 × as vagas", "120 inscritos", "nota mínima 15 (item 8.2.6)". */
export function textoDoLote(lote: LoteDaTriagem | undefined) {
  const l = { ...LOTE_PADRAO, ...(lote || {}) };
  const item = l.item_edital ? ` (item ${l.item_edital})` : "";
  const base =
    l.base === "FIXO"
      ? `${numero(l.fixo)} inscritos por vaga`
      : l.base === "NOTA_MINIMA"
        ? `nota mínima ${numero(l.nota_minima)}${item}`
        : `${numero(l.multiplo)} × as vagas`;
  const extras = [
    l.inclui_cr ? "conta o cadastro reserva" : "",
    l.por_modalidade ? "por modalidade" : "",
    l.inclui_empatados === false ? "" : "empatados no corte entram",
    l.linha_anda === false ? "a linha não anda" : "a linha anda",
  ].filter(Boolean);
  return [base, ...extras].join(" · ");
}

export function textoDaBaseDaNota(config: ConfiguracaoDaTriagem) {
  const declarada = (config.nota?.nota_declarada || []).length > 0;
  const base = config.nota?.base_da_nota ?? (declarada ? "DECLARADA" : "ART");
  return base === "DECLARADA"
    ? `nota declarada recalculada (${(config.nota?.nota_declarada || []).length} pergunta(s))`
    : "ART da Empregare";
}

export function textoDoDesempate(config: ConfiguracaoDaTriagem) {
  const criterios = config.desempate?.criterios ?? DESEMPATE_PADRAO;
  return criterios.length
    ? criterios.map((c) => NOME_DO_CRITERIO[c] || c).join(" → ")
    : "sem critério";
}

export interface LinhaDoResumo {
  rotulo: string;
  valor: string;
}

/** O resumo da regra em linhas curtas, para o topo da tela da Triagem. */
export function resumoDaRegraDaTriagem(
  config: ConfiguracaoDaTriagem | null | undefined,
): LinhaDoResumo[] {
  if (!config) return [];
  const eliminacoes = config.requisitos?.eliminacao_automatica || [];
  const tolerancia = config.nota?.divergencia_tolerancia;
  const porVaga = Object.keys(config.lote?.por_vaga || {}).length;
  return [
    {
      rotulo: "Requisitos",
      valor: eliminacoes.length
        ? eliminacoes.map((e) => e.motivo).join("; ")
        : "nenhuma eliminação automática",
    },
    { rotulo: "Nota da lista", valor: textoDaBaseDaNota(config) },
    {
      rotulo: "Tolerância ART × declarada",
      valor: `${numero(tolerancia ?? 0)} ponto(s)`,
    },
    { rotulo: "Desempate", valor: textoDoDesempate(config) },
    {
      rotulo: "Lote",
      valor:
        textoDoLote(config.lote) +
        (porVaga ? ` · tamanho próprio em ${porVaga} vaga(s)` : ""),
    },
  ];
}

// ── Contas da edição ───────────────────────────────────────────────────────

/** Erros que a tela mostra antes de mandar (o banco confere tudo de novo). */
export function errosDaRegraDaTriagem(config: ConfiguracaoDaTriagem): string[] {
  const erros: string[] = [];
  const lote = config.lote || {};
  if (!["MULTIPLO_VAGAS", "FIXO", "NOTA_MINIMA"].includes(String(lote.base)))
    erros.push("Lote: escolha múltiplo das vagas, número fixo ou nota mínima.");
  if (lote.base === "MULTIPLO_VAGAS" && !(Number(lote.multiplo) >= 1))
    erros.push("Lote: múltiplo de 1 a 100.");
  if (lote.base === "FIXO" && !(Number(lote.fixo) >= 1))
    erros.push("Lote: número fixo de 1 a 100.000.");
  if (lote.base === "NOTA_MINIMA" && !(Number(lote.nota_minima) >= 0))
    erros.push("Lote: informe a nota mínima.");
  const codigos = new Set<string>();
  (config.requisitos?.eliminacao_automatica || []).forEach((e, i) => {
    if (!/^[A-Z][A-Z0-9_]{1,29}$/.test(e.codigo || ""))
      erros.push(`Eliminação ${i + 1}: código em maiúsculas.`);
    if (codigos.has(e.codigo))
      erros.push(`Eliminação ${i + 1}: código repetido.`);
    codigos.add(e.codigo);
    if (!String(e.motivo || "").trim())
      erros.push(`Eliminação ${i + 1}: informe o motivo.`);
  });
  if (
    config.nota?.base_da_nota === "DECLARADA" &&
    !(config.nota?.nota_declarada || []).length
  )
    erros.push("Base da nota pela declarada: configure a nota declarada.");
  return erros;
}

/** Lista de textos de um campo "um por linha". */
export function linhasDoTexto(texto: string): string[] {
  return texto
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean);
}
