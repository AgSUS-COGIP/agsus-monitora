/*
  A sessão do MONITORA — dona única da entrada, sem React.

  Estado assinável (`obter()` / `assinar(ouvinte)`, lido pela tela de entrada
  com `useSyncExternalStore` e pelo legado por assinatura) com tudo o que
  antes morava no começo do antigo legacy-app.js:

    - o arranque (`iniciar`): eventos do Supabase Auth, retorno do Google com
      `?code=` (PKCE, `exchangeCodeForSession`), `?auth=google` e
      `?auth_error=`, link de recuperação de senha e a sessão guardada;
    - o login Google: popup no computador, redirecionamento no celular e no
      iPad, a janela fechada sem concluir, o retorno pelo botão Voltar;
    - entrar direto com a conta já aberta no computador: o e-mail da última
      conta vai ao Google como `login_hint`, e a tela entra sozinha uma vez
      por aba (src/lib/sessao/entrada-direta.ts);
    - o domínio permitido, o perfil (`obter_contexto_monitora`, com
      `meu_usuario` de reserva) e a decisão entre abrir o sistema e mostrar o
      pedido de acesso (o sistema não concede acesso automático: quem não tem
      perfil ativo pede, e um administrador libera);
    - sair, limpar a sessão e a troca de usuário na mesma aba.

  O resto (navegação, carga dos dados, presença, auditoria) é do sistema
  (src/app/sistema.ts): ele se liga com `ligarSistema({...})` e é chamado nos
  pontos do contrato (docs/arquitetura-react.md, "Sessão ↔ sistema").

  Por que a sessão termina (manual, expirada, revogada) continua em
  src/lib/sessao/estado-de-saida.ts; "a sessão acabou mesmo?", em src/lib/sessao/sessao.ts.
*/

import {
  getOAuthCallbackUrl,
  isMobileOAuthContext,
  isUsableSession,
  LOGIN_POPUP_MESSAGE,
  openLoginPopup,
  iniciarOAuthPorRedirecionamento,
} from "../lib/sessao/auth-flow";
import {
  deveEntrarSozinho,
  esquecerConta,
  lembrarConta,
  lerUltimaConta,
  marcarSaidaVoluntaria,
  parametrosDoGoogle,
  reservarEntradaAutomatica,
} from "../lib/sessao/entrada-direta";
import { DEFAULT_ACCESS_BRANDING } from "../lib/entrada/access-branding.ts";
import { hasSupabaseEnv } from "../lib/sessao/env";
import {
  SAIDA_DESCONHECIDA,
  SAIDA_MANUAL,
  SAIDA_REVOGADA,
  causaDaSaida,
  declararSaida,
  encerrarTransicaoDeSaida,
  mensagemDaSaida,
  reivindicarSaida,
} from "../lib/sessao/estado-de-saida";
import {
  isAllowedInstitutionalEmail,
  normalizeAllowedDomains,
  normalizePlatformContext,
} from "../lib/navegacao/platform-context";
import { SESSAO_ATIVA, estadoDaSessao } from "../lib/sessao/sessao";
import { ehFalhaDeConexao } from "../lib/carga/falha-de-rede";
import type { PerfilGuardado } from "./perfil-guardado.ts";
import {
  getSupabaseAuthStorage,
  getSupabaseClient,
} from "../lib/sessao/supabaseClient";
import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";
import type { CausaDaSaida } from "../lib/sessao/estado-de-saida";
import type { PerfilDaPlataforma } from "../lib/navegacao/platform-context";

const RPC_CONTEXTO = "obter_contexto_monitora";
const RPC_MEU_USUARIO = "meu_usuario";

export const FASES = Object.freeze({
  /** Antes de saber se há sessão: a tela de acesso aparece como sempre. */
  INICIANDO: "iniciando",
  DESLOGADO: "deslogado",
  /** Sessão válida: perfil e dados carregando (skeleton da entrada). */
  ABRINDO: "abrindo",
  /** Entrou com Google, mas sem perfil ativo: o pedido de acesso. */
  SEM_ACESSO: "sem-acesso",
  /**
   * O perfil não pôde ser lido (ou a abertura quebrou): não é "sem acesso".
   * A tela de entrada oferece "Tentar de novo".
   */
  FALHA_NA_ENTRADA: "falha-na-entrada",
  CONECTADO: "conectado",
});

export const TEXTO_DO_BOTAO = DEFAULT_ACCESS_BRANDING.buttonText;
export const TEXTO_DO_BOTAO_OCUPADO = "Entrando no sistema…";
/** O botão na entrada automática (o e-mail lembrado). */
export const textoDaEntradaAutomatica = (email: string) =>
  `Entrando como ${email}…`;
/**
 * Quanto a entrada automática espera antes de ir ao Google: o bastante para
 * ver "Entrando como…" e clicar em "Usar outra conta".
 */
export const ESPERA_DA_ENTRADA_AUTOMATICA_MS = 1200;

export const MENSAGENS = Object.freeze({
  escolherConta: "Escolha sua conta institucional na janela do Google.",
  googleDesligado: "Login Google está desativado nas configurações do sistema.",
  falhaNoRetorno:
    "Não foi possível finalizar o login Google. Tente novamente escolhendo a conta.",
  sessaoIncompleta:
    "A sessão não foi concluída. Entre novamente com sua conta Google.",
  janelaFechada: "A janela do Google foi fechada antes de concluir o acesso.",
  falhaNoPopup: "Não foi possível concluir o acesso Google.",
  falhaNoCelular: "Não foi possível abrir o login Google. Tente novamente.",
  sessaoLimpa: "Sessão limpa. Escolha como deseja entrar.",
  aguardandoLiberacao:
    "Seu e-mail entrou com Google, mas ainda precisa ser liberado por um administrador.",
  permissoes: "Não foi possível verificar suas permissões. Tente novamente.",
  falhaAoAbrir: "Não foi possível abrir o sistema. Tente novamente.",
  semAmbiente:
    "Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY para conectar ao Supabase.",
  semConexao: "Não foi possível iniciar a conexão segura com o Supabase.",
});

