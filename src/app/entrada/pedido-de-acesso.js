/*
  O pedido de acesso — o cartão de quem entrou com Google e não tem perfil
  ativo: situação do pedido, formulário, validação e envio, tudo por RPC.
  Estado sem React (`obter`/`assinar`); o desenho é de pedido-de-acesso.jsx e
  as regras e textos, de src/lib/solicitacao-de-acesso.js. A análise dos
  pedidos é de Configurações › Acessos (src/modulos/acessos/).

  O sistema não concede acesso automático: sem perfil ativo, a pessoa pede, e
  um administrador libera (ou ela foi convidada e entra com o e-mail
  convidado).
*/

import {
  contaMarcadaComoDesativada,
  lembrarContaDesativada,
  marcarBoasVindasPendentes,
} from "../../lib/acesso-liberado.js";
import { mensagemDeFalha } from "../../lib/falha-de-rede.js";
import { normalizePlatformContext } from "../../lib/platform-context.js";
import {
  argumentosDaSolicitacao,
  telaDaSolicitacao,
  validarSolicitacao,
} from "../../lib/solicitacao-de-acesso.js";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { nomeDoUsuario } from "../sessao.js";

const RPC_COORDENACOES_ATIVAS = "listar_coordenacoes_ativas";
const RPC_MINHA_SOLICITACAO = "obter_minha_solicitacao_acesso";
const RPC_REGISTRAR_SOLICITACAO = "registrar_solicitacao_acesso";
const RPC_CONTEXTO = "obter_contexto_monitora";
const RPC_MINHA_CONTA_DESATIVADA = "minha_conta_desativada";

export const TITULO_VERIFICANDO = "Verificando seu acesso…";
export const AVISO_SEM_CONSULTA =
  "Não foi possível consultar seu pedido anterior. Você pode enviar um pedido agora.";

const CAMPOS_VAZIOS = Object.freeze({
  nome: "",
  setor: "",
  coordenacao: "",
  justificativa: "",
});

const INICIAL = Object.freeze({
  usuarioId: "",
  email: "",
  carregando: false,
  /** O que a faixa de situação mostra (uma tela de telaDaSolicitacao ou um aviso). */
  status: null,
  /** A tela que decide o formulário (editável, só leitura ou oculto). */
  formulario: telaDaSolicitacao({}),
  /** A última tela desenhada: "Pedir reativação" reabre a partir dela. */
  ultimaTela: null,
  modoReativacao: false,
  campos: CAMPOS_VAZIOS,
  erros: {},
  enviando: false,
  coordenacoes: [],
  /** Para levar o foco à justificativa ao abrir a reativação. */
  focoNaJustificativa: 0,
});

/** Erro do banco no envio, em texto para a pessoa. */
export function mensagemDoEnvio(erro) {
  const texto = String(erro?.message || "");
  if (
    texto.includes("permission denied") ||
    texto.includes("violates row-level security")
  )
    return "Permissão insuficiente para esta ação. Verifique o perfil do usuário e as políticas RLS.";
  return mensagemDeFalha(erro);
}

/**
 * O que o cartão mostra, derivado do estado (sem DOM):
 *   { titulo, verificando, desativada, textosDoPedido, status: { tom, titulo,
 *     texto, triste, oferecerReativacao, entrar } | null, formulario:
 *     "editavel" | "leitura" | "oculto", semSetor, rotuloDoBotao,
 *     mostrarBotao }
 */
