/*
  Tipos de Configurações: o retrato do estado (estado.ts), o das imagens da
  Aparência (imagens.ts), as seções (secoes.ts) e os clientes do Supabase
  que eles usam. Os tipos da publicação, dos painéis externos e da marca da
  tela de acesso são das bibliotecas (src/lib/) e são reexportados aqui, para
  as telas importarem de um lugar só.
*/

import type {
  AlteracaoParaRevisar,
  ConflitoDaPublicacao,
  LinhaDaConfiguracao,
  RetratoDasConfiguracoesNoBanco,
  ValoresDasConfiguracoes,
  VersaoDoHistorico,
} from "../../lib/publicacao-de-configuracoes.ts";
import type {
  LinhaDoPainel,
  PainelExterno,
  RascunhoDosPaineis,
} from "../../lib/paineis-externos-das-configuracoes.ts";
import type { criarEstadoDasConfiguracoes } from "./estado.ts";
import type { criarImagensDaAparencia } from "./imagens.ts";

export type {
  AlteracaoGravada,
  AlteracaoParaRevisar,
  CampoDaSecao,
  ConfiguracaoCarregada,
  ConflitoDaPublicacao,
  LinhaDaConfiguracao,
  LinhaDeConfiguracaoNoBanco,
  OpcaoDoCampo,
  RetratoDasConfiguracoesNoBanco,
  SecaoQuePublica,
  TipoDoCampo,
  ValoresDasConfiguracoes,
  VersaoDoHistorico,
} from "../../lib/publicacao-de-configuracoes.ts";
export type {
  AlteracoesDoPainel,
  CampoEditavelDoPainel,
  LinhaDePainelNoBanco,
  LinhaDoPainel,
  PainelExterno,
  RascunhoDosPaineis,
  ResumoDosPaineis,
  SituacaoDoPainel,
  ValorDoCampoDoPainel,
} from "../../lib/paineis-externos-das-configuracoes.ts";
export type { MarcaDoAcesso } from "../../lib/access-branding.ts";
export type {
  CampoDaMarcaGuardada,
  MarcaGuardada,
} from "../../lib/access-branding-cache.ts";
export type { ArquivoDeImagem } from "../../lib/access-background-storage.ts";
export type {
  TipoDoAviso,
  TomDoAviso,
} from "../../lib/apresentacao-das-configuracoes.ts";

// ── Supabase ────────────────────────────────────────────────────────────────

/** Resposta de uma RPC, com o `data` na forma que a função devolve. */
export interface RespostaDaRpc<T> {
  data: T | null;
  error: unknown;
}

/** O que salvar_configuracoes_e_paineis_v2 e restaurar_configuracoes_versao devolvem. */
export interface ResultadoDaPublicacao {
  ok?: boolean;
  total_alteracoes?: number | null;
}

/** As RPCs do estado das Configurações. */
export interface ClienteDasConfiguracoes {
  rpc(
    nome: "get_configuracoes_snapshot",
  ): PromiseLike<RespostaDaRpc<RetratoDasConfiguracoesNoBanco>>;
  rpc(
    nome: "salvar_configuracoes_e_paineis_v2",
    argumentos: {
      p_config_rows: LinhaDaConfiguracao[];
      p_paineis: LinhaDoPainel[];
      p_motivo: string;
    },
  ): PromiseLike<RespostaDaRpc<ResultadoDaPublicacao>>;
  rpc(
    nome: "get_configuracoes_historico",
    argumentos: { p_limit: number },
  ): PromiseLike<RespostaDaRpc<VersaoDoHistorico[]>>;
  rpc(
    nome: "restaurar_configuracoes_versao",
    argumentos: { p_versao_id: string | number; p_motivo: string },
  ): PromiseLike<RespostaDaRpc<ResultadoDaPublicacao>>;
}

/** Um arquivo listado no armazenamento (só o nome é lido). */
export interface ArquivoNoArmazenamento {
  name: string;
}

