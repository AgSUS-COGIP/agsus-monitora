import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstadoDaAcao } from "../ui/botao-de-acao.tsx";
import type { LogoDoDocumento } from "./classificacao/tipos-dos-documentos.ts";
export type RegistroDaCarta = Record<string, unknown>;
export interface CandidatoDaCarta extends RegistroDaCarta {
  candidato_id?: string | number;
  nome?: string;
  status?: string | null;
  cpf?: unknown;
  cargo?: string;
  codigo_vaga?: string | number;
  lotacao?: string;
  unidade?: string;
  edital?: string;
  edital_id?: string | number;
  classificacao?: unknown;
  modalidade?: string | null;
  lista_ativa?: boolean;
}
export interface EmissaoDaCarta {
  dataLimite?: string;
  local?: string;
  documentos?: string;
  contato?: string;
  data?: string;
}
export interface ConteudoDaCarta {
  titulo: string;
  texto: string;
  local: string;
  documentos: string;
  contato: string;
  prazoDias: string;
}
export interface RascunhoDaCarta extends ConteudoDaCarta {
  nome: string;
  editalId: string;
  motivo: string;
}
export interface ModeloDaCarta {
  id: string;
  area: string;
  editalId: string;
  edital: string;
  unidade: string;
  nome: string;
  ativo: boolean;
  motivoSituacao: string;
  versao: number;
  atualizadoEm: string;
  cartas: number;
  vigente: ConteudoDaCarta & { usuario: string; salvoEm: string };
  versoes: {
    versao: number;
    motivo: string;
    usuario: string;
    salvoEm: string;
  }[];
}
export interface ModeloDoDocumentoDaCarta {
  id?: string;
  nome?: string;
  versao?: number;
  vigente?: Partial<ConteudoDaCarta>;
}
export interface BlocoDaCarta {
  tipo: "paragrafo" | "item";
  texto: string;
}
export interface CartaPreenchida {
  titulo: string;
  blocos: BlocoDaCarta[];
  faltando: string[];
}
export interface CartaMontada extends CartaPreenchida {
  candidatoId: string;
  nome: string;
}
export interface DocumentoDasCartas {
  nome: string;
  modelo: string;
  versao: number;
  localData: string;
  localDataPorExtenso: string;
  cartas: CartaMontada[];
}
export interface OpcoesDasCartas {
  modelo?: ModeloDoDocumentoDaCarta | null;
  candidatos?: readonly CandidatoDaCarta[];
  emissao?: EmissaoDaCarta;
  hoje?: string;
  cidade?: string;
}
export type AgrupamentoDaCarta = "UNICO" | "POR_CANDIDATO";
export type SaidaDaCarta = "SEI" | "DOCX" | "PDF";
export interface PedidoDeEmissao {
  modelo: ModeloDaCarta | null;
  candidatos: readonly CandidatoDaCarta[];
  emissao: EmissaoDaCarta;
  agrupamento?: AgrupamentoDaCarta;
  saida: SaidaDaCarta;
  indice?: number;
}
export interface ResultadoDaEmissao {
  cartaId: string;
  candidatos: readonly CandidatoDaCarta[];
  nova: boolean;
}
export interface HistoricoDaCarta {
  carregando: boolean;
  dataConvocacao: string;
  cartas: RegistroDaCarta[];
  erro: string;
}
export interface SnapshotDaCarta {
  area: string;
  modelos: readonly ModeloDaCarta[];
  podeEditar: boolean;
  carregando: boolean;
  carregado: boolean;
  erro: string;
  historicos: Map<string, HistoricoDaCarta>;
  acao: { tipo: string; rotulo: string } | null;
}
export type RpcDaCarta =
  | "listar_modelos_carta_convocacao"
  | "salvar_modelo_carta_convocacao"
  | "definir_modelo_carta_ativo"
  | "registrar_carta_convocacao"
  | "listar_cartas_do_candidato";
export interface ClienteDaCarta {
  rpc: (
    nome: RpcDaCarta | Parameters<SupabaseClient["rpc"]>[0],
    argumentos?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
}
export interface OpcoesDoEstadoDaCarta {
  supabase?: ClienteDaCarta | null;
  toast?: (mensagem: string, tom?: string) => void;
  perfil?: () => unknown;
  areaAtual?: () => string;
  baixar?: (arquivo: Blob, nome: string) => void;
  imprimir?: (html: string) => void;
  copiar?: (conteudo: {
    html: string;
    texto: string;
  }) => string | Promise<string>;
  carregarLogo?: () => LogoDoDocumento | null | Promise<LogoDoDocumento | null>;
  cabecalho?: () => unknown;
  enderecoDoLogo?: string;
  hoje?: () => string;
  marcarConvocados?: (
    ids: (string | number | undefined)[],
    data: string,
    cartaId: string,
  ) => unknown | Promise<unknown>;
}
export type EstadoDaCarta = ReturnType<
  typeof import("../modulos/aprovados/carta-de-convocacao/estado.ts").criarEstadoDaCarta
>;
export interface EstadoPaiDaCarta extends EstadoDaAcao {
  carta: EstadoDaCarta;
  fecharModal: () => void;
  abrirModelosDaCarta: () => void;
}