export function visaoDoPedido(estado) {
  if (estado.carregando)
    return {
      titulo: TITULO_VERIFICANDO,
      verificando: true,
      desativada: false,
      textosDoPedido: false,
      status: null,
      formulario: "oculto",
      semSetor: false,
      rotuloDoBotao: "Enviar pedido",
      mostrarBotao: false,
    };
  const tela = estado.status;
  const form = estado.formulario;
  /*
    Conta desativada: o título muda e os textos de pedido e convite somem.
    Com o pedido de reativação aberto, um aviso de falha no envio não troca o
    título.
  */
  const desativada = Boolean(
    tela?.desativada || tela?.ilustracao === "triste" || estado.modoReativacao,
  );
  const reativacao = estado.modoReativacao || form.reativacao === "pendente";
  return {
    titulo: desativada ? "Acesso desativado" : "Solicitar acesso",
    verificando: false,
    desativada,
    textosDoPedido: !desativada,
    status: tela?.texto
      ? {
          tom: tela.tom || "",
          titulo: tela.titulo || "",
          texto: tela.texto,
          triste: tela.ilustracao === "triste",
          oferecerReativacao:
            tela.reativacao === "oferecer" && !estado.modoReativacao,
          entrar: tela.acao === "entrar",
        }
      : null,
    formulario: form.formulario || "editavel",
    semSetor: reativacao,
    rotuloDoBotao: reativacao ? "Pedir reativação" : "Enviar pedido",
    mostrarBotao: form.acao === "enviar",
  };
}

