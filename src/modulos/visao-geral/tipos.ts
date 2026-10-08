import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReactNode } from "react";

/** Contratos existentes de integração com o app, consumidos por esta tela. */
declare global {
  interface Window {
    getMonitoraProfile?: () => Perfil | null;
    refreshData?: () => unknown;
    nucleoController?: {
      estado?: {
        abrirLinhaDoTempo?: (id: string | number | undefined) => void;
      };
    };
  }
}

export type CampoDoFiltro = "unidade" | "edital" | "status" | "fase" | "uf";
export type ColunaDaTabela =
  | "unidade"
  | "edital"
  | "data_inicio"
  | "data_fim"
  | "vagas_total"
  | "contratados"
  | "vagas_ociosas"
  | "status"
  | "fase"
  | "atencao"
  | "observacoes";
export type FiltrosDaVisaoGeral = Record<CampoDoFiltro, readonly string[]>;
export type Ordenacao = {
  campo: ColunaDaTabela | "";
  direcao: "asc" | "desc" | "";
};
export type Pendencia =
  "sem_lista" | "sem_status" | "contratacao_baixa" | "desistencias";
export type Atalho = "" | "criticos" | `pos:${Pendencia}`;
export type Motivo = { codigo: string; rotulo: string; tom: string };
export type LinhaDoMonitoramento = {
  [campo: string]: unknown;
  id?: string | number;
  unidade?: string;
  edital?: string;
  status?: string;
  fase?: string;
  uf?: string;
  processo?: string;
  ciclo?: string;
  etapa?: string;
  responsavel?: string;
  cargos?: string;
  observacoes?: string;
  observacoes_internas?: string;
  link_edital?: string;
  risco?: string;
  CO_AREA?: string;
  data_inicio?: string;
  data_fim?: string;
  vagas_total?: number | string;
  contratados?: number | string;
  inscritos?: number | string;
  vagas_ociosas?: number | string;
  cronograma_percentual?: number | string;
  cronograma_dias_para_proxima?: number | string | null;
  cronograma_automatico?: boolean;
  cronograma_atividade_atual?: string;
  cronograma_proxima_atividade?: string;
  cronograma_proxima_data?: string;
  atencao?: Motivo[];
  pos_resultado?: Pendencia[];
  desistentes?: number;
};
export type LinhaDaVisaoGeral = LinhaDoMonitoramento & {
  fase: string;
  atencao: Motivo[];
  pos_resultado: Pendencia[];
  desistentes: number;
};
export type EtapaDoAcompanhamento = {
  monitoramento_id: string | number;
  data_inicio?: string;
  data_fim?: string;
  atividade?: string;
  ordem?: number;
};
export type ListaDoAcompanhamento = {
  monitoramento_id: string | number;
  aprovados?: number | string;
  com_status?: number | string;
  desistentes?: number | string;
};
export type Acompanhamento = {
  etapasPorEdital: Map<string, EtapaDoAcompanhamento[]>;
  listasPorEdital: Map<string, ListaDoAcompanhamento>;
};
export type Indicadores = {
  processos: number;
  vagas: number;
  contratadas: number;
  emSelecao: number;
  ociosas: number;
  cadastroReserva: number;
  criticos: number;
  inscritos: number;
};
export type ChaveDoIndicador =
  | "kpi_vagas_label"
  | "kpi_contratadas_label"
  | "kpi_em_selecao_label"
  | "kpi_ociosas_label"
  | "kpi_cadastro_reserva_label"
  | "kpi_criticos_label"
  | "kpi_inscritos_label";
