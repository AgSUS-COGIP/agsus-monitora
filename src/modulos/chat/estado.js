/*
  Estado do chat (painel "Mensagens"), fora do React. Os componentes leem com
  `useSyncExternalStore(estado.assinar, estado.obter)`. Não importa React.

  RPCs (supabase/migrations/20261002210000_chat.sql; contrato em
  src/lib/rpc-contrato.js): listar_conversas_chat, listar_mensagens_chat,
  listar_pessoas_chat, enviar_mensagem_chat, editar_mensagem_chat,
  apagar_mensagem_chat, marcar_conversa_lida_chat, abrir_conversa_direta_chat,
  criar_grupo_chat, adicionar_participantes_chat, sair_conversa_chat,
  silenciar_conversa_chat e abrir_conversa_edital_chat; da v1.1
  (20261005100000_chat_limpar_e_reacoes.sql), limpar_conversa_chat e
  alternar_reacao_chat; e da v2 (20261007210000_chat_v2.sql), enviar com
  citação e anexos, obter_mensagem_chat, encaminhar_mensagem_chat,
  buscar_mensagens_chat, fixar_conversa_chat, marcar_nao_lida_chat e
  definir_status_chat.

  Anexos (v2): o arquivo sobe para o bucket privado chat-anexos (caminho
  <conversa>/<uuid>.<extensão>) e só depois a RPC de envio registra; o que
  já subiu não sobe de novo ao tentar outra vez. Miniatura e download por URL
  assinada curta (createSignedUrl, 60 s).

  Tempo real (Supabase Realtime, com a RLS do banco):
    - canal "chat-usuario:<eu>": postgres_changes de TB_MENSAGEM (todas as que a
      pessoa pode ler) e de RL_CONVERSA_PARTICIPANTE (as linhas dela). Mensagem
      da conversa aberta entra na hora (sem duplicar: `mesclarMensagens`); a
      lista é relida logo depois (contagem e prévia certas). O que a pessoa
      limpou (limpa_em) não volta pelo Realtime. Reações (RL_MENSAGEM_REACAO)
      da conversa aberta entram na mensagem (aplicarReacaoDaLinha). A linha
      com anexo ou citação é completada por obter_mensagem_chat. A leitura
      dos outros participantes da conversa aberta atualiza o Visto
      (aplicarLeituraDaLinha; a RLS só entrega a quem participa). DELETE de
      TB_MENSAGEM (retenção ou "Zerar mensagens" das Configurações, só com a
      chave): a mensagem sai da tela (tirarMensagens); a releitura da página
      mais nova também tira o que sumiu do banco (reconciliarPagina).
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
  aplicarLeituraDaLinha,
  aplicarReacaoDaLinha,
  citacaoDe,
  depoisDaLimpeza,
  LIMITE_DO_TEXTO,
  linkDaTela,
  MENSAGENS_POR_PAGINA,
  mensagemDaLinha,
  mesclarMensagens,
  naoLidasDasMensagens,
  ordenarConversas,
  podeEnviar,
  precisaCompletar,
  REACOES_RAPIDAS,
  reacoesComAlternancia,
  reconciliarPagina,
  STATUS_DE_PRESENCA,
  termoDeBuscaValido,
  tirarMensagens,
  totalDeNaoLidas,
  validarTexto,
} from "../../lib/chat.js";
import {
  BUCKET_DO_CHAT,
  caminhoDoAnexoDoChat,
  VALIDADE_DA_URL_DO_ANEXO,
} from "../../lib/anexos-do-chat.js";
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
const RPC_OBTER_MENSAGEM = "obter_mensagem_chat";
const RPC_ENCAMINHAR = "encaminhar_mensagem_chat";
const RPC_BUSCAR = "buscar_mensagens_chat";
const RPC_FIXAR = "fixar_conversa_chat";
const RPC_NAO_LIDA = "marcar_nao_lida_chat";
const RPC_STATUS = "definir_status_chat";

const TEMPO_LIMITE_MS = 30000;
const DIGITANDO_MS = 4000;
const RELER_LISTA_MS = 60000;
/* Quantas páginas antigas buscar para achar a mensagem (busca, citação). */
const PAGINAS_PARA_ACHAR = 10;
/* A URL assinada vale 60 s; a miniatura reaproveita por um pouco menos. */
const GUARDAR_URL_MS = 45000;
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
  // v2
  resposta: null,
  destaque: null,
  busca: { termo: "", resultados: [], carregando: false, erro: "" },
  meuStatus: "DISPONIVEL",
  /* paginasPermitidas(perfil) de quem está logado: o "Abrir" dos cartões. */
  paginas: null,
  compartilhando: null,
  linkPendente: null,
  encaminhando: null,
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
  /* Prévia local do anexo antes de subir (imagem): URL do navegador. */
  criarUrlLocal = (arquivo) => {
    try {
      return globalThis.URL?.createObjectURL?.(arquivo) ?? null;
    } catch {
      return null;
    }
  },
  liberarUrlLocal = (url) => {
    try {
      globalThis.URL?.revokeObjectURL?.(url);
    } catch {
      /* sem URL local */
    }
  },
} = {}) {
  let estado = {
    ...ESTADO_INICIAL,
    preferencias: lerPreferencias(armazenamento),
  };
  /* Arquivos de cada mensagem pendente (id → [{ arquivo, caminho, mime, enviado }]). */
  const arquivos = new Map();
  /* URLs assinadas recentes (caminho → { url, ate }) e as mensagens em completação. */
  const urlsAssinadas = new Map();
  const completando = new Set();
  let pedidoDaBusca = 0;
  let vezDoDestaque = 0;
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
      const meuStatus = STATUS_DE_PRESENCA.some(
        (s) => s.valor === dados?.meu_status,
      )
        ? dados.meu_status
        : estado.meuStatus;
      publicar({
        conversas,
        meuStatus,
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

  /*
    DELETE: a retenção ou o "Zerar mensagens" (Configurações) apagaram de
    fato. O Realtime manda só a chave (sem RLS no DELETE): a mensagem sai da
    conversa aberta e dos avisos, e a lista é relida (prévia e não lidas).
  */
  function aoApagarMensagem(payload) {
    const id = payload?.old?.CO_MENSAGEM;
    if (!id) return;
    const mensagens = tirarMensagens(estado.mensagens, [id]);
    if (mensagens !== estado.mensagens) publicar({ mensagens });
    tirarAvisoDaMensagem(id);
    agendarReleitura();
  }

  function aoMudarMensagem(payload) {
    if (payload?.eventType === "DELETE") return aoApagarMensagem(payload);
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
      const naTela = estado.mensagens.find((m) => m.id === mensagem.id);
      if (precisaCompletar(naTela)) void completarMensagem(mensagem.id);
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

  /* A linha do Realtime anuncia anexos ou citação: a mensagem inteira vem da RPC. */
  async function completarMensagem(id) {
    if (completando.has(id)) return false;
    completando.add(id);
    try {
      const inteira = await rpc(RPC_OBTER_MENSAGEM, { p_mensagem: id });
      if (inteira?.id && inteira.conversa === estado.conversaId)
        publicar({
          mensagens: mesclarMensagens(estado.mensagens, [
            { ...inteira, qt_anexo: undefined, resposta_id: undefined },
          ]),
        });
      return Boolean(inteira?.id);
    } catch {
      return false;
    } finally {
      completando.delete(id);
    }
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

  /*
    RL_CONVERSA_PARTICIPANTE (a RLS entrega a própria linha e as das conversas
    em que a pessoa participa): a própria relê a lista; a de outra pessoa na
    conversa aberta atualiza o Visto (ou, se não mudou a leitura — alguém
    entrou ou saiu —, relê a lista).
  */
  function aoMudarParticipante(payload) {
    const linha = payload?.new;
    if (!linha?.CO_USUARIO || String(linha.CO_USUARIO) === String(estado.eu))
      return agendarReleitura();
    if (linha.CO_CONVERSA !== estado.conversaId || !estado.conversa) return;
    const conversa = aplicarLeituraDaLinha(estado.conversa, linha);
    if (conversa !== estado.conversa) publicar({ conversa });
    else agendarReleitura();
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
        },
        aoMudarParticipante,
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
    pedidoDaBusca += 1;
    liberarPreviasLocais(estado.mensagens);
    arquivos.clear();
    urlsAssinadas.clear();
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
    clearTimeout(leituraAgendada);
    sairDoCanalDaConversa();
    liberarPreviasLocais(estado.mensagens);
    publicar({
      visao: "lista",
      conversaId: null,
      conversa: null,
      mensagens: [],
      temMais: false,
      erroDaConversa: "",
      carregandoMensagens: false,
      resposta: null,
      destaque: null,
      encaminhando: null,
    });
  }

  function mostrar(visao) {
    publicar({ visao, pessoas: [] });
  }

  /* As prévias locais (URL do navegador) das mensagens que saem da tela. */
  function liberarPreviasLocais(mensagens) {
    for (const m of mensagens || [])
      for (const a of m?.anexos || []) if (a?.previa) liberarUrlLocal(a.previa);
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
        // Página mais nova: o que sumiu do banco (retenção, zerar) sai da tela.
        mensagens: antes
          ? mesclarMensagens(estado.mensagens, recebidas)
          : reconciliarPagina(
              estado.mensagens,
              recebidas,
              Boolean(dados?.tem_mais),
            ),
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
      liberarPreviasLocais(estado.mensagens);
      publicar({
        conversaId: id,
        conversa: daLista,
        mensagens: [],
        temMais: false,
        erroDaConversa: "",
        resposta: null,
        destaque: null,
      });
      assinarCanalDaConversa(id);
    }
    publicar({
      aberto: true,
      visao: "conversa",
      avisos: estado.avisos.filter((a) => a.conversa !== id),
      // "Compartilhar esta ficha": o cartão espera no campo desta conversa.
      ...(estado.compartilhando
        ? {
            linkPendente: { conversa: id, link: estado.compartilhando },
            compartilhando: null,
          }
        : {}),
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
    if (conversa && !pendentes && !conversa.marcada_nao_lida) return true;
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
          marcada_nao_lida: false,
          lida_em: dados?.lida_em ?? daLista.lida_em,
          participa: true,
        });
      else agendarReleitura(0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Envia a mensagem da conversa aberta. `anexos`: os de juntarAnexos
   * (src/lib/anexos-do-chat.js: `{ arquivo, mime, extensao }`); `resposta`: a
   * citação (estado.resposta, de citacaoDe).
   */
  async function enviar(
    texto,
    { link = null, mencoes = [], anexos = [], resposta = null } = {},
  ) {
    const id = estado.conversaId;
    const linkConferido = link ? linkDaTela(link) : null;
    const lista = Array.isArray(anexos) ? anexos : [];
    const validacao = podeEnviar(texto, {
      anexos: lista.length,
      link: linkConferido,
    });
    if (!id || !validacao.ok) {
      if (!validacao.ok) toast(validacao.erro, "warn");
      return false;
    }
    const mensagemId = novoId();
    let paraSubir;
    try {
      paraSubir = lista.map((a) => {
        const anexoId = novoId();
        return {
          id: anexoId,
          arquivo: a.arquivo,
          mime: a.mime,
          caminho: caminhoDoAnexoDoChat(id, anexoId, a.extensao),
          enviado: false,
        };
      });
    } catch (erro) {
      toast(erro.message, "error");
      return false;
    }
    if (paraSubir.length) arquivos.set(mensagemId, paraSubir);
    const mensagem = {
      id: mensagemId,
      conversa: id,
      autor: estado.eu,
      texto: String(texto ?? "").slice(0, LIMITE_DO_TEXTO),
      link: linkConferido,
      mencoes,
      criada_em: agora().toISOString(),
      editada_em: null,
      apagada: false,
      pendente: true,
      resposta: resposta?.id ? resposta : null,
      anexos: paraSubir.map((p) => ({
        id: p.id,
        nome: String(p.arquivo?.name || "arquivo").slice(0, 200),
        mime: p.mime,
        bytes: p.arquivo?.size ?? 0,
        caminho: p.caminho,
        previa: p.mime.startsWith("image/") ? criarUrlLocal(p.arquivo) : null,
      })),
    };
    publicar({
      mensagens: mesclarMensagens(estado.mensagens, [mensagem]),
      resposta: null,
    });
    return gravar(mensagem);
  }

  /* Sobe ao bucket os arquivos da mensagem que ainda não subiram. */
  async function subirArquivos(mensagemId) {
    for (const p of arquivos.get(mensagemId) || []) {
      if (p.enviado) continue;
      if (!supabase?.storage?.from) throw new Error("Sem conexão com o banco.");
      const { error } = await comTempoLimite(
        supabase.storage
          .from(BUCKET_DO_CHAT)
          .upload(p.caminho, p.arquivo, { contentType: p.mime, upsert: false }),
        tempoLimiteMs * 4,
      );
      // Já subiu numa tentativa anterior (a resposta é que se perdeu).
      if (error && !/exist|duplicate/i.test(String(error.message || "")))
        throw error;
      p.enviado = true;
    }
  }

  async function gravar(mensagem) {
    try {
      await subirArquivos(mensagem.id);
      const gravada = await rpc(RPC_ENVIAR, {
        p_conversa: mensagem.conversa,
        p_texto: mensagem.texto,
        p_link_tela: mensagem.link,
        p_mencoes: mensagem.mencoes?.length ? mensagem.mencoes : null,
        p_mensagem: mensagem.id,
        p_resposta: mensagem.resposta?.id ?? null,
        p_anexos: mensagem.anexos?.length
          ? mensagem.anexos.map((a) => ({ caminho: a.caminho, nome: a.nome }))
          : null,
      });
      arquivos.delete(mensagem.id);
      if (estado.conversaId === mensagem.conversa) {
        const naTela = estado.mensagens.find((m) => m.id === mensagem.id);
        liberarPreviasLocais(naTela ? [naTela] : []);
        publicar({
          mensagens: mesclarMensagens(estado.mensagens, [
            { ...gravada, pendente: false, falhou: false },
          ]),
        });
      }
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
    const fora = estado.mensagens.find((m) => m.id === id && m.falhou);
    if (!fora) return;
    arquivos.delete(id);
    liberarPreviasLocais([fora]);
    publicar({ mensagens: estado.mensagens.filter((m) => m !== fora) });
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

  // ── Anexos: URL assinada curta ───────────────────────────────────────────

  /**
   * URL assinada (60 s) do anexo: para a miniatura (`baixar: false`, guardada
   * por 45 s) ou para baixar com o nome original. A política do bucket decide
   * quem recebe.
   */
  async function urlDoAnexo(anexo, { baixar = false } = {}) {
    if (!anexo?.caminho || !supabase?.storage?.from) return null;
    const guardada = urlsAssinadas.get(anexo.caminho);
    if (!baixar && guardada && guardada.ate > Date.now()) return guardada.url;
    const { data, error } = await comTempoLimite(
      supabase.storage
        .from(BUCKET_DO_CHAT)
        .createSignedUrl(
          anexo.caminho,
          VALIDADE_DA_URL_DO_ANEXO,
          baixar ? { download: String(anexo.nome || "arquivo") } : undefined,
        ),
      tempoLimiteMs,
    );
    if (error) throw error;
    const url = data?.signedUrl || null;
    if (url && !baixar)
      urlsAssinadas.set(anexo.caminho, {
        url,
        ate: Date.now() + GUARDAR_URL_MS,
      });
    return url;
  }

  async function baixarAnexo(anexo) {
    try {
      const url = await urlDoAnexo(anexo, { baixar: true });
      if (!url) throw new Error("Sem endereço para o arquivo.");
      const ancora = documento?.createElement?.("a");
      if (!ancora) return false;
      ancora.href = url;
      ancora.rel = "noopener";
      ancora.click();
      return true;
    } catch (erro) {
      toast(
        erro?.statusCode === "400" || erro?.status === 400
          ? "Este arquivo não está mais disponível."
          : mensagemDoBanco(erro),
        "error",
      );
      return false;
    }
  }

  // ── Responder, encaminhar e ir até a mensagem ────────────────────────────

  function responder(id) {
    const mensagem = estado.mensagens.find((m) => m.id === id);
    if (!mensagem || mensagem.apagada || mensagem.pendente || mensagem.falhou)
      return false;
    publicar({ resposta: citacaoDe(mensagem) });
    return true;
  }

  const cancelarResposta = () => publicar({ resposta: null });

  function pedirEncaminhamento(id) {
    const mensagem = estado.mensagens.find((m) => m.id === id);
    if (!mensagem || mensagem.apagada || mensagem.pendente || mensagem.falhou)
      return false;
    publicar({ encaminhando: citacaoDe(mensagem), visao: "encaminhar" });
    return true;
  }

  function cancelarEncaminhamento() {
    publicar({
      encaminhando: null,
      visao: estado.conversaId ? "conversa" : "lista",
    });
  }

  async function encaminhar(destino) {
    const origem = estado.encaminhando;
    if (!origem?.id || !destino) return false;
    const gravada = await comAcao("encaminhar", "Encaminhando…", () =>
      rpc(RPC_ENCAMINHAR, { p_mensagem: origem.id, p_conversa: destino }),
    );
    if (!gravada?.id) return false;
    publicar({ encaminhando: null });
    agendarReleitura(200);
    informar("Mensagem encaminhada.");
    return abrirConversa(destino);
  }

  /**
   * Abre a conversa e rola até a mensagem (resultado da busca, citação):
   * busca páginas mais antigas até achar (no máximo 10). Achou: `destaque`.
   */
  async function irParaMensagem(conversaId, mensagemId) {
    if (!conversaId || !mensagemId) return false;
    if (estado.conversaId !== conversaId || estado.visao !== "conversa") {
      const abriu = await abrirConversa(conversaId);
      if (!abriu) return false;
    }
    const tem = () => estado.mensagens.some((m) => m.id === mensagemId);
    for (let i = 0; i < PAGINAS_PARA_ACHAR && !tem() && estado.temMais; i++)
      if (!(await carregarAnteriores())) break;
    if (!tem()) {
      toast("Esta mensagem não está mais na conversa.", "warn");
      return false;
    }
    vezDoDestaque += 1;
    publicar({ destaque: { id: mensagemId, vez: vezDoDestaque } });
    return true;
  }

  // ── Busca ────────────────────────────────────────────────────────────────

  async function buscar(termo) {
    const meu = ++pedidoDaBusca;
    const t = String(termo ?? "").trim();
    if (!termoDeBuscaValido(t)) {
      publicar({
        busca: { termo: t, resultados: [], carregando: false, erro: "" },
      });
      return false;
    }
    publicar({
      busca: { ...estado.busca, termo: t, carregando: true, erro: "" },
    });
    try {
      const dados = await rpc(RPC_BUSCAR, { p_termo: t, p_limite: 30 });
      if (meu !== pedidoDaBusca) return false;
      publicar({
        busca: {
          termo: t,
          resultados: Array.isArray(dados?.resultados) ? dados.resultados : [],
          carregando: false,
          erro: "",
        },
      });
      return true;
    } catch (erro) {
      if (meu !== pedidoDaBusca) return false;
      publicar({
        busca: {
          termo: t,
          resultados: [],
          carregando: false,
          erro: mensagemDoBanco(erro),
        },
      });
      return false;
    }
  }

  // ── Fixar, não lida, status e compartilhar ───────────────────────────────

  async function fixar(id, fixada) {
    if (!id) return false;
    try {
      const conversa = await rpc(RPC_FIXAR, {
        p_conversa: id,
        p_fixada: Boolean(fixada),
      });
      if (!conversa?.id) return false;
      trocarConversaNaLista(conversa);
      if (estado.conversaId === id)
        publicar({ conversa: { ...estado.conversa, ...conversa } });
      return true;
    } catch (erro) {
      toast(mensagemDoBanco(erro), "error");
      return false;
    }
  }

  /* Marca como não lida e, se estava aberta, volta para a lista (senão a leitura desmarcaria). */
  async function marcarNaoLida(id) {
    if (!id) return false;
    try {
      const conversa = await rpc(RPC_NAO_LIDA, { p_conversa: id });
      if (!conversa?.id) return false;
      if (estado.conversaId === id) voltarParaLista();
      trocarConversaNaLista(conversa);
      return true;
    } catch (erro) {
      toast(mensagemDoBanco(erro), "error");
      return false;
    }
  }

  async function definirStatus(status) {
    if (!STATUS_DE_PRESENCA.some((s) => s.valor === status)) return false;
    const antes = estado.meuStatus;
    publicar({ meuStatus: status });
    try {
      const dados = await rpc(RPC_STATUS, { p_status: status });
      if (dados?.status) publicar({ meuStatus: dados.status });
      return true;
    } catch (erro) {
      publicar({ meuStatus: antes });
      toast(mensagemDoBanco(erro), "error");
      return false;
    }
  }

  /**
   * "Compartilhar esta ficha" (ou outra tela) de fora do painel: abre a lista
   * para escolher a conversa; o cartão espera no campo dela (linkPendente).
   */
  function compartilhar(link) {
    const conferido = linkDaTela(link);
    if (!estado.ligado || !conferido) return false;
    if (estado.conversaId) voltarParaLista();
    publicar({ aberto: true, visao: "lista", compartilhando: conferido });
    if (!estado.carregado) void carregarConversas();
    return true;
  }

  const cancelarCompartilhamento = () => publicar({ compartilhando: null });

  /* As páginas que quem está logado abre (chat.jsx, pela sessão do app). */
  function definirPaginas(paginas) {
    const valor = paginas && typeof paginas === "object" ? paginas : null;
    if (JSON.stringify(valor) !== JSON.stringify(estado.paginas))
      publicar({ paginas: valor });
  }

  function consumirLinkPendente(conversaId) {
    const pendente = estado.linkPendente;
    if (!pendente || pendente.conversa !== conversaId) return null;
    publicar({ linkPendente: null });
    return pendente.link;
  }

  const informar = (mensagem) => toast(mensagem, "success");

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
    // v2
    urlDoAnexo,
    baixarAnexo,
    responder,
    cancelarResposta,
    pedirEncaminhamento,
    cancelarEncaminhamento,
    encaminhar,
    irParaMensagem,
    buscar,
    fixar,
    marcarNaoLida,
    definirStatus,
    compartilhar,
    cancelarCompartilhamento,
    consumirLinkPendente,
    definirPaginas,
    avisar: (mensagem) => toast(mensagem, "warn"),
    informar,
    /** Só para os testes: o que o Realtime entregaria. */
    _aoMudarMensagem: aoMudarMensagem,
    _aoMudarStatus: aoMudarStatus,
    _aoMudarReacao: aoMudarReacao,
    _aoMudarParticipante: aoMudarParticipante,
    _aoReceberDigitando: aoReceberDigitando,
  };
}