/** O bucket `platform-assets` (o `storage.from(...)` do Supabase). */
export interface ArmazenamentoDasImagens {
  list(
    pasta: string,
    opcoes: {
      limit: number;
      sortBy: { column: string; order: string };
    },
  ): PromiseLike<{ data: ArquivoNoArmazenamento[] | null; error: unknown }>;
  getPublicUrl(caminho: string): { data: { publicUrl: string } };
  upload(
    caminho: string,
    arquivo: File,
    opcoes: { cacheControl: string; contentType: string; upsert: boolean },
  ): PromiseLike<{ error: unknown }>;
  remove(caminhos: string[]): PromiseLike<{ error: unknown }>;
}

/** A arte de fundo gravada por definir_fundo_acesso_monitora. */
export interface FundoGravado {
  url?: string | null;
  caminho?: string | null;
}

/** O cliente que as imagens da Aparência usam: a RPC da arte e o armazenamento. */
export interface ClienteDasImagens {
  rpc(
    nome: "definir_fundo_acesso_monitora",
    argumentos: { p_url: string | null; p_caminho: string | null },
  ): PromiseLike<RespostaDaRpc<FundoGravado>>;
  storage?: { from(bucket: string): ArmazenamentoDasImagens };
}

// ── Estado das Configurações (estado.ts) ────────────────────────────────────

/** Situação de um carregamento (histórico, galerias). */
export type StatusDoCarregamento = "idle" | "loading" | "ready" | "error";

/** O histórico de versões publicadas. */
export interface HistoricoDasConfiguracoes {
  status: StatusDoCarregamento;
  itens: VersaoDoHistorico[];
  erro: string;
}

/** Corrigir antes de publicar. */
export interface ModalDeErros {
  tipo: "erros";
  mensagens: string[];
  enviando?: never;
}

/** Nada para publicar. */
export interface ModalVazio {
  tipo: "vazio";
  enviando?: never;
}

/** A revisão não pôde ser preparada. */
export interface ModalDeFalha {
  tipo: "falha";
  titulo: string;
  detalhe: string;
  enviando?: never;
}

/** A revisão da publicação, com o motivo a informar. */
export interface ModalDeRevisao {
  tipo: "revisar";
  alteracoes: AlteracaoParaRevisar[];
  /** O que outro administrador mudou nos mesmos campos. */
  conflitos: ConflitoDaPublicacao[];
  linhas: LinhaDaConfiguracao[];
  paineis: LinhaDoPainel[];
  enviando: boolean;
  erro: string;
}

/** A restauração de uma versão do histórico. */
export interface ModalDeRestauracao {
  tipo: "restaurar";
  versao: VersaoDoHistorico;
  alteracoes: AlteracaoParaRevisar[];
  enviando: boolean;
  erro: string;
}

/** O diálogo aberto nas Configurações. */
export type ModalDasConfiguracoes =
  | ModalDeErros
  | ModalVazio
  | ModalDeFalha
  | ModalDeRevisao
  | ModalDeRestauracao;

/** O retrato do estado das Configurações (`estado.obter()`). */
export interface SnapshotDasConfiguracoes {
  /** Valores lidos da TB_CONFIGURACAO: Map chave → valor. */
  valores: ValoresDasConfiguracoes;
  carregado: boolean;
  /** Alterações das seções: Map chave → valor. */
  rascunho: Map<string, string>;
  /** Painéis externos lidos da TB_PAINEL_EXTERNO (normalizarPaineis). */
  paineis: readonly PainelExterno[];
  /** Alterações dos painéis: Map id → { titulo?, url?, ativo?, em_manutencao? }. */
  rascunhoDosPaineis: RascunhoDosPaineis;
  /** Seção aberta (id de SECOES, secoes.ts). */
  secao: string;
  salvando: boolean;
  /** Mensagens da última validação, e o erro de cada campo. */
  errosDaValidacao: readonly string[];
  errosDosCampos: Map<string, string>;
  modal: ModalDasConfiguracoes | null;
  historico: HistoricoDasConfiguracoes;
}

