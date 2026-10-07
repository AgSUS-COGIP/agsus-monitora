/*
  Estado da seção Configurações › Mensagens (chat), fora do React (só o
  administrador global): a última leitura de `obter_retencao_chat`, já
  normalizada (src/lib/retencao-do-chat.js), e as duas ações — salvar o prazo
  de retenção e zerar as mensagens. As RPCs são de
  supabase/migrations/20261005190000_chat_retencao_das_mensagens.sql e
  devolvem a leitura nova, que substitui a anterior. A tela lê com
  `useSyncExternalStore`. Não importa React.

  Expurgo dos anexos (20261007210000_chat_v2.sql): a retenção e o "Zerar"
  apagam as linhas dos anexos e põem os arquivos numa fila; o Storage só apaga
  pela API. Depois de ler (com fila) e de cada ação, a seção pede a fila
  (preparar_expurgo_anexos_chat), remove os arquivos do bucket chat-anexos
  (a política de exclusão só aceita o que está na fila) e confirma
  (confirmar_expurgo_anexos_chat). Falhou: fica para a próxima vez.
*/
import { BUCKET_DO_CHAT } from "../../lib/anexos-do-chat.js";
import {
  comTempoLimite,
  ehFalhaDeConexao,
  mensagemDeFalha,
} from "../../lib/falha-de-rede.js";
import {
  mensagemDeErroDaRetencao,
  normalizarRetencao,
} from "../../lib/retencao-do-chat.js";

const RPC_OBTER = "obter_retencao_chat";
const RPC_SALVAR = "salvar_retencao_chat";
const RPC_ZERAR = "zerar_mensagens_chat";
const RPC_PREPARAR_EXPURGO = "preparar_expurgo_anexos_chat";
const RPC_CONFIRMAR_EXPURGO = "confirmar_expurgo_anexos_chat";
const TEMPO_LIMITE_MS = 60000;
/* Lotes de até 100 caminhos; no máximo 10 por vez (1.000 arquivos). */
const LOTES_DO_EXPURGO = 10;

export function criarEstadoDasMensagensDoChat({
  supabase = null,
  tempoLimiteMs = TEMPO_LIMITE_MS,
} = {}) {
  let estado = {
    status: "idle",
    dados: null,
    erro: "",
    acao: null,
    erroDaAcao: "",
    acaoComErro: null,
    /* A ação falhou por tempo ou rede: o banco pode ter concluído. */
    semConfirmacao: false,
    aviso: "",
  };
  let pedido = 0;
  const ouvintes = new Set();
  const publicar = (mudancas) => {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  };
  const cliente = () =>
    typeof supabase === "function" ? supabase() : supabase;

  /* Tempo esgotado ou rede caída: a resposta não veio, mas o banco pode ter
     terminado a transação. */
  const semResposta = (falha) =>
    Object.assign(new Error(mensagemDeFalha(falha)), { semResposta: true });

  async function rpc(nome, argumentos) {
    const banco = cliente();
    if (!banco) throw new Error("Sem conexão com o banco.");
    let resposta;
    try {
      resposta = await comTempoLimite(
        banco.rpc(nome, argumentos),
        tempoLimiteMs,
      );
    } catch (falha) {
      throw semResposta(falha);
    }
    if (resposta.error)
      throw ehFalhaDeConexao(resposta.error)
        ? semResposta(resposta.error)
        : resposta.error;
    return normalizarRetencao(resposta.data);
  }

  async function rpcBruto(nome, argumentos) {
    const banco = cliente();
    if (!banco) throw new Error("Sem conexão com o banco.");
    const resposta = await comTempoLimite(
      banco.rpc(nome, argumentos),
      tempoLimiteMs,
    );
    if (resposta.error) throw resposta.error;
    return resposta.data;
  }

  /*
    Tira do Storage os arquivos da fila (lotes de 100) e confirma. Silencioso:
    o que não sair fica na fila para a próxima vez. Devolve quantos saíram.
  */
  let expurgando = false;
  async function expurgarAnexos() {
    const banco = cliente();
    if (expurgando || !banco?.storage?.from) return 0;
    expurgando = true;
    let removidos = 0;
    try {
      for (let lote = 0; lote < LOTES_DO_EXPURGO; lote++) {
        const fila = await rpcBruto(RPC_PREPARAR_EXPURGO);
        const caminhos = Array.isArray(fila?.caminhos) ? fila.caminhos : [];
        if (!caminhos.length) break;
        const { error } = await comTempoLimite(
          banco.storage.from(BUCKET_DO_CHAT).remove(caminhos),
          tempoLimiteMs,
        );
        if (error) break;
        const confirmado = await rpcBruto(RPC_CONFIRMAR_EXPURGO, {
          p_caminhos: caminhos,
        });
        const quantos = Number(confirmado?.confirmados) || 0;
        removidos += quantos;
        if (estado.dados)
          publicar({
            dados: {
              ...estado.dados,
              expurgoPendente: Math.max(0, Number(confirmado?.pendentes) || 0),
            },
          });
        if (!quantos || caminhos.length < 100) break;
      }
    } catch {
      /* fica para a próxima vez */
    } finally {
      expurgando = false;
    }
    return removidos;
  }

  async function carregar() {
    const meu = ++pedido;
    publicar({ status: "loading", erro: "" });
    try {
      const dados = await rpc(RPC_OBTER);
      if (meu !== pedido) return false;
      publicar({ status: "ready", dados, erro: "" });
      if (dados.expurgoPendente > 0) void expurgarAnexos();
      return true;
    } catch (erro) {
      if (meu !== pedido) return false;
      publicar({ status: "error", erro: mensagemDeErroDaRetencao(erro) });
      return false;
    }
  }

  async function agir(tipo, nome, argumentos, aviso) {
    if (estado.acao) return false;
    pedido++;
    publicar({
      acao: tipo,
      erroDaAcao: "",
      acaoComErro: null,
      semConfirmacao: false,
      aviso: "",
    });
    try {
      const dados = await rpc(nome, argumentos);
      publicar({ acao: null, status: "ready", dados, aviso });
      if (dados.expurgoPendente > 0) void expurgarAnexos();
      return true;
    } catch (erro) {
      const semConfirmacao = erro?.semResposta === true;
      publicar({
        acao: null,
        erroDaAcao: mensagemDeErroDaRetencao(erro),
        acaoComErro: tipo,
        semConfirmacao,
      });
      // Relê os números: mostram se a ação chegou a valer.
      if (semConfirmacao) void carregar();
      return false;
    }
  }

  /** Salva o prazo (nulo = para sempre); o banco apaga na hora o que passou dele. */
  function salvarPrazo(dias, motivo) {
    return agir(
      "prazo",
      RPC_SALVAR,
      { p_dias: dias, p_motivo: motivo },
      "Prazo salvo.",
    );
  }

  /** Zera todas as mensagens (e, se pedido, as conversas sem participante ativo). */
  function zerar({ confirmacao, motivo, incluirConversas = false }) {
    return agir(
      "zerar",
      RPC_ZERAR,
      {
        p_confirmacao: confirmacao,
        p_motivo: motivo,
        p_incluir_conversas: Boolean(incluirConversas),
      },
      "Mensagens zeradas.",
    );
  }

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    salvarPrazo,
    zerar,
    expurgarAnexos,
    limparErroDaAcao: () =>
      publicar({ erroDaAcao: "", acaoComErro: null, semConfirmacao: false }),
  };
}
