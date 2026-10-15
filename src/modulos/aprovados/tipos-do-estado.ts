import type { OpcoesDoEstadoDaCarta } from "../../lib/tipos-da-carta.ts";
import type {
  ConfiguracoesDaConvocacao,
  ModelosDaConvocacao,
} from "../../lib/tipos-da-configuracao-de-convocacao.ts";

export type {
  CandidatoAprovado,
  ListaDeAprovados,
  AnexoDoAprovado,
  ConvocacaoDoAprovado,
} from "../../lib/tipos-do-estado-de-aprovados.ts";
import type {
  CandidatoAprovado,
  ListaDeAprovados,
  AnexoDoAprovado,
  ConvocacaoDoAprovado,
} from "../../lib/tipos-do-estado-de-aprovados.ts";
export type ModalDosAprovados =
  | { tipo: "status" | "anexos" | "candidato"; candidatoId: string }
  | { tipo: "sub-judice"; aba?: "novo" | "aprovado"; candidatoId?: string }
  | { tipo: "carta"; candidatoIds: string[] }
  | { tipo: "modelos-carta" }
  | { tipo: "listas"; editalId: string; rotulo: string };
export interface SnapshotDosAprovados {
  candidatos: readonly CandidatoAprovado[];
  listas: readonly ListaDeAprovados[];
  anexos: ReadonlyMap<string, readonly AnexoDoAprovado[]>;
  convocacoes: ReadonlyMap<string, ConvocacaoDoAprovado>;
  modelos: ModelosDaConvocacao;
  configs: ConfiguracoesDaConvocacao;
  carregado: boolean;
  carregadoEm: string;
  erroAoCarregar: string;
  acao: { tipo: string; rotulo: string } | null;
  perfil: unknown;
  modal: (ModalDosAprovados & { abertura: number }) | null;
  publicacao: {
    editalId: string;
    carregando: boolean;
    dados: Record<string, unknown> | null;
  } | null;
}
export interface RespostaDosAprovados {
  data: unknown;
  error: unknown;
}
export interface ClienteDosAprovados {
  rpc: (
    nome: string,
    argumentos?: Record<string, unknown>,
  ) => PromiseLike<RespostaDosAprovados>;
  storage: {
    from: (bucket: string) => {
      upload: (
        caminho: string,
        arquivo: File,
        opcoes: { contentType: string; upsert: boolean },
      ) => PromiseLike<RespostaDosAprovados>;
      download: (
        caminho: string,
      ) => PromiseLike<{ data: Blob | null; error: unknown }>;
    };
  };
}
export interface OpcoesDoEstadoDosAprovados extends Pick<
  OpcoesDoEstadoDaCarta,
  | "toast"
  | "baixar"
  | "copiar"
  | "imprimir"
  | "carregarLogo"
  | "cabecalho"
  | "hoje"
> {
  supabase?: ClienteDosAprovados | null;
  getProfile?: () => unknown;
  confirmar?: (mensagem: string) => boolean;
  lerPlanilha?: (arquivo: File) => Promise<readonly Record<string, unknown>[]>;
  novaAba?: () => { mostrar: (url: string) => void; fechar: () => void };
  armazenamento?: {
    ler: (chave: string) => Promise<unknown>;
    guardar: (chave: string, valor: unknown) => Promise<unknown>;
    apagarTudo: () => Promise<unknown>;
  };
  areaAtual?: () => unknown;
}
export interface CamposDoStatus {
  status?: unknown;
  processo?: unknown;
  matricula?: unknown;
  dataConvocacao?: unknown;
  anexos?: ArrayLike<File> | Iterable<File>;
}
export interface CamposSubJudice {
  editalId?: unknown;
  cargo?: unknown;
  nome?: unknown;
  nota?: unknown;
  modalidade?: unknown;
  processo?: unknown;
  observacao?: unknown;
}
export interface ResultadoDosCandidatos {
  data?: readonly CandidatoAprovado[] | null;
  error: unknown;
  versao?: string | null;
  guardado?: unknown;
  inalterado?: boolean;
}
export type EstadoDosAprovados = ReturnType<
  typeof import("./estado.ts").criarEstadoDaListaDeAprovados
>;
export interface OpcoesDaTelaDosAprovados extends OpcoesDoEstadoDosAprovados {
  secao?: HTMLElement | null;
}
