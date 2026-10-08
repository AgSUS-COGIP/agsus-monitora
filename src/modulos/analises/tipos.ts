/** Contratos da lista, dos filtros e das consultas de Análises curriculares. */
export type RegistroDaAnalise = Record<string, unknown>;
export type LinhaDaAnalise = RegistroDaAnalise & {
  __chave: string;
  __busca: string;
  __buscaDaFila: string;
};
export type EscopoDasAnalises = "ativo" | "inativo" | "todos";
export type CampoDoFiltro =
  | "unidade"
  | "municipio"
  | "edital"
  | "vaga"
  | "status"
  | "responsavel"
  | "categoria"
  | "modalidade"
  | "validacao";
export type FiltrosDasAnalises = Record<CampoDoFiltro, readonly string[]> & {
  busca: string;
};
export interface FiltroDaAnalise {
  campo: CampoDoFiltro;
  rotulo: string;
  todos: string;
  avancado?: boolean;
  valores(linha: RegistroDaAnalise): string[];
  rotuloDoValor?(valor: string): string;
}
export interface PeriodoDasAnalises {
  inicio: string;
  fim: string;
}
export interface RecorteDasAnalises {
  escopo?: EscopoDasAnalises;
  filtros?: Partial<FiltrosDasAnalises>;
  kpi?: string;
  responsavel?: string;
  periodo?: PeriodoDasAnalises;
}
export interface PendenciaDaAnalise {
  chave: string;
  titulo: string;
  detalhe: string;
  tom: "perigo" | "alerta";
  atalho: { tipo: "kpi" | "validacao" | "responsavel"; valor: string };
}
export interface CargaDoResponsavel {
  rotulo: string;
  Pendente: number;
  Revisar: number;
  Aprovado: number;
  Reprovado: number;
  total: number;
}
export interface DiaDasAnalises {
  rotulo: string;
  valor: number;
  fora: number;
  futuras: number;
  data: Date | null;
  chave: string;
}
export interface EnvelopeDasAnalises extends Record<string, unknown> {
  editais?: RegistroDaAnalise[];
}
export interface PayloadDasAnalises extends EnvelopeDasAnalises {
  columns: string[];
  rows: unknown[][];
}

export interface LeituraDasAnalises {
  payload: EnvelopeDasAnalises;
  linhas: RegistroDaAnalise[];
}
export interface ResultadoDasAnalises extends LeituraDasAnalises {
  daCopia: boolean;
  revalidacao: Promise<unknown>;
}
export interface OpcoesDeCarga {
  area: string;
  escopo: string;
  usuarioId: string;
  forcarRede?: boolean;
  aoMudar?(leitura: LeituraDasAnalises): void;
  aoPerderAcesso?(erro: unknown): void;
}
export interface ClienteDasAnalises {
  rpc(
    nome:
      | "usuario_pode_ler_analises"
      | "get_analises_dashboard_payload_v2"
      | "get_analise_detalhe_do_painel"
      | "get_analises_texto_do_painel"
      | "obter_ultima_conferencia",
    argumentos?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
  auth?: {
    getSession?(): Promise<{
      data: { session: { user?: { id?: string } } | null };
    }>;
    onAuthStateChange?(
      callback: (
        evento: string,
        sessao: { user?: { id?: string } } | null,
      ) => void,
    ): unknown;
  };
}
export interface ConsultasDasAnalises {
  podeLer(): Promise<boolean | null>;
  ultimaConferencia?(area: string): Promise<string | null>;
  carregarEscopo(opcoes: OpcoesDeCarga): Promise<ResultadoDasAnalises>;
  detalhe(id: unknown): Promise<RegistroDaAnalise | null>;
  textos(area: string, escopo: string): Promise<Map<string, RegistroDaAnalise>>;
  esquecer(): void;
  apagarCopias(): Promise<unknown>;
}
export type DetalheDaAnalise = {
  situacao: "carregando" | "pronto" | "erro";
  dados: RegistroDaAnalise | null;
};
export interface SnapshotDasAnalises {
  readonly area: string;
  readonly escopo: EscopoDasAnalises;
  readonly linhas: readonly LinhaDaAnalise[];
  readonly payload: EnvelopeDasAnalises | null;
  readonly carregado: boolean;
  readonly atualizando: boolean;
  readonly erroAoCarregar: string;
  readonly semSessao: boolean;
  readonly semAcesso: boolean;
  readonly daCopia: boolean;
  readonly carregadoEm: number;
  readonly conferidoEm: string | null;
  readonly gaveta: string | null;
  readonly detalhes: ReadonlyMap<string, DetalheDaAnalise>;
  readonly textos: "" | "carregando" | "prontos" | "erro";
}
export interface MarcoDasAnalises {
  ligadas: boolean;
  usuarioId: string;
  area: string;
  nomeDaArea: string;
  escopo: EscopoDasAnalises;
  linhas: readonly RegistroDaAnalise[];
}
export interface DependenciasDasAnalises {
  supabase?: ClienteDasAnalises | null;
  toast?(mensagem: string, tom?: string): void;
  baixar?(conteudo: string, nome: string): void;
  consultas?: ConsultasDasAnalises | null;
  comemoracoesLigadas?(): boolean;
  avaliarMarcos?(marco: MarcoDasAnalises): unknown;
  agora?(): number;
}
export interface EstadoDasAnalises {
  obter(): SnapshotDasAnalises;
  assinar(ouvinte: () => void): () => void;
  carregar(
    area?: string,
    opcoes?: { escopo?: string; forcarRede?: boolean },
  ): Promise<boolean>;
  abrir(area: string): Promise<boolean>;
  atualizar(): Promise<boolean>;
  trocarEscopo(escopo: string): Promise<boolean>;
  garantirTextos(): Promise<boolean>;
  exportarCsv(
    selecionar: (
      linhas: readonly LinhaDaAnalise[],
    ) => readonly LinhaDaAnalise[],
  ): Promise<boolean>;
  abrirDetalhe(chave: string): Promise<void>;
  fecharDetalhe(): void;
}
export interface ChipDasAnalises {
  chave: string;
  rotulo: string;
  valor: string;
  aoTirar(): void;
}
export type MudarFiltroDasAnalises = (
  campo: CampoDoFiltro,
  valores: readonly string[],
) => void;
