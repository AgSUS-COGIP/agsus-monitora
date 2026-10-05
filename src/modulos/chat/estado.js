/*
  Estado do chat (painel "Mensagens"), fora do React. Os componentes leem com
  `useSyncExternalStore(estado.assinar, estado.obter)`. Não importa React.

  RPCs (supabase/migrations/20261002210000_chat.sql; contrato em
  src/lib/rpc-contrato.js): listar_conversas_chat, listar_mensagens_chat,
  listar_pessoas_chat, enviar_mensagem_chat, editar_mensagem_chat,
  apagar_mensagem_chat, marcar_conversa_lida_chat, abrir_conversa_direta_chat,
  criar_grupo_chat, adicionar_participantes_chat, sair_conversa_chat,
  silenciar_conversa_chat e abrir_conversa_edital_chat; e, da v1.1
  (20261005100000_chat_limpar_e_reacoes.sql), limpar_conversa_chat e
  alternar_reacao_chat.

  Tempo real (Supabase Realtime, com a RLS do banco):
    - canal "chat-usuario:<eu>": postgres_changes de TB_MENSAGEM (todas as que a
      pessoa pode ler) e de RL_CONVERSA_PARTICIPANTE (as linhas dela). Mensagem
      da conversa aberta entra na hora (sem duplicar: `mesclarMensagens`); a
      lista é relida logo depois (contagem e prévia certas). O que a pessoa
      limpou (limpa_em) não volta pelo Realtime. Reações (RL_MENSAGEM_REACAO)
      da conversa aberta entram na mensagem (aplicarReacaoDaLinha).
    - canal privado "chat:<conversa>" da conversa aberta: broadcast "digitando".
    - Caiu e voltou (SUBSCRIBED depois de erro) ou a aba voltou a ficar visível:
      relê a lista e a conversa aberta.

  Avisos (src/lib/avisos-do-chat.js): não lidas no ícone e no título da aba;
  mensagem nova de outra pessoa fora da conversa à vista vira aviso na tela
  (`avisos`, até 3, desenhados por avisos.jsx) ou, com a aba em segundo plano,
  notificação do navegador (só se a pessoa ativar); som desligado por padrão.
  Preferências guardadas no navegador. Nada durante o carregamento inicial.
*/

import {
  aplicarReacaoDaLinha,
  depoisDaLimpeza,
  LIMITE_DO_TEXTO,
  linkDaTela,
  MENSAGENS_POR_PAGINA,
  mensagemDaLinha,
  mesclarMensagens,
  naoLidasDasMensagens,
  ordenarConversas,
  REACOES_RAPIDAS,
  reacoesComAlternancia,
  totalDeNaoLidas,
  validarTexto,
} from "../../lib/chat.js";
import {
  comoAvisar,
  empilharAvisos,
  montarAviso,
  textoDaNotificacao,
} from "../../lib/avisos-do-chat.js";
import {
  comTempoLimite,
  ehFalhaDeConexao,
  mensagemDeFalha,
} from "../../lib/falha-de-rede.js";
import { definirNaoLidasDaAba } from "../../lib/identidade-da-aba.js";

const RPC_LISTAR_CONVERSAS = "listar_conversas_chat";
const RPC_LISTAR_MENSAGENS = "listar_mensagens_chat";
const RPC_LISTAR_PESSOAS = "listar_pessoas_chat";
const RPC_ENVIAR = "enviar_mensagem_chat";
const RPC_EDITAR = "editar_mensagem_chat";
const RPC_APAGAR = "apagar_mensagem_chat";
const RPC_MARCAR_LIDA = "marcar_conversa_lida_chat";
const RPC_ABRIR_DIRETA = "abrir_conversa_direta_chat";
const RPC_CRIAR_GRUPO = "criar_grupo_chat";
const RPC_ADICIONAR = "adicionar_participantes_chat";
const RPC_SAIR = "sair_conversa_chat";
const RPC_SILENCIAR = "silenciar_conversa_chat";
const RPC_ABRIR_EDITAL = "abrir_conversa_edital_chat";
const RPC_LIMPAR = "limpar_conversa_chat";
const RPC_REAGIR = "alternar_reacao_chat";

