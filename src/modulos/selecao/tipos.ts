/** Contratos da Seleção. Dados externos chegam como unknown. */
export type VagaDaSelecao = {
  id: string;
  edital_id: unknown;
  edital: string;
  edital_planilha: string;
  unidade: string;
  vaga: string | null;
  vagaPlanilha: string;
  cargo: string;
  observacao: string | null;
  origemConvocados: "entrevistas" | "planilha";
  busca: string;
  inscritos: number | null;
  aptos: number | null;
  cancelados: number | null;
  reprovadosQuestionario: number | null;
  eliminadosNota: number | null;
  reprovadosAnalise: number | null;
  triados: number | null;
  totalEliminados: number | null;
  convocados: number | null;
  aprovados: number | null;
  contratados: number | null;
  naoContratados: number | null;
};

export type DadosDaSelecao = {
  area: string;
  // Preservados da origem; o normalizador não interpreta datas ou IDs.
  geradoEm: unknown;
  ultimaCarga: {
    em: unknown;
    linhas: number | null;
    semEdital: number | null;
  } | null;
  vagas: VagaDaSelecao[];
};

export type SnapshotDaSelecao = Readonly<{
  area: string;
  dados: DadosDaSelecao | null;
  carregado: boolean;
  erroAoCarregar: string;
  semSessao: boolean;
  semAcesso: boolean;
  atualizando: boolean;
  daCopia: boolean;
  carregadoEm: number;
}>;

type SessaoDaSelecao = { user?: { id?: string } } | null;

/** Só as operações já consumidas pelo módulo; aceita o cliente único do app. */
export type ClienteDaSelecao = {
  rpc: (
    nome: "get_selecao_da_area",
    argumentos: { p_area: string },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  auth?: {
    getSession?: () => PromiseLike<{
      data: { session: SessaoDaSelecao } | null;
    }>;
    onAuthStateChange?: (
      ouvinte: (evento: string, sessao: SessaoDaSelecao) => void,
    ) => unknown;
  };
};

export type ArmazenamentoDaSelecao = {
  ler: (chave: string) => unknown | PromiseLike<unknown>;
  guardar: (chave: string, valor: unknown) => unknown | PromiseLike<unknown>;
  apagarTudo: () => unknown | PromiseLike<unknown>;
};

export type OpcoesDoEstadoDaSelecao = {
  supabase?: ClienteDaSelecao | null;
  toast?: (mensagem: string, tom?: "warn" | "error") => void;
  baixar?: (conteudo: string, nome: string) => void;
  armazenamento?: ArmazenamentoDaSelecao;
  agora?: () => number;
  tempoLimiteMs?: number;
};

export type EstadoDaSelecao = {
  obter: () => SnapshotDaSelecao;
  assinar: (ouvinte: () => void) => () => void;
  carregar: (area?: string) => Promise<boolean>;
  exportarCsv: (vagas: readonly VagaDaSelecao[]) => void;
  reiniciar: () => void;
};

export type CampoDoFiltro = "unidades" | "editais" | "cargos" | "vagas";
export type FiltrosDaSelecao = Readonly<
  Record<CampoDoFiltro, readonly string[]>
>;
export type OpcoesDosFiltros = Record<CampoDoFiltro, string[]>;
export type CampoNumerico = {
  [K in keyof VagaDaSelecao]: VagaDaSelecao[K] extends number | null
    ? K
    : never;
}[keyof VagaDaSelecao];
export type IndicadoresDaSelecao = {
  vagas: number;
  inscritos: number | null;
  aptos: number | null;
  triados: number | null;
  convocados: number | null;
  aprovados: number | null;
  contratados: number | null;
  taxa: number | null;
};
export type ObservacaoDaSelecao = {
  texto: string;
  vagas: number;
  unidades: string[];
  editais: string[];
};
export type AtivoDoRecorte = [CampoDoFiltro, string, string];
export type OpcoesDaTelaDeSelecao = Pick<
  OpcoesDoEstadoDaSelecao,
  "supabase" | "toast" | "baixar" | "armazenamento"
> & { secao?: HTMLElement | null; areaAtual?: () => unknown };
