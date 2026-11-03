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
  Presença e acesso, sem React. Uma chamada por batida, sempre a mesma:
  `registrar_navegacao_monitora` (migration 20261103230000), que leva junto o
  que coincide com ela.

  - presença (TB_PRESENCA_ONLINE_MONITORA): a batida a cada 150 s com o lugar
    da pessoa ("Recursos · SEDE"), e na hora em que ela troca de página, área
    ou seção. O banco conta "online" por 6 min (duas batidas e um minuto de
    folga): uma batida perdida não derruba ninguém. Com a aba oculta, a batida
    para; na volta, bate uma vez só (se a última passou do intervalo) e o
    relógio recomeça dali. A resposta traz, de carona, a versão do catálogo de
    abas (migration 20261019160000), entregue a `aoRegistrar` — o vigia do
    catálogo (src/app/vigia-do-catalogo.ts) relê o menu só quando ela muda;
  - auditoria (TL_EVENTO_ACESSO): entrada, abertura de tela, heartbeat a cada
    `access_heartbeat_minutos` e saída. A entrada vai com a primeira batida, a
    abertura com a troca de lugar e o heartbeat com a primeira batida depois do
    intervalo. Eventos de outros módulos (o retrato de desempenho do front,
    src/lib/frontend-performance-monitor.ts) entram na fila de carona
    (`enfileirarEvento`) e vão com a próxima chamada; a aba que fica oculta
    os despacha na hora. A linha gravada é a de sempre (o "último acesso",
    private."FC_ULTIMO_ACESSO", e a duração da sessão por `client_session_id`
    leem dela);
  - "Pessoas online": a lista que o cabeçalho mostra
    (src/componentes/pessoas-online/), só para quem `podeVerPessoasOnline`
    (admin global e Gestor). Vai de carona na batida (`p_listar`): com a lista
    aberta, a cada batida; fechada, só a contagem do botão, no máximo a cada
    10 min. Abrir a lista é uma batida adiantada (o relógio recomeça dali).

  Ninguém espera pela chamada (o cliente a envia com `keepalive`,
  src/lib/supabaseClient.ts). Banco antigo (PGRST202), um degrau por vez:
  sem `p_eventos`/`p_listar` (antes de 20261103230000), a lista e os eventos
  de carona saem em chamadas à parte; sem a função (antes de 20261029121700),
  `registrar_evento_acesso` + `registrar_presenca_monitora`.

  O estado de "Pessoas online" é assinável (`obter()` / `assinar(ouvinte)`).
*/

const RPC_EVENTO_DE_ACESSO = "registrar_evento_acesso";
const RPC_REGISTRAR_PRESENCA = "registrar_presenca_monitora";
const RPC_LISTAR_PRESENCA = "listar_presenca_online_monitora";
const RPC_NAVEGACAO = "registrar_navegacao_monitora";
/* PostgREST: a função não existe (migration ainda não aplicada). */
const FUNCAO_AUSENTE = "PGRST202";
const CHAVE_DA_ABA = "agsus_monitora_client_session_id";
/** A batida da presença: 150 s com a aba visível. */
export const INTERVALO_DA_PRESENCA_MS = 150_000;
/**
 * Quanto o banco conta "online" depois da última batida
 * (`listar_presenca_online_monitora`, migration 20261103230000): duas batidas
 * e um minuto de folga.
 */
export const ONLINE_NO_BANCO_MS = 6 * 60_000;
/* Lista fechada: a contagem do botão é relida no máximo a cada 10 min. */
export const LISTA_FECHADA_MS = 10 * 60_000;
/** Eventos de carona por chamada (o banco aceita até 10). */
export const CARONA_MAXIMA = 10;
const HEARTBEAT_PADRAO_MINUTOS = 5;

/*
  O que o banco sabe fazer numa chamada, descoberto pela primeira recusa:
  "batida" (presença, eventos de carona e lista), "navegacao" (evento e
  presença) e "antiga" (uma RPC para cada coisa).
*/
type NivelDoBanco = "batida" | "navegacao" | "antiga";

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
export type EventoDaNavegacao = {
  nome: string;
  tela?: string | null;
  detalhes?: Record<string, unknown>;
};

/**
 * Um evento de outro módulo que vai de carona na próxima chamada. Sem
 * `origem`, `client_session_id` ou `app_version`, valem os da aba.
 */
