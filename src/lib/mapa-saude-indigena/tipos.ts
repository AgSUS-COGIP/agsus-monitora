import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LinhaDoMonitoramento } from "../../componentes/tipos-do-monitoramento.ts";
import type { CoordenadasDoMapa } from "../tipos-do-mapa.ts";
import type { tipoDaUnidade } from "./formas.ts";
import type { VoltaDoDsei } from "../../modulos/mapa-saude-indigena/tipos-do-painel.ts";

export interface PoloDoMapa {
  [campo: string]: unknown;
  n: string;
  lat?: number | string | null;
  lon?: number | string | null;
  uf?: string;
  cod?: string | number | null;
  cnes?: string;
}
export interface DseiDoMapa extends PoloDoMapa {
  k: string;
  polos?: PoloDoMapa[];
  ufs?: string[];
  pop?: number | string | null;
  sedeuf?: string;
  sede_municipio?: string;
  sede_uf?: string;
  sede_endereco?: string;
  sede_cnes?: string;
}
export type EstabelecimentoCompacto = [
  nome: string,
  cnes: string | number | null,
  latitude: number | string | null,
  longitude: number | string | null,
  municipio?: string,
  uf?: string | number,
];
export interface ConfiguracaoDoMapa {
  [campo: string]: unknown;
  dsei: DseiDoMapa[];
}
export interface RedeCnesDoMapa {
  rede: Record<
    string,
    { u: EstabelecimentoCompacto[]; c: EstabelecimentoCompacto[] }
  >;
  nac: EstabelecimentoCompacto[];
}
export interface ContagemDoDsei {
  editais: number;
  vagas: number;
  ociosas: number;
}
export interface BolhaDoDsei extends ContagemDoDsei {
  dsei: DseiDoMapa;
  chave: string;
  lat: number;
  lon: number;
  raio: number;
  comEdital: boolean;
  estilo: {
    radius: number;
    color: string;
    weight: number;
    fillColor: string;
    fillOpacity: number;
  };
}
export interface TerritorioDoMapa extends BolhaDoDsei {
  posicao: number;
  preenchidas: number;
  situacao: string;
  detalhe: string;
}
export interface CasaiNacionalDoMapa {
  chave: string;
  nome: string;
  cnes: string;
  lat: number;
  lon: number;
  cidade: string;
  uf: string;
  editais: number;
  termoDeBusca: string;
}
export interface RegistroDoDsei {
  id: string;
  name: string;
  cnes: string | number | null;
  lat: number;
  lon: number;
  city?: string;
  uf?: string | number;
  type: ReturnType<typeof tipoDaUnidade>;
  origens?: string[];
  nomes?: Record<string, string>;
  vinculo?: string;
  ufAdministrativa?: string;
}
export interface CaixaDaTerra {
  oeste: number;
  sul: number;
  leste: number;
  norte: number;
}
export interface TerraDoMapa {
  nome: string;
  povos?: string[];
  ufs?: string[];
  fase?: string;
  caixa?: CaixaDaTerra | null;
}
export interface LinhaDaTerra {
  nome: string;
  povos: string;
  povoDeclarado: boolean;
  detalhe: string;
  caixa: CaixaDaTerra | null;
}
export interface EnquadramentoDoMapa {
  chave: string;
  modo: string;
  pontos: CoordenadasDoMapa[];
}
export interface PropsDoMapaSaudeIndigena {
  lmap: unknown;
  redeCnes: unknown;
  linhas?: readonly LinhaDoMonitoramento[];
  filtroAtivo?: boolean;
  dseiSelecionado?: string | null;
  carregando?: boolean;
  tema?: string;
  idDoMapaNacional?: string;
  idDoMapaDoDsei?: string;
  aoEscolherDsei?(dsei: DseiDoMapa): void;
  aoSairDoDsei?(): void;
  aoFiltrarPorBusca?(busca: string): void;
  aoEscolherUnidade?(unidade: RegistroDoDsei): void;
  perfil?: object | null;
  supabase?: SupabaseClient | null;
  aoAtualizarMapa?(configuracao: { lmap?: unknown; rede_cnes?: unknown }): void;
}
export interface PropsDaVisaoNacional extends Pick<
  PropsDoMapaSaudeIndigena,
  | "lmap"
  | "redeCnes"
  | "perfil"
  | "supabase"
  | "aoAtualizarMapa"
  | "aoEscolherDsei"
  | "aoFiltrarPorBusca"
> {
  L:
    | import("../../modulos/mapa-saude-indigena/tipos-do-leaflet.ts").LeafletDoMapa
    | null;
  idDoMapa: string;
  visivel: boolean;
  telaCheia: boolean;
  carregando: boolean;
  acoes?: ReactNode;
  bolhas: BolhaDoDsei[];
  casais: CasaiNacionalDoMapa[];
  territorios: TerritorioDoMapa[];
  enquadramento: EnquadramentoDoMapa;
  voltaDoDsei?: VoltaDoDsei | null;
  resumoDaRede(dsei: DseiDoMapa): string[];
}
export interface PropsDoMapaDoDsei extends Pick<
  PropsDoMapaSaudeIndigena,
  "lmap" | "perfil" | "supabase" | "aoAtualizarMapa" | "aoEscolherUnidade"
> {
  L:
    | import("../../modulos/mapa-saude-indigena/tipos-do-leaflet.ts").LeafletDoMapa
    | null;
  redeCnes: unknown;
  dsei: DseiDoMapa;
  idDoMapa: string;
  telaCheia: boolean;
  acoes?: ReactNode;
  aoVoltarAoBrasil(): void;
}