const TEMPO_LIMITE_MS = 30000;
const DIGITANDO_MS = 4000;
const RELER_LISTA_MS = 60000;
const CHAVE_PREFERENCIAS = "monitora.chat.preferencias";

const ESTADO_INICIAL = Object.freeze({
  ligado: false,
  eu: null,
  aberto: false,
  visao: "lista",
  conversas: [],
  carregado: false,
  carregandoConversas: false,
  erro: "",
  conversaId: null,
  conversa: null,
  mensagens: [],
  carregandoMensagens: false,
  temMais: false,
  erroDaConversa: "",
  digitando: {},
  pessoas: [],
  buscandoPessoas: false,
  acao: null,
  reconectando: false,
  preferencias: { som: false, notificacoes: false },
  avisos: [],
});

export function mensagemDoBanco(erro) {
  if (erro?.code === "PGRST202")
    return "As mensagens ainda não foram publicadas no banco.";
  if (erro?.code === "42501") return "Seu acesso não inclui esta conversa.";
  if (erro?.code === "P0002") return "Conversa não encontrada.";
  if (ehFalhaDeConexao(erro)) return mensagemDeFalha(erro);
  return erro?.message || mensagemDeFalha(erro);
}

function lerPreferencias(armazenamento) {
  try {
    const salvo = JSON.parse(
      armazenamento?.getItem(CHAVE_PREFERENCIAS) || "{}",
    );
    return {
      som: salvo.som === true,
      notificacoes: salvo.notificacoes === true,
    };
  } catch {
    return { ...ESTADO_INICIAL.preferencias };
  }
}

function guardarPreferencias(armazenamento, preferencias) {
  try {
    armazenamento?.setItem(CHAVE_PREFERENCIAS, JSON.stringify(preferencias));
  } catch {
    /* navegador sem armazenamento: vale só nesta visita */
  }
}

/* Um "plim" curto, sem arquivo de áudio. */
function tocarPlim(janela = globalThis.window) {
  try {
    const Contexto = janela?.AudioContext || janela?.webkitAudioContext;
    if (!Contexto) return;
    const ctx = new Contexto();
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.frequency.value = 880;
    ganho.gain.setValueAtTime(0.08, ctx.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(ganho).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => ctx.close?.();
  } catch {
    /* sem áudio */
  }
}

function novoId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (
        Number(c) ^
        (Math.floor(Math.random() * 256) & (15 >> (Number(c) / 4)))
      ).toString(16),
    )
  );
}

