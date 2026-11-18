export type NivelDeGravidade = "erro" | "revisar" | "sem" | "confirmar";
export type FiltroDeGravidade = NivelDeGravidade | "";
export interface PontoDoEditor {
  id: string;
  nome: string;
  latitude: number | null;
  longitude: number | null;
  localidade?: string;
}
export interface CandidatoDaPendencia {
  f: string;
  n?: string;
  ti?: string;
  lat: number | string;
  lon: number | string;
}
export interface PendenciaDoEditor {
  fonte?: unknown;
  tipo?: unknown;
  dsei?: unknown;
  codigo?: unknown;
  [campo: string]: unknown;
  conferido?: boolean;
  motivo?: string;
  candidatos?: CandidatoDaPendencia[];
}
export interface SugestaoDoEditor {
  id: string;
  fonte: string;
  nome: string;
  terra: string;
  latitude: number;
  longitude: number;
  rotulo: string;
  distanciaKm: number | null;
}
export interface GravidadeDoPonto {
  nivel: NivelDeGravidade;
  resumo: string;
  melhor: SugestaoDoEditor | null;
}
export type ItemDaFila<P> = P & {
  pendencia: PendenciaDoEditor | null;
  pendente: boolean;
  gravidade: GravidadeDoPonto | null;
};
export interface FilaDoEditor<P> {
  itens: ItemDaFila<P>[];
  pendentes: number;
  porGravidade: Partial<Record<NivelDeGravidade, number>>;
}
export interface OpcoesDaFila {
  busca?: string;
  soPendentes?: boolean;
  gravidade?: FiltroDeGravidade;
}
export interface RegrasDaFila<P> {
  chaveDoPonto(ponto: P): string;
  chaveDaPendencia(pendencia: PendenciaDoEditor): string;
  pendenteSemPendencia?(ponto: P): boolean;
  gravidade(
    pendencia: PendenciaDoEditor | null,
    ponto: P,
  ): GravidadeDoPonto | null;
  textoDeBusca(item: ItemDaFila<P>): string;
  comparar(a: ItemDaFila<P>, b: ItemDaFila<P>): number;
}
export interface AlteracaoDoPonto {
  id: number | string;
  acao: string;
  desfeito?: boolean;
  latitude_anterior?: number | null;
  longitude_anterior?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  por?: string;
  em?: string;
  motivo?: string;
}
export interface RetanguloDoEditor {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export interface FolgaDoEditor {
  padding?: [number, number];
  paddingTopLeft?: [number, number];
  paddingBottomRight?: [number, number];
}
export interface CorrecaoDoEditor {
  [campo: string]: unknown;
  lugar?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  conferido?: boolean | null;
}
