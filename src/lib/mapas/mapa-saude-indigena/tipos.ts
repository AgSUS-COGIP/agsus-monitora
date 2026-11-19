import type { ReactNode } from "react";
import type { LinhaDoMonitoramento } from "../../../componentes/tipos-do-monitoramento.ts";
import type { CoordenadasDoMapa } from "../tipos-do-mapa.ts";
import type { tipoDaUnidade } from "./formas.ts";
import type { VoltaDoDsei } from "../../../modulos/mapa-saude-indigena/tipos-do-painel.ts";

export interface PoloDoMapa {
  [campo: string]: unknown;
  n: string;
  lat?: number | string | null;
  lon?: number | string | null;
  uf?: string;
  cod?: string | number | null;
  cnes?: string;
  /** O tipo do SIGEPSI (TP_UNIDADE); "polo" quando ausente. */
  tipo?: "casai" | "polo" | "unidade";
  municipio?: string;
  origem?: string;
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
/** CASAI nacional do SIGEPSI: [nome, código, lat, lon, município, UF]. */
export type CasaiNacionalCompacta = [
  nome: string,
  codigo: string | number | null,
  latitude: number | string | null,
  longitude: number | string | null,
  municipio?: string,
  uf?: string | number,
];
export interface ConfiguracaoDoMapa {
  [campo: string]: unknown;
  dsei: DseiDoMapa[];
}
export interface ContagemDoDsei {
  editais: number;
  vagas: number;
  /** Vagas imediatas contratadas (contratadasImediatas), sem os cancelados. */
  contratadas: number;
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
  /** O código da localização no SIGEPSI. */
  cod?: string | null;
  /** Meio de acesso, acessibilidade, urbano/rural e floresta (da `/todas`). */
  acesso?: import("./territorio-do-sigepsi.ts").AcessoDaUnidade | null;
  cnes: string | number | null;
  lat: number;
  lon: number;
  city?: string;
  uf?: string | number;
  type: ReturnType<typeof tipoDaUnidade>;
  origens?: string[];
  nomes?: Record<string, string>;
  vinculo?: "normal" | "externo" | "indeterminado";
  ufAdministrativa?: string | null;
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
  /** As CASAIs nacionais do SIGEPSI (localizações 131 e 132). */
  casaisNacionais: unknown;
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
  /** "Abrir na Visão geral" do cartão de processos: as unidades do DSEI. */
  aoAbrirNaVisaoGeral?(unidades: string[]): void;
  /** Território, acesso e CNES do SIGEPSI (`/api/territorio-dos-dseis`). */
  territorio?: {
    estado: "carregando" | "pronto" | "indisponivel";
    resposta: import("./territorio-na-tela.ts").RespostaDoTerritorio | null;
  };
}
export interface PropsDaVisaoNacional extends Pick<
  PropsDoMapaSaudeIndigena,
  "aoEscolherDsei" | "aoFiltrarPorBusca"
> {
  L:
    | import("../../../modulos/mapa-saude-indigena/tipos-do-leaflet.ts").LeafletDoMapa
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
  "aoEscolherUnidade"
> {
  L:
    | import("../../../modulos/mapa-saude-indigena/tipos-do-leaflet.ts").LeafletDoMapa
    | null;
  dsei: DseiDoMapa;
  idDoMapa: string;
  telaCheia: boolean;
  acoes?: ReactNode;
  aoVoltarAoBrasil(): void;
  /** Meio de acesso e CNES de cada unidade, pela chave `nome|lat|lon`. */
  detalhesDasUnidades?: ReadonlyMap<string, string>;
}
