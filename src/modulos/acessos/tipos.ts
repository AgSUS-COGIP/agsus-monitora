import type { SupabaseClient } from "@supabase/supabase-js";
import type { AcaoEmCurso } from "../../ui/botao-de-acao.tsx";
import type {
  ContaDesativada,
  CoordenacaoDeAcesso,
  GrupoDeAcesso,
  MatrizDeAcessos,
  PerfilDeAcesso,
  RascunhoDeAcessos,
  TetoDeAcessos,
  UsuarioDaMatriz,
} from "../../lib/tipos-dos-acessos.ts";

/*
  Tipos do estado de Configurações › Acessos (estado.ts) e dos componentes.
  As regras e as linhas das RPCs estão em src/lib/tipos-dos-acessos.ts; aqui
  ficam os campos a mais que só a tela lê e a forma do estado.
*/

// ── Linhas do banco (com os campos que só a tela lê) ─────────────────────────

/**
 * Pessoa de obter_matriz_acessos, com o setor informado no pedido e a data do
 * cadastro. A conta é o e-mail: ele sempre vem.
 */
export type UsuarioDosAcessos = UsuarioDaMatriz & {
  email: string;
  setor?: string | null;
  cadastrado_em?: string | null;
};

/** Grupo com a contagem de pessoas. */
export type GrupoDosAcessos = GrupoDeAcesso & { usuarios?: number | null };

/** Coordenação com a contagem de pessoas. */
export type CoordenacaoDosAcessos = CoordenacaoDeAcesso & {
  usuarios?: number | null;
};

/**
 * Linha de listar_contas_desativadas, com o nome do grupo e o pedido
 * pendente. A conta é o e-mail: ele sempre vem.
 */
export type ContaDesativadaDosAcessos = ContaDesativada & {
  email: string;
  grupo_nome?: string | null;
  pedido_pendente?: boolean | null;
};

/** O retorno de obter_matriz_acessos como a tela lê (o teto sempre vem). */
export type MatrizDosAcessos = Omit<
  MatrizDeAcessos,
  "usuarios" | "grupos" | "coordenacoes" | "teto"
> & {
  usuarios?: UsuarioDosAcessos[];
  grupos?: GrupoDosAcessos[];
  coordenacoes?: CoordenacaoDosAcessos[];
  teto: TetoDeAcessos;
};

/** Pedido de listar_solicitacoes_acesso (status "pendente"). */
export type PedidoPendente = {
  id: string;
  nome?: string | null;
  email: string;
  setor?: string | null;
  justificativa?: string | null;
  created_at?: string | null;
  coordenacao?: string | null;
  coordenacao_nome?: string | null;
  area?: string | null;
  area_nome?: string | null;
  cargo?: string | null;
  cargo_rotulo?: string | null;
  cargo_outro?: string | null;
  reativacao?: boolean;
  grupo_anterior?: string | null;
};

/** Linha de listar_unidades_por_area. */
export type UnidadeDaArea = { unidade: string; area: string };

/** Erro do PostgREST (o que a tela lê dele). */
export type ErroDoBanco = { code?: string | null; message?: string | null };

// ── Estado ───────────────────────────────────────────────────────────────────

/** "idle", "loading", "ready" ou "error". */
export type StatusDaCarga = "idle" | "loading" | "ready" | "error";

/** Aviso depois de salvar ou de um conflito. */
export type AvisoDosAcessos = { tom: "warn" | "danger"; texto: string };

/** Gaveta da pessoa aberta. */
export type GavetaAberta = { usuarioId: string; abertura: number };

export type SnapshotDosAcessos = Readonly<{
  perfil: PerfilDeAcesso | null;
  matriz: MatrizDosAcessos | null;
  status: StatusDaCarga;
  erro: string;
  erroCodigo: string;
  busca: string;
  offset: number;
  filtroCoordenacao: string;
  filtroGrupo: string;
  rascunho: RascunhoDeAcessos;
  solicitacoes: readonly PedidoPendente[];
  statusDasSolicitacoes: StatusDaCarga;
  desativadas: readonly ContaDesativadaDosAcessos[];
  statusDasDesativadas: StatusDaCarga;
  buscaDasDesativadas: string;
  acao: AcaoEmCurso | null;
  gaveta: GavetaAberta | null;
  adicionando: number;
  aviso: AvisoDosAcessos | null;
  geracao: number;
}>;

/** Busca, filtros e página de obter_matriz_acessos. */
export type MudancasDaMatriz = Partial<
  Pick<
    SnapshotDosAcessos,
    "busca" | "offset" | "filtroCoordenacao" | "filtroGrupo"
  >
>;

/** O que "Adicionar pessoa" grava (adicionar_pessoa_acesso). */
export type NovaPessoa = {
  email: string;
  nome: string;
  grupo: string;
  coordenacao: string;
  areas: string[] | null;
};

/** Passo "Convite pronto" de "Adicionar pessoa". */
export type ConvitePronto = { nome: string; email: string; reativada: boolean };

/** Escolhas de quem aprova um pedido. */
export type EscolhaDaAprovacao = {
  grupo: string;
  coordenacao: string;
  areas: string[] | null;
  observacao?: string | null;
};

/** `argumentos` de validarRecusa (src/lib/solicitacao-de-acesso.ts). */
export type ArgumentosDaRecusa = {
  p_motivo: string;
  p_complemento: string | null;
};

/** { ok } ou { ok: false, erro } com a mensagem para o modal. */
export type ResultadoDaAcao = { ok: boolean; erro: string };

/** O que salvar_grupo_acesso / salvar_coordenacao devolvem (o código gravado). */
export type RespostaDaGravacao = { codigo?: string | null };

export type RpcDosAcessos =
  | "obter_matriz_acessos"
  | "salvar_matriz_acessos"
  | "listar_solicitacoes_acesso"
  | "aprovar_solicitacao_acesso"
  | "recusar_solicitacao_acesso"
  | "salvar_grupo_acesso"
  | "remover_grupo_acesso"
  | "salvar_coordenacao"
  | "desativar_coordenacao"
  | "obter_contexto_de_usuario"
  | "desativar_acesso_usuario"
  | "listar_unidades_por_area"
  | "adicionar_pessoa_acesso"
  | "mover_conta_para_coordenacoes"
  | "listar_contas_desativadas"
  | "reativar_acesso_usuario";

export interface ClienteDosAcessos {
  rpc: (
    nome: RpcDosAcessos,
    argumentos?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  auth?: Partial<
    Pick<SupabaseClient["auth"], "onAuthStateChange" | "getSession">
  >;
}

export interface OpcoesDoEstadoDosAcessos {
  supabase?: ClienteDosAcessos | null;
  toast?: (mensagem: string, tom?: string) => void;
  getProfile?: () => PerfilDeAcesso | null | undefined;
  confirmar?: (mensagem: string) => boolean;
}

export type EstadoDosAcessos = ReturnType<
  typeof import("./estado.ts").criarEstadoDosAcessos
>;
