/*
  Os tipos da aba Pré-classificação: o resultado de obter_pre_classificacao
  (supabase/migrations/20261006110000_pre_classificacao_e_lote.sql, gravado
  pelo job Python), o estado do store (estado-da-pre-classificacao.ts) e as
  formas que a inclusão no lote por decisão usa (decisao-do-lote.tsx).
*/
import type { CopiasPorChave } from "../../lib/avaliacao-documental/leitura-por-versao.ts";
import type { LogoDoDocumento } from "../../lib/classificacao/tipos-dos-documentos.ts";
import type { DadosDoAcompanhamento } from "../../lib/avaliacao-documental/acompanhamento-das-inscricoes.ts";

export type RegistroDaPre = Record<string, unknown>;

/** A situação do inscrito na pré-classificação (gravada pelo job). */
export type SituacaoDoInscrito =
  "NO_LOTE" | "ANALISADO" | "RANQUEADO" | "ELIMINADO";

/** A decisão da coordenação que pôs o candidato no lote (TB_DECISAO_LOTE). */
export interface DecisaoDoLote {
  motivo?: string | null;
  por?: string | null;
  em?: string | null;
  /** O que a regra dizia: o motivo da eliminação ou a situação. */
  motivo_regra?: string | null;
  situacao_regra?: string | null;
}

/** O que o selo e o "Revogar decisão" leem do candidato (pré-classificação ou fila). */
export interface InscritoComDecisao {
  codigo?: string | number | null;
  entrada?: string | null;
  decisao?: DecisaoDoLote | string | null;
  motivo_entrada?: string | null;
}

/** Um candidato fora do lote na gaveta "Incluir por decisão da coordenação". */
export interface CandidatoForaDoLote {
  id: string | number;
  codigo?: string | number | null;
  nome?: string | null;
  vaga?: string | number | null;
  situacao?: string | null;
  /** O motivo da eliminação (da pré-classificação ou da fila). */
  motivo?: unknown;
  nota?: unknown;
}

/** O que o banco precisa de cada candidato para decidir (decisao-no-banco.ts). */
export interface CandidatoParaDecidir {
  codigo?: string | number | null;
  vaga?: string | number | null;
}

/** O que as ações de decisão devolvem para a tela. */
export interface RespostaDaDecisao {
  ok?: boolean;
  erro?: string;
}

/** Um inscrito do resultado gravado. */
export interface InscritoDaPre extends RegistroDaPre, InscritoComDecisao {
  id: string;
  vaga: string;
  codigo: string;
  nome: string;
  situacao: SituacaoDoInscrito;
  motivo: string | null;
  motivo_codigo?: string | null;
  art: number | null;
  nota?: number | null;
  origem_nota?: string | null;
  declarada: number | null;
  declarada_congelada?: number | null;
  congelada_em?: string | null;
  divergente: boolean;
  modalidade: string | null;
  posicao: number | null;
  lote: number | null;
  motivo_entrada: string | null;
}

/** Os campos de uma vaga do resultado gravado (sem inscritos = ainda sem pré-classificação). */
interface CamposDaVaga {
  codigo: string;
  candidatos_empregare?: number | null;
  cargo?: string | null;
  lotacao?: string | null;
  vagas_imediatas?: number | null;
  cadastro_reserva?: boolean | null;
  inscritos?: number | null;
  /* "eliminados" (a contagem) fica no índice: na tela, vagasDaTela troca pela lista. */
  ranqueados?: number | null;
  no_lote?: number | null;
  no_lote_regra?: number | null;
  no_lote_decisao?: number | null;
  tamanho?: number | null;
  descricao?: string | null;
  art_corte?: number | null;
  divergencias?: number | null;
  avisos?: string[];
  modalidades?: unknown;
}

/** Uma vaga do resultado gravado. */
export interface VagaDaPre extends RegistroDaPre, CamposDaVaga {}

/** A vaga na tela: os inscritos no lote, fora do lote e eliminados (vagasDaTela). */
export interface VagaDaTela extends RegistroDaPre, CamposDaVaga {
  lote: InscritoDaPre[];
  fora: InscritoDaPre[];
  eliminados: InscritoDaPre[];
}