export type EventoDeCarona = {
  evento: string;
  tela?: string | null;
  origem?: string;
  detalhes?: Record<string, unknown>;
  client_session_id?: string;
  app_version?: string;
};

/** Detalhes opcionais de um evento da auditoria. */
export type OpcoesDoEventoDeAcesso = {
  tela?: string | null;
  detalhes?: Record<string, unknown>;
};

/* A resposta de registrar_navegacao_monitora (o que a tela lê dela). */
type RespostaDaBatida = {
  presenca_erro?: unknown;
  pessoas?: unknown;
  pessoas_erro?: unknown;
} & Record<string, unknown>;

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
  /* O heartbeat da auditoria está ligado; vai na primeira batida depois do intervalo. */
  let heartbeatLigado = false;
  let ultimoHeartbeat = 0;
  let ultimoLocal: string | null = null;
  /* `iniciar` ligou a presença (a aba oculta só pausa a batida). */
  let ligada = false;
  let ultimaBatida: number | null = null;
  let ultimaLista: number | null = null;
  let nivel: NivelDoBanco = "batida";
  /* Eventos de outros módulos esperando a próxima chamada. */
  let carona: EventoDeCarona[] = [];

  /* Só chamado depois de `sb()` conferido (ou dentro de `try`). */
  const sb = () => cliente()!;
  const usuarioId = () => obterUsuario()?.id;
  const view = () => navegacao.obter().view;
  const visivelNaAba = () => documento.visibilityState === "visible";
  const podeVer = () => podeVerPessoasOnline(obterPerfil());
  const codigoDoErro = (erro: unknown) =>
    (erro as { code?: unknown } | null)?.code;

  function definir(parcial: Partial<EstadoDaPresenca>) {
    const proximo = { ...estado, ...parcial };
    // "Sincronizando" conta o tempo desde que deixou de estar sincronizado.
    if (estado.sincronizado && proximo.sincronizado === false)
      proximo.desde = agora();
    estado = Object.freeze(proximo);
    ouvintes.forEach((ouvinte) => ouvinte());
  }

  // ── Auditoria ─────────────────────────────────────────────────────────

  /* Um evento numa chamada à parte (banco sem a batida, ou aba sem presença). */
  async function enviarEventoAvulso(evento: EventoDeCarona) {
    try {
      await sb().rpc(RPC_EVENTO_DE_ACESSO, {
        p_evento: evento.evento,
        p_tela: evento.tela ?? view() ?? null,
        p_origem: evento.origem ?? "index",
        p_detalhes: evento.detalhes ?? {},
        p_client_session_id: evento.client_session_id ?? idDaAba(),
        p_user_agent: agente(),
        p_app_version: evento.app_version ?? configuracao.versao(),
      });
    } catch (erro) {
      console.warn("Falha ao registrar auditoria:", erro);
    }
  }

  async function registrarEvento(
    evento: string,
    { tela, detalhes }: OpcoesDoEventoDeAcesso = {},
  ) {
    if (!sb() || !usuarioId() || !evento) return;
    // Com eventos na fila, o evento os leva (a saída, por exemplo).
    if (carona.length && nivel === "batida") {
      await registrarNavegacao({
        evento: { nome: evento, tela, detalhes },
      }).catch(() => {});
      return;
    }
    await enviarEventoAvulso({ evento, tela, detalhes });
  }

  /* Manda já o que está na fila (a aba vai ficar oculta, ou não há batida). */
  function despacharCarona() {
    if (!carona.length || !sb() || !usuarioId()) return;
    registrarNavegacao({}).catch(() => {});
  }

  /**
   * Põe um evento na fila de carona: vai com a próxima chamada (batida ou
   * navegação). Com a pessoa conhecida mas sem presença batendo, ou com a
   * aba oculta, vai na hora; antes de a pessoa ser conhecida (a entrada
   * ainda carregando), espera a primeira batida.
   */
  function enfileirarEvento(evento: EventoDeCarona) {
    if (!evento?.evento) return;
    carona = [...carona, evento].slice(-CARONA_MAXIMA);
    if (!ligada || !visivelNaAba()) despacharCarona();
  }

  function pararHeartbeat() {
    heartbeatLigado = false;
  }

  /* Liga o heartbeat; o intervalo conta daqui (a batida o leva quando vencer). */
  function iniciarHeartbeat() {
    pararHeartbeat();
    if (!usuarioId()) return;
    heartbeatLigado = true;
    ultimoHeartbeat = agora();
  }

  function heartbeatVencido() {
    if (!heartbeatLigado) return false;
    const minutos = Math.max(
      1,
      configuracao.inteiro(
        "access_heartbeat_minutos",
        HEARTBEAT_PADRAO_MINUTOS,
      ),
    );
    return agora() - ultimoHeartbeat >= minutos * 60 * 1000;
  }

  /* O evento "heartbeat" da auditoria, com o que ele sempre levou. */
  function eventoDeHeartbeat(): EventoDaNavegacao {
    ultimoHeartbeat = agora();
    return {
      nome: "heartbeat",
      detalhes: { current_view: view(), page_title: documento.title },
    };
  }

  // ── Presença ──────────────────────────────────────────────────────────

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

  /* Banco antigo (antes de 20261029121700): uma RPC para cada coisa. */
  async function registrarNaAntiga(
    evento: EventoDaNavegacao | null,
    comPresenca: boolean,
  ): Promise<RespostaDaBatida | null> {
    if (evento)
      void enviarEventoAvulso({
        evento: evento.nome,
        tela: evento.tela,
        detalhes: evento.detalhes,
      });
    if (!comPresenca) return null;
    const lugar = local(view());
    const resposta = await sb().rpc(RPC_REGISTRAR_PRESENCA, {
      p_current_view: lugar,
    });
    if (resposta.error) throw resposta.error;
    presencaGravada(lugar, resposta.data);
    return (resposta.data as RespostaDaBatida | null) ?? null;
  }

  /*
    A chamada única (`registrar_navegacao_monitora`): o evento, os de carona,
    a presença (o lugar atual, com a aba visível) e, com `listar`, a lista de
    "Pessoas online". Devolve a resposta (com `pessoas` quando o banco a
    mandou). Rejeita quando a presença não foi gravada; o evento, não: a falha
    dele só avisa.
  */
  async function registrarNavegacao({
    evento = null,
    presenca = false,
    listar = false,
  }: {
    evento?: EventoDaNavegacao | null;
    presenca?: boolean;
    listar?: boolean;
  }): Promise<RespostaDaBatida | null> {
    if (!sb() || !usuarioId()) return null;
    const comPresenca = presenca && visivelNaAba();
    // Abaixo da batida, a fila sai em chamadas à parte.
    if (nivel !== "batida")
      carona.splice(0).forEach((e) => void enviarEventoAvulso(e));
    const eventos = carona.splice(0);
    if (!evento && !comPresenca && !eventos.length) return null;
    if (nivel === "antiga") return registrarNaAntiga(evento, comPresenca);
    const lugar = comPresenca ? local(view()) : null;
    const resposta = await sb().rpc(RPC_NAVEGACAO, {
      p_evento: evento?.nome ?? null,
      p_tela: evento ? (evento.tela ?? view() ?? null) : null,
      p_origem: "index",
      p_detalhes: evento?.detalhes ?? {},
      p_client_session_id: idDaAba(),
      p_user_agent: agente(),
      p_app_version: configuracao.versao(),
      p_presenca: comPresenca,
      p_current_view: lugar,
      // Só a batida (20261103230000) conhece estes dois; pelos nove nomes, cai na de antes.
      ...(nivel === "batida"
        ? { p_eventos: eventos, p_listar: listar && comPresenca }
        : {}),
    });
    if (codigoDoErro(resposta.error) === FUNCAO_AUSENTE) {
      // Um degrau abaixo, com os mesmos eventos de volta na fila.
      carona = [...eventos, ...carona];
      nivel = nivel === "batida" ? "navegacao" : "antiga";
      return registrarNavegacao({ evento, presenca, listar });
    }
    if (resposta.error) {
      if (evento || eventos.length)
        console.warn("Falha ao registrar auditoria:", resposta.error);
      throw resposta.error;
    }
    const dados = resposta.data as RespostaDaBatida | null;
    if (!comPresenca) return dados;
    if (dados?.presenca_erro) throw dados.presenca_erro;
    presencaGravada(lugar, dados);
    return dados;
  }

  /* Ao trocar de página, área ou seção, avisa na hora (sem esperar a batida). */
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

  function mostrarLista(dados: unknown) {
    ultimaLista = agora();
    definir({
      visivel: true,
      sincronizado: true,
      pessoas: normalizeOnlinePresenceList(dados),
    });
  }

  /* A lista numa chamada à parte (banco sem a batida, ou presença parada). */
  async function listar() {
    // Sem permissão (inclusive quem a perdeu nesta sessão): o indicador some.
    if (!podeVer()) {
      definir({ visivel: false });
      return;
    }
    const resposta = await sb().rpc(RPC_LISTAR_PRESENCA);
    if (resposta.error) throw resposta.error;
    mostrarLista(resposta.data);
  }

  /* Lista aberta: a cada batida. Fechada: a primeira e, depois, a cada 10 min. */
  const listaVencida = () =>
    estado.aberto ||
    ultimaLista === null ||
    agora() - ultimaLista >= LISTA_FECHADA_MS;

  /*
    A batida: presença, o evento pendente e, quando vencida, a lista — uma
    chamada. `evento`: o da entrada, que vai junto com a primeira batida; sem
    ele, o heartbeat vencido vai junto. `lista`: relê a lista mesmo sem vencer
    (a pessoa acabou de abri-la).
  */
  async function sincronizar(
    evento: EventoDaNavegacao | null = null,
    { lista = false }: { lista?: boolean } = {},
  ) {
    if (!sb() || !usuarioId()) return;
    if (!visivelNaAba()) {
      if (evento) void registrarEvento(evento.nome, { tela: evento.tela });
      return;
    }
    try {
      const comEvento =
        evento ?? (heartbeatVencido() ? eventoDeHeartbeat() : null);
      const querLista = podeVer() && (lista || listaVencida());
      const dados = await registrarNavegacao({
        evento: comEvento,
        presenca: true,
        listar: querLista,
      });
      if (!podeVer()) definir({ visivel: false });
      else if (!querLista) return;
      else if (dados?.pessoas_erro) falhou();
      else if (dados && "pessoas" in dados) mostrarLista(dados.pessoas);
      else await listar();
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
    batida = setInterval(() => void sincronizar(), INTERVALO_DA_PRESENCA_MS);
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

  /*
    Aba oculta: a batida para (o banco ainda conta 6 min de "online"); o que
    estava na fila de carona sai agora, porque a aba pode não voltar.
  */
  function pausar() {
    pararBatida();
    despacharCarona();
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

  /**
   * Abre ou fecha a lista. Com a presença batendo, abrir é uma batida
   * adiantada com a lista de carona, e o relógio recomeça dali.
   */
  function alternar() {
    const aberto = !estado.aberto;
    definir({ aberto });
    if (!aberto || !sb() || !usuarioId()) return;
    if (ligada && batida && visivelNaAba()) {
      void sincronizar(null, { lista: true });
      ligarBatida();
      return;
    }
    listar().catch(falhou);
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
    /*
      Uma chamada por navegação: a abertura da tela e o lugar novo juntos.
      O lugar só conta como gravado quando a resposta volta; por isso os
      avisos do mesmo instante (o menu refeito e a abertura, numa entrada ou
      no "Atualizar dados") são juntados num só (microtarefa) antes de chamar
      o banco. `estado` é só o redesenho do React (título, edital do
      endereço já aberto): não muda o lugar.
    */
    let pendente: { abertura: string | null } | null = null;
    const enviarPendente = () => {
      const abertura = pendente?.abertura ?? null;
      pendente = null;
      const presenca = trocouDeLocal();
      if (!abertura && !presenca) return;
      registrarNavegacao({
        evento: abertura ? { nome: "abertura_tela", tela: abertura } : null,
        presenca,
      }).catch(() => {});
    };
    const pararNavegacao = navegacao.assinar((evento) => {
      if (evento.tipo === "estado") return;
      const abertura =
        evento.tipo === "abertura" && evento.view !== evento.anterior
          ? (evento.view ?? null)
          : null;
      if (pendente) {
        if (abertura) pendente.abertura = abertura;
        return;
      }
      pendente = { abertura };
      queueMicrotask(enviarPendente);
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
    carona = [];
    parar();
  }

  return {
    obter: () => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    registrarEvento,
    enfileirarEvento,
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
