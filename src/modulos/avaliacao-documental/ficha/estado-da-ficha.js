/*
  Estado da ficha aberta (fase F4), fora do React (useSyncExternalStore). Não
  importa React. A conta e as regras puras estão em
  src/lib/avaliacao-documental/ficha.js e pontuacao.js; aqui, a leitura, o
  lançamento em edição, o salvamento automático, a conclusão e a reabertura.

  RPCs (supabase/migrations/20261007130000_conteudo_da_ficha.sql; contrato em
  src/lib/rpc-contrato.js):
    obter_ficha_analise(p_ficha)
    salvar_rascunho_ficha(p_ficha, p_versao, p_lancamento, p_resultado, p_parecer)
    concluir_ficha(p_ficha, p_versao, p_versao_regra, p_lancamento, p_resultado, p_parecer)
    reabrir_ficha(p_ficha, p_versao, p_motivo)
    registrar_acesso_ficha(p_ficha, p_tipo)

  Salvamento automático: cada mudança agenda um rascunho (ATRASO_MS); uma
  mudança durante o envio agenda outro com a versão nova. "Salvo às HH:MM" só
  depois de o banco confirmar (AM-12.1). Versão velha (40001) ou reserva
  perdida (55P03) param a edição com o aviso.
*/
import {
  calcularFicha,
  declaradaDaFicha,
  lancamentoInicial,
  pendenciasDaFicha,
  resumoParaGravar,
} from "../../../lib/avaliacao-documental/ficha.js";
import { mensagemDoBanco } from "../estado.js";

const RPC_OBTER = "obter_ficha_analise";
const RPC_SALVAR = "salvar_rascunho_ficha";
const RPC_CONCLUIR = "concluir_ficha";
const RPC_REABRIR = "reabrir_ficha";
const RPC_ACESSO = "registrar_acesso_ficha";

export const ATRASO_MS = 1200;

const INICIAL = Object.freeze({
  fichaId: "",
  carregando: false,
  erro: "",
  dados: null,
  lancamento: null,
  avaliacao: null,
  declarada: null,
  pendencias: [],
  versao: 0,
  podeEditar: false,
  salvando: false,
  sujo: false,
  salvoEm: null,
  aviso: "",
  concluindo: false,
});

