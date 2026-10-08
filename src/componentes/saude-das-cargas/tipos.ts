import type { ClienteDosAvisos } from "../../modulos/conferencias/tipos.ts";
import type { ResumoDaAgenda } from "./agenda-dos-robos.tsx";
export type SituacaoDaCarga =
  "em_dia" | "atrasada" | "falhou" | "em_andamento" | "nunca";
export interface ExecucaoDaCarga {
  inicio: Date | null;
  fim: Date | null;
  situacao: "ok" | "falha" | "andamento";
  situacaoBruta: string;
  linhas: number | null;
  mensagem: string | null;
  encerradaPorInatividade: boolean;
}
export interface Carga {
  id: string;
  nome: string;
  onde: string;
  esperado: string;
  prazoMin: number | null;
  situacao: SituacaoDaCarga;
  ultima: ExecucaoDaCarga | null;
  ultimaOk: Pick<ExecucaoDaCarga, "inicio" | "fim"> | null;
  idadeMin: number | null;
  emAndamento: boolean;
  historico: ExecucaoDaCarga[];
  area?: string;
  incremental?: boolean;
  ativa?: boolean;
  agenda?: ResumoDaAgenda;
}
export interface SaudeNormalizada {
  geradoEm: Date | null;
  grupos: {
    id: string;
    titulo: string;
    descricao: string;
    cargas: Carga[];
    indisponivel?: boolean;
  }[];
  resumo: Record<string, number>;
  total: number;
}
export interface LinhaDaSaude {
  id: string;
  titulo: string;
  explicacao: string;
  situacao: SituacaoDaCarga;
  ultimaAtualizacao: Date | null;
  idadeMin: number | null;
  emAndamento: boolean;
  erro: { quando: Date | null; mensagem: string | null; parte: string } | null;
  partes: Carga[];
  agenda?: ResumoDaAgenda;
  indisponivel?: boolean;
}
export interface EditalDoRobo {
  id: string;
  numero: string;
  edital: string;
  area: string;
  unidade: string;
  ativo: boolean;
  status: string;
  treinamento: boolean;
  vigente: boolean;
}
export interface AreaDoRobo {
  area: string;
  nome: string;
}
export interface VagaDoRobo {
  vaga: string;
  editalId: string;
  cargo: string;
  ultimaCarga: Date | null;
  situacao: string;
  ativos: number | null;
}
export interface ResultadoDaVaga {
  vaga: string;
  situacao: string;
  arquivo: number | null;
  ativos: number | null;
  comLink: number | null;
  mensagem: string;
}
export interface ExecucaoDoRobo {
  id: string;
  inicio: Date | null;
  fim: Date | null;
  situacao: string;
  disparo: string;
  quem: string;
  parametros: {
    editais: string[];
    vagas?: string[];
    limite?: number | null;
    texto: string;
  };
  resultado: string;
  porVaga: ResultadoDaVaga[];
  mensagem: string;
  execucao: string | null;
}
export interface PainelDosRobos {
  geradoEm: Date | null;
  areas: AreaDoRobo[];
  editais: EditalDoRobo[];
  execucoes: Record<string, ExecucaoDoRobo[]>;
}
export interface OpcoesDoRobo {
  modos: readonly { valor: string; rotulo: string; explicacao: string }[];
  editais: string | null;
  vagas: boolean;
  limite: { min: number; max: number; padrao: number } | null;
  /** Aceita "anexos" (guardar os links dos anexos do questionário; robô da Empregare). */
  anexos?: boolean;
}
export interface RoboDeCarga {
  readonly id: string;
  readonly nome: string;
  readonly workflow: string;
  readonly limiteMin: number;
  readonly porEdital?: boolean;
}
export interface OpcoesConferidas {
  modo: string;
  editais: string[];
  vagas: string[];
  limite: number | null;
  /** Só aparece quando marcado. */
  anexos?: true;
}
export type ResultadoDasOpcoes =
  | { opcoes: OpcoesConferidas; erro?: never; texto?: never }
  | { opcoes?: never; erro: string; texto: string };
export interface PedidoDoRobo {
  em: Date;
  modo: string;
  frase?: string;
  id?: number | string;
  disparo?: SituacaoDoPedido;
}
export interface InputsDoPedido {
  modo?: string;
  editais?: string[];
  vagas?: string[];
  limite?: string;
  anexos?: boolean;
}
export interface SituacaoDoPedido {
  situacao: string;
  http: number | null;
  mensagem: string;
  terminou: boolean;
  aceito: boolean;
  aviso: { tom: "erro"; texto: string } | null;
}
export type EtapaDoPedido = {
  execucao: ExecucaoDoRobo | null;
  url: string | null;
  semRegistro?: boolean;
} & (
  | { etapa: "recusado"; texto: string }
  | { etapa: "aguardando" | "github" | "rodando" | "terminou" }
);
export interface SnapshotDaSaude {
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly dados: SaudeNormalizada | null;
  readonly bruto: unknown;
  readonly erro: string;
  readonly erroCodigo: string;
  readonly perfil: Record<string, unknown> | null;
  readonly pedidos: Readonly<Record<string, Date | null>>;
  readonly avisos: Readonly<
    Record<string, { tom: "erro" | "sucesso" | "info"; texto: string } | null>
  >;
  readonly painel: {
    status: "idle" | "loading" | "ready" | "error" | "sem_funcao";
    dados: PainelDosRobos | null;
    erro: string;
  };
  readonly acompanhamentos: Readonly<Record<string, PedidoDoRobo>>;
}
type RespostaDaCarga = {
  data: unknown;
  error: { message?: string; code?: string } | null;
};
export type ClienteDaSaude = ClienteDosAvisos & {
  rpc(
    nome: "disparar_robo",
    parametros: { p_robo: string; p_inputs: InputsDoPedido },
  ): PromiseLike<RespostaDaCarga>;
  rpc(
    nome: "situacao_do_disparo_robo",
    parametros: { p_disparo: number | string },
  ): PromiseLike<RespostaDaCarga>;
  rpc(
    nome: "get_saude_das_cargas" | "get_painel_dos_robos",
  ): PromiseLike<RespostaDaCarga>;
  rpc(
    nome: "listar_vagas_dos_robos",
    parametros: { p_editais: string[] | null; p_vagas: string[] | null },
  ): PromiseLike<RespostaDaCarga>;
};
export interface DependenciasDaSaude {
  supabase: ClienteDaSaude | null;
  getProfile?: () => Record<string, unknown> | null;
  agora?: () => Date;
  agendar?: (fn: () => void, ms: number) => unknown;
}
export interface EstadoDaSaude {
  obter(): SnapshotDaSaude;
  assinar(ouvinte: () => void): () => void;
  carregar(): Promise<void>;
  conferirPedido(id: string): Promise<void>;
  carregarPainel(): Promise<void>;
  agora(): Date;
  rodarAgora(id: string): Promise<boolean>;
  rodarComOpcoes(
    id: string,
    opcoes: OpcoesConferidas,
    frase?: string,
  ): Promise<boolean>;
  buscarVagas(consulta?: {
    editais?: string[];
    vagas?: string[];
  }): Promise<{ vagas: VagaDoRobo[]; erro: string }>;
  dispensarAcompanhamento(id: string): void;
}
export interface PropsDaLinha {
  linha: LinhaDaSaude;
  atual: SnapshotDaSaude;
  estado: EstadoDaSaude;
}
export interface PropsDoRobo {
  robo: RoboDeCarga;
  atual: SnapshotDaSaude;
  estado: EstadoDaSaude;
}
