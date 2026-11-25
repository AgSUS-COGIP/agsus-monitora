import type { CandidatoDaTabelaDeAprovados } from "./tipos-da-aba-de-aprovados.ts";
import type { TipoDaCentralDeConvocacoes } from "../../lib/aprovados/central-de-convocacoes.ts";
import type { EditalPedidoDaCentral } from "./central-de-convocacoes.tsx";
import type {
  CandidatoDaConvocacao,
  GrupoDaConvocacao,
  LinhaDaConvocacao,
} from "../../lib/aprovados/tipos-da-lista-de-convocacao.ts";
import type {
  ConfiguracoesDaConvocacao,
  ModelosDaConvocacao,
} from "../../lib/aprovados/carta-de-convocacao/tipos-da-configuracao-de-convocacao.ts";
export interface CandidatoDaTabelaDaConvocacao extends CandidatoDaTabelaDeAprovados {
  candidato_id: string;
  nome: string;
  classificacao?: string | number | null;
  lista_ativa?: boolean | null;
}
export type GrupoDaTabelaDaConvocacao =
  GrupoDaConvocacao<CandidatoDaTabelaDaConvocacao>;
export type LinhaDaTabelaDaConvocacao =
  LinhaDaConvocacao<CandidatoDaTabelaDaConvocacao>;
export interface LinhaPlanaDaConvocacao {
  grupo: GrupoDaTabelaDaConvocacao;
  linha: LinhaDaTabelaDaConvocacao;
}
export interface BlocoDaTabelaDaConvocacao {
  grupo: GrupoDaTabelaDaConvocacao;
  linhas: LinhaDaTabelaDaConvocacao[];
}
export interface FiltrosDaConvocacao {
  editalId: string[];
  cargo: string[];
  status: string[];
}
export interface SelecaoDaConvocacao {
  tem: (id: string) => boolean;
  alternar: (id: string) => void;
}
export interface EstadoDaAbaDaConvocacao {
  abrirCandidato: (id: string) => void;
  abrirStatus: (id: string) => void;
  abrirCarta: (ids: readonly string[]) => void;
  abrirModelosDaCarta: () => void;
  baixarArquivo: (arquivo: Blob, nome: string) => void;
}
export type ConvocacoesDaTabela = ReadonlyMap<
  string,
  { data?: string; cartas?: number; ultimaCarta?: string }
>;
export interface PropsDaAbaDaConvocacao {
  ativa: boolean;
  estado: EstadoDaAbaDaConvocacao;
  perfil: unknown;
  candidatos: readonly CandidatoDaTabelaDaConvocacao[];
  listas: readonly {
    edital_id?: unknown;
    edital?: unknown;
    unidade?: unknown;
  }[];
  configs: ConfiguracoesDaConvocacao;
  modelos: ModelosDaConvocacao;
  convocacoes?: ConvocacoesDaTabela;
  carregado: boolean;
  erroAoCarregar: string | boolean;
  /** O tipo da Central de convocações (na URL: `?tipo=entrevista`). */
  tipo: TipoDaCentralDeConvocacoes;
  aoMudarTipo: (tipo: TipoDaCentralDeConvocacoes) => void;
  /** O edital do atalho "Ver em Convocações", para "Para entrevistas". */
  editalPedido?: EditalPedidoDaCentral | null;
}
