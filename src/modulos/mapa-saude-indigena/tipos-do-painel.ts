import type {
  MetodosDoMapaIndigena,
  LeafletDoMapa,
} from "./tipos-do-leaflet.ts";
import type { ReactNode, RefObject } from "react";
import type {
  CoordenadasDoMapa,
  MapaNacional,
} from "../../lib/tipos-do-mapa.ts";
import type { ModoDeEdicao } from "../editor-de-coordenadas/modo-de-edicao.tsx";

export interface MapaDoPainel
  extends Omit<MapaNacional, "invalidateSize">, MetodosDoMapaIndigena {
  remove(): void;
}
export interface ControleDoEnquadramento {
  pegar(): void;
  soltar(): void;
}
export interface MapaCriadoDoBrasil extends ControleDoEnquadramento {
  mapa: MapaDoPainel;
  parar(): void;
}
export interface OpcoesDoPainel<T extends object> {
  aoCriar(mapa: MapaDoPainel): T;
  emVoo?: RefObject<boolean | (() => void) | null>;
  visivel?: boolean;
  telaCheia?: boolean;
}
export interface PropsDoTopoDoMapa {
  L: LeafletDoMapa | null;
  mapa: MapaDoPainel | null;
  camadas: RefObject<ControleDoEnquadramento | null>;
  idDoMapa: string;
  titulo: string;
  contagem: ReactNode;
  podeEditar?: boolean;
  modo: ModoDeEdicao;
  idDoPainel: string;
  acoes?: ReactNode;
}
export interface PropsDaListaDoMapa {
  refDaLista?: RefObject<HTMLElement | null>;
  id: string;
  idDoTitulo: string;
  titulo: string;
  total: number;
  carregando: boolean;
  vazio: string;
  antes?: ReactNode;
  children?: ReactNode;
}
export interface DistritoDaVolta {
  k: string;
  lat?: number | string | null;
  lon?: number | string | null;
}
export interface VoltaDoDsei {
  k: string;
  partida: CoordenadasDoMapa | null;
  focar: boolean;
  vez: number;
}
export interface MapaDasTerras extends MapaNacional {
  on?(evento: string, ouvinte: () => void): unknown;
  off?(evento: string, ouvinte: () => void): unknown;
  __agsusFaseDaTerraVisivel?(fase: string): boolean;
  __agsusAlternarFaseDaTerra?(fase: string): unknown;
}
