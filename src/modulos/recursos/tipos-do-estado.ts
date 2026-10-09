import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DadosDoRecurso,
  DetalheParaRascunho,
  IdentificadorDoRecurso,
  OrigemDoRecurso,
  EtapaDoCronogramaDoRecurso,
} from "../../lib/tipos-dos-recursos.ts";
export type RegistroDosRecursos = Record<string, unknown>;
export interface CandidatoDoRecurso {
  id: IdentificadorDoRecurso;
  candidato: string;
  codigo?: string | number | null;
  cargo?: string;
  vaga?: string;
  nota?: string | number | null;
  resultado?: string;
  responsavel?: string;
}
export interface EditalDosRecursos {
  id: IdentificadorDoRecurso;
  edital: string;
  unidade: string;
  tem_analises: boolean;
}
export interface DadosDosRecursos extends RegistroDosRecursos {
  recursos: DadosDoRecurso[];
  cronogramas: EtapaDoCronogramaDoRecurso[];
  origens: OrigemDoRecurso[];
  editais: EditalDosRecursos[];
  modelos: RegistroDosRecursos[];
  pode_editar: boolean;
  pode_decidir: boolean;
  pode_administrar_modelos: boolean;
}
export interface DetalheDoRecurso
  extends DetalheParaRascunho, RegistroDosRecursos {
  erro?: string;
}
export interface ErroDosRecursos {
  message?: string;
  code?: string;
  hint?: string;
}
export type RpcDosRecursos =
  | "get_recursos_da_area"
  | "get_recurso_candidato_detalhe"
  | "buscar_candidatos_recurso"
  | "salvar_recurso_candidato"
  | "marcar_etapa_recurso"
  | "excluir_recurso_candidato"
  | "transicionar_recurso_candidato"
  | "obter_ajustes_pontuacao_recurso"
  | "obter_dados_previa_ajuste"
  | "propor_ajuste_pontuacao"
  | "aprovar_ajuste_pontuacao"
  | "cancelar_ajuste_pontuacao"
  | "salvar_resposta_recurso"
  | "transicionar_resposta_recurso"
  | "registrar_anexo_recurso"
  | "arquivar_anexo_recurso"
  | "registrar_download_anexo_recurso"
  | "listar_modelos_resposta_recurso"
  | "salvar_modelo_resposta_recurso"
  | "arquivar_modelo_resposta_recurso";
export interface ClienteDosRecursos {
  rpc: (
    nome: RpcDosRecursos,
    argumentos?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  auth?: Partial<
    Pick<SupabaseClient["auth"], "getSession" | "onAuthStateChange">
  >;
  storage?: SupabaseClient["storage"];
}
export interface SnapshotDosRecursos {
  area: string;
  dados: DadosDosRecursos | null;
  carregado: boolean;
  erroAoCarregar: string;
  semSessao: boolean;
  atualizando: boolean;
  carregadoEm: number;
  acao: { tipo: string; rotulo: string } | null;
  gaveta: IdentificadorDoRecurso | null;
  detalhes: Map<IdentificadorDoRecurso, DetalheDoRecurso>;
  ajustes: Map<IdentificadorDoRecurso, RegistroDosRecursos>;
  previas: Map<IdentificadorDoRecurso, RegistroDosRecursos>;
  formulario: {
    modo: "novo" | "edicao";
    id: IdentificadorDoRecurso | null;
    abertura: number;
  } | null;
  modelosAbertos: boolean;
  modelosAdmin: RegistroDosRecursos | null;
  comemoracoes: boolean;
}
export interface OpcoesDoEstadoDosRecursos {
  supabase?: ClienteDosRecursos | null;
  toast?: (mensagem: string, tom?: string) => void;
  baixar?: (conteudo: string, nome: string) => void;
  baixarArquivo?: (arquivo: Blob, nome: string) => void;
  abrirUrl?: (url: string) => void;
  imprimir?: (texto: string, titulo: string) => void;
  novoId?: () => string;
  agora?: () => number;
}
export type AcaoDoParecer =
  | "enviar_parecer"
  | "deferir"
  | "deferir_parcialmente"
  | "indeferir"
  | "devolver"
  | "reabrir";
export type AcaoDaResposta =
  "enviar_revisao" | "aprovar" | "devolver" | "reabrir" | "marcar_enviada";
export type EstadoDosRecursos = ReturnType<
  typeof import("./estado.ts").criarEstadoDosRecursos
>;
