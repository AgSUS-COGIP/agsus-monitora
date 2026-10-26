/*
  Contratos dos estados da tela Avaliação documental (estado.ts e
  estado-da-fila.ts), fora do React: o snapshot que os componentes leem com
  `useSyncExternalStore`, as opções dos criadores e as linhas das RPCs.
  Dados externos: uma anotação não valida JSON; o banco manda estas formas
  (supabase/migrations) e a tela só lê.
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CopiasPorChave } from "../../lib/avaliacao-documental/leitura-por-versao.ts";
import type {
  AnalistaDaFila,
  DistribuicaoDaRegra,
  FiltroDaFila,
  InscritoNaFila,
  VagaNaFila,
} from "../../lib/avaliacao-documental/fila.ts";
import type { DadosDaFila } from "../../lib/avaliacao-documental/fila-por-mudancas.ts";
import type {
  PerguntaDaCarga,
  RegraSalva,
} from "../../lib/avaliacao-documental/tipos-da-regra.ts";
import type { EditalDaLista, Visao } from "./abas-e-entrada.ts";
import type {
  ApoioDaRegra,
  DadosDaRegra,
  RegraDeClassificacaoSalva,
} from "./assistente/tipos.ts";

export type Registro = Record<string, unknown>;

/** O cliente Supabase no que os estados usam (o do app ou um falso nos testes). */
export interface ClienteDaAvaliacao {
  // Método (não propriedade): aceita o cliente tipado do app, de RPCs nomeadas.
  rpc(
    nome: string,
    argumentos?: Registro,
  ): PromiseLike<{ data: unknown; error: unknown }>;
  auth?: Partial<
    Pick<SupabaseClient["auth"], "onAuthStateChange" | "getSession">
  >;
}

/** O aviso da tela (toast do app). */
export type Avisar = (mensagem: string, tom?: string) => void;

/** O erro do banco no que a tela lê (PostgrestError e afins). */
export interface ErroDoBanco {
  code?: string;
  message?: string;
}

/* ---------------------------- Estado da avaliação ---------------------------- */

/** Um edital da lista (listar_editais_avaliacao), com o dono da avaliação. */
export type EditalDaAvaliacao = EditalDaLista & { origem?: string | null };

/** Aldeias do DSEI do edital (obter_regra_analise, só para quem coordena). */
export interface AldeiasDoEdital {
  quantidade?: number | null;
  atualizado_em?: string | null;
  fonte?: string | null;
}

/** O edital aberto: obter_regra_analise (ou a versão "se mudou"). */
export type DadosDoEdital = DadosDaRegra & {
  /** Dono da avaliação: MONITORA, PLANILHA ou COMPARACAO (definir_origem_analise). */
  origem: string;
  aldeias?: AldeiasDoEdital | null;
  pode_carregar_aldeias?: boolean;
  vagas_empregare?: unknown;
  fichas_concluidas?: number;
};

/** Gestor do edital (já coordena, sem linha na equipe). */
export interface GestorDoEdital {
  usuario: string;
  nome: string;
  email?: string | null;
}

/** Uma linha da equipe como obter_equipe_edital devolve. */
export interface LinhaDaEquipeSalva {
  id?: string;
  usuario: string;
  nome: string;
  email?: string | null;
  papel: string;
  vaga?: string | null;
  limite?: number | null;
  desde?: string | null;
  /** Nível em Avaliação documental (0 sem acesso, 1 leitor, 2 editor, 3 admin). */
  nivel: number;
  ativo_no_sistema?: boolean;
}

/** Quem pode entrar na equipe (só para quem coordena). */
export interface PessoaDaEquipe {
  usuario: string;
  nome: string;
  email?: string | null;
  nivel: number;
  gestor?: boolean;
}

/** obter_equipe_edital / salvar_equipe_edital. */
export interface EquipeDoEdital {
  papel?: string | null;
  pode_coordenar?: boolean;
  gestores?: GestorDoEdital[] | null;
  equipe?: LinhaDaEquipeSalva[] | null;
  pessoas?: PessoaDaEquipe[] | null;
  vagas?: string[] | null;
}

/** A linha que salvar_equipe_edital recebe (equipe.ts: linhaDaEquipe). */
export interface LinhaDaEquipeParaSalvar {
  usuario: string;
  papel: string;
  vaga: string | null;
  limite: number | null;
}

/** O snapshot do estado da avaliação (estado.ts: obter()). */
export interface EstadoDaAvaliacao {
  area: string;
  visao: Visao;
  editais: EditalDaAvaliacao[];
  carregado: boolean;
  carregandoEditais: boolean;
  erroAoCarregar: string;
  semAcesso: boolean;
  editalId: string;
  dados: DadosDoEdital | null;
  equipe: EquipeDoEdital | null;
  carregandoEdital: boolean;
  erroDoEdital: string;
  salvando: boolean;
  apoio: ApoioDaRegra | null;
  carregandoApoio: boolean;
  erroDoApoio: string;
  /** Perguntas e respostas da última carga (null = ainda não lidas). */
  perguntasDaCarga: PerguntaDaCarga[] | null;
  carregandoPerguntas: boolean;
  erroDasPerguntas: string;
  /** A versão que o assistente acabou de salvar (a aba Regra remonta a cada versão). */
  regraSalvaAgora: { editalId: string; versao: number } | null;
}

export interface OpcoesDaAvaliacao {
  supabase?: ClienteDaAvaliacao | null;
  toast?: Avisar;
  tempoLimiteMs?: number;
  aoGravarVersao?: (editalId: string) => void;
  copias?: CopiasPorChave | null;
}

