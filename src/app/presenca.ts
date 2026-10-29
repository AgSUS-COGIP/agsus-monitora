import { getSupabaseClient } from "../lib/supabaseClient";
import { podeVerPessoasOnline } from "../lib/access-roles.ts";
import {
  normalizeOnlinePresenceList,
  ondeEstaNoMonitora,
} from "../lib/online-presence";
import type { PessoaOnline } from "../lib/online-presence";
import type { SupabaseClient } from "@supabase/supabase-js";
import { obterDadosDoMonitoramento } from "../componentes/dados-do-monitoramento.ts";
import {
  SECOES,
  secaoAtualDeConfiguracao,
} from "../modulos/configuracoes/secoes.ts";

/*
  Presença e acesso, sem React:

  - auditoria (`registrar_evento_acesso`): entrada, abertura de tela, heartbeat
    a cada `access_heartbeat_minutos` e saída;
  - presença (`registrar_presenca_monitora`, TB_PRESENCA_ONLINE_MONITORA): a
    batida a cada 90 s com o lugar da pessoa ("Recursos · SEDE"), na hora em
    que ela troca de página, área ou seção. O banco conta "online" por 4 min
    (migration 20261013140000): uma batida perdida não derruba ninguém. Com a
    aba oculta, a batida para; na volta, bate uma vez só (se a última passou
    do intervalo) e o relógio recomeça dali. A resposta traz, de carona, a
    versão do catálogo de abas (migration 20261019160000), entregue a
    `aoRegistrar` — o vigia do catálogo (src/app/vigia-do-catalogo.ts) relê o
    menu só quando ela muda, sem chamada nova ao banco;
  - "Pessoas online" (`listar_presenca_online_monitora`): a lista que o
    cabeçalho mostra (src/componentes/pessoas-online/), só para quem
    `podeVerPessoasOnline` (admin global e Gestor). Com a lista aberta, relê a
    cada batida; fechada, só a contagem do botão, no máximo a cada 10 min.

  A navegação (abertura de tela e troca de lugar) e a entrada (o evento de
  entrada com a primeira batida) vão numa chamada só,
  `registrar_navegacao_monitora` (migration 20261029121700): ela grava o
  mesmo evento e a mesma presença das duas RPCs acima. Ninguém espera por
  ela (o cliente a envia com `keepalive`, src/lib/supabaseClient.ts). Banco
  sem essa função (PGRST202): volta às duas chamadas de antes.

  O estado de "Pessoas online" é assinável (`obter()` / `assinar(ouvinte)`).
*/

const RPC_EVENTO_DE_ACESSO = "registrar_evento_acesso";
const RPC_REGISTRAR_PRESENCA = "registrar_presenca_monitora";
const RPC_LISTAR_PRESENCA = "listar_presenca_online_monitora";
const RPC_NAVEGACAO = "registrar_navegacao_monitora";
/* PostgREST: a função não existe (migration ainda não aplicada). */
const FUNCAO_AUSENTE = "PGRST202";
const CHAVE_DA_ABA = "agsus_monitora_client_session_id";
export const INTERVALO_DA_PRESENCA_MS = 90_000;
/* Lista fechada: a contagem do botão é relida no máximo a cada 10 min. */
export const LISTA_FECHADA_MS = 10 * 60_000;
const HEARTBEAT_PADRAO_MINUTOS = 5;

/* Onde a pessoa está agora, em texto para quem lê (página · área, ou a seção de Configurações). */
function localPadrao(view: string, documento: Document) {
  const secao = secaoAtualDeConfiguracao(documento);
  return (
    ondeEstaNoMonitora({
      view,
      area: obterDadosDoMonitoramento().areaAtual,
      rotuloDaSecao: SECOES.find((s) => s.id === secao)?.rotulo,
    }) || null
  );
}

/** Identificador da aba para a auditoria (gerador criptográfico, não Math.random). */
export function idDaAba(armazenamento = globalThis.sessionStorage) {
  try {
    let valor = armazenamento.getItem(CHAVE_DA_ABA);
    if (!valor) {
      valor = globalThis.crypto.randomUUID();
      armazenamento.setItem(CHAVE_DA_ABA, valor);
    }
    return valor;
  } catch {
    return `${Date.now()}-fallback`;
  }
}