/** Uma fase da entrada (valor de `FASES`). */
export type FaseDaSessao = (typeof FASES)[keyof typeof FASES];

/** A mensagem da tela de entrada; `tom` vazio = sem mensagem. */
export type MensagemDaEntrada = { texto: string; tom: string };

/** O que a entrada lê de TB_CONFIGURACAO (ver `configuracaoDaEntrada`). */
export type ConfiguracaoDaEntrada = {
  googleAtivo: boolean;
  textoDoBotao: string;
  dicaDeDominio: string;
  dominios: string[];
  mensagemDeSenha: string;
};

/** O perfil lido do banco e os painéis liberados. */
export type ContextoDoPerfil = {
  perfil: PerfilDaPlataforma;
  painelIds: string[];
  contextoCarregado: boolean;
};

/** O estado assinável da sessão. */
export type EstadoDaSessaoDoApp = {
  fase: FaseDaSessao;
  usuario: User | null;
  perfil: PerfilDaPlataforma | null;
  painelIds: string[];
  contextoCarregado: boolean;
  mensagem: MensagemDaEntrada;
  entrando: boolean;
  erroDeConfiguracao: string;
  consultarPedido: boolean;
  configuracao: ConfiguracaoDaEntrada;
  /**
   * Entrou sem rede, com o perfil guardado (src/lib/sessao/sessao-sem-rede.ts): o
   * perfil é conferido no banco quando a rede voltar.
   */
  semRede: boolean;
  /** O e-mail da última conta que entrou neste navegador ("" = nenhuma). */
  contaLembrada: string;
  /** A tela está entrando sozinha com a conta lembrada. */
  entradaAutomatica: boolean;
};

/** Como o botão pede o login ao Google. */
export type OpcoesDoLogin = {
  /** "Usar outra conta": esquece o e-mail e pede a escolha de conta. */
  escolherConta?: boolean;
  /** Entrada automática: redirecionamento (popup sem clique é bloqueado). */
  automatica?: boolean;
};

/** De onde veio a sessão que está entrando. */
export type OrigemDaEntrada =
  | "auth"
  | "boot"
  | "oauth"
  | "oauth_callback"
  | "oauth_popup"
  | "tentar_de_novo";

/**
 * Os ganchos que o sistema registra com `ligarSistema` (contrato
 * "Sessão ↔ sistema" em docs/arquitetura-react.md). Todos opcionais.
 */
export type GanchosDoSistema = {
  aoVerificar?: (dados: { usuario: User; origem: OrigemDaEntrada }) => unknown;
  abrir?: (
    dados: ContextoDoPerfil & { usuario: User; origem: OrigemDaEntrada },
  ) => unknown;
  aoAtualizarPerfil?: (dados: {
    perfil: PerfilDaPlataforma;
    painelIds: string[];
  }) => unknown;
  aoFicarSemAcesso?: (dados: { usuario: User | null }) => unknown;
  aoFalharNaEntrada?: (dados: { usuario: User | null }) => unknown;
  aoSair?: () => unknown;
  aoLimparSessao?: () => unknown;
  antesDeSair?: () => unknown;
  carregarConfiguracao?: () => unknown;
  mostrarEsqueleto?: () => unknown;
  encerrarEspera?: () => unknown;
};

type Gancho<K extends keyof GanchosDoSistema> = NonNullable<
  GanchosDoSistema[K]
>;

/** O armazenamento da sessão do Supabase (só a limpeza é usada aqui). */
type ArmazenamentoDaAutenticacao = { clearAuthState?: () => void } | null;

/** As dependências de `criarSessao`, injetáveis para os testes. */
export type DependenciasDaSessao = {
  cliente?: () => SupabaseClient | null;
  armazenamento?: () => ArmazenamentoDaAutenticacao;
  janela?: Window;
  temAmbiente?: () => boolean;
  celular?: () => boolean;
  agora?: () => number;
  esperar?: (ms: number) => Promise<unknown>;
  /** A cópia do perfil para entrar sem rede; `null` desliga. */
  perfilGuardado?: () => PerfilGuardado | null;
};

/** O usuário do Supabase Auth, na parte que dá nome à pessoa. */
type UsuarioComMetadados = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/** A mensagem que o popup do login (auth/callback.html) manda à página. */
type MensagemDoPopup = { type?: unknown; result?: unknown } | null | undefined;

export function mensagemDoDominio(dominios: string[]): string {
  return `Use uma conta institucional (${dominios.map((dominio) => `@${dominio}`).join(" ou ")}).`;
}

const SEM_MENSAGEM = Object.freeze({ texto: "", tom: "" });

/* O perfil não pôde ser lido: diferente de "sem perfil" (`null`). */
const PERFIL_ILEGIVEL: Readonly<{ ilegivel: true }> = Object.freeze({
  ilegivel: true,
});
/* A leitura do perfil falhou por falta de rede: serve o perfil guardado. */
const PERFIL_SEM_REDE: Readonly<{ semRede: true }> = Object.freeze({
  semRede: true,
});

/* A cópia do perfil (IndexedDB) baixa sob demanda: fora do pedaço da entrada. */
let perfilGuardadoPadrao: Promise<PerfilGuardado> | null = null;
const carregarPerfilGuardado = () =>
  (perfilGuardadoPadrao ??= import("./perfil-guardado.ts").then((m) =>
    m.criarPerfilGuardado(),
  ));
const PERFIL_GUARDADO_DO_APP: PerfilGuardado = Object.freeze({
  ler: (usuarioId: string) =>
    carregarPerfilGuardado()
      .then((p) => p.ler(usuarioId))
      .catch(() => null),
  guardar: (
    usuarioId: string,
    contexto: Parameters<PerfilGuardado["guardar"]>[1],
  ) =>
    carregarPerfilGuardado()
      .then((p) => p.guardar(usuarioId, contexto))
      .catch(() => false),
});
const perfilGuardadoDoApp = () => PERFIL_GUARDADO_DO_APP;

