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
  /** O que a conferência acha: ABERTO (achado na última execução) ou RESOLVIDO. */
  situacao: "ABERTO" | "RESOLVIDO";
  primeiraVez: Date | null;
  /** A última execução que achou o aviso (a "rechecagem"). */
  ultimaVez: Date | null;
  resolvidoEm: Date | null;
  /** O que a equipe fez (TB_AVISO_CONFERENCIA.TP_TRATAMENTO, 20261118120000). */
  tratamento: Tratamento;
  tratadoEm: Date | null;
  tratadoPor: string;
  /** O último motivo do histórico (tratamento, reabertura ou rechecagem). */
  motivo: string | null;
  responsavelId: string | null;
  responsavel: string;
  /** "aaaa-mm-dd" ou null. */
  prazo: string | null;
  evidencias: number;
  /** Dispensar e atribuir (gestor do módulo ou administrador global). */
  podeGerir: boolean;
  /** Mudar o tratamento e juntar evidência (o gestor ou o responsável). */
  podeTratar: boolean;
}
export type Tratamento =
  | "PENDENTE"
  | "EM_ANALISE"
  | "AGUARDANDO_DOCUMENTO"
  | "CORRIGIDO"
  | "RECHECADO_SEM_PROBLEMA"
  | "DISPENSADO";
export interface ListaDeAvisosNormalizada {
  geradoEm: Date | null;
  ultimaExecucao: {
    inicio: Date | null;
    fim: Date | null;
    situacao: string;
  } | null;
  /** Abertos que contam no selo (todos menos os dispensados). */
  abertos: readonly Aviso[];
  dispensados: readonly Aviso[];
  /** Resolvidos pela conferência nos últimos 30 dias. */
  resolvidos: readonly Aviso[];
}
export interface GrupoDeAvisos {
  chave: string;
  titulo: string;
  avisos: readonly Aviso[];
}
export interface EventoDoHistorico {
  id: string;
  texto: string;
  motivo: string;
  por: string;
  em: Date | null;
}
export interface EvidenciaDoAviso {
  id: string;
  tipo: "SEI" | "LINK" | "NOTA";
  descricao: string;
  url: string | null;
  caso: string | null;
  ativa: boolean;
  por: string;
  em: Date | null;
  retiradaEm: Date | null;
}
export interface HistoricoDoAviso {
  eventos: readonly EventoDoHistorico[];
  evidencias: readonly EvidenciaDoAviso[];
}
export interface NovaEvidencia {
  tipo: string;
  descricao: string;
  url?: string;
  chaveDoCaso?: string | null;
}
export interface PessoaResponsavel {
  id: string;
  nome: string;
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
  | {
      view: "approved";
      filtro: {
        candidatos: string[];
        nome: string;
        /** O aviso virou pendência do edital: abre a aba Pendências no edital. */
        pendencias?: true;
        edital?: string;
      };
    }
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
  /** O aviso com uma ação em andamento (tratar, atribuir, evidência). */
  readonly agindo: string | null;
  readonly erroDaAcao: string;
}
type RespostaDosAvisos = {
  data: unknown;
  error: { message?: string; code?: string } | null;
};
/** Usa apenas as RPCs dos avisos e o cliente compartilhado do app. */
export interface ClienteDosAvisos {
  rpc(
    nome: "listar_avisos_conferencia_se_mudou",
    parametros: {
      p_area: string | null | undefined;
      p_modulo: string | null | undefined;
      p_versao: string | null;
    },
  ): PromiseLike<RespostaDosAvisos>;
  rpc(
    nome: "tratar_aviso_conferencia",
    parametros: { p_id: string; p_tratamento: string; p_motivo: string | null },
  ): PromiseLike<RespostaDosAvisos>;
  rpc(
    nome: "atribuir_aviso_conferencia",
    parametros: {
      p_id: string;
      p_responsavel: string | null;
      p_prazo: string | null;
    },
  ): PromiseLike<RespostaDosAvisos>;
  rpc(
    nome: "listar_responsaveis_aviso_conferencia",
    parametros: { p_id: string },
  ): PromiseLike<RespostaDosAvisos>;
  rpc(
    nome: "incluir_evidencia_aviso_conferencia",
    parametros: {
      p_id: string;
      p_tipo: string;
      p_descricao: string;
      p_url: string | null;
      p_chave_caso: string | null;
    },
  ): PromiseLike<RespostaDosAvisos>;
  rpc(
    nome: "retirar_evidencia_aviso_conferencia",
    parametros: { p_evidencia: string; p_motivo: string },
  ): PromiseLike<RespostaDosAvisos>;
  rpc(
    nome: "listar_historico_aviso_conferencia",
    parametros: { p_id: string },
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
  tratar(id: string, tratamento: Tratamento, motivo: string): Promise<boolean>;
  atribuir(
    id: string,
    responsavel: string | null,
    prazo: string | null,
  ): Promise<boolean>;
  responsaveis(id: string): Promise<PessoaResponsavel[]>;
  incluirEvidencia(id: string, evidencia: NovaEvidencia): Promise<boolean>;
  retirarEvidencia(
    avisoId: string,
    evidenciaId: string,
    motivo: string,
  ): Promise<boolean>;
  historico(id: string): Promise<HistoricoDoAviso>;
  listarCasos(
    consulta?: ConsultaDeCasos,
  ): Promise<{ total: number; casos: Caso[] }>;
  todosOsCasos(consulta?: ConsultaDeCasos): Promise<Caso[]>;
  exportarCasos(consulta?: ExportacaoDeCasos): Promise<boolean>;
}