export type TextosDaVisaoGeral = {
  filtros: string;
  filtrosSubtitulo: string;
  mostrarFiltros: string;
  ocultarFiltros: string;
  indicadores: string;
  rotulos: Record<ChaveDoIndicador, string>;
  tabela: string;
  busca: string;
  colunas: string;
  colunasTitulo: string;
};
export type Armazenamento = Pick<Storage, "getItem" | "setItem">;
export type DadosDoMonitoramento = {
  obter: () => {
    linhas: readonly unknown[];
    areaAtual: string;
    carregado: boolean;
  };
  assinar: (ouvinte: () => void) => () => void;
};
export type BuscaDoAcompanhamento = (
  area: string,
) => unknown | PromiseLike<unknown>;
export type ClienteDoAcompanhamento = {
  rpc: (
    nome: "listar_acompanhamento_da_visao_geral",
    parametros: { p_area: string },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};
export type ClienteDosMarcos = {
  rpc: (
    nome: "obter_marcos_da_area",
    parametros: { p_area: string },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};
export type MarcoDoAno = { ano: number; concluidas_no_ano: number };
export type EstadoProprio = {
  filtros: FiltrosDaVisaoGeral;
  busca: string;
  dsei: { chave: string; nome: string };
  atalho: Atalho;
  mapa: { lmap: unknown; redeCnes: unknown };
  ordenacao: Ordenacao;
  colunas: readonly ColunaDaTabela[];
  acompanhamento: {
    area: string;
    linhas: readonly unknown[];
    dados: Acompanhamento | null;
  } | null;
  destaque: { id: string; vez: number } | null;
  carregadoEm: number;
};
export type SnapshotDaVisaoGeral = Readonly<
  Omit<EstadoProprio, "filtros" | "colunas"> & {
    filtros: Readonly<FiltrosDaVisaoGeral>;
    colunas: readonly ColunaDaTabela[];
    area: string;
    carregado: boolean;
    hoje: string;
    linhasDaArea: readonly LinhaDaVisaoGeral[];
    etapasPorEdital: Map<string, EtapaDoAcompanhamento[]> | null;
    comListas: boolean;
    opcoes: FiltrosDaVisaoGeral;
    filtradas: readonly LinhaDaVisaoGeral[];
    temRecorte: boolean;
    quantosFiltros: number;
    criticosAtivo: boolean;
    indicadores: Indicadores;
  }
>;
export type EstadoDaVisaoGeral = {
  obter: () => SnapshotDaVisaoGeral;
  assinar: (ouvinte: () => void) => () => void;
  definirAviso: (funcao?: ((mensagem: string) => void) | null) => void;
  definirBuscaDoAcompanhamento: (funcao: BuscaDoAcompanhamento | null) => void;
  definirFiltro: (campo: CampoDoFiltro, valores: readonly string[]) => void;
  alternarFiltroUnico: (
    campo: CampoDoFiltro,
    valor: string,
    rotulo: string,
  ) => void;
  alternarAtalho: (atalho: Atalho) => void;
  alternarCriticos: () => void;
  tirarAtalho: () => void;
  limparTudo: () => void;
  tirarDsei: () => void;
  localizar: (linha: LinhaDoMonitoramento | null) => void;
  destacar: (id: string | number | undefined) => void;
  definirBusca: (busca: string) => void;
  definirDsei: (chave: string, nome?: string) => void;
  definirDadosDoMapa: (dados?: { lmap?: unknown; redeCnes?: unknown }) => void;
  ordenarPor: (campo: ColunaDaTabela) => void;
  alternarColuna: (campo: ColunaDaTabela, visivel: boolean) => void;
  exportarCsv: () => void;
};
export type OpcoesDoEstado = {
  dados?: DadosDoMonitoramento;
  armazenamento?: Armazenamento | null;
  agora?: () => number;
  baixar?: (conteudo: string, nome: string) => void;
};
export type Perfil = {
  nome?: string;
  email?: string;
  user_id?: string;
  id?: string;
  [campo: string]: unknown;
};
export type Configuracoes = {
  assinar: (ouvinte: () => void) => () => void;
  obter: () => { valores?: ReadonlyMap<string, unknown> };
};
export type PropsDoPainel = {
  e: SnapshotDaVisaoGeral;
  estado: EstadoDaVisaoGeral;
};
export type PropsComTextos = PropsDoPainel & { textos: TextosDaVisaoGeral };
export type PropsDasBoasVindas = {
  obterPerfil: () => Perfil | null;
  agora: () => Date;
};
export type PropsDosMarcos = Omit<PropsDasBoasVindas, "agora"> & {
  supabase: ClienteDosMarcos | null;
  comemoracoesLigadas: () => boolean;
  armazenamento?: Armazenamento;
};
export type PropsDoBloco = {
  id: string;
  titulo: string;
  className: string;
  children?: ReactNode;
};
export type CarregadorDeMunicipios = ReturnType<
  typeof import("../mapa-de-projetos/carregador.ts").criarCarregadorDeMunicipios
>;
export type PropsDaTela = {
  estado: EstadoDaVisaoGeral;
  configuracoes: Configuracoes;
  carregadorDeMunicipios: CarregadorDeMunicipios;
  obterPerfil: () => Perfil | null;
  supabase: SupabaseClient | null;
  comemoracoesLigadas: () => boolean;
  agora: () => Date;
};
export type OpcoesDaTela = Partial<PropsDaTela> & {
  secao?: HTMLElement | null;
  toast?: (mensagem: string) => void;
};