/** Cria o estado do pedido. `cliente` devolve o cliente Supabase único. */
export function criarPedidoDeAcesso({
  cliente = getSupabaseClient,
  janela = globalThis.window,
} = {}) {
  let estado = INICIAL;
  const ouvintes = new Set();
  let coordenacoesCarregadas = false;
  let versao = 0;

  function definir(parcial) {
    estado = { ...estado, ...parcial };
    ouvintes.forEach((ouvinte) => ouvinte());
  }

  async function carregarCoordenacoes(sb) {
    if (coordenacoesCarregadas) return;
    const { data, error } = await sb.rpc(RPC_COORDENACOES_ATIVAS);
    if (error || !Array.isArray(data)) return;
    coordenacoesCarregadas = true;
    definir({ coordenacoes: data });
  }

  /* Desenha a situação; conta desativada deixa a marca por usuário (na volta, "Bem-vindo(a) de volta"). */
  function desenhar(tela, solicitacao) {
    const leitura = tela.formulario === "leitura";
    definir({
      modoReativacao: false,
      ultimaTela: tela,
      status: tela,
      formulario: tela,
      ...(leitura && solicitacao
        ? {
            campos: {
              nome: solicitacao.nome ?? "",
              setor: solicitacao.setor ?? "",
              coordenacao: solicitacao.coordenacao ?? "",
              justificativa: solicitacao.justificativa ?? "",
            },
          }
        : {}),
      ...(leitura ? {} : { erros: {} }),
    });
    if (tela.desativada) lembrarContaDesativada(estado.usuarioId, janela);
  }

  /* A consulta falhou: formulário para enviar, como antes (ou a tela de desativada). */
  function desenharSemPedido(contaDesativada) {
    const tela = telaDaSolicitacao({ contaDesativada });
    if (contaDesativada) return desenhar(tela, null);
    definir({
      modoReativacao: false,
      ultimaTela: tela,
      status: { tom: "warn", texto: AVISO_SEM_CONSULTA },
      formulario: tela,
      erros: {},
    });
  }

  async function lerEDesenhar(sb, minhaVersao) {
    void carregarCoordenacoes(sb).catch(() => {});
    // O banco diz se a conta existe e está desativada.
    const [{ data, error }, contaDesativada] = await Promise.all([
      sb.rpc(RPC_MINHA_SOLICITACAO),
      Promise.resolve()
        .then(() => sb.rpc(RPC_MINHA_CONTA_DESATIVADA))
        .then((r) => !r?.error && r?.data === true)
        .catch(() => false),
    ]);
    if (minhaVersao !== versao) return null;
    if (error) {
      desenharSemPedido(contaDesativada);
      return null;
    }
    const solicitacao = data || null;
    let perfilAtivo = false;
    if (!contaDesativada && solicitacao?.status === "aprovado") {
      const contexto = await sb.rpc(RPC_CONTEXTO);
      perfilAtivo =
        !contexto.error && Boolean(normalizePlatformContext(contexto.data));
    }
    if (minhaVersao !== versao) return null;
    /*
      O banco só diz "desativada" quando a conta existe; a marca de quando a
      tela de desativada foi mostrada segura a situação depois do pedido de
      reativação (senão viraria um "Pedido enviado" comum).
    */
    const desativada =
      contaDesativada ||
      (!perfilAtivo && contaMarcadaComoDesativada(estado.usuarioId, janela));
    desenhar(
      telaDaSolicitacao({
        solicitacao,
        contaDesativada: desativada,
        perfilAtivo,
      }),
      solicitacao,
    );
    return solicitacao;
  }

  /**
   * Abre o cartão para `usuario`. Até saber a situação, ele fica em
   * "Verificando seu acesso…" (sem formulário); `consultar: false` mostra o
   * formulário direto (a carga do login falhou e não há o que consultar).
   */
  async function carregar({
    usuario,
    consultar = true,
    carregando = true,
  } = {}) {
    const minhaVersao = ++versao;
    const usuarioId = usuario?.id || estado.usuarioId;
    const trocou = usuarioId !== estado.usuarioId;
    const campos = trocou ? CAMPOS_VAZIOS : estado.campos;
    definir({
      usuarioId,
      email: usuario?.email || estado.email,
      campos: {
        ...campos,
        nome: campos.nome || nomeDoUsuario(usuario),
      },
      ...(trocou ? { erros: {}, status: null } : {}),
      enviando: false,
    });
    const sb = cliente();
    if (!consultar || !sb) {
      definir({
        carregando: false,
        modoReativacao: false,
        formulario: telaDaSolicitacao({}),
      });
      return null;
    }
    if (carregando) definir({ carregando: true });
    try {
      return await lerEDesenhar(sb, minhaVersao);
    } catch (erro) {
      console.warn("Não foi possível consultar o pedido de acesso:", erro);
      if (minhaVersao === versao) desenharSemPedido(false);
      return null;
    } finally {
      if (minhaVersao === versao) definir({ carregando: false });
    }
  }

  function atualizarCampo(chave, valor) {
    definir({ campos: { ...estado.campos, [chave]: valor } });
  }

  /** "Pedir reativação": o formulário aparece, editável, com o nome já preenchido. */
  function abrirReativacao() {
    if (estado.ultimaTela?.reativacao !== "oferecer") return;
    const tela = {
      ...estado.ultimaTela,
      formulario: "editavel",
      acao: "enviar",
    };
    definir({
      modoReativacao: true,
      status: tela,
      formulario: tela,
      erros: {},
      focoNaJustificativa: estado.focoNaJustificativa + 1,
    });
  }

  /**
   * Valida e envia. Com erro de campo, nada vai ao banco e cada campo mostra
   * o seu. Devolve { ok, mensagem, erros }.
   */
  async function enviar() {
    const sb = cliente();
    if (!sb || estado.enviando) return { ok: false, mensagem: "", erros: {} };
    const opcoes = { reativacao: estado.modoReativacao };
    const erros = validarSolicitacao(estado.campos, opcoes);
    definir({ erros });
    if (Object.keys(erros).length) return { ok: false, mensagem: "", erros };
    definir({ enviando: true });
    const { error } = await sb.rpc(
      RPC_REGISTRAR_SOLICITACAO,
      argumentosDaSolicitacao(estado.campos, opcoes),
    );
    if (error) {
      definir({
        enviando: false,
        status: {
          tom: "danger",
          texto: "Não foi possível enviar o pedido: " + mensagemDoEnvio(error),
        },
      });
      return { ok: false, mensagem: error.message, erros: {} };
    }
    await carregar({ carregando: false });
    definir({ enviando: false });
    return { ok: true, mensagem: "", erros: {} };
  }

  /** "Entrar agora" (pedido liberado): marca as boas-vindas e recarrega. */
  function entrarAgora() {
    marcarBoasVindasPendentes(janela);
    janela?.location?.reload();
  }

  /** A pessoa saiu: o cartão volta ao início (nada da conta anterior fica). */
  function limpar() {
    versao += 1;
    definir({ ...INICIAL, coordenacoes: estado.coordenacoes });
  }

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    atualizarCampo,
    abrirReativacao,
    enviar,
    entrarAgora,
    limpar,
  };
}