/** A última execução do job (e a situação do edital nela). */
export interface ExecucaoDaPre extends RegistroDaPre {
  id: string;
  inicio?: string | null;
  fim?: string | null;
  situacao: string;
  mensagem?: string | null;
  disparo?: string | null;
  edital?: {
    edital?: string;
    situacao?: string | null;
    mensagem?: string | null;
  } | null;
}

/** O cabeçalho de uma lista registrada (PROVISORIA ou LOTE). */
export interface MetaDaLista extends RegistroDaPre {
  id: string;
  tipo?: string;
  gerada_em?: string | null;
  por?: string | null;
  publicada?: boolean;
  publicada_em?: string | null;
}

export interface ListaDaPre {
  meta: MetaDaLista | null;
  lote: number | null;
}

/** A regra de análise ou de classificação como o resultado a traz. */
export interface RegraNaPre extends RegistroDaPre {
  versao: number;
  situacao?: string;
  configuracao: RegistroDaPre;
}

/** O resultado de obter_pre_classificacao (ou da "se mudou", refeito). */
export interface DadosDaPreClassificacao extends RegistroDaPre {
  schema_version?: number;
  versao?: string;
  edital?: (RegistroDaPre & { id?: string; treinamento?: boolean }) | null;
  papel?: string | null;
  pode_coordenar: boolean;
  pode_registrar_lista: boolean;
  pode_publicar_lista: boolean;
  regra: RegraNaPre | null;
  regra_classificacao: RegraNaPre | null;
  em_andamento: boolean;
  ultima_execucao: ExecucaoDaPre | null;
  vagas: VagaDaPre[];
  candidatos: InscritoDaPre[];
  listas: ListaDaPre[];
}

/** obter_situacao_pre_classificacao: só a execução. */
export interface SituacaoDaPre extends RegistroDaPre {
  em_andamento?: boolean;
  ultima_execucao?: ExecucaoDaPre | null;
}

/** O retrato de uma lista registrada (o gerador da Classificação o lê). */
export interface RetratoDaPre extends RegistroDaPre {
  edital?: unknown;
  lote?: number | null;
}

/** Uma lista registrada nesta sessão, pronta para exportar. */
export interface ListaRegistradaDaPre {
  meta: MetaDaLista | undefined;
  retrato: RetratoDaPre | undefined;
}

export interface AvisoDaPre {
  tom: "info" | "warning" | "danger";
  texto: string;
}

/** O estado da aba (useSyncExternalStore). */
export interface SnapshotDaPreClassificacao {
  editalId: string;
  dados: DadosDaPreClassificacao | null;
  inscricoes: DadosDoAcompanhamento | null;
  carregando: boolean;
  erro: string;
  pedidoEm: Date | null;
  aviso: AvisoDaPre | null;
  /** A chave da lista sendo registrada (chaveDaLista), ou "". */
  registrando: string;
  registradas: Record<string, ListaRegistradaDaPre>;
}

export type TipoDaListaDaPre = "PROVISORIA" | "LOTE";

/** O cliente do banco que o store usa (só a RPC). */
export interface ClienteDaPreClassificacao {
  rpc: (
    nome: string,
    argumentos?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
}

export interface OpcoesDaPreClassificacao {
  supabase?: ClienteDaPreClassificacao | null;
  toast?: (mensagem: string, tom?: string) => void;
  agendar?: (fn: () => void, ms: number) => unknown;
  agora?: () => Date;
  baixar?: (bytes: BlobPart, nome: string, tipo: string) => void;
  copiar?: (conteudo: {
    html: string;
    texto: string;
  }) => string | Promise<string>;
  imprimir?: (html: string) => void;
  carregarLogo?: () => LogoDoDocumento | null | Promise<LogoDoDocumento | null>;
  cabecalho?: () => unknown;
  tempoLimiteMs?: number;
  /** A cópia no navegador da leitura por versão; null = só a memória. */
  copias?: CopiasPorChave | null;
}

export type EstadoDaPreClassificacao = ReturnType<
  typeof import("./estado-da-pre-classificacao.ts").criarEstadoDaPreClassificacao
>;