/** Opções de `criarEstadoDasConfiguracoes` (injetáveis para teste). */
export interface OpcoesDoEstadoDasConfiguracoes {
  supabase?: () => ClienteDasConfiguracoes | null;
  documento?: Document;
  confirmar?: (mensagem: string) => boolean;
  alertar?: (mensagem: string) => void;
  recarregar?: () => void;
}

/** O controlador do estado das Configurações. */
export type EstadoDasConfiguracoes = ReturnType<
  typeof criarEstadoDasConfiguracoes
>;

// ── Imagens da Aparência (imagens.ts) ───────────────────────────────────────

/** Uma imagem guardada no armazenamento (arte de fundo ou logo da barra). */
export interface ImagemGuardada {
  caminho: string;
  nome: string;
  url: string;
}

/** Uma galeria de imagens guardadas. */
export interface GaleriaDeImagens {
  status: StatusDoCarregamento;
  itens: ImagemGuardada[];
}

/** A ação de imagem em andamento ("" quando nenhuma). */
export type AcaoDaImagem = "enviar" | "restaurar" | "usar" | "apagar";

/** Resultado da última ação da logo. */
export interface AvisoDoLogo {
  texto: string;
  tom: "sucesso" | "erro";
}

/** O retrato das imagens da Aparência (`imagens.obter()`). */
export interface SnapshotDasImagens {
  /** Artes guardadas. */
  fundos: GaleriaDeImagens;
  /** Uma ação da arte em andamento. */
  fundoOcupado: AcaoDaImagem | "";
  /** Logos guardadas. */
  logos: GaleriaDeImagens;
  logoOcupado: AcaoDaImagem | "";
  avisoDoLogo: AvisoDoLogo | null;
}

/** Tom do aviso (toast) do app. */
export type TomDoToast = "error" | "warn";

/** O que as imagens leem e mudam no estado das Configurações. */
export type ConfiguracoesDasImagens = Pick<
  EstadoDasConfiguracoes,
  "obter" | "valor" | "mudarCampo" | "definirValoresPublicados"
>;

/** Opções de `criarImagensDaAparencia` (injetáveis para teste). */
export interface OpcoesDasImagens {
  supabase?: () => ClienteDasImagens | null;
  configuracoes: ConfiguracoesDasImagens;
  documento?: Document;
  avisar?: (mensagem: string, tipo?: TomDoToast) => unknown;
  confirmar?: (mensagem: string) => boolean;
}

/** O controlador das imagens da Aparência. */
export type ImagensDaAparencia = ReturnType<typeof criarImagensDaAparencia>;

/** Props das seções que entram por portal (configuracoes.tsx). */
export interface PropsDaSecaoNoPortal {
  estado: EstadoDasConfiguracoes;
  imagens: ImagensDaAparencia;
}

// ── Seções (secoes.ts) ──────────────────────────────────────────────────────

/** Os ids das seções de Configurações. */
export type IdDaSecaoDeConfiguracao =
  | "marca"
  | "inicio"
  | "acesso"
  | "aparencia"
  | "recursos"
  | "operacao"
  | "comemoracoes"
  | "acessos"
  | "modulos"
  | "cargas"
  | "automacao";

/** Uma seção de Configurações (item de SECOES). */
export interface SecaoDeConfiguracao {
  id: IdDaSecaoDeConfiguracao;
  rotulo: string;
  /** Ícone Font Awesome do cabeçalho. */
  icone: string;
  /** Ícone Lucide do menu lateral. */
  iconeDoMenu: string;
  descricao: string;
}

/** `detail` do evento EVENTO_SECAO_ABERTA. */
export interface DetalheDaSecaoAberta {
  secao: string;
}

/** O controlador de uma ilha React com bloco próprio (Acessos, Módulos...). */
export interface ControladorDeSecao {
  confirmarSaida(): boolean;
  render(): unknown;
}

/** O nome, em `window`, do controlador de cada ilha. */
export type NomeDoControladorDeSecao =
  | "acessosController"
  | "modulosController"
  | "saudeDasCargasController"
  | "automacaoController";
