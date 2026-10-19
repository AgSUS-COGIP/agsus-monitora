import { getSupabaseClient } from "../lib/supabaseClient.js";
import { podeVerPessoasOnline } from "../lib/access-roles.js";
import {
  normalizeOnlinePresenceList,
  ondeEstaNoMonitora,
} from "../lib/online-presence.js";
import { obterDadosDoMonitoramento } from "../componentes/dados-do-monitoramento.ts";
import {
  SECOES,
  secaoAtualDeConfiguracao,
} from "../modulos/configuracoes/secoes.js";

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

  O estado de "Pessoas online" é assinável (`obter()` / `assinar(ouvinte)`).
*/

const RPC_EVENTO_DE_ACESSO = "registrar_evento_acesso";
const RPC_REGISTRAR_PRESENCA = "registrar_presenca_monitora";
const RPC_LISTAR_PRESENCA = "listar_presenca_online_monitora";
const CHAVE_DA_ABA = "agsus_monitora_client_session_id";
export const INTERVALO_DA_PRESENCA_MS = 90_000;
/* Lista fechada: a contagem do botão é relida no máximo a cada 10 min. */
export const LISTA_FECHADA_MS = 10 * 60_000;
const HEARTBEAT_PADRAO_MINUTOS = 5;

/* Onde a pessoa está agora, em texto para quem lê (página · área, ou a seção de Configurações). */
function localPadrao(view, documento) {
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

/**
 * @param {object} dependencias
 * @param {() => object|null} dependencias.obterUsuario
 * @param {() => object|null} dependencias.obterPerfil
 * @param {object} dependencias.configuracao `inteiro(chave, padrao)` e `versao()`
 * @param {object} dependencias.navegacao `obter()` (a tela atual) e `assinar`
 */
export function criarPresenca({
  cliente = getSupabaseClient,
  documento = globalThis.document,
  agente = () => globalThis.navigator?.userAgent || "",
  obterUsuario = () => null,
  obterPerfil = () => null,
  configuracao = { inteiro: (_c, padrao) => padrao, versao: () => "" },
  navegacao = { obter: () => ({ view: "" }), assinar: () => () => {} },
  local = (view) => localPadrao(view, documento),
  agora = () => Date.now(),
  aoRegistrar = () => {},
} = {}) {
  let estado = Object.freeze({
    visivel: false,
    aberto: false,
    sincronizado: false,
    desde: agora(),
    pessoas: [],
  });
  const ouvintes = new Set();
  let batida = null;
  let heartbeat = null;
  let ultimoLocal = null;
  /* `iniciar` ligou a presença (a aba oculta só pausa a batida). */
  let ligada = false;
  let ultimaBatida = null;
  let ultimaLista = null;

  const sb = () => cliente();
  const usuarioId = () => obterUsuario()?.id;
  const view = () => navegacao.obter().view;
  const visivelNaAba = () => documento.visibilityState === "visible";
  const podeVer = () => podeVerPessoasOnline(obterPerfil());

  function definir(parcial) {
    const proximo = { ...estado, ...parcial };
    // "Sincronizando" conta o tempo desde que deixou de estar sincronizado.
    if (estado.sincronizado && proximo.sincronizado === false)
      proximo.desde = agora();
    estado = Object.freeze(proximo);
    ouvintes.forEach((ouvinte) => ouvinte());
  }

  // ── Auditoria ─────────────────────────────────────────────────────────

  async function registrarEvento(evento, { tela, detalhes } = {}) {
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
    clearInterval(heartbeat);
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
    ultimoLocal = lugar;
    ultimaBatida = agora();
    try {
      aoRegistrar(resposta.data);
    } catch (erro) {
      // Quem ouve a resposta não derruba a presença.
      console.warn("Falha ao tratar a resposta da presença:", erro);
    }
  }

  /* Ao trocar de página, área ou seção, avisa na hora (sem esperar os 90 s). */
  function avisarTrocaDeLocal() {
    if (!ligada || !batida) return;
    if (local(view()) === ultimoLocal) return;
    registrarLocal().catch(() => {});
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

  async function sincronizar() {
    if (!sb() || !usuarioId() || !visivelNaAba()) return;
    try {
      await registrarLocal();
      if (!podeVer()) definir({ visivel: false });
      else if (listaVencida()) await listar();
    } catch {
      falhou();
    }
  }

  function pararBatida() {
    clearInterval(batida);
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

  function iniciar() {
    parar();
    if (!usuarioId()) return;
    ligada = true;
    if (!visivelNaAba()) return; // começa quando a aba ficar visível
    void sincronizar();
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
    seção) → o lugar na presença. A aba oculta pausa a batida; a que volta a
    ficar visível retoma. Devolve o cancelamento.
  */
  function acompanhar() {
    const pararNavegacao = navegacao.assinar((evento) => {
      if (evento.tipo === "abertura" && evento.view !== evento.anterior)
        void registrarEvento("abertura_tela", { tela: evento.view });
      avisarTrocaDeLocal();
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
    assinar(ouvinte) {
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