export function criarEstadoDaFicha({
  rpc,
  toast = (mensagem) => console.info(mensagem),
  agendar = (fn, ms) => setTimeout(fn, ms),
  cancelar = (id) => clearTimeout(id),
  atrasoMs = ATRASO_MS,
} = {}) {
  let estado = { ...INICIAL };
  let pedido = 0;
  let temporizador = null;
  let mudancas = 0;
  let envio = null;
  const ouvintes = new Set();
  const publicar = (m) => {
    estado = { ...estado, ...m };
    for (const ouvinte of ouvintes) ouvinte();
  };

  function calcular(
    lancamento,
    dados = estado.dados,
    declarada = estado.declarada,
  ) {
    const regra = dados.regra.configuracao;
    const avaliacao = calcularFicha(regra, lancamento, dados.documental);
    return {
      lancamento,
      avaliacao,
      pendencias: pendenciasDaFicha(regra, lancamento, avaliacao, declarada),
    };
  }

  function pararTemporizador() {
    if (temporizador !== null) cancelar(temporizador);
    temporizador = null;
  }

  async function carregar(fichaId = estado.fichaId) {
    const meu = ++pedido;
    pararTemporizador();
    mudancas = 0;
    publicar({ ...INICIAL, fichaId, carregando: true });
    try {
      const dados = await rpc(RPC_OBTER, { p_ficha: fichaId });
      if (meu !== pedido) return false;
      const regra = dados.regra.configuracao;
      const declarada = declaradaDaFicha(regra, dados.respostas);
      const lancamento = lancamentoInicial({
        regra,
        respostas: dados.respostas,
        modalidade: dados.ficha.modalidade,
        cargo: dados.ficha.cargo,
        documental: dados.documental,
        gravado: dados.ficha.lancamento,
      });
      publicar({
        carregando: false,
        dados,
        declarada,
        versao: dados.ficha.versao,
        podeEditar: Boolean(dados.pode_editar),
        salvoEm: dados.ficha.rascunho_em || null,
        ...calcular(lancamento, dados, declarada),
      });
      return true;
    } catch (erro) {
      if (meu !== pedido) return false;
      publicar({ carregando: false, erro: mensagemDoBanco(erro) });
      return false;
    }
  }

  /* Muda o lançamento (só em edição) e agenda o rascunho. */
  function mudar(transformar) {
    if (!estado.podeEditar || !estado.lancamento) return;
    const lancamento = transformar(structuredClone(estado.lancamento));
    mudancas += 1;
    publicar({ ...calcular(lancamento), sujo: true });
    pararTemporizador();
    temporizador = agendar(() => {
      temporizador = null;
      void salvar();
    }, atrasoMs);
  }

  function pararEdicao(erro) {
    pararTemporizador();
    const codigo = erro?.code;
    publicar({
      podeEditar: false,
      aviso:
        codigo === "40001"
          ? "Esta ficha mudou desde que você abriu (outra aba ou outra pessoa). Feche e abra de novo; o que não foi salvo está nesta tela."
          : mensagemDoBanco(erro),
    });
  }

  async function enviarRascunho() {
    const minhas = mudancas;
    const { lancamento, avaliacao, declarada, versao } = estado;
    publicar({ salvando: true });
    try {
      const r = await rpc(RPC_SALVAR, {
        p_ficha: estado.fichaId,
        p_versao: versao,
        p_lancamento: lancamento,
        p_resultado: resumoParaGravar(avaliacao, declarada),
        p_parecer: avaliacao.parecer,
      });
      const nada = mudancas === minhas;
      publicar({
        salvando: false,
        versao: r.versao,
        salvoEm: r.salvo_em,
        sujo: !nada,
        aviso: "",
      });
      return true;
    } catch (erro) {
      publicar({ salvando: false });
      if (["40001", "55P03", "42501"].includes(erro?.code)) pararEdicao(erro);
      else
        publicar({
          aviso: `Não foi possível salvar: ${mensagemDoBanco(erro)}`,
        });
      return false;
    }
  }

  /* Salva agora (Ctrl+S, "Salvar rascunho", antes de fechar e de concluir). */
  async function salvar() {
    pararTemporizador();
    if (!estado.podeEditar) return !estado.sujo;
    while (envio) await envio;
    if (!estado.sujo || !estado.podeEditar) return true;
    envio = enviarRascunho();
    const ok = await envio;
    envio = null;
    if (ok && estado.sujo && estado.podeEditar) return salvar();
    return ok;
  }

  /* Conclui; devolve { ok, pendencias, erro }. */
  async function concluir() {
    if (!estado.podeEditar)
      return { ok: false, erro: "Ficha só para leitura." };
    if (estado.pendencias.length)
      return { ok: false, pendencias: estado.pendencias };
    if (!(await salvar())) return { ok: false, erro: estado.aviso };
    publicar({ concluindo: true });
    try {
      const { lancamento, avaliacao, declarada } = estado;
      const r = await rpc(RPC_CONCLUIR, {
        p_ficha: estado.fichaId,
        p_versao: estado.versao,
        p_versao_regra: estado.dados.regra.versao,
        p_lancamento: lancamento,
        p_resultado: resumoParaGravar(avaliacao, declarada),
        p_parecer: avaliacao.parecer,
      });
      publicar({
        concluindo: false,
        sujo: false,
        podeEditar: false,
        versao: r.versao,
      });
      toast("Ficha concluída.", "success");
      return { ok: true, resultado: r };
    } catch (erro) {
      publicar({ concluindo: false });
      if (erro?.code === "40001") {
        await carregar();
        return {
          ok: false,
          erro: "A regra ou a ficha mudou: a ficha foi recalculada. Confira e conclua de novo.",
        };
      }
      return { ok: false, erro: mensagemDoBanco(erro) };
    }
  }

  async function reabrir(motivo) {
    try {
      await rpc(RPC_REABRIR, {
        p_ficha: estado.fichaId,
        p_versao: estado.versao,
        p_motivo: motivo,
      });
      toast("Ficha reaberta.", "success");
      await carregar();
      return { ok: true };
    } catch (erro) {
      return { ok: false, erro: mensagemDoBanco(erro) };
    }
  }

  async function registrarAcesso(tipo) {
    try {
      await rpc(RPC_ACESSO, { p_ficha: estado.fichaId, p_tipo: tipo });
    } catch {
      /* O registro não impede o trabalho; a falha aparece no log do banco. */
    }
  }

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    mudar,
    salvar,
    concluir,
    reabrir,
    registrarAcesso,
    temAlteracaoPendente: () => estado.sujo || estado.salvando,
    descartar() {
      pedido += 1;
      pararTemporizador();
      ouvintes.clear();
    },
  };
}