/* As chaves de TB_CONFIGURACAO que a entrada usa, com o padrão de quando não vieram. */
const CONFIGURACAO_PADRAO = Object.freeze({
  auth_google_enabled: "true",
  auth_google_button_text: "",
  auth_google_domain_hint: "",
  auth_google_allowed_domains: "agenciasus.org.br,agsus.org.br",
  password_reset_message: "",
});

function lerBooleano(valor: unknown, padrao: boolean): boolean {
  const texto = String(valor ?? "")
    .trim()
    .toLowerCase();
  if (["true", "1", "sim", "yes", "on"].includes(texto)) return true;
  if (["false", "0", "nao", "não", "no", "off"].includes(texto)) return false;
  return padrao;
}

/**
 * O que a entrada precisa da configuração. `valores` traz só as chaves que
 * vieram do banco (as outras ficam no padrão, como o `cfgValue` do legado).
 */
export function configuracaoDaEntrada(
  valores: Record<string, unknown> = {},
): ConfiguracaoDaEntrada {
  const lido = (chave: keyof typeof CONFIGURACAO_PADRAO): string =>
    Object.hasOwn(valores, chave)
      ? String(valores[chave] ?? "")
      : CONFIGURACAO_PADRAO[chave];
  return {
    googleAtivo: lerBooleano(lido("auth_google_enabled"), true),
    textoDoBotao: lido("auth_google_button_text").trim(),
    dicaDeDominio: lido("auth_google_domain_hint").trim(),
    dominios: normalizeAllowedDomains(lido("auth_google_allowed_domains")),
    mensagemDeSenha: lido("password_reset_message"),
  };
}

/** O nome que o Google deu à pessoa (preenche o pedido de acesso). */
export function nomeDoUsuario(
  usuario: UsuarioComMetadados | null | undefined,
): string {
  const meta: Record<string, unknown> = usuario?.user_metadata || {};
  return String(
    meta.full_name ||
      meta.name ||
      meta.nome ||
      usuario?.email?.split("@")[0] ||
      "",
  ).trim();
}

function sessionStorageDe(janela: Window | null | undefined): Storage | null {
  try {
    return janela?.sessionStorage || null;
  } catch {
    return null;
  }
}

function localStorageDe(janela: Window | null | undefined): Storage | null {
  try {
    return janela?.localStorage || null;
  } catch {
    return null;
  }
}

const esperarPadrao = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cria o estado da sessão. As dependências são injetáveis para os testes; o
 * app usa a instância única `sessaoDoApp`, logo abaixo.
 */
