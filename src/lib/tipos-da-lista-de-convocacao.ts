import type { ModeloDaConvocacao } from "./tipos-da-configuracao-de-convocacao.ts";
export interface CandidatoDaConvocacao {
  candidato_id?: unknown;
  nome?: unknown;
  nota?: unknown;
  classificacao?: unknown;
  modalidade?: unknown;
  status?: unknown;
  codigo_vaga?: unknown;
  cargo?: unknown;
  edital_id?: unknown;
  edital?: unknown;
  unidade?: unknown;
  lista_ativa?: unknown;
}
export interface LinhaDaConvocacao<
  T extends CandidatoDaConvocacao = CandidatoDaConvocacao,
> {
  candidato: T;
  posicao: number | null;
  categoria: string | null;
  categoriaReservada: string | null;
  imediata: boolean;
  reservas: string[];
  reservasEfetivas: string[];
}
export interface ResultadoDaConvocacao<
  T extends CandidatoDaConvocacao = CandidatoDaConvocacao,
> {
  linhas: LinhaDaConvocacao<T>[];
  foraDaFila: LinhaDaConvocacao<T>[];
  totalImediatas: number;
  ciclo: string[];
}
export interface EntradaDaConvocacao<T extends CandidatoDaConvocacao> {
  candidatos?: readonly T[] | null;
  quadro?: Record<string, unknown> | null;
  modelo?: ModeloDaConvocacao | null;
  proporcionalidade?: boolean;
}
export interface ConfiguracaoDaVagaParaChamada {
  proporcionalidade?: boolean;
  quadro?: Record<string, unknown> | null;
  modelo?: ModeloDaConvocacao | null;
}
export interface BaseDoGrupoDaConvocacao<T extends CandidatoDaConvocacao> {
  chave: string;
  editalId: string;
  edital: string;
  unidade: string;
  cargo: string;
  codigoVaga: string;
  listaAtiva: boolean;
  candidatos: T[];
}
export interface GrupoDaConvocacao<
  T extends CandidatoDaConvocacao = CandidatoDaConvocacao,
>
  extends BaseDoGrupoDaConvocacao<T>, ResultadoDaConvocacao<T> {
  quadro: Record<string, number>;
  modelo: ModeloDaConvocacao;
  proporcionalidade: boolean;
}
export interface ItemDaFilaDaConvocacao<T extends CandidatoDaConvocacao> {
  candidato: T;
  declaradas: string[];
  efetivas: string[];
}
export interface OpcoesDoCsvDaConvocacao<
  T extends CandidatoDaConvocacao = CandidatoDaConvocacao,
> {
  convocacoes?: ReadonlyMap<string, { data?: unknown }>;
  rotulo?: (grupo: GrupoDaConvocacao<T>, categoria: string) => string;
}
