import type { SupabaseClient } from "@supabase/supabase-js";
import type { classificarEdital } from "../../lib/classificacao/ajustes.ts";
export type RegistroDaClassificacao = Record<string, unknown>;
export interface VersaoDaRegraDaClassificacao extends RegistroDaClassificacao {
  versao: number;
  nome: string | null;
  em: string;
  por: string;
  motivo: string;
  configuracao?: RegistroDaClassificacao;
  renomeacoes: {
    em: string;
    por: string;
    de: string;
    para: string;
    motivo: string;
  }[];
}
export interface EditalDaClassificacao extends RegistroDaClassificacao {
  id: string;
  edital: string;
  unidade: string;
  candidatos: number;
  versao_regra?: number;
  nome_regra?: string | null;
  treinamento?: boolean;
}
export interface RegraDaClassificacao extends RegistroDaClassificacao {
  versao: number;
  nome: string | null;
  configuracao: RegistroDaClassificacao;
  versoes?: VersaoDaRegraDaClassificacao[];
}
export interface RetratoDaClassificacao extends RegistroDaClassificacao {
  tipo: string;
  edital: RegistroDaClassificacao & {
    id?: string;
    edital?: string;
    unidade?: string;
  };
  vagas: RegistroDaClassificacao[];
  modalidades: RegistroDaClassificacao[];
  parciais?: string[];
  rodape?: string;
}
export interface ListaRegistrada extends RegistroDaClassificacao {
  id: string;
  tipo?: string;
  retrato?: RetratoDaClassificacao;
  publicada?: boolean;
  pendencias?: number;
  gerada_em?: string;
  por?: string;
  versao_regra?: number;
  hash?: string;
}
export interface DesempateRegistrado extends RegistroDaClassificacao {
  chave: string;
  metodo: string;
  ordem?: string[];
  semente?: string;
  origem_semente?: string;
}
export interface DadosDaClassificacao extends RegistroDaClassificacao {
  edital: RegistroDaClassificacao & { id?: string; treinamento?: boolean };
  regra: RegraDaClassificacao | null;
  listas: ListaRegistrada[];
  candidatos: RegistroDaClassificacao[];
  desempates: DesempateRegistrado[];
  cronograma: RegistroDaClassificacao[];
  pode_editar: boolean;
}
export interface SnapshotDaClassificacao {
  area: string;
  editais: EditalDaClassificacao[];
  podeEditar: boolean;
  carregado: boolean;
  carregandoEditais: boolean;
  erroAoCarregar: string;
  semAcesso: boolean;
  editalId: string;
  dados: DadosDaClassificacao | null;
  carregandoEdital: boolean;
  erroDoEdital: string;
  salvando: boolean;
  gerando: boolean;
}
export type RpcDaClassificacao =
  | "listar_editais_classificacao"
  | "obter_classificacao_do_edital"
  | "obter_classificacao_do_edital_se_mudou"
  | "salvar_regra_classificacao"
  | "renomear_versao_regra_classificacao"
  | "registrar_lista_classificacao"
  | "publicar_lista_classificacao"
  | "obter_lista_classificacao"
  | "registrar_desempate_classificacao"
  | "obter_publicacao_lista_aprovados"
  | "publicar_lista_aprovados_da_classificacao"
  | "listar_configuracao_convocacao"
  | "listar_modelos_convocacao"
  | "salvar_hora_nascimento_candidato";
export interface ClienteDaClassificacao {
  rpc: (
    nome:
      | RpcDaClassificacao
      | "obter_agenda_entrevista"
      | "salvar_regra_agenda_entrevista"
      | "salvar_agenda_entrevista",
    argumentos?: RegistroDaClassificacao,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  auth?: Partial<Pick<SupabaseClient["auth"], "onAuthStateChange">>;
}
export type ResultadoDaClassificacao = ReturnType<typeof classificarEdital>;
export interface OpcoesDoDocumento {
  lista?: string;
  fase?: "PRELIMINAR" | "FINAL" | null;
  documento?: RegistroDaClassificacao | null;
}
export interface OpcoesDoEstado {
  supabase?: ClienteDaClassificacao | null;
  toast?: (mensagem: string, tom?: string) => void;
  baixar?: (bytes: BlobPart, nome: string, tipo: string) => void;
  imprimir?: (html: string) => void;
  copiar?: (conteudo: {
    html: string;
    texto: string;
  }) => string | Promise<string>;
  carregarLogo?: () =>
    | { bytes: Uint8Array; largura: number; altura: number }
    | null
    | Promise<{ bytes: Uint8Array; largura: number; altura: number } | null>;
  cabecalho?: () => unknown;
  enderecoDoLogo?: string;
  tempoLimiteMs?: number;
  agendaDoEdital?: (id: string) => unknown;
  /** Versão nova da regra salva (o rascunho guardado do edital acaba antes de a aba remontar). */
  aoGravarVersao?: (editalId: string) => void;
  /** A cópia no navegador da leitura por versão (src/app/copias-por-versao.ts); null = só a memória. */
  copias?:
    | import("../../lib/avaliacao-documental/leitura-por-versao.ts").CopiasPorChave
    | null;
}
export type EstadoDaClassificacao = ReturnType<
  typeof import("./estado.ts").criarEstadoDaClassificacao
>;
export type EstadoDaAgenda = ReturnType<
  typeof import("./estado-da-agenda.ts").criarEstadoDaAgenda
>;
export interface OpcoesDaTela extends OpcoesDoEstado {
  secao?: HTMLElement | null;
  areaAtual?: () => string | null;
  /** O rascunho guardado da regra (src/app/rascunho-da-regra.ts, tipo CLASSIFICACAO). */
  rascunho?: import("../../app/rascunho-da-regra.ts").RascunhoDaRegra;
  confirmar?: (mensagem: string) => boolean;
}