/** O estado assinável de "Pessoas online". */
export type EstadoDaPresenca = Readonly<{
  visivel: boolean;
  aberto: boolean;
  sincronizado: boolean;
  /** Desde quando está sincronizando (ms). */
  desde: number;
  pessoas: readonly PessoaOnline[];
}>;

/** O que a navegação avisa a quem a assina (src/app/navegacao.ts). */
export type EventoDaNavegacaoNaPresenca = {
  tipo: string;
  view?: string;
  anterior?: string;
};

/** Um evento da auditoria que vai junto com a navegação. */
export type EventoDaNavegacao = { nome: string; tela?: string | null };

/** Detalhes opcionais de um evento da auditoria. */
export type OpcoesDoEventoDeAcesso = {
  tela?: string | null;
  detalhes?: Record<string, unknown>;
};

/**
 * `obterUsuario`/`obterPerfil`: quem entrou; `configuracao`: `inteiro(chave,
 * padrao)` e `versao()`; `navegacao`: `obter()` (a tela atual) e `assinar`.
 */
export type DependenciasDaPresenca = {
  cliente?: () => SupabaseClient | null;
  documento?: Document;
  agente?: () => string;
  obterUsuario?: () => { id?: string | null } | null;
  obterPerfil?: () => unknown;
  configuracao?: {
    inteiro(chave: string, padrao: number): number;
    versao(): string;
  };
  navegacao?: {
    obter(): { view: string };
    assinar(
      ouvinte: (evento: EventoDaNavegacaoNaPresenca) => void,
    ): () => unknown;
  };
  local?: (view: string) => string | null;
  agora?: () => number;
  aoRegistrar?: (dados: unknown) => unknown;
};

export type Presenca = ReturnType<typeof criarPresenca>;