export function criarEstadoDoChat({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  documento = globalThis.document,
  janela = globalThis.window,
  armazenamento = (() => {
    try {
      return globalThis.localStorage;
    } catch {
      return null;
    }
  })(),
  tocarSom = () => tocarPlim(janela),
  notificar = (titulo, opcoes) => {
    const Notificacao = janela?.Notification;
    if (Notificacao?.permission === "granted")
      return new Notificacao(titulo, opcoes);
    return null;
  },
  definirTitulo = (total) => definirNaoLidasDaAba(total, documento),
  tempoLimiteMs = TEMPO_LIMITE_MS,
  agora = () => new Date(),
} = {}) {
  let estado = {
    ...ESTADO_INICIAL,
    preferencias: lerPreferencias(armazenamento),
  };
  const ouvintes = new Set();
  let canalDoUsuario = null;
  let canalDaConversa = null;
  let caiu = false;
  let pedidoDaConversa = 0;
  let pedidoDaLista = 0;
  let pedidoDasPessoas = 0;
  let releituraAgendada = null;
  let intervaloDaLista = null;
  let leituraAgendada = null;
  let ultimoDigitando = 0;
  const temporizadoresDigitando = new Map();

  function publicar(mudancas) {
    const antes = estado;
    estado = { ...estado, ...mudancas };
    if (antes.conversas !== estado.conversas || antes.ligado !== estado.ligado)
      definirTitulo(estado.ligado ? totalDeNaoLidas(estado.conversas) : 0);
    for (const ouvinte of ouvintes) ouvinte();
  }

  async function rpc(nome, argumentos) {
    if (!supabase) throw new Error("Sem conexão com o banco.");
    const { data, error } = await comTempoLimite(
      supabase.rpc(nome, argumentos),
      tempoLimiteMs,
    );
    if (error) throw error;
    return data;
  }

  const visivel = () => documento?.visibilityState !== "hidden";
  const conversaAVista = (id) =>
    estado.aberto &&
    estado.visao === "conversa" &&
    estado.conversaId === id &&
    visivel();

  function trocarConversaNaLista(conversa) {
    if (!conversa?.id) return;
    const outras = estado.conversas.filter((c) => c.id !== conversa.id);
    const lista = conversa.participa === false ? outras : [conversa, ...outras];
    publicar({ conversas: ordenarConversas(lista) });
  }

  // ── Lista ────────────────────────────────────────────────────────────────

  async function carregarConversas({ silencioso = false } = {}) {
    if (!estado.ligado) return false;
    const meu = ++pedidoDaLista;
    if (!silencioso) publicar({ carregandoConversas: true, erro: "" });
    try {
      const dados = await rpc(RPC_LISTAR_CONVERSAS);
      if (meu !== pedidoDaLista || !estado.ligado) return false;
      const conversas = ordenarConversas(
        Array.isArray(dados?.conversas) ? dados.conversas : [],
      );
      const aberta = conversas.find((c) => c.id === estado.conversaId);
      publicar({
        conversas,
        carregado: true,
        carregandoConversas: false,
        erro: "",
        ...(aberta ? { conversa: { ...estado.conversa, ...aberta } } : {}),
      });
      return true;
    } catch (erro) {
      if (meu !== pedidoDaLista) return false;
      publicar({ carregandoConversas: false, erro: mensagemDoBanco(erro) });
      return false;
    }
  }

  function agendarReleitura(ms = 600) {
    clearTimeout(releituraAgendada);
    releituraAgendada = setTimeout(
      () => void carregarConversas({ silencioso: true }),
      ms,
    );
  }

  // ── Tempo real ───────────────────────────────────────────────────────────

  function aoMudarMensagem(payload) {
    const mensagem = mensagemDaLinha(payload?.new);
    if (!mensagem) return;
    const daAberta = mensagem.conversa === estado.conversaId;
    const conversa = estado.conversas.find((c) => c.id === mensagem.conversa);
    if (mensagem.apagada) tirarAvisoDaMensagem(mensagem.id);
    if (!daAberta && !conversa) {
      // Conversa nova (alguém começou com a pessoa) ou do edital que ela não
      // acompanha: a lista relida diz qual é.
      if (payload.eventType === "INSERT") void avisarDepoisDeReler(mensagem);
      return;
    }
    const limpaEm =
      (daAberta ? estado.conversa?.limpa_em : null) ?? conversa?.limpa_em;
    if (!depoisDaLimpeza(mensagem, limpaEm)) return; // a pessoa limpou
    if (daAberta) {
      publicar({ mensagens: mesclarMensagens(estado.mensagens, [mensagem]) });
      if (conversaAVista(mensagem.conversa)) agendarLeitura();
    }
    if (payload.eventType === "INSERT") {
      const aVista = conversaAVista(mensagem.conversa);
      if (conversa) {
        const minha = String(mensagem.autor) === String(estado.eu);
        trocarConversaNaLista({
          ...conversa,
          atualizada_em: mensagem.criada_em,
          ultima: {
            id: mensagem.id,
            autor: mensagem.autor,
            texto: mensagem.texto.slice(0, 160),
            apagada: mensagem.apagada,
            criada_em: mensagem.criada_em,
          },
          nao_lidas:
            minha || aVista
              ? conversa.nao_lidas || 0
              : (conversa.nao_lidas || 0) + 1,
        });
      }
      avisarChegada(mensagem, conversa || estado.conversa, aVista);
    }
    agendarReleitura();
  }

  async function avisarDepoisDeReler(mensagem) {
    if (!estado.carregado || mensagem.apagada) return;
    if (String(mensagem.autor) === String(estado.eu)) return;
    await carregarConversas({ silencioso: true });
    const conversa = estado.conversas.find((c) => c.id === mensagem.conversa);
    if (!conversa || !depoisDaLimpeza(mensagem, conversa.limpa_em)) return;
    avisarChegada(mensagem, conversa, conversaAVista(mensagem.conversa));
  }

  function avisarChegada(mensagem, conversa, abertaAVista) {
    const como = comoAvisar({
      mensagem,
      eu: estado.eu,
      conversa,
      abertaAVista,
      carregado: estado.carregado,
      abaVisivel: visivel(),
      preferencias: estado.preferencias,
    });
    const aviso =
      como.tela || como.navegador
        ? montarAviso({ mensagem, conversa, eu: estado.eu })
        : null;
    if (como.som) tocarSom();
    if (como.tela) publicar({ avisos: empilharAvisos(estado.avisos, aviso) });
    if (como.navegador) {
      const { titulo, corpo } = textoDaNotificacao(aviso);
      try {
        const notificacao = notificar(titulo, {
          body: corpo,
          tag: `monitora-chat-${aviso.conversa}`,
        });
        if (notificacao)
          notificacao.onclick = () => {
            janela?.focus?.();
            notificacao.close?.();
            void abrirConversa(aviso.conversa);
          };
      } catch {
        /* navegador recusou */
      }
    }
  }

  function tirarAvisoDaMensagem(id) {
    if (estado.avisos.some((a) => a.id === id))
      publicar({ avisos: estado.avisos.filter((a) => a.id !== id) });
  }

  function abrirDoAviso(id) {
    const aviso = estado.avisos.find((a) => a.id === id);
    if (!aviso) return Promise.resolve(false);
    return abrirConversa(aviso.conversa);
  }

  function aoMudarReacao(payload) {
    const linha = payload?.new;
    if (!linha?.CO_CONVERSA || linha.CO_CONVERSA !== estado.conversaId) return;
    const mensagens = aplicarReacaoDaLinha(estado.mensagens, linha);
    if (mensagens !== estado.mensagens) publicar({ mensagens });
  }

  function aoMudarStatus(status) {
    if (status === "SUBSCRIBED") {
      if (caiu) {
        caiu = false;
        publicar({ reconectando: false });
        void recarregarTudo();
      }
      return;
    }
    if (
      ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status) &&
      estado.ligado
    ) {
      caiu = true;
      publicar({ reconectando: true });
    }
  }

  function assinarCanalDoUsuario() {
    if (!supabase?.channel || canalDoUsuario) return;
    canalDoUsuario = supabase
      .channel(`chat-usuario:${estado.eu}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "TB_MENSAGEM" },
        aoMudarMensagem,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "RL_CONVERSA_PARTICIPANTE",
          filter: `CO_USUARIO=eq.${estado.eu}`,
        },
        () => agendarReleitura(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "RL_MENSAGEM_REACAO" },
        aoMudarReacao,
      )
      .subscribe(aoMudarStatus);
  }

  function aoReceberDigitando(evento) {
    const { usuario, nome, conversa } = evento?.payload || {};
    if (!usuario || String(usuario) === String(estado.eu)) return;
    if (conversa !== estado.conversaId) return;
    clearTimeout(temporizadoresDigitando.get(usuario));
    publicar({
      digitando: { ...estado.digitando, [usuario]: nome || "Alguém" },
    });
    temporizadoresDigitando.set(
      usuario,
      setTimeout(() => {
        const { [usuario]: _fora, ...resto } = estado.digitando;
        publicar({ digitando: resto });
      }, DIGITANDO_MS),
    );
  }

  function assinarCanalDaConversa(id) {
    sairDoCanalDaConversa();
    if (!supabase?.channel || !id) return;
    canalDaConversa = supabase
      .channel(`chat:${id}`, { config: { private: true } })
      .on("broadcast", { event: "digitando" }, aoReceberDigitando)
      .subscribe();
  }

  function sairDoCanalDaConversa() {
    for (const t of temporizadoresDigitando.values()) clearTimeout(t);
    temporizadoresDigitando.clear();
    if (canalDaConversa) void supabase?.removeChannel?.(canalDaConversa);
    canalDaConversa = null;
    if (Object.keys(estado.digitando).length) publicar({ digitando: {} });
  }

  function aoMudarVisibilidade() {
    if (visivel() && estado.ligado) void recarregarTudo();
  }

  async function recarregarTudo() {
    await carregarConversas({ silencioso: true });
    if (estado.conversaId)
      await carregarMensagens(estado.conversaId, { silencioso: true });
  }

  // ── Ligar e desligar (sessão e permissão) ────────────────────────────────

  function ligar(eu) {
    if (!eu) return desligar();
    if (estado.ligado && estado.eu === eu) return;
    if (estado.ligado) desligar();
    publicar({
      ...ESTADO_INICIAL,
      preferencias: estado.preferencias,
      ligado: true,
      eu,
    });
    assinarCanalDoUsuario();
    documento?.addEventListener?.("visibilitychange", aoMudarVisibilidade);
    intervaloDaLista = setInterval(() => {
      if (visivel()) void carregarConversas({ silencioso: true });
    }, RELER_LISTA_MS);
    void carregarConversas();
  }

  function desligar() {
    clearTimeout(releituraAgendada);
    clearTimeout(leituraAgendada);
    clearInterval(intervaloDaLista);
    intervaloDaLista = null;
    sairDoCanalDaConversa();
    if (canalDoUsuario) void supabase?.removeChannel?.(canalDoUsuario);
    canalDoUsuario = null;
    caiu = false;
    documento?.removeEventListener?.("visibilitychange", aoMudarVisibilidade);
    pedidoDaLista += 1;
    pedidoDaConversa += 1;
    if (estado.ligado || estado.conversas.length)
      publicar({ ...ESTADO_INICIAL, preferencias: estado.preferencias });
  }

  // ── Painel ───────────────────────────────────────────────────────────────

  function abrir() {
    if (!estado.ligado) return;
    publicar({ aberto: true });
    if (!estado.carregado) void carregarConversas();
    if (estado.visao === "conversa" && estado.conversaId) agendarLeitura(0);
  }

  function fechar() {
    publicar({ aberto: false });
  }

  function alternar() {
    if (estado.aberto) fechar();
    else abrir();
  }

  function voltarParaLista() {
    pedidoDaConversa += 1;
    sairDoCanalDaConversa();
    publicar({
      visao: "lista",
      conversaId: null,
      conversa: null,
      mensagens: [],
      temMais: false,
      erroDaConversa: "",
      carregandoMensagens: false,
    });
  }

  function mostrar(visao) {
    publicar({ visao, pessoas: [] });
  }

  // ── Conversa ─────────────────────────────────────────────────────────────

  async function carregarMensagens(
    id,
    { silencioso = false, antes = null } = {},
  ) {
    const meu = ++pedidoDaConversa;
    if (!silencioso)
      publicar({ carregandoMensagens: true, erroDaConversa: "" });
    try {
      const dados = await rpc(RPC_LISTAR_MENSAGENS, {
        p_conversa: id,
        p_antes: antes,
        p_limite: MENSAGENS_POR_PAGINA,
      });
      if (meu !== pedidoDaConversa || estado.conversaId !== id) return false;
      const recebidas = Array.isArray(dados?.mensagens) ? dados.mensagens : [];
      publicar({
        conversa: dados?.conversa
          ? { ...estado.conversa, ...dados.conversa }
          : estado.conversa,
        mensagens: mesclarMensagens(estado.mensagens, recebidas),
        ...(antes || !silencioso ? { temMais: Boolean(dados?.tem_mais) } : {}),
        carregandoMensagens: false,
        erroDaConversa: "",
      });
      if (conversaAVista(id)) agendarLeitura(0);
      return true;
    } catch (erro) {
      if (meu !== pedidoDaConversa) return false;
      publicar({
        carregandoMensagens: false,
        erroDaConversa: mensagemDoBanco(erro),
      });
      return false;
    }
  }

  async function abrirConversa(id, conversa = null) {
    if (!estado.ligado || !id) return false;
    const daLista =
      conversa || estado.conversas.find((c) => c.id === id) || null;
    if (estado.conversaId !== id) {
      sairDoCanalDaConversa();
      publicar({
        conversaId: id,
        conversa: daLista,
        mensagens: [],
        temMais: false,
        erroDaConversa: "",
      });
      assinarCanalDaConversa(id);
    }
    publicar({
      aberto: true,
      visao: "conversa",
      avisos: estado.avisos.filter((a) => a.conversa !== id),
    });
    return carregarMensagens(id);
  }

  async function comAcao(tipo, rotulo, fazer) {
    if (estado.acao) return null;
    publicar({ acao: { tipo, rotulo } });
    try {
      return await fazer();
    } catch (erro) {
      toast(mensagemDoBanco(erro), "error");
      return null;
    } finally {
      publicar({ acao: null });
    }
  }

  async function abrirConversaDireta(usuarioId) {
    if (!estado.ligado || !usuarioId) return false;
    const conversa = await comAcao("abrir", "Abrindo…", () =>
      rpc(RPC_ABRIR_DIRETA, { p_usuario: usuarioId }),
    );
    if (!conversa?.id) return false;
    trocarConversaNaLista(conversa);
    return abrirConversa(conversa.id, conversa);
  }

  async function abrirConversaDoEdital(edital) {
    if (!estado.ligado || !edital?.id) return false;
    const conversa = await comAcao("abrir", "Abrindo…", () =>
      rpc(RPC_ABRIR_EDITAL, { p_edital: edital.id }),
    );
    if (!conversa?.id) return false;
    trocarConversaNaLista(conversa);
    return abrirConversa(conversa.id, conversa);
  }

  function carregarAnteriores() {
    const primeira = estado.mensagens.find((m) => !m.pendente);
    if (!estado.conversaId || !primeira) return Promise.resolve(false);
    return carregarMensagens(estado.conversaId, { antes: primeira.criada_em });
  }

  function agendarLeitura(ms = 400) {
    clearTimeout(leituraAgendada);
    leituraAgendada = setTimeout(() => void marcarLida(), ms);
  }

  async function marcarLida() {
    const id = estado.conversaId;
    if (!id || !estado.ligado) return false;
    const gravadas = estado.mensagens.filter((m) => !m.pendente && !m.falhou);
    const ultima = gravadas.at(-1);
    const conversa = estado.conversas.find((c) => c.id === id);
    const pendentes =
      (conversa?.nao_lidas || 0) +
      naoLidasDasMensagens(
        gravadas,
        conversa?.lida_em ?? estado.conversa?.lida_em,
        estado.eu,
      );
    if (conversa && !pendentes) return true;
    try {
      const dados = await rpc(RPC_MARCAR_LIDA, {
        p_conversa: id,
        p_ate: ultima?.criada_em ?? null,
      });
      const daLista = estado.conversas.find((c) => c.id === id);
      if (daLista)
        trocarConversaNaLista({
          ...daLista,
          nao_lidas: 0,
          mencoes: 0,
          lida_em: dados?.lida_em ?? daLista.lida_em,
          participa: true,
        });
      else agendarReleitura(0);
      return true;
    } catch {
      return false;
    }
  }

  async function enviar(texto, { link = null, mencoes = [] } = {}) {
    const id = estado.conversaId;
    const validacao = validarTexto(texto);
    if (!id || !validacao.ok) {
      if (!validacao.ok) toast(validacao.erro, "warn");
      return false;
    }
    const linkConferido = link ? linkDaTela(link) : null;
    const mensagem = {
      id: novoId(),
      conversa: id,
      autor: estado.eu,
      texto: String(texto).slice(0, LIMITE_DO_TEXTO),
      link: linkConferido,
      mencoes,
      criada_em: agora().toISOString(),
      editada_em: null,
      apagada: false,
      pendente: true,
    };
    publicar({ mensagens: mesclarMensagens(estado.mensagens, [mensagem]) });
    return gravar(mensagem);
  }

  async function gravar(mensagem) {
    try {
      const gravada = await rpc(RPC_ENVIAR, {
        p_conversa: mensagem.conversa,
        p_texto: mensagem.texto,
        p_link_tela: mensagem.link,
        p_mencoes: mensagem.mencoes?.length ? mensagem.mencoes : null,
        p_mensagem: mensagem.id,
      });
      if (estado.conversaId === mensagem.conversa)
        publicar({
          mensagens: mesclarMensagens(estado.mensagens, [
            { ...gravada, pendente: false, falhou: false },
          ]),
        });
      agendarReleitura(200);
      return true;
    } catch (erro) {
      if (estado.conversaId === mensagem.conversa)
        publicar({
          mensagens: mesclarMensagens(estado.mensagens, [
            { ...mensagem, pendente: false, falhou: true },
          ]),
        });
      toast(mensagemDoBanco(erro), "error");
      return false;
    }
  }

  function reenviar(id) {
    const mensagem = estado.mensagens.find((m) => m.id === id && m.falhou);
    if (!mensagem) return Promise.resolve(false);
    publicar({
      mensagens: mesclarMensagens(estado.mensagens, [
        { ...mensagem, pendente: true, falhou: false },
      ]),
    });
    return gravar(mensagem);
  }

  function descartar(id) {
    publicar({
      mensagens: estado.mensagens.filter((m) => !(m.id === id && m.falhou)),
    });
  }

  async function editar(id, texto) {
    const validacao = validarTexto(texto);
    if (!validacao.ok) {
      toast(validacao.erro, "warn");
      return false;
    }
    const gravada = await comAcao("editar", "Salvando…", () =>
      rpc(RPC_EDITAR, { p_mensagem: id, p_texto: texto }),
    );
    if (!gravada?.id) return false;
    publicar({ mensagens: mesclarMensagens(estado.mensagens, [gravada]) });
    return true;
  }

  async function apagar(id) {
    const gravada = await comAcao("apagar", "Apagando…", () =>
      rpc(RPC_APAGAR, { p_mensagem: id }),
    );
    if (!gravada?.id) return false;
    publicar({ mensagens: mesclarMensagens(estado.mensagens, [gravada]) });
    agendarReleitura(200);
    return true;
  }

  async function alternarReacao(id, emoji) {
    const mensagem = estado.mensagens.find((m) => m.id === id);
    if (
      !mensagem ||
      mensagem.apagada ||
      mensagem.pendente ||
      mensagem.falhou ||
      !REACOES_RAPIDAS.includes(emoji)
    )
      return false;
    const antes = mensagem.reacoes || [];
    const trocar = (reacoes) =>
      publicar({
        mensagens: estado.mensagens.map((m) =>
          m.id === id ? { ...m, reacoes } : m,
        ),
      });
    // Na hora, na tela; a resposta (ou o Realtime) confirma.
    trocar(reacoesComAlternancia(antes, emoji, estado.eu));
    try {
      const gravada = await rpc(RPC_REAGIR, {
        p_mensagem: id,
        p_emoji: emoji,
      });
      if (gravada?.id && estado.conversaId === gravada.conversa)
        publicar({ mensagens: mesclarMensagens(estado.mensagens, [gravada]) });
      return true;
    } catch (erro) {
      if (estado.mensagens.some((m) => m.id === id)) trocar(antes);
      toast(mensagemDoBanco(erro), "error");
      return false;
    }
  }

  function avisarDigitando(nome) {
    if (!canalDaConversa || !estado.conversaId) return;
    const instante = Date.now();
    if (instante - ultimoDigitando < 2500) return;
    ultimoDigitando = instante;
    try {
      void canalDaConversa.send?.({
        type: "broadcast",
        event: "digitando",
        payload: { usuario: estado.eu, nome, conversa: estado.conversaId },
      });
    } catch {
      /* sem tempo real: só não avisa */
    }
  }

  // ── Pessoas, grupo e participação ────────────────────────────────────────

  async function buscarPessoas(termo = "") {
    const meu = ++pedidoDasPessoas;
    publicar({ buscandoPessoas: true });
    try {
      const dados = await rpc(RPC_LISTAR_PESSOAS, {
        p_busca: String(termo || ""),
      });
      if (meu !== pedidoDasPessoas) return false;
      publicar({
        pessoas: Array.isArray(dados?.pessoas) ? dados.pessoas : [],
        buscandoPessoas: false,
      });
      return true;
    } catch (erro) {
      if (meu !== pedidoDasPessoas) return false;
      publicar({ buscandoPessoas: false });
      toast(mensagemDoBanco(erro), "error");
      return false;
    }
  }

  async function criarGrupo(nome, participantes) {
    const conversa = await comAcao("grupo", "Criando…", () =>
      rpc(RPC_CRIAR_GRUPO, { p_nome: nome, p_participantes: participantes }),
    );
    if (!conversa?.id) return false;
    trocarConversaNaLista(conversa);
    return abrirConversa(conversa.id, conversa);
  }

  async function adicionarParticipantes(participantes) {
    const id = estado.conversaId;
    if (!id) return false;
    const conversa = await comAcao("adicionar", "Adicionando…", () =>
      rpc(RPC_ADICIONAR, { p_conversa: id, p_participantes: participantes }),
    );
    if (!conversa?.id) return false;
    trocarConversaNaLista(conversa);
    publicar({
      conversa: { ...estado.conversa, ...conversa },
      visao: "conversa",
    });
    return true;
  }

  async function sair() {
    const id = estado.conversaId;
    if (!id) return false;
    const feito = await comAcao("sair", "Saindo…", () =>
      rpc(RPC_SAIR, { p_conversa: id }),
    );
    if (!feito) return false;
    publicar({ conversas: estado.conversas.filter((c) => c.id !== id) });
    voltarParaLista();
    return true;
  }

  /* Limpar conversa (para mim): o histórico até agora some só para a pessoa. */
  async function limparConversa() {
    const id = estado.conversaId;
    if (!id) return false;
    const conversa = await comAcao("limpar", "Limpando…", () =>
      rpc(RPC_LIMPAR, { p_conversa: id }),
    );
    if (!conversa?.id || estado.conversaId !== id) return false;
    trocarConversaNaLista(conversa);
    publicar({
      conversa: { ...estado.conversa, ...conversa },
      mensagens: estado.mensagens.filter((m) =>
        depoisDaLimpeza(m, conversa.limpa_em),
      ),
      temMais: false,
    });
    return true;
  }

  async function silenciar(silenciada) {
    const id = estado.conversaId;
    if (!id) return false;
    const conversa = await comAcao("silenciar", "Salvando…", () =>
      rpc(RPC_SILENCIAR, { p_conversa: id, p_silenciada: Boolean(silenciada) }),
    );
    if (!conversa?.id) return false;
    trocarConversaNaLista(conversa);
    publicar({ conversa: { ...estado.conversa, ...conversa } });
    return true;
  }

  // ── Preferências ─────────────────────────────────────────────────────────

  async function definirPreferencia(chave, valor) {
    if (!["som", "notificacoes"].includes(chave)) return false;
    let ligado = Boolean(valor);
    if (chave === "notificacoes" && ligado) {
      const Notificacao = janela?.Notification;
      if (!Notificacao) {
        toast("Este navegador não mostra notificações.", "warn");
        ligado = false;
      } else if (Notificacao.permission !== "granted") {
        const resposta = await Notificacao.requestPermission?.();
        if (resposta !== "granted") {
          toast("As notificações estão bloqueadas neste navegador.", "warn");
          ligado = false;
        }
      }
    }
    const preferencias = { ...estado.preferencias, [chave]: ligado };
    guardarPreferencias(armazenamento, preferencias);
    publicar({ preferencias });
    return ligado;
  }

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    ligar,
    desligar,
    abrir,
    fechar,
    alternar,
    mostrar,
    voltarParaLista,
    carregarConversas,
    abrirConversa,
    abrirConversaDireta,
    abrirConversaDoEdital,
    carregarAnteriores,
    marcarLida,
    enviar,
    reenviar,
    descartar,
    editar,
    apagar,
    avisarDigitando,
    buscarPessoas,
    criarGrupo,
    adicionarParticipantes,
    sair,
    silenciar,
    limparConversa,
    alternarReacao,
    definirPreferencia,
    dispensarAviso: tirarAvisoDaMensagem,
    abrirDoAviso,
    recarregarTudo,
    avisar: (mensagem) => toast(mensagem, "warn"),
    informar: (mensagem) => toast(mensagem, "success"),
    /** Só para os testes: o que o Realtime entregaria. */
    _aoMudarMensagem: aoMudarMensagem,
    _aoMudarStatus: aoMudarStatus,
    _aoMudarReacao: aoMudarReacao,
    _aoReceberDigitando: aoReceberDigitando,
  };
}
