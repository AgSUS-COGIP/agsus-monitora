import { getSupabaseClient } from "../lib/supabaseClient.js";
import { podeVerPessoasOnline } from "../lib/access-roles.js";
import {
  normalizeOnlinePresenceList,
  ondeEstaNoMonitora,
} from "../lib/online-presence.js";
import { obterDadosDoMonitoramento } from "../componentes/dados-do-monitoramento.js";
import {
  SECOES,
  secaoAtualDeConfiguracao,
} from "../modulos/configuracoes/secoes.js";

/*
  Presença e acesso, sem React:

  - auditoria (`registrar_evento_acesso`): entrada, abertura de tela, heartbeat
    a cada `access_heartbeat_minutos` e saída;
  - presença (`registrar_presenca_monitora`, TB_PRESENCA_ONLINE_MONITORA): a
    batida a cada 45 s com o lugar da pessoa ("Recursos · SEDE"), na hora em
    que ela troca de página, área ou seção;
  - "Pessoas online" (`listar_presenca_online_monitora`): a lista que o
    cabeçalho mostra (src/componentes/pessoas-online/), só para quem
    `podeVerPessoasOnline` (admin global e Gestor).

  O estado de "Pessoas online" é assinável (`obter()` / `assinar(ouvinte)`).
*/

const RPC_EVENTO_DE_ACESSO = "registrar_evento_acesso";
const RPC_REGISTRAR_PRESENCA = "registrar_presenca_monitora";
const RPC_LISTAR_PRESENCA = "listar_presenca_online_monitora";
const CHAVE_DA_ABA = "agsus_monitora_client_session_id";
export const INTERVALO_DA_PRESENCA_MS = 45_000;
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
  }

  /* Ao trocar de página, área ou seção, avisa na hora (sem esperar os 45 s). */
  function avisarTrocaDeLocal() {
    if (!batida) return;
    if (local(view()) === ultimoLocal) return;
    registrarLocal().catch(() => {});
  }

  async function sincronizar() {
    if (!sb() || !usuarioId() || !visivelNaAba()) return;
    try {
      await registrarLocal();
      // Sem permissão (inclusive quem a perdeu nesta sessão): o indicador some.
      if (!podeVer()) {
        definir({ visivel: false });
        return;
      }
      const resposta = await sb().rpc(RPC_LISTAR_PRESENCA);
      if (resposta.error) throw resposta.error;
      definir({
        visivel: true,
        sincronizado: true,
        pessoas: normalizeOnlinePresenceList(resposta.data),
      });
    } catch {
      definir(
        podeVer()
          ? { visivel: true, sincronizado: false, pessoas: [] }
          : { visivel: false },
      );
    }
  }

  function parar() {
    clearInterval(batida);
    batida = null;
    definir({ visivel: false, aberto: false });
  }

  function iniciar() {
    parar();
    if (!usuarioId()) return;
    void sincronizar();
    batida = setInterval(sincronizar, INTERVALO_DA_PRESENCA_MS);
  }

  /** Abre ou fecha a lista; ao abrir, relê na hora. */
  function alternar() {
    const aberto = !estado.aberto;
    definir({ aberto });
    if (aberto) void sincronizar();
  }

  function fechar() {
    if (estado.aberto) definir({ aberto: false });
  }

  /*
    A navegação avisa: tela aberta → auditoria; qualquer troca (tela, menu,
    seção) → o lugar na presença. A aba que volta a ficar visível relê.
    Devolve o cancelamento.
  */
  function acompanhar() {
    const pararNavegacao = navegacao.assinar((evento) => {
      if (evento.tipo === "abertura" && evento.view !== evento.anterior)
        void registrarEvento("abertura_tela", { tela: evento.view });
      avisarTrocaDeLocal();
    });
    const aoVoltar = () => {
      if (visivelNaAba() && usuarioId()) void sincronizar();
    };
    documento.addEventListener("visibilitychange", aoVoltar);
    return () => {
      pararNavegacao();
      documento.removeEventListener("visibilitychange", aoVoltar);
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
    usuarioAtual: () => obterUsuario(),
    perfilAtual: () => obterPerfil(),
  };
}