export function criarPresenca({
  cliente = getSupabaseClient,
  documento = globalThis.document,
  agente = () => globalThis.navigator?.userAgent || "",
  obterUsuario = () => null,
  obterPerfil = () => null,
  configuracao = {
    inteiro: (_c: string, padrao: number) => padrao,
    versao: () => "",
  },
  navegacao = { obter: () => ({ view: "" }), assinar: () => () => {} },
  local = (view: string) => localPadrao(view, documento),
  agora = () => Date.now(),
  aoRegistrar = () => {},
}: DependenciasDaPresenca = {}) {
  let estado: EstadoDaPresenca = Object.freeze({
    visivel: false,
    aberto: false,
    sincronizado: false,
    desde: agora(),
    pessoas: [],
  });
  const ouvintes = new Set<() => void>();
  let batida: ReturnType<typeof setInterval> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let ultimoLocal: string | null = null;
  /* `iniciar` ligou a presença (a aba oculta só pausa a batida). */
  let ligada = false;
  let ultimaBatida: number | null = null;
  let ultimaLista: number | null = null;
  /* O banco não tem registrar_navegacao_monitora: as duas chamadas de antes. */
  let semNavegacaoNoBanco = false;

  /* Só chamado depois de `sb()` conferido (ou dentro de `try`). */
  const sb = () => cliente()!;
  const usuarioId = () => obterUsuario()?.id;
  const view = () => navegacao.obter().view;
  const visivelNaAba = () => documento.visibilityState === "visible";
  const podeVer = () => podeVerPessoasOnline(obterPerfil());

  function definir(parcial: Partial<EstadoDaPresenca>) {
    const proximo = { ...estado, ...parcial };
    // "Sincronizando" conta o tempo desde que deixou de estar sincronizado.
    if (estado.sincronizado && proximo.sincronizado === false)
      proximo.desde = agora();
    estado = Object.freeze(proximo);
    ouvintes.forEach((ouvinte) => ouvinte());
  }

  // ── Auditoria ─────────────────────────────────────────────────────────

  async function registrarEvento(
    evento: string,
    { tela, detalhes }: OpcoesDoEventoDeAcesso = {},
  ) {
    if (!sb() || !usuarioId() || !evento) return;
    try {
      await sb().rpc(RPC_EVENTO_DE_ACESSO, {
        p_evento: evento,
        p_tela: tela ?? view() ?? null,
        p_origem: "index",
        p_detalhes: detalhes ?? {},
        p_client_session_id: idDaAba(),
        p_user_agent: agente(),
        p_app_version: configuracao.versao(),
      });
    } catch (erro) {
      console.warn("Falha ao registrar auditoria:", erro);
    }
  }

  function pararHeartbeat() {
    clearInterval(heartbeat!);
    heartbeat = null;
  }

  function iniciarHeartbeat() {
    pararHeartbeat();
    if (!usuarioId()) return;
    const minutos = Math.max(
      1,
      configuracao.inteiro(
        "access_heartbeat_minutos",
        HEARTBEAT_PADRAO_MINUTOS,
      ),
    );
    heartbeat = setInterval(
      () =>
        registrarEvento("heartbeat", {
          detalhes: { current_view: view(), page_title: documento.title },
        }),
      minutos * 60 * 1000,
    );
  }

  // ── Presença ──────────────────────────────────────────────────────────

  async function registrarLocal() {
    if (!sb() || !usuarioId() || !visivelNaAba()) return;
    const lugar = local(view());
    const resposta = await sb().rpc(RPC_REGISTRAR_PRESENCA, {
      p_current_view: lugar,
    });
    if (resposta.error) throw resposta.error;
    presencaGravada(lugar, resposta.data);
  }

  /* A presença foi gravada (pela batida ou pela navegação). */
  function presencaGravada(lugar: string | null, dados: unknown) {
    ultimoLocal = lugar;
    ultimaBatida = agora();
    try {
      aoRegistrar(dados);
    } catch (erro) {
      // Quem ouve a resposta não derruba a presença.
      console.warn("Falha ao tratar a resposta da presença:", erro);
    }
  }

  /*
    Evento e presença numa chamada só (`registrar_navegacao_monitora`).
    `presenca`: grava também o lugar atual (a aba precisa estar visível).
    Rejeita quando a presença não foi gravada; o evento, não: a falha dele só
    avisa, como em `registrarEvento`.
  */
  async function registrarNavegacao({
    evento = null,
    presenca = false,
  }: {
    evento?: EventoDaNavegacao | null;
    presenca?: boolean;
  }) {
    if (!sb() || !usuarioId()) return;
    const comPresenca = presenca && visivelNaAba();
    if (!evento && !comPresenca) return;
    if (semNavegacaoNoBanco) {
      if (evento) void registrarEvento(evento.nome, { tela: evento.tela });
      if (comPresenca) await registrarLocal();
      return;
    }
    const lugar = comPresenca ? local(view()) : null;
    const resposta = await sb().rpc(RPC_NAVEGACAO, {
      p_evento: evento?.nome ?? null,
      p_tela: evento ? (evento.tela ?? view() ?? null) : null,
      p_origem: "index",
      p_detalhes: {},
      p_client_session_id: idDaAba(),
      p_user_agent: agente(),
      p_app_version: configuracao.versao(),
      p_presenca: comPresenca,
      p_current_view: lugar,
    });
    if (
      (resposta.error as { code?: unknown } | null)?.code === FUNCAO_AUSENTE
    ) {
      semNavegacaoNoBanco = true;
      return registrarNavegacao({ evento, presenca });
    }
    if (resposta.error) {
      if (evento) console.warn("Falha ao registrar auditoria:", resposta.error);
      throw resposta.error;
    }
    if (!comPresenca) return;
    const dados = resposta.data as { presenca_erro?: unknown } | null;
    if (dados?.presenca_erro) throw dados.presenca_erro;
    presencaGravada(lugar, dados);
  }

  /* Ao trocar de página, área ou seção, avisa na hora (sem esperar os 90 s). */
  function trocouDeLocal() {
    return Boolean(ligada && batida) && local(view()) !== ultimoLocal;
  }

  function avisarTrocaDeLocal() {
    if (!trocouDeLocal()) return;
    registrarNavegacao({ presenca: true }).catch(() => {});
  }

  function falhou() {
    definir(
      podeVer()
        ? { visivel: true, sincronizado: false, pessoas: [] }
        : { visivel: false },
    );
  }

  /* A lista de "Pessoas online" (só quem pode ver). */
  async function listar() {
    // Sem permissão (inclusive quem a perdeu nesta sessão): o indicador some.
    if (!podeVer()) {
      definir({ visivel: false });
      return;
    }
    const resposta = await sb().rpc(RPC_LISTAR_PRESENCA);
    if (resposta.error) throw resposta.error;
    ultimaLista = agora();
    definir({
      visivel: true,
      sincronizado: true,
      pessoas: normalizeOnlinePresenceList(resposta.data),
    });
  }

  /* Lista aberta: a cada batida. Fechada: a primeira e, depois, a cada 10 min. */
  const listaVencida = () =>
    estado.aberto ||
    ultimaLista === null ||
    agora() - ultimaLista >= LISTA_FECHADA_MS;

  /* `evento`: o da entrada, que vai junto com a primeira batida. */
  async function sincronizar(evento: EventoDaNavegacao | null = null) {
    if (!sb() || !usuarioId()) return;
    if (!visivelNaAba()) {
      if (evento) void registrarEvento(evento.nome, { tela: evento.tela });
      return;
    }
    try {
      if (evento) await registrarNavegacao({ evento, presenca: true });
      else await registrarLocal();
      if (!podeVer()) definir({ visivel: false });
      else if (listaVencida()) await listar();
    } catch {
      falhou();
    }
  }

  function pararBatida() {
    clearInterval(batida!);
    batida = null;
  }

  function ligarBatida() {
    pararBatida();
    batida = setInterval(sincronizar, INTERVALO_DA_PRESENCA_MS);
  }

  function parar() {
    ligada = false;
    pararBatida();
    ultimaBatida = null;
    ultimaLista = null;
    definir({ visivel: false, aberto: false });
  }

  /** Liga a presença; `evento` (a entrada) vai junto com a primeira batida. */
  function iniciar(evento: EventoDaNavegacao | null = null) {
    parar();
    if (!usuarioId()) return;
    ligada = true;
    if (!visivelNaAba()) {
      // A presença começa quando a aba ficar visível; o evento, agora.
      if (evento) void registrarEvento(evento.nome, { tela: evento.tela });
      return;
    }
    void sincronizar(evento);
    ligarBatida();
  }

  /* Aba oculta: a batida para (o banco ainda conta 4 min de "online"). */
  function pausar() {
    pararBatida();
  }

  /*
    Aba visível de novo: uma batida só, e só se a última já passou do
    intervalo; o relógio recomeça daqui (sem a batida dobrada da volta).
  */
  function retomar() {
    if (!ligada || batida || !usuarioId() || !visivelNaAba()) return;
    if (
      ultimaBatida === null ||
      agora() - ultimaBatida >= INTERVALO_DA_PRESENCA_MS
    )
      void sincronizar();
    ligarBatida();
  }

  /** Abre ou fecha a lista; ao abrir, relê só a lista. */
  function alternar() {
    const aberto = !estado.aberto;
    definir({ aberto });
    if (aberto && sb() && usuarioId()) listar().catch(falhou);
  }

  function fechar() {
    if (estado.aberto) definir({ aberto: false });
  }

  /*
    A navegação avisa: tela aberta → auditoria; qualquer troca (tela, menu,
    seção) → o lugar na presença — as duas numa chamada só. A aba oculta pausa
    a batida; a que volta a ficar visível retoma. Devolve o cancelamento.
  */
  function acompanhar() {
    // Uma chamada por navegação: a abertura da tela e o lugar novo juntos.
    const pararNavegacao = navegacao.assinar((evento) => {
      const abriu =
        evento.tipo === "abertura" && evento.view !== evento.anterior;
      const presenca = trocouDeLocal();
      if (!abriu && !presenca) return;
      registrarNavegacao({
        evento: abriu ? { nome: "abertura_tela", tela: evento.view } : null,
        presenca,
      }).catch(() => {});
    });
    const aoMudarVisibilidade = () => {
      if (visivelNaAba()) retomar();
      else pausar();
    };
    documento.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      pararNavegacao();
      documento.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }

  /** Para tudo (saída, sem acesso, aba em segundo plano). */
  function pararTudo() {
    pararHeartbeat();
    parar();
  }

  return {
    obter: () => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    registrarEvento,
    iniciarHeartbeat,
    pararHeartbeat,
    iniciar,
    parar,
    pararTudo,
    sincronizar,
    alternar,
    fechar,
    avisarTrocaDeLocal,
    acompanhar,
  };
}