/** O que as RPCs da regra (copiar, salvar, conferir, renomear) devolvem. */
export interface RespostaDaGravacaoDaRegra {
  regra?: RegraSalva | null;
  [chave: string]: unknown;
}

/** salvar_regra_classificacao (a regra de classificação inteira). */
export type RegraDeClassificacaoGravada = RegraDeClassificacaoSalva & {
  configuracao?: {
    documental?: {
      nota_minima?: number | null;
      nota_minima_por_nivel?: Record<string, number | null> | null;
    } | null;
  } | null;
};

/** Resultado das gravações: { ok } ou { ok: false, erro } (a mensagem para a tela). */
export type FalhaDaGravacao = { ok: false; erro: string };
export type ResultadoDaRegra =
  { ok: true; resposta: RespostaDaGravacaoDaRegra | null } | FalhaDaGravacao;
export type ResultadoDaClassificacao =
  { ok: true; regra: RegraDeClassificacaoGravada | null } | FalhaDaGravacao;
export type ResultadoSimples = { ok: true } | FalhaDaGravacao;
export type ResultadoDasAldeias =
  { ok: true; resposta: { ativas?: number | null } | null } | FalhaDaGravacao;

/* ------------------------------- Estado da fila ------------------------------ */

/** O filtro da fila: o de fila.ts (FILTRO_INICIAL e normalizarFiltro). */
export type { FiltroDaFila };

/** Um filtro salvo com nome (salvar_filtro_fila / excluir_filtro_fila). */
export interface FiltroSalvo {
  id: string;
  nome: string;
  filtro: Partial<FiltroDaFila>;
}

/** A fila do edital como a tela guarda (obter_fila_avaliacao[_desde]). */
export interface DadosDaFilaNaTela extends DadosDaFila {
  edital?: {
    id?: string;
    edital?: string | null;
    area?: string | null;
    rotulo?: string | null;
  } | null;
  papel?: string | null;
  pode_coordenar?: boolean;
  pode_pegar?: boolean;
  /** O id de quem está logado. */
  eu?: string;
  filtros?: FiltroSalvo[] | null;
  fora_do_lote?: unknown;
  vagas?: VagaNaFila[] | null;
  analistas?: AnalistaDaFila[] | null;
  distribuicao?: DistribuicaoDaRegra | null;
  /** Quantos do lote ainda sem ficha. */
  sem_ficha?: number | null;
  candidatos?: InscritoNaFila[] | null;
}

/** As linhas de fora do lote: null = ainda não lidas (ou a versão mudou). */
export interface ForaDoLote {
  linhas: InscritoNaFila[] | null;
  versao: string;
  carregando: boolean;
  erro: string;
}

/** A reserva vigente de uma ficha (FC_FICHA_ANALISE_JSON). */
export interface ReservaDaFicha {
  usuario: string;
  nome?: string | null;
  desde?: string | null;
  expira: string;
}

/** O cabeçalho da ficha (FC_FICHA_ANALISE_JSON). */
export interface FichaDaFila {
  id: string;
  versao?: number;
  edital?: string;
  vaga?: string | null;
  cargo?: string | null;
  lotacao?: string | null;
  candidato?: string | number | null;
  codigo?: string | number | null;
  nome?: string | null;
  posicao?: number | null;
  lote?: number | null;
  art?: number | null;
  nota?: number | null;
  modalidade?: string | null;
  modalidades?: string[] | null;
  situacao?: string;
  motivo_saida?: string | null;
  versao_regra?: number | null;
  responsavel?: string | null;
  responsavel_nome?: string | null;
  atribuida_em?: string | null;
  reserva?: ReservaDaFicha | null;
  [chave: string]: unknown;
}

/** reservar_ficha / pegar_proxima_ficha: a ficha aberta e a reserva. */
export interface FichaAberta {
  ficha?: FichaDaFila | null;
  reservada?: boolean;
  somente_leitura?: boolean;
  motivo?: string | null;
}

/** A ficha aberta lembrada na sessão da aba. */
export interface FichaLembrada {
  edital: string;
  ficha: string;
}

/** O snapshot do estado da fila (estado-da-fila.ts: obter()). */
export interface SnapshotDaFila {
  editalId: string;
  dados: DadosDaFilaNaTela | null;
  fora: ForaDoLote;
  carregando: boolean;
  erro: string;
  filtro: FiltroDaFila;
  aberta: FichaAberta | null;
  abrindo: boolean;
  /** A ação em andamento ("distribuir", "liberar", "revisao", ...; "" nenhuma). */
  acao: string;
}

export type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface OpcoesDaFila {
  supabase?: ClienteDaAvaliacao | null;
  toast?: Avisar;
  armazenamento?: Armazenamento | null;
  sessao?: Armazenamento | null;
  agendar?: (fn: () => void, ms: number) => unknown;
  cancelar?: (id: unknown) => void;
  tempoLimiteMs?: number;
  baixar?: (conteudo: BlobPart, nome: string) => void;
  getProfile?: () => unknown;
}

/** As contagens que as ações da fila devolvem. */
export interface ContagemDaAcao {
  alteradas?: number | null;
  liberadas?: number | null;
  criadas?: number | null;
  reiniciadas?: number | null;
}

/** Resultado das ações da fila: { ok, resultado } ou { ok: false, erro }. */
export type ResultadoDaAcao<T> = { ok: true; resultado: T } | FalhaDaGravacao;
