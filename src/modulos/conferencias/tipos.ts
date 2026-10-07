/** Contratos do módulo; o JSON das RPCs passa pela normalização antes da tela. */
export interface Aviso {
  id: string;
  conferencia: string;
  titulo: string;
  escopo: string;
  gravidade: "CRITICA" | "ATENCAO" | "INFORMATIVO";
  tom: "perigo" | "aviso" | "info";
  rotuloDaGravidade: string;
  modulo: string;
  area: string | null;
  editalId: string | null;
  edital: string | null;
  onde: string;
  quantidade: number;
  exemplos: readonly string[];
  resumo: string;
  situacao: "ABERTO" | "IGNORADO";
  primeiraVez: Date | null;
  ultimaVez: Date | null;
  ignoradoEm: Date | null;
  motivo: string | null;
  podeIgnorar: boolean;
}
export interface ListaDeAvisosNormalizada {
  geradoEm: Date | null;
  ultimaExecucao: {
    inicio: Date | null;
    fim: Date | null;
    situacao: string;
  } | null;
  abertos: readonly Aviso[];
  ignorados: readonly Aviso[];
}
export interface AnaliseDoCaso {
  id: string | null;
  edital: string;
  vaga: string;
  status: string;
  responsavel: string;
  dataAnalise: string | null;
}
export interface VinculoDoCaso {
  id: string | null;
  editalId: string | null;
  edital: string;
  vaga: string;
  status: string;
  dataConvocacao: string | null;
  dataContratacao: string | null;
  situacao: string;
}
export interface Caso {
  chave: string;
  avisoId: string;
  conferencia: string;
  titulo: string;
  ordem: number;
  tipo: string | null;
  resolucao: "ok" | "removido" | "sem_acesso";
  analiseId: string | null;
  aprovadoId: string | null;
  entrevistaId: string | null;
  editalId: string | null;
  codigo: string;
  nome: string;
  edital: string;
  codigoVaga: string;
  vaga: string;
  responsavel: string;
  status: string;
  dataAnalise: string | null;
  dataConvocacao: string | null;
  dataContratacao: string | null;
  nota: number | null;
  compareceu: string | null;
  lista: {
    tipo: string;
    geradaEm: string | null;
    aprovadoEm: string | null;
    pendencias: number;
  } | null;
  referencia: string;
  detalhe: Record<string, unknown>;
  analises: readonly AnaliseDoCaso[];
  vinculos: readonly VinculoDoCaso[];
  foraDoAcesso: number;
  situacao: string;
  motivo: string;
}
export type DestinoDoCaso =
  | { view: "analises"; filtro: { busca: string; analise: string | null } }
  | { view: "approved"; filtro: { candidatos: string[]; nome: string } }
  | {
      view: "entrevistas";
      filtro: { busca: string; entrevista: string | null };
    }
  | { view: "classificacao"; filtro: Record<string, never> };
export interface OpcoesDeAbrirCaso {
  navegar?: boolean;
  pedir?: (
    view: DestinoDoCaso["view"],
    filtro: DestinoDoCaso["filtro"],
  ) => void;
  ir?: (view: DestinoDoCaso["view"]) => void;
}
export type AbrirCaso = (caso: Caso, opcoes?: OpcoesDeAbrirCaso) => void;
export interface FiltroDosAvisos {
  area?: string | null;
  modulo?: string | null;
}
export interface ConsultaDeCasos {
  avisoId?: string | null;
  busca?: string;
  limite?: number;
  deslocamento?: number;
}
export interface ExportacaoDeCasos {
  aviso?: Pick<Aviso, "id" | "conferencia"> | null;
  busca?: string;
}
export interface SnapshotDosAvisos {
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly lista: ListaDeAvisosNormalizada | null;
  readonly erro: string;
  readonly erroCodigo: string;
  readonly ignorando: string | null;
  readonly erroAoIgnorar: string;
}
type RespostaDosAvisos = {
  data: unknown;
  error: { message?: string; code?: string } | null;
};
/** Usa apenas as três RPCs já existentes e o cliente compartilhado do app. */
export interface ClienteDosAvisos {
  rpc(
    nome: "listar_avisos_conferencia",
    parametros: {
      p_area: string | null | undefined;
      p_modulo: string | null | undefined;
    },
  ): PromiseLike<RespostaDosAvisos>;
  rpc(
    nome: "ignorar_aviso_conferencia",
    parametros: { p_id: string; p_motivo: string },
  ): PromiseLike<RespostaDosAvisos>;
  rpc(
    nome: "listar_casos_aviso_conferencia",
    parametros: {
      p_aviso: string | null;
      p_busca: string | null;
      p_area: string | null | undefined;
      p_modulo: string | null | undefined;
      p_limite: number;
      p_deslocamento: number;
    },
  ): PromiseLike<RespostaDosAvisos>;
}
export interface EstadoDosAvisos {
  assinar(ouvinte: () => void): () => void;
  obter(): SnapshotDosAvisos;
  carregar(filtro?: FiltroDosAvisos): Promise<void>;
  ignorar(id: string, motivo: string): Promise<boolean>;
  listarCasos(
    consulta?: ConsultaDeCasos,
  ): Promise<{ total: number; casos: Caso[] }>;
  todosOsCasos(consulta?: ConsultaDeCasos): Promise<Caso[]>;
  exportarCasos(consulta?: ExportacaoDeCasos): Promise<boolean>;
}
