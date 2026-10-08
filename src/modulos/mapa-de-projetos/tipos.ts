import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LinhaDoMonitoramento } from "../../componentes/tipos-do-monitoramento.ts";
import type { MapaNacional } from "../../lib/tipos-do-mapa.ts";

export type Coordenadas = [latitude: number, longitude: number];
export interface ProjetoDoMapa {
  nome: string;
  serie: number;
}
export interface EditalDoLugar {
  id: string;
  edital: string;
  projeto: string;
  serie: number;
  vagas: number | null;
  cadastroReserva: boolean;
  origens: readonly unknown[];
  lotacoes: string[];
}
export interface MunicipioDoMapa {
  chave: string;
  lugar: string;
  municipioUf: string;
  uf: string;
  nivel: "uf" | "municipio";
  codigoIbge: number | null;
  coordenada?: { latitude: number; longitude: number; origem: string } | null;
  vagas: number;
  vagasEdital: number | null;
  cadastroReserva: boolean;
  candidatos: number;
  aprovados: number;
  reprovados: number;
  projetos: ProjetoDoMapa[];
  editais: EditalDoLugar[];
}
export interface PontoDoMunicipio extends MunicipioDoMapa {
  rotulo: string;
  tamanho: number;
  coordenadas: Coordenadas | null;
  raio: number;
  serie: number;
  variosProjetos: boolean;
}
export interface ProjetoComLugares extends ProjetoDoMapa {
  lugares: number;
}
export interface EscolhaDoMapa {
  readonly projeto: string;
  readonly agrupar: boolean;
}
export interface ResultadoDosMunicipios {
  readonly municipios: readonly MunicipioDoMapa[];
  readonly indisponivel: boolean;
  readonly erro: string;
}
export interface CarregadorDeMunicipios {
  emCache(area: string): ResultadoDosMunicipios | null;
  carregar(area: string): Promise<ResultadoDosMunicipios>;
  corrigirCoordenada(lugar: string, latitude: number, longitude: number): void;
  obterEscolha(): EscolhaDoMapa;
  guardarEscolha(nova: Partial<EscolhaDoMapa>): void;
}
export interface PropsDoMapaDeProjetos {
  area?: string;
  carregador: CarregadorDeMunicipios;
  carregadoEm?: number;
  linhas?: readonly LinhaDoMonitoramento[];
  filtroAtivo?: boolean;
  tema?: string;
  idDoMapa?: string;
  perfil?: Record<string, unknown> | null;
  supabase?: SupabaseClient | null;
}
export interface PropsDaLista {
  id: string;
  idDoTitulo: string;
  titulo: string;
  carregando: boolean;
  indisponivel?: boolean;
  erro?: string;
  noRecorte?: boolean;
  pontos: readonly PontoDoMunicipio[];
  projetos: readonly ProjetoComLugares[];
  escolha: EscolhaDoMapa;
  aoMudarEscolha(mudanca: Partial<EscolhaDoMapa>): void;
  aoEscolher(ponto: PontoDoMunicipio): void;
}
export interface PontoEditavelDoProjeto {
  alvo: { lugar: string };
  latitude: number | null;
  longitude: number | null;
  nivel: string;
  uf: string;
  localidade: string;
}
export interface CorrecaoDoLugar {
  lugar?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
}
/** Contrato mínimo da integração com as peças Leaflet ainda em JavaScript. */
export type MapaDoProjeto = MapaNacional;
export interface PropsDoEditorDeProjetos {
  municipios?: readonly MunicipioDoMapa[] | null;
  L: unknown;
  mapa: MapaDoProjeto | null;
  perfil?: Record<string, unknown> | null;
  supabase?: SupabaseClient | null;
  aoAtualizarMapa(data: CorrecaoDoLugar, ponto: PontoEditavelDoProjeto): void;
  aoFechar?: () => void;
  areaLivre?: () => unknown;
  versaoDaArea?: number;
  botaoDeRecolher?: ReactNode;
}
