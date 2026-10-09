export type CampoDoFiltro =
  | "busca"
  | "unidade"
  | "edital"
  | "vaga"
  | "cargo"
  | "parecer"
  | "comparecimento"
  | "modalidade"
  | "ligacao"
  | "andamento";
export type FiltrosDoPainel = Record<CampoDoFiltro, string>;
export type ListaDoFiltro =
  | "unidades"
  | "editais"
  | "vagas"
  | "cargos"
  | "pareceres"
  | "comparecimentos"
  | "modalidades"
  | "ligacoes"
  | "andamentos";
export type OpcoesDosFiltros = Record<
  ListaDoFiltro,
  readonly { valor: string; rotulo: string }[]
>;
export type FiltroAtivo = [campo: CampoDoFiltro, rotulo: string, valor: string];
export type AoFiltrar = (campo: CampoDoFiltro, valor: string) => void;
export interface CriterioDoPainel {
  indice: number;
  texto: string;
  curto: string;
}
export interface AnaliseDaEntrevista {
  id: unknown;
  ligacao: string | null;
  nota: number | null;
  resultado: string;
  etapa: string;
  responsavel: string;
  ativo: boolean;
}
export interface EntrevistaDoPainel {
  id: string;
  edital_id: unknown;
  edital: string;
  edital_planilha: string;
  unidade: string;
  vaga: string;
  cargo: string;
  candidato: string;
  codigo: string | null;
  modalidade: string | null;
  nota: number | null;
  parecer: string;
  compareceu: "S" | "N" | null;
  link: string | null;
  busca: string;
  notas: { indice: number; criterio: string; curto: string; nota: number }[];
  somaDasNotas: number | null;
  divergente: boolean;
  semEdital: boolean;
  analise: AnaliseDaEntrevista | null;
}
export interface AprovadoSemEntrevista {
  analise_id: unknown;
  candidato: string;
  codigo: string | null;
  vaga: string;
  cargo: string;
  edital: string;
  unidade: string;
  nota: number | null;
  modalidade: string | null;
}
export interface GrupoDosSemEntrevista {
  chave: string;
  edital: string;
  vaga: string;
  cargo: string;
  unidade: string;
  candidatos: AprovadoSemEntrevista[];
}
export interface IndicadoresDoPainel {
  vagas: number;
  candidatos: number;
  compareceram: number;
  aptos: number;
  inaptos: number;
  media: number | null;
  semEntrevista: number;
}
export interface PendenciaDoPainel {
  chave: string;
  titulo: string;
  subtitulo: string;
  unidade: [string, string];
  valor: number;
  severidade: "alta" | "media" | "baixa";
  campo?: CampoDoFiltro;
}
export interface PropsDosIndicadores {
  indicadores: IndicadoresDoPainel;
  carregado: boolean;
  filtros: FiltrosDoPainel;
  aoFiltrar: AoFiltrar;
  aoAbrirSemEntrevista(): void;
}
export interface PropsDasPendencias {
  pendencias: readonly PendenciaDoPainel[];
  carregado: boolean;
  filtros: FiltrosDoPainel;
  aoFiltrar: AoFiltrar;
  aoAbrirSemEntrevista(): void;
}
export interface PropsDosGraficos extends PropsDasPendencias {
  entrevistas: readonly EntrevistaDoPainel[];
  criterios: readonly CriterioDoPainel[];
  escuro: boolean;
}

export interface DadosDoPainel {
  area: string;
  geradoEm: unknown;
  ultimaCarga: {
    em: unknown;
    linhas: number | null;
    ligadasAnalise: number | null;
    semAnalise: number | null;
    semEdital: number | null;
  } | null;
  criterios: CriterioDoPainel[];
  entrevistas: EntrevistaDoPainel[];
  aprovadosSemEntrevista: AprovadoSemEntrevista[];
}
export type SnapshotDasEntrevistas = Readonly<{
  area: string;
  dados: DadosDoPainel | null;
  carregado: boolean;
  erroAoCarregar: string;
  semSessao: boolean;
  semAcesso: boolean;
  atualizando: boolean;
  daCopia: boolean;
  carregadoEm: number;
  gaveta: string | null;
  semEntrevistaAberta: boolean;
  comemoracoes: boolean;
  agenda: Readonly<{
    editalId: string;
    itens: import("../../lib/painel-de-entrevistas.ts").ItemDaAgenda[] | null;
    erro: string;
  }>;
}>;
type SessaoDoPainel = { user?: { id?: string } } | null;
export interface ClienteDoPainel {
  rpc(
    nome: "get_entrevistas_da_area",
    argumentos: { p_area: string },
  ): PromiseLike<{ data: unknown; error: unknown }>;
  rpc(
    nome: "obter_agenda_entrevista",
    argumentos: { p_edital: string },
  ): PromiseLike<{ data: unknown; error: unknown }>;
  auth?: {
    getSession?: () => PromiseLike<{
      data: { session: SessaoDoPainel } | null;
    }>;
    onAuthStateChange?: (
      ouvinte: (evento: string, sessao: SessaoDoPainel) => void,
    ) => unknown;
  };
}
export interface ArmazenamentoDoPainel {
  ler(chave: string): unknown | PromiseLike<unknown>;
  guardar(chave: string, valor: unknown): unknown | PromiseLike<unknown>;
  apagarTudo(): unknown | PromiseLike<unknown>;
}
export interface OpcoesDoEstadoDasEntrevistas {
  supabase?: ClienteDoPainel | null;
  toast?: (mensagem: string, tom?: "warn" | "error") => void;
  baixar?: (conteudo: string, nome: string) => void;
  armazenamento?: ArmazenamentoDoPainel;
  agora?: () => number;
  tempoLimiteMs?: number;
  avaliarMarcos?:
    | ((contexto: {
        usuarioId: string;
        area: string;
        dados: DadosDoPainel | null;
        ligadas: boolean;
      }) => unknown)
    | null;
}
export interface EstadoDasEntrevistas {
  obter(): SnapshotDasEntrevistas;
  assinar(ouvinte: () => void): () => void;
  carregar(area?: string): Promise<boolean>;
  abrirGaveta(id: string): void;
  fecharGaveta(): void;
  abrirSemEntrevista(): void;
  fecharSemEntrevista(): void;
  exportarCsv(entrevistas: readonly EntrevistaDoPainel[]): void;
  carregarAgenda(
    editalId: string,
  ): Promise<
    import("../../lib/painel-de-entrevistas.ts").ItemDaAgenda[] | null
  >;
  reiniciar(): void;
  definirComemoracoes(ligadas: boolean): void;
}
export type OpcoesDaTelaDeEntrevistas = Pick<
  OpcoesDoEstadoDasEntrevistas,
  "supabase" | "toast" | "baixar" | "armazenamento"
> & {
  secao?: HTMLElement | null;
  areaAtual?: () => unknown;
  comemoracoesLigadas?: () => boolean;
};