export function criarSessao({
  cliente = getSupabaseClient,
  armazenamento = getSupabaseAuthStorage,
  janela = globalThis.window,
  temAmbiente = hasSupabaseEnv,
  celular = () => isMobileOAuthContext(),
  agora = () => Date.now(),
  esperar = esperarPadrao,
  perfilGuardado = perfilGuardadoDoApp,
}: DependenciasDaSessao = {}) {
  let estado: EstadoDaSessaoDoApp = {
    fase: FASES.INICIANDO,
    usuario: null,
    perfil: null,
    painelIds: [],
    contextoCarregado: false,
    mensagem: SEM_MENSAGEM,
    entrando: false,
    erroDeConfiguracao: "",
    consultarPedido: true,
    configuracao: configuracaoDaEntrada(),
    semRede: false,
    contaLembrada: lerUltimaConta(localStorageDe(janela))?.email || "",
    entradaAutomatica: false,
  };
  const ouvintes = new Set<() => void>();
  let sistema: GanchosDoSistema = {};
  let sb: SupabaseClient | null = null;
  let iniciado = false;
  let ouvintesDaJanela = false;
  let trocandoCodigo = false;
  let vigiaDoPopup: number | null = null;
  let tentativaDoPopup = 0;
  let usuarioCarregado = "";
  let ultimoSignedIn = 0;
  let carregamento: Promise<void> | null = null;
  /* Cada entrada automática (ou clique que a cancela) ganha um número novo. */
  let tentativaAutomatica = 0;

  function definir(parcial: Partial<EstadoDaSessaoDoApp>) {
    estado = { ...estado, ...parcial };
    ouvintes.forEach((ouvinte) => ouvinte());
  }

  function chamar<K extends keyof GanchosDoSistema>(
    gancho: K,
    ...argumentos: Parameters<Gancho<K>>
  ): unknown {
    const funcao = sistema?.[gancho] as
      ((...lista: Parameters<Gancho<K>>) => unknown) | undefined;
    return typeof funcao === "function" ? funcao(...argumentos) : undefined;
  }

  function obterCliente() {
    if (!sb) sb = cliente() || null;
    return sb;
  }

  function mostrarMensagem(texto: string, tom = "warn") {
    definir({ mensagem: texto ? { texto, tom } : SEM_MENSAGEM });
  }

  // ── Endereço (o que o Google e o Supabase deixam na URL) ────────────────

  const parametros = () => new URLSearchParams(janela?.location?.search || "");
  const parametrosDoHash = () =>
    new URLSearchParams(String(janela?.location?.hash || "").replace(/^#/, ""));

  function limparEndereco() {
    janela?.history?.replaceState?.(
      {},
      janela.document?.title || "",
      janela.location.pathname,
    );
  }

  /*
    O retorno do Google também traz `?code=`; isso não é recuperação de
    senha. Só conta quando o tipo vem como `recovery` ou com `reset=1`.
  */
  function temParametrosDeRecuperacao() {
    const qs = parametros();
    return (
      qs.get("reset") === "1" ||
      qs.get("type") === "recovery" ||
      parametrosDoHash().get("type") === "recovery"
    );
  }

  /*
    O Sair confirmado volta ao endereço inicial: quem sai terminou, e quem
    entrar depois no mesmo navegador não começa na última página da pessoa
    anterior. A sessão expirada e o link aberto sem login guardam o endereço
    (a navegação o abre depois de entrar).
  */
  function voltarAoInicio() {
    janela?.history?.replaceState?.({}, janela.document?.title || "", "/");
  }

  function limparEnderecoDoOAuth() {
    const qs = parametros();
    const hash = parametrosDoHash();
    if (
      qs.has("code") ||
      qs.has("auth") ||
      qs.has("auth_error") ||
      hash.has("access_token") ||
      hash.has("refresh_token")
    )
      limparEndereco();
  }

  // ── Saída ───────────────────────────────────────────────────────────────

  /** Há uma saída em curso? Enquanto houver, a sessão não reabre o sistema. */
  const saidaEmCurso = () => causaDaSaida() !== SAIDA_DESCONHECIDA;

  function redefinirDeslogado(mensagem: MensagemDaEntrada = SEM_MENSAGEM) {
    usuarioCarregado = "";
    ultimoSignedIn = 0;
    definir({
      fase: FASES.DESLOGADO,
      usuario: null,
      perfil: null,
      painelIds: [],
      contextoCarregado: false,
      entrando: false,
      consultarPedido: true,
      mensagem,
    });
    chamar("aoSair");
  }

  /*
    Dono único da transição para o estado deslogado: o evento `SIGNED_OUT`,
    o botão Sair e as recusas passam todos por aqui, e `reivindicarSaida()`
    garante que ela só é aplicada uma vez (a causa dura até o próximo
    `SIGNED_IN`).
  */
  function aplicarSaida(
    opcoes: { causa?: CausaDaSaida; mensagem?: string; tom?: string } = {},
  ) {
    if (opcoes.causa) declararSaida(opcoes.causa);
    if (!reivindicarSaida()) return false;
    const texto =
      opcoes.mensagem !== undefined ? opcoes.mensagem : mensagemDaSaida();
    redefinirDeslogado(
      texto ? { texto, tom: opcoes.tom || "warn" } : SEM_MENSAGEM,
    );
    return true;
  }

  /*
    Sai com uma mensagem que tem de aparecer. O `signOut()` emite
    `SIGNED_OUT` antes de voltar, e o ouvinte aplica a saída primeiro (com a
    mensagem genérica da causa); no legado, a frase específica — o domínio
    recusado, o aviso da recuperação de senha — se perdia ali.
  */
  async function sairComMensagem(
    causa: CausaDaSaida,
    texto: string,
    tom: string,
    { local = true }: { local?: boolean } = {},
  ) {
    declararSaida(causa);
    try {
      await obterCliente()?.auth.signOut(
        local ? { scope: "local" } : undefined,
      );
    } catch {
      /* Sem rede: o estado local é limpo do mesmo jeito. */
    }
    aplicarSaida({ mensagem: texto, tom });
    if (texto) mostrarMensagem(texto, tom);
  }

  async function limparAutenticacaoLocal() {
    usuarioCarregado = "";
    ultimoSignedIn = 0;
    carregamento = null;
    definir({ usuario: null, perfil: null, painelIds: [] });
    try {
      armazenamento()?.clearAuthState?.();
    } catch {
      /* Armazenamento bloqueado. */
    }
    try {
      sessionStorageDe(janela)?.removeItem("agsus_oauth_callback_ok");
    } catch {
      /* Armazenamento bloqueado. */
    }
    try {
      await obterCliente()?.auth?.signOut({ scope: "local" });
    } catch {
      /* Sem sessão para encerrar. */
    }
    limparEnderecoDoOAuth();
  }

  // ── Perfil ──────────────────────────────────────────────────────────────

  /**
   * O perfil de quem entrou. `null` = sem perfil (pedido de acesso);
   * `PERFIL_ILEGIVEL` = a leitura falhou (rede, banco): não se sabe se há
   * perfil, e a pessoa não deve cair no pedido de acesso por isso.
   */
  async function carregarPerfil(): Promise<
    ContextoDoPerfil | typeof PERFIL_ILEGIVEL | typeof PERFIL_SEM_REDE | null
  > {
    const client = obterCliente()!;
    const { data, error } = await client.rpc(RPC_CONTEXTO);
    if (error) {
      console.warn("Falha ao ler o contexto do usuário:", error);
      return ehFalhaDeConexao(error) ? PERFIL_SEM_REDE : PERFIL_ILEGIVEL;
    }
    const contexto = normalizePlatformContext(data);
    if (contexto) {
      const lido = {
        perfil: contexto.profile,
        painelIds: contexto.panelIds,
        contextoCarregado: true,
      };
      // A cópia para entrar sem rede renova a cada leitura com rede.
      const id = estado.usuario?.id;
      if (id) void perfilGuardado()?.guardar(id, lido);
      return lido;
    }
    // Sem contexto unificado: o contrato antigo. Um contexto ausente não revive
    // perfil desativado nem as permissões amplas do legado.
    const reserva = await client.rpc(RPC_MEU_USUARIO);
    if (reserva.error) {
      console.warn("Perfil indisponível para o usuário atual:", reserva.error);
      return ehFalhaDeConexao(reserva.error)
        ? PERFIL_SEM_REDE
        : PERFIL_ILEGIVEL;
    }
    const linha: Record<string, unknown> | null = Array.isArray(reserva.data)
      ? reserva.data[0] || null
      : reserva.data || null;
    if (!linha) return null;
    return {
      perfil: { ...linha, ativo: linha.ativo !== false, permissoes: {} },
      painelIds: [],
      contextoCarregado: false,
    };
  }

  function ficarSemAcesso({
    consultar = true,
    mensagem = "",
  }: { consultar?: boolean; mensagem?: string } = {}) {
    definir({
      fase: FASES.SEM_ACESSO,
      perfil: null,
      painelIds: [],
      contextoCarregado: false,
      consultarPedido: consultar,
      mensagem: mensagem ? { texto: mensagem, tom: "warn" } : SEM_MENSAGEM,
    });
    chamar("aoFicarSemAcesso", { usuario: estado.usuario });
  }

  /*
    A leitura do perfil (ou a abertura) falhou: a tela de entrada mostra o
    erro e "Tentar de novo". O sistema fica fechado, como no pedido de acesso.
  */
  function falharNaEntrada(texto: string) {
    definir({
      fase: FASES.FALHA_NA_ENTRADA,
      perfil: null,
      painelIds: [],
      contextoCarregado: false,
      mensagem: { texto, tom: "error" },
    });
    chamar("aoFalharNaEntrada", { usuario: estado.usuario });
  }

  // ── Entrar ──────────────────────────────────────────────────────────────

  function jaAberto(sessao: Session | null | undefined) {
    const id = sessao?.user?.id || "";
    return (
      Boolean(id) &&
      estado.usuario?.id === id &&
      usuarioCarregado === id &&
      estado.fase === FASES.CONECTADO
    );
  }

  async function abrirSessao(sessao: Session, origem: OrigemDaEntrada) {
    const usuario = sessao.user;
    // O legado liga o skeleton e começa a ler a cópia da sessão junto com o perfil.
    chamar("aoVerificar", { usuario, origem });
    let contexto = await carregarPerfil();
    /*
      Sem rede: o perfil guardado na última entrada com rede (até 48 h). Sem
      ele, o erro de sempre. Quando a rede voltar, o perfil é conferido.
    */
    const semRede = contexto === PERFIL_SEM_REDE;
    if (semRede)
      contexto =
        ((await perfilGuardado()?.ler(
          usuario.id,
        )) as ContextoDoPerfil | null) ?? PERFIL_ILEGIVEL;
    if (contexto === PERFIL_ILEGIVEL || contexto === PERFIL_SEM_REDE) {
      falharNaEntrada(MENSAGENS.permissoes);
      return;
    }
    if (!contexto) {
      ficarSemAcesso({ consultar: true });
      return;
    }
    // `===` não estreita objetos: aqui já não é PERFIL_ILEGIVEL.
    definir({
      perfil: (contexto as ContextoDoPerfil).perfil,
      painelIds: (contexto as ContextoDoPerfil).painelIds,
      contextoCarregado: (contexto as ContextoDoPerfil).contextoCarregado,
    });
    const aberto = await chamar("abrir", {
      usuario,
      perfil: (contexto as ContextoDoPerfil).perfil,
      painelIds: (contexto as ContextoDoPerfil).painelIds,
      contextoCarregado: (contexto as ContextoDoPerfil).contextoCarregado,
      origem,
    });
    if (aberto) {
      usuarioCarregado = usuario.id;
      definir({ fase: FASES.CONECTADO, mensagem: SEM_MENSAGEM, semRede });
    } else if (estado.fase === FASES.ABRINDO) {
      // Os dados não vieram (o legado já avisou): fica a tela de acesso.
      definir({ fase: FASES.DESLOGADO });
    }
  }

  /**
   * Uma sessão válida chegou (arranque, retorno do Google, popup, evento).
   * Confere o domínio, evita recarregar o mesmo usuário e carrega uma vez só.
   */
  async function entrar(
    sessao: Session | null | undefined,
    origem: OrigemDaEntrada = "auth",
  ): Promise<void> {
    if (!isUsableSession(sessao) || saidaEmCurso()) return;

    const { dominios } = estado.configuracao;
    // `isUsableSession` não é guarda de tipo: daqui em diante há sessão.
    if (!isAllowedInstitutionalEmail(sessao!.user?.email, dominios)) {
      await sairComMensagem(
        SAIDA_REVOGADA,
        mensagemDoDominio(dominios),
        "error",
      );
      return;
    }

    // A conta entrou: na próxima vez, o Google a recebe como sugestão.
    lembrarConta(localStorageDe(janela), sessao!.user?.email);
    const lembrada = lerUltimaConta(localStorageDe(janela))?.email || "";
    if (lembrada && estado.contaLembrada !== lembrada)
      definir({ contaLembrada: lembrada });

    /*
      O Supabase emite SIGNED_IN de novo quando a aba volta ao foco ou a
      sessão é sincronizada entre abas: com o sistema aberto para o mesmo
      usuário, não recomeça. Outro usuário (troca de conta em outra aba)
      recarrega tudo.
    */
    if (jaAberto(sessao)) {
      definir({ usuario: sessao!.user });
      return;
    }
    if (carregamento) return carregamento;

    // Entrar encerra a transição de saída, venha ou não o SIGNED_IN nesta aba.
    encerrarTransicaoDeSaida();
    definir({ usuario: sessao!.user, fase: FASES.ABRINDO });
    carregamento = abrirSessao(sessao!, origem);
    try {
      await carregamento;
    } catch (erro) {
      console.error("Falha ao finalizar login:", erro);
      falharNaEntrada(MENSAGENS.falhaAoAbrir);
    } finally {
      limparEnderecoDoOAuth();
      carregamento = null;
      // Rede de segurança: aconteça o que acontecer, a entrada não fica no skeleton.
      chamar("encerrarEspera");
      definir({ entrando: false });
    }
  }

  async function esperarSessao(
    idEsperado = "",
    limiteMs = 5000,
  ): Promise<Session | null> {
    const client = obterCliente()!;
    const inicio = agora();
    while (agora() - inicio < limiteMs) {
      const { data } = await client.auth.getSession();
      if (isUsableSession(data?.session, idEsperado)) return data.session;
      await esperar(150);
    }
    const { data } = await client.auth.getSession();
    return isUsableSession(data?.session, idEsperado) ? data.session : null;
  }

  /** `?code=` no próprio index (PKCE). Devolve true se tratou o retorno. */
  async function trocarCodigoDoOAuth() {
    const codigo = parametros().get("code");
    if (!codigo) return false;
    chamar("mostrarEsqueleto");
    trocandoCodigo = true;
    try {
      const { data, error } =
        await obterCliente()!.auth.exchangeCodeForSession(codigo);
      if (error) throw error;
      const sessao = isUsableSession(data?.session)
        ? data.session
        : await esperarSessao(data?.user?.id || "");
      if (!isUsableSession(sessao))
        throw new Error("Sessão não encontrada após retorno do Google.");
      await entrar(sessao, "oauth_callback");
      return true;
    } catch (erro) {
      console.error("Falha no callback OAuth:", erro);
      limparEnderecoDoOAuth();
      chamar("encerrarEspera");
      redefinirDeslogado({ texto: MENSAGENS.falhaNoRetorno, tom: "error" });
      return true;
    } finally {
      trocandoCodigo = false;
    }
  }

  async function recarregarPerfil(sessao?: Session | null) {
    definir({ usuario: sessao?.user || null });
    if (!estado.usuario || estado.fase !== FASES.CONECTADO) return;
    try {
      const contexto = await carregarPerfil();
      // Leitura falhou com o sistema aberto: fica o perfil que já estava.
      if (contexto === PERFIL_ILEGIVEL || contexto === PERFIL_SEM_REDE) return;
      if (!contexto) {
        ficarSemAcesso({ consultar: true });
        return;
      }
      definir({
        semRede: false,
        perfil: (contexto as ContextoDoPerfil).perfil,
        painelIds: (contexto as ContextoDoPerfil).painelIds,
        contextoCarregado: (contexto as ContextoDoPerfil).contextoCarregado,
      });
      await chamar("aoAtualizarPerfil", {
        perfil: (contexto as ContextoDoPerfil).perfil,
        painelIds: (contexto as ContextoDoPerfil).painelIds,
      });
    } catch (erro) {
      console.error("Falha ao atualizar perfil:", erro);
    }
  }

  function aoMudarAutenticacao(
    evento: AuthChangeEvent,
    sessao: Session | null,
  ) {
    if (evento === "PASSWORD_RECOVERY") {
      definir({ usuario: null });
      limparEndereco();
      // Causa manual: o `SIGNED_OUT` que vem a seguir não é expiração.
      void sairComMensagem(
        SAIDA_MANUAL,
        estado.configuracao.mensagemDeSenha,
        "warn",
        { local: false },
      );
      return;
    }
    if (evento === "SIGNED_OUT") {
      /*
        A causa não é consumida aqui: um segundo `SIGNED_OUT` — que o
        Supabase emite em mais de uma situação — continua sendo a mesma saída,
        e não vira "sessão expirada" depois de sair pelo botão.
      */
      aplicarSaida();
      return;
    }
    if (evento === "TOKEN_REFRESHED") {
      definir({ usuario: sessao?.user || estado.usuario });
      return;
    }
    if (evento === "USER_UPDATED") {
      setTimeout(() => void recarregarPerfil(sessao), 0);
    }
    if (evento === "SIGNED_IN") {
      encerrarTransicaoDeSaida();
      if (trocandoCodigo) return;
      if (jaAberto(sessao)) {
        definir({ usuario: sessao!.user });
        return;
      }
      const id = sessao?.user?.id || "";
      const instante = agora();
      if (id && estado.usuario?.id === id && instante - ultimoSignedIn < 1500)
        return;
      ultimoSignedIn = instante;
      setTimeout(() => void entrar(sessao, "oauth"), 0);
    }
  }

  // ── Login Google ────────────────────────────────────────────────────────

  function liberarBotao(mensagem?: MensagemDaEntrada) {
    tentativaAutomatica++;
    definir({
      entrando: false,
      entradaAutomatica: false,
      ...(mensagem ? { mensagem } : {}),
    });
  }

  function pararVigiaDoPopup() {
    if (vigiaDoPopup === null) return;
    janela.clearInterval(vigiaDoPopup);
    vigiaDoPopup = null;
  }

  /*
    Espera a sessão que o popup deixou no armazenamento e entra; sem ela, o
    botão volta com `mensagem`. Uma tentativa mais nova (a mensagem do popup
    chegou enquanto o vigia esperava) torna esta sem efeito.
  */
  async function concluirPeloPopup(
    tentativa: number,
    limiteMs: number,
    mensagem: MensagemDaEntrada,
  ) {
    try {
      const sessao = await esperarSessao("", limiteMs);
      if (tentativa !== tentativaDoPopup) return;
      if (isUsableSession(sessao)) {
        await entrar(sessao, "oauth_popup");
        return;
      }
      liberarBotao(mensagem);
    } catch (erro) {
      console.error("Falha ao concluir o login pelo popup:", erro);
      if (tentativa === tentativaDoPopup)
        liberarBotao({ texto: MENSAGENS.falhaNoPopup, tom: "error" });
    }
  }

  /* A janela fechada sem a mensagem do popup: a pessoa desistiu. */
  function vigiarPopup(popup: Window) {
    pararVigiaDoPopup();
    const tentativa = ++tentativaDoPopup;
    vigiaDoPopup = janela.setInterval(() => {
      if (!popup.closed) return;
      pararVigiaDoPopup();
      void concluirPeloPopup(tentativa, 1400, {
        texto: MENSAGENS.janelaFechada,
        tom: "warn",
      });
    }, 400);
  }

  /*
    O popup (auth/callback.html) avisa aqui como terminou (`result`). Deu certo,
    a sessão chega pelo armazenamento compartilhado; deu errado, a mensagem é
    imediata. Nos dois casos o vigia da janela sai: ela fechou por conclusão,
    não por desistência.
  */
  async function aoReceberMensagem(evento: MessageEvent<MensagemDoPopup>) {
    if (evento.origin !== janela.location.origin) return;
    if (evento.data?.type !== LOGIN_POPUP_MESSAGE) return;
    pararVigiaDoPopup();
    const tentativa = ++tentativaDoPopup;
    // A mesma mensagem do retorno com `?auth_error=` (login sem popup).
    if (evento.data!.result !== "success") {
      liberarBotao({ texto: MENSAGENS.falhaNoRetorno, tom: "error" });
      return;
    }
    await concluirPeloPopup(tentativa, 5000, {
      texto: MENSAGENS.falhaNoPopup,
      tom: "error",
    });
  }

  /*
    Abaixo de 768 px não há popup: o login é um redirecionamento de página
    inteira. Se a pessoa cancela ou usa o Voltar, o navegador restaura esta
    página (muitas vezes do bfcache) com o botão ainda ocupado. Sem sessão,
    o botão volta.
  */
  function aoMostrarPagina(evento: PageTransitionEvent) {
    const restauradaDoCache = evento.persisted;
    const veioDoHistorico =
      (
        janela.performance?.getEntriesByType?.("navigation")?.[0] as
          PerformanceNavigationTiming | undefined
      )?.type === "back_forward";
    if (!restauradaDoCache && !veioDoHistorico) return;
    if (!estado.entrando) return;
    void (async () => {
      const { estado: situacao } = await estadoDaSessao(obterCliente());
      if (situacao === SESSAO_ATIVA) return;
      liberarBotao();
    })();
  }

  function instalarOuvintesDaJanela() {
    if (ouvintesDaJanela || !janela?.addEventListener) return;
    ouvintesDaJanela = true;
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- devolve a promessa de propósito (o teste aguarda o login entrar); o navegador ignora o retorno.
    janela.addEventListener("message", aoReceberMensagem);
    janela.addEventListener("pageshow", aoMostrarPagina);
    janela.addEventListener("online", () => void conferirDepoisDaRede());
  }

  /*
    Entrou sem rede com o perfil guardado: a rede voltou, o perfil é conferido
    no banco. Sem acesso, o app fecha e as cópias saem (`ficarSemAcesso`).
  */
  async function conferirDepoisDaRede() {
    if (!estado.semRede || estado.fase !== FASES.CONECTADO) return;
    try {
      const { data } = await obterCliente()!.auth.getSession();
      if (data?.session) await recarregarPerfil(data.session);
    } catch (erro) {
      console.warn("Falha ao conferir o perfil depois da rede:", erro);
    }
  }

  async function entrarComGoogle({
    escolherConta = false,
    automatica = false,
  }: OpcoesDoLogin = {}) {
    // Um clique (ou "Usar outra conta") cancela a entrada automática que espera.
    if (!automatica) tentativaAutomatica++;
    const client = obterCliente();
    if (!client) {
      definir({ erroDeConfiguracao: MENSAGENS.semConexao });
      return;
    }
    if (!estado.configuracao.googleAtivo) {
      mostrarMensagem(MENSAGENS.googleDesligado, "error");
      return;
    }

    if (escolherConta) {
      esquecerConta(localStorageDe(janela));
      definir({ contaLembrada: "", entradaAutomatica: false });
    }
    const queryParams = parametrosDoGoogle({
      dicaDeDominio: estado.configuracao.dicaDeDominio,
      email: estado.contaLembrada,
      escolherConta,
    });

    if (automatica || celular()) {
      definir({ entrando: true });
      try {
        await iniciarOAuthPorRedirecionamento({
          client,
          authStorage: armazenamento(),
          locationRef: janela.location,
          sessionStorageRef: sessionStorageDe(janela),
          queryParams,
        });
      } catch (erro) {
        liberarBotao({
          texto: (erro as Error | null)?.message || MENSAGENS.falhaNoCelular,
          tom: "error",
        });
      }
      return;
    }

    // A janela vazia nasce no próprio clique (antes de qualquer espera) para
    // o navegador não bloqueá-la enquanto a URL segura do Supabase é pedida.
    const popup = openLoginPopup(janela);
    // Troca de perfil e testes: a sessão local sai antes do OAuth.
    await limparAutenticacaoLocal();
    definir({
      entrando: true,
      entradaAutomatica: false,
      // Com o e-mail lembrado, o Google em geral nem mostra a escolha.
      mensagem: queryParams.login_hint
        ? SEM_MENSAGEM
        : { texto: MENSAGENS.escolherConta, tom: "warn" },
    });
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getOAuthCallbackUrl(janela.location),
        queryParams,
        ...(popup ? { skipBrowserRedirect: true } : {}),
      },
    });
    if (error) {
      try {
        popup?.close();
      } catch {
        /* Popup já fechado. */
      }
      liberarBotao({
        texto: "Falha ao iniciar login Google: " + error.message,
        tom: "error",
      });
      return;
    }
    if (popup && data?.url) {
      popup.location.replace(data.url);
      vigiarPopup(popup);
    }
  }

  /*
    Entrada automática: este navegador já entrou antes (há e-mail lembrado),
    não há sessão nem nada a mostrar e a pessoa não clicou em Sair depois.
    Uma tentativa por aba: se falhar ou voltar com erro, fica a tela normal.
    Espera um pouco com "Entrando como <e-mail>…" no botão, para dar tempo de
    "Usar outra conta", e vai ao Google por redirecionamento.
  */
  async function entrarSozinho() {
    const conta = lerUltimaConta(localStorageDe(janela));
    if (
      estado.fase !== FASES.DESLOGADO ||
      !conta ||
      !deveEntrarSozinho({
        conta,
        googleAtivo: estado.configuracao.googleAtivo,
        temMensagem: Boolean(
          estado.mensagem.texto || estado.erroDeConfiguracao,
        ),
      }) ||
      !reservarEntradaAutomatica(sessionStorageDe(janela))
    )
      return;
    const tentativa = ++tentativaAutomatica;
    definir({
      contaLembrada: conta.email,
      entrando: true,
      entradaAutomatica: true,
    });
    await esperar(ESPERA_DA_ENTRADA_AUTOMATICA_MS);
    if (tentativa !== tentativaAutomatica || estado.fase !== FASES.DESLOGADO)
      return;
    await entrarComGoogle({ automatica: true });
  }

  // ── Arranque ────────────────────────────────────────────────────────────

  async function iniciar() {
    if (iniciado) return;
    iniciado = true;
    instalarOuvintesDaJanela();

    const client = temAmbiente() ? obterCliente() : null;
    if (!client) {
      definir({
        fase: FASES.DESLOGADO,
        erroDeConfiguracao: temAmbiente()
          ? MENSAGENS.semConexao
          : MENSAGENS.semAmbiente,
      });
      chamar("encerrarEspera");
      return;
    }

    client.auth.onAuthStateChange(aoMudarAutenticacao);
    // Domínios, Google ligado e textos vêm de TB_CONFIGURACAO (o legado carrega).
    try {
      await chamar("carregarConfiguracao");
    } catch (erro) {
      console.warn("Falha ao carregar a configuração da entrada:", erro);
    }

    if (await trocarCodigoDoOAuth()) return;

    const qs = parametros();
    const erroNoRetorno = qs.get("auth_error");
    const daVolta = qs.get("auth") === "google" ? await esperarSessao() : null;
    const { data } = daVolta
      ? { data: { session: daVolta } }
      : await client.auth.getSession();

    if (temParametrosDeRecuperacao()) {
      definir({ usuario: null });
      limparEndereco();
      await sairComMensagem(
        SAIDA_MANUAL,
        estado.configuracao.mensagemDeSenha,
        "warn",
        { local: false },
      );
      return;
    }

    if (isUsableSession(data?.session)) {
      await entrar(data!.session, "boot");
      return;
    }

    // A sessão guardada expirou (ou não há): o skeleton do <head> dá lugar ao login.
    chamar("encerrarEspera");
    if (estado.fase === FASES.INICIANDO) definir({ fase: FASES.DESLOGADO });
    if (erroNoRetorno) {
      mostrarMensagem(MENSAGENS.falhaNoRetorno, "error");
      limparEnderecoDoOAuth();
    } else if (data?.session) {
      redefinirDeslogado({ texto: MENSAGENS.sessaoIncompleta, tom: "warn" });
    }
    // Sem esperar: o arranque termina com a tela de acesso desenhada.
    void entrarSozinho();
  }

  // ── Sair e limpar ───────────────────────────────────────────────────────

  /*
    Saída voluntária. Declara a causa e pede o `signOut()`; quem transforma o
    app em estado deslogado é o ouvinte de `SIGNED_OUT`. A chamada final é
    rede de segurança: só age se o evento não tiver chegado, sem mensagem.
    O e-mail lembrado fica (o botão o leva como sugestão), mas a tela não
    entra mais sozinha até a próxima entrada.
  */
  async function sair() {
    try {
      // Auditoria, Realtime e o cache do painel de análises (legado).
      await chamar("antesDeSair");
    } catch (erro) {
      console.warn("Falha antes de sair:", erro);
    }
    marcarSaidaVoluntaria(localStorageDe(janela));
    declararSaida(SAIDA_MANUAL);
    await encerrarNoSupabase();
    aplicarSaida();
    voltarAoInicio();
  }

  /*
    Pede o signOut e garante que o token sai do navegador mesmo se ele falhar.
    Com o token vencido e a rede fora, a auth-js devolve `{ error }` sem apagar
    a sessão guardada: a tela diria "deslogado", e quem abrisse o Yeendé
    depois, com rede, entraria como a pessoa anterior.

    Só neste navegador (`scope: "local"`): a sessão deste aparelho é revogada
    no servidor e as dos outros navegadores da pessoa continuam. O link de
    recuperação de senha segue derrubando todas (`sairComMensagem` com
    `local: false`); a conta desativada é barrada pelo banco em qualquer
    navegador (perfil inativo), sem depender de signOut.
  */
  async function encerrarNoSupabase() {
    const client = obterCliente();
    if (!client) return;
    let falhou = false;
    try {
      const { error } = await client.auth.signOut({ scope: "local" });
      falhou = Boolean(error);
      if (error) console.warn("Falha ao encerrar a sessão no Supabase:", error);
    } catch (erro) {
      falhou = true;
      console.warn("Falha ao encerrar a sessão no Supabase:", erro);
    }
    if (!falhou) return;
    try {
      armazenamento()?.clearAuthState?.();
    } catch {
      /* Armazenamento bloqueado. */
    }
  }

  /** "Tentar de novo" depois de uma falha na entrada: relê a sessão guardada e entra. */
  async function tentarDeNovo() {
    if (estado.fase !== FASES.FALHA_NA_ENTRADA) return;
    const client = obterCliente()!;
    definir({ mensagem: SEM_MENSAGEM });
    try {
      const { data } = await client.auth.getSession();
      if (isUsableSession(data?.session)) {
        await entrar(data.session, "tentar_de_novo");
        return;
      }
    } catch (erro) {
      console.warn("Falha ao reler a sessão:", erro);
    }
    redefinirDeslogado({ texto: MENSAGENS.sessaoIncompleta, tom: "warn" });
  }

  /** "Sair" do pedido de acesso: limpa tudo, inclusive a cópia da sessão. */
  async function limparSessao() {
    marcarSaidaVoluntaria(localStorageDe(janela));
    await limparAutenticacaoLocal();
    await chamar("aoLimparSessao");
    declararSaida(SAIDA_MANUAL);
    await encerrarNoSupabase();
    aplicarSaida({ mensagem: "" });
    mostrarMensagem(MENSAGENS.sessaoLimpa, "ok");
  }

  return {
    obter: () => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    /** O legado registra os ganchos do contrato (ver docs/arquitetura-react.md). */
    ligarSistema(adaptador: GanchosDoSistema | null | undefined) {
      sistema = adaptador || {};
    },
    /** O legado repassa o que carregou de TB_CONFIGURACAO. */
    definirConfiguracao(valores?: Record<string, unknown>) {
      definir({ configuracao: configuracaoDaEntrada(valores) });
    },
    mostrarMensagem,
    iniciar,
    entrarComGoogle,
    sair,
    limparSessao,
    tentarDeNovo,
    recarregarPerfil,
    /** Para os testes: chamar os passos sem passar pelo Supabase Auth. */
    entrar,
    aoMudarAutenticacao,
  };
}

export const sessaoDoApp = criarSessao();
