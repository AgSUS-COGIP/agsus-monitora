/*
  Estado da seção Configurações › Mensagens (chat), fora do React (só o
  administrador global): a última leitura de `obter_retencao_chat`, já
  normalizada (src/lib/retencao-do-chat.js), e as duas ações — salvar o prazo
  de retenção e zerar as mensagens. As RPCs são de
  supabase/migrations/20261005190000_chat_retencao_das_mensagens.sql e
  devolvem a leitura nova, que substitui a anterior. A tela lê com
  `useSyncExternalStore`. Não importa React.
*/
import { comTempoLimite, mensagemDeFalha } from "../../lib/falha-de-rede.js";
import {
  mensagemDeErroDaRetencao,
  normalizarRetencao,
} from "../../lib/retencao-do-chat.js";

const RPC_OBTER = "obter_retencao_chat";
const RPC_SALVAR = "salvar_retencao_chat";
const RPC_ZERAR = "zerar_mensagens_chat";
const TEMPO_LIMITE_MS = 60000;

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
      throw new Error(mensagemDeFalha(falha));
    }
    if (resposta.error) throw resposta.error;
    return normalizarRetencao(resposta.data);
  }

  async function carregar() {
    const meu = ++pedido;
    publicar({ status: "loading", erro: "" });
    try {
      const dados = await rpc(RPC_OBTER);
      if (meu !== pedido) return false;
      publicar({ status: "ready", dados, erro: "" });
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
    publicar({ acao: tipo, erroDaAcao: "", acaoComErro: null, aviso: "" });
    try {
      const dados = await rpc(nome, argumentos);
      publicar({ acao: null, status: "ready", dados, aviso });
      return true;
    } catch (erro) {
      publicar({
        acao: null,
        erroDaAcao: mensagemDeErroDaRetencao(erro),
        acaoComErro: tipo,
      });
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
    limparErroDaAcao: () => publicar({ erroDaAcao: "", acaoComErro: null }),
  };
}
