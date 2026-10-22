import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import type {
  CoordenadasDoMapa,
  MapaNacional,
} from "../../lib/tipos-do-mapa.ts";
import type {
  AlteracaoDoPonto,
  FilaDoEditor,
  FolgaDoEditor,
  GravidadeDoPonto,
  OpcoesDaFila,
  PendenciaDoEditor,
  PontoDoEditor,
  SugestaoDoEditor,
} from "../../lib/tipos-do-editor-de-coordenadas.ts";

export type AcaoDoEditor = "corrigir" | "conferir";
export type ArgumentosDaRpc = Record<string, unknown>;
export type { CorrecaoDoEditor } from "../../lib/tipos-do-editor-de-coordenadas.ts";
import type { CorrecaoDoEditor } from "../../lib/tipos-do-editor-de-coordenadas.ts";
export interface FonteDoEditor<P extends PontoDoEditor> {
  rpc: {
    salvar: string;
    desfazer: string;
    pendencias: string;
    historico: string;
  };
  fila(
    pontos: readonly P[],
    pendencias: readonly PendenciaDoEditor[],
    opcoes: OpcoesDaFila,
  ): FilaDoEditor<P>;
  chaveDoPonto(ponto: P): string;
  chaveDaPendencia(pendencia: PendenciaDoEditor): string;
  sugestoes(pendencia: PendenciaDoEditor | null, ponto: P): SugestaoDoEditor[];
  gravidade(
    pendencia: PendenciaDoEditor | null,
    ponto: P,
  ): GravidadeDoPonto | null;
  pendenteSemPendencia?(ponto: P): boolean;
  argumentosDoSalvar(dados: {
    ponto: P;
    latitude: number;
    longitude: number;
    motivo: string;
    conferir: boolean;
  }): ArgumentosDaRpc;
  argumentosDoHistorico(ponto: P, limite: number): ArgumentosDaRpc;
  textos: { busca: string; lista: string };
  detalheDoItem(item: P): string;
}
export interface PropsDoEditor<P extends PontoDoEditor> {
  L: unknown;
  mapa: MapaNacional | null;
  pontos: readonly P[];
  fonte: FonteDoEditor<P>;
  perfil?: object | null;
  supabase?: SupabaseClient | null;
  aoAtualizarMapa(data: CorrecaoDoEditor, ponto: P): void;
  aoFechar?(): void;
  areaLivre?(): FolgaDoEditor;
  versaoDaArea?: number;
  botaoDeRecolher?: ReactNode;
}
export interface PosicaoDoPin {
  lat: number;
  lng: number;
}
export type PosicaoDoEditor = CoordenadasDoMapa | PosicaoDoPin;
export interface CamadaDoEditor {
  addTo(mapa: MapaDoEditor): this;
  bindTooltip(texto: HTMLElement, opcoes?: Record<string, unknown>): this;
  on(evento: string, ouvinte: () => void): this;
}
export interface PinDoEditor extends CamadaDoEditor {
  off(evento: string, ouvinte: () => void): this;
  getLatLng(): PosicaoDoPin;
  setLatLng(posicao: CoordenadasDoMapa): this;
  dragging?: { disable(): void; enable(): void };
}
export interface GrupoDoEditor extends CamadaDoEditor {
  addLayer(camada: CamadaDoEditor): this;
}
export interface MapaDoEditor extends MapaNacional {
  getCenter(): PosicaoDoPin;
  removeLayer(camada: CamadaDoEditor): unknown;
  flyToBounds(
    limites: unknown,
    opcoes: FolgaDoEditor & { maxZoom: number },
  ): unknown;
  panInside?(posicao: PosicaoDoPin, folga: FolgaDoEditor): unknown;
}
export interface LeafletDoEditor {
  marker(
    posicao: PosicaoDoEditor,
    opcoes: Record<string, unknown>,
  ): PinDoEditor;
  circleMarker(
    posicao: CoordenadasDoMapa,
    opcoes: Record<string, unknown>,
  ): CamadaDoEditor;
  layerGroup(): GrupoDoEditor;
  polyline(
    posicoes: CoordenadasDoMapa[],
    opcoes: Record<string, unknown>,
  ): CamadaDoEditor;
  latLngBounds(posicoes: PosicaoDoEditor[]): unknown;
}
export type HistoricoDoEditor = AlteracaoDoPonto[];
