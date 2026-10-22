/** Contratos de Configurações › Módulos e abas. */
export type EstadoDoModulo = "ativa" | "manutencao" | "desativada";
export type CampoDosModulos =
  "ativo" | "situacao" | "mensagem" | "previsao" | "beta" | "comemoracoes";
export type AlvoDosModulos =
  | { escopo: "sistema"; area?: never; aba?: never; painel?: never }
  | { escopo: "area"; area: string; aba?: never; painel?: never }
  | { escopo: "aba"; aba: string; area?: never; painel?: never }
  | { escopo: "aba_area"; area: string; aba: string; painel?: never }
  | { escopo: "painel"; painel: string; area?: never; aba?: never };
export interface AlvoDoHistorico {
  escopo?: string | null;
  area?: string | null;
  aba?: string | null;
  painel?: string | null;
}
export interface RegistroDoCampo {
  readonly alvo: AlvoDosModulos;
  readonly campo: CampoDosModulos;
  readonly valor: string;
}
export type CamposDosModulos = ReadonlyMap<string, RegistroDoCampo>;
export interface ManutencaoDoModulo {
  situacao?: string | null;
  mensagem?: string | null;
  previsao?: string | null;
}
export interface AbaDosModulos extends ManutencaoDoModulo {
  co_aba: string;
  no_aba?: string | null;
  ativo?: boolean;
  beta?: boolean;
}
export interface AreaDosModulos extends ManutencaoDoModulo {
  co_area: string;
  no_area?: string | null;
  ativo?: boolean;
  abas?: readonly AbaDosModulos[];
}
export interface PainelDosModulos {
  id: string;
  titulo?: string | null;
  ativo?: boolean;
  em_manutencao?: boolean;
}
export interface HistoricoDosModulos extends AlvoDoHistorico {
  campo?: string | null;
  quando?: string | null;
  anterior?: unknown;
  novo?: unknown;
  motivo?: string | null;
  autor?: string | null;
}
export interface ArvoreDosModulos {
  sistema?: ManutencaoDoModulo & { comemoracoes?: boolean };
  areas?: readonly AreaDosModulos[];
  abas?: readonly AbaDosModulos[];
  paineis?: readonly PainelDosModulos[];
  historico?: readonly HistoricoDosModulos[];
}
export interface SnapshotDosModulos {
  readonly perfil: Record<string, unknown> | null;
  readonly arvore: ArvoreDosModulos | null;
  readonly originais: CamposDosModulos;
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly erro: string;
  readonly erroCodigo: string;
  readonly rascunho: CamposDosModulos;
  readonly acao: { tipo: "salvar"; rotulo: string } | null;
  readonly aviso: { tom: "danger"; texto: string } | null;
  readonly geracao: number;
}
export interface AlteracaoDosModulos {
  escopo: AlvoDosModulos["escopo"];
  area?: string;
  aba?: string;
  painel?: string;
  campo: CampoDosModulos;
  valor: string;
}
export interface ClienteDosModulos {
  rpc(
    nome: "obter_modulos_e_abas" | "salvar_situacao_modulos",
    parametros?: { p_alteracoes: AlteracaoDosModulos[]; p_motivo: string },
  ): PromiseLike<{ data: unknown; error: unknown }>;
  auth?: {
    getSession?(): Promise<{
      data: {
        session: { access_token?: string; user?: { id?: string } } | null;
      };
      error?: unknown;
    }>;
    onAuthStateChange?(
      callback: (
        evento: string,
        sessao: { user?: { id?: string } } | null,
      ) => void,
    ): { data: { subscription: { unsubscribe(): void } } };
  };
}
export interface DependenciasDosModulos {
  supabase?: ClienteDosModulos | null;
  toast?(mensagem: string, tom?: string): void;
  getProfile?(): Record<string, unknown> | null;
  confirmar?(mensagem: string): boolean;
}
export interface EstadoDosModulos {
  obter(): SnapshotDosModulos;
  assinar(ouvinte: () => void): () => void;
  garantirCarregado(): Promise<ArvoreDosModulos | null>;
  carregar(): Promise<ArvoreDosModulos | null>;
  mudarCampo(alvo: AlvoDosModulos, campo: CampoDosModulos, valor: string): void;
  mudarEstado(alvo: AlvoDosModulos, novo: EstadoDoModulo): void;
  descartar(): void;
  salvar(motivo: string): Promise<boolean>;
  confirmarSaida(): boolean;
  temAlteracoesPendentes(): boolean;
  desligar(): void;
}
