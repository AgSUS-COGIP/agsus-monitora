/*
  Estado da aba Pré-classificação, fora do React (useSyncExternalStore). Não
  importa React. A conta é do job Python (scripts/pre_classificacao/); aqui só
  a leitura, o pedido de recálculo, o registro das listas e a exportação.

  RPCs (supabase/migrations/20261006110000_pre_classificacao_e_lote.sql;
  contrato em src/lib/rpc-contrato.js):
    obter_pre_classificacao(p_edital)                 o resultado gravado
    registrar_lista_pre_classificacao(p_edital, p_tipo, p_lote)
                                                      PROVISORIA ou LOTE
    publicar_lista_classificacao(p_lista)             marca a lista como publicada
    descongelar_declarada_pre_classificacao(p_edital, p_motivo, p_vaga)
                                                      (20261007170000) descongela a
                                                      nota declarada; depois, Recalcular
    incluir_no_lote_por_decisao / revogar_decisao_lote  (20261007200000, decisao-no-banco.js)
                                                      a coordenação inclui no lote por
                                                      decisão ou revoga, com motivo
  "Recalcular": disparar_robo('pre_classificacao', { editais: [edital] })
  (o banco confere se quem clicou coordena o edital e pede o job ao GitHub
  com a chave do Vault, 20261008140000); situacao_do_disparo_robo diz, em
  poucos segundos, se o GitHub recusou ou se a chave falta ou expirou. O
  resultado do pedido fica na aba (`aviso`): o erro, com o botão de volta; ou
  "pedido", e a aba acompanha a execução (em_andamento e ultima_execucao de
  obter_pre_classificacao) e relê sozinha quando ela termina.
  O documento das listas sai do gerador da Classificação
  (src/lib/classificacao/documento-sei.js e documento-docx.js).
*/
import {
  documentoOficial,
  htmlParaSei,
  paginaDaPrevia,
  textoParaSei,
} from "../../lib/classificacao/documento-sei.js";
import { gerarDocxOficial } from "../../lib/classificacao/documento-docx.js";
import { ehEditalDeTreinamento } from "../../lib/edital-de-treinamento.js";
import { nomeDoArquivo } from "../../lib/classificacao/exportacao.js";
import { CABECALHO_PADRAO } from "../../lib/cabecalho-dos-documentos.js";
import { MIME_DOCX } from "../../lib/documento-da-resposta.js";
import { comTempoLimite, mensagemDeFalha } from "../../lib/falha-de-rede.js";
import { LOGO_PADRAO_DA_BARRA } from "../../lib/marca-da-barra-lateral.js";
import {
  inputsDoPedido,
  mensagemDoErroDoDisparo,
  roboDeCarga,
  RPC_DISPARAR_ROBO,
  RPC_SITUACAO_DO_DISPARO,
  situacaoDoPedido,
} from "../../lib/robos-de-carga.js";
import { baixarNoNavegador } from "../classificacao/estado.js";
import {
  copiarParaAreaDeTransferencia,
  imprimirPagina,
  logoEmPng,
} from "../classificacao/documento-no-navegador.js";
import { decidirNoLote } from "./decisao-no-banco.js";
import { mensagemDoBanco } from "./estado.js";

const RPC_OBTER_PRE_CLASSIFICACAO = "obter_pre_classificacao";
const RPC_REGISTRAR_LISTA = "registrar_lista_pre_classificacao";
const RPC_PUBLICAR_LISTA = "publicar_lista_classificacao";
const RPC_DESCONGELAR = "descongelar_declarada_pre_classificacao";
const TEMPO_LIMITE_MS = 45000;
/* O GitHub responde ao banco em 1 ou 2 s: quando conferir se aceitou o pedido. */
const ESPERA_DA_RESPOSTA_MS = 3000;
/* O job leva de segundos a poucos minutos: a aba relê neste intervalo até
   a execução terminar, no máximo pelo tempo limite do workflow. */
const INTERVALO_DO_ACOMPANHAMENTO_MS = 15000;
const LIMITE_DO_ACOMPANHAMENTO_MS =
  (roboDeCarga("pre_classificacao")?.limiteMin ?? 20) * 60000;

const INICIAL = Object.freeze({
  editalId: "",
  dados: null,
  carregando: false,
  erro: "",
  pedidoEm: null,
  aviso: null,
  registrando: "",
  registradas: {},
});

const hora = (data) =>
  data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function chaveDaLista(tipo, lote = null) {
  return lote ? `${tipo}:${lote}` : tipo;
}

export function criarEstadoDaPreClassificacao({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  agendar = (fn, ms) => setTimeout(fn, ms),
  agora = () => new Date(),
  baixar = baixarNoNavegador,
  copiar = copiarParaAreaDeTransferencia,
  imprimir = imprimirPagina,
  carregarLogo = logoEmPng,
  cabecalho = () => CABECALHO_PADRAO,
  tempoLimiteMs = TEMPO_LIMITE_MS,
} = {}) {
  let estado = INICIAL;
  let pedido = 0;
  let acompanhamento = 0;
  const ouvintes = new Set();
  const publicar = (mudancas) => {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  };

  async function rpc(nome, argumentos) {
    if (!supabase) throw new Error("Sem conexão com o banco.");
    const { data, error } = await comTempoLimite(
      supabase.rpc(nome, argumentos),
      tempoLimiteMs,
    );
    if (error) throw error;
    return data;
  }

  /* Lê o resultado gravado do edital (troca de edital recomeça do zero). */
  async function carregar(editalId = estado.editalId) {
    const meu = ++pedido;
    if (!editalId) {
      publicar({ ...INICIAL });
      return false;
    }
    publicar(
      editalId !== estado.editalId
        ? { ...INICIAL, editalId, carregando: true }
        : { carregando: true, erro: "" },
    );
    try {
      const dados = await rpc(RPC_OBTER_PRE_CLASSIFICACAO, {
        p_edital: editalId,
      });
      if (meu !== pedido) return false;
      publicar({ dados, carregando: false, erro: "" });
      return true;
    } catch (erro) {
      if (meu !== pedido) return false;
      publicar({ carregando: false, erro: mensagemDoBanco(erro) });
      return false;
    }
  }

  /* "Recalcular": pede o job da pré-classificação só deste edital. */
  async function recalcular() {
    const editalId = estado.editalId;
    if (!editalId) return false;
    const antes = estado.dados?.ultima_execucao?.id ?? null;
    const em = agora();
    acompanhamento += 1;
    const doEdital = (mudancas) => {
      if (estado.editalId === editalId) publicar(mudancas);
    };
    publicar({
      pedidoEm: em,
      aviso: { tom: "info", texto: "Pedindo o recálculo…" },
    });
    let disparo;
    try {
      disparo = await rpc(RPC_DISPARAR_ROBO, {
        p_robo: "pre_classificacao",
        p_inputs: inputsDoPedido({ edital: editalId }),
      });
    } catch (erro) {
      if (erro?.code === "55006") {
        const texto = `${mensagemDoErroDoDisparo(erro)} A lista atualiza sozinha quando terminar.`;
        doEdital({ aviso: { tom: "info", texto } });
        toast(texto, "info");
        acompanhar(editalId, antes, em);
        return false;
      }
      return recusado(
        doEdital,
        erro?.code
          ? mensagemDoErroDoDisparo(erro, "Não foi possível pedir o recálculo.")
          : mensagemDeFalha(erro),
      );
    }
    const texto = `Recálculo pedido às ${hora(em)}. A lista atualiza sozinha quando terminar.`;
    doEdital({ aviso: { tom: "info", texto } });
    toast(texto, "success");
    agendar(
      () => void conferirDisparo(editalId, disparo),
      ESPERA_DA_RESPOSTA_MS,
    );
    acompanhar(editalId, antes, em);
    return true;
  }

  /* O GitHub aceitou? Se recusou (ou falta a chave), a aba diz o que fazer. */
  async function conferirDisparo(editalId, disparo) {
    if (!supabase || disparo === null || disparo === undefined) return;
    let situacao;
    try {
      situacao = situacaoDoPedido(
        await rpc(RPC_SITUACAO_DO_DISPARO, { p_disparo: disparo }),
      );
    } catch {
      return;
    }
    if (!situacao.aviso || estado.editalId !== editalId) return;
    acompanhamento += 1;
    recusado((mudancas) => publicar(mudancas), situacao.aviso.texto);
  }

  /*
    "Descongelar e recalcular" (coordenação): apaga a nota declarada congelada
    do edital, com o motivo no histórico, e pede o recálculo, que congela de
    novo com as respostas de agora.
  */
  async function descongelar(motivo) {
    const editalId = estado.editalId;
    if (!editalId) return false;
    let r;
    try {
      r = await rpc(RPC_DESCONGELAR, {
        p_edital: editalId,
        p_motivo: String(motivo ?? "").trim(),
        p_vaga: null,
      });
    } catch (erro) {
      toast(`Não foi possível descongelar: ${mensagemDoBanco(erro)}`, "error");
      return false;
    }
    const n = Number(r?.descongeladas) || 0;
    toast(
      `${n} ${n === 1 ? "nota declarada descongelada" : "notas declaradas descongeladas"}.`,
      "success",
    );
    if (estado.editalId === editalId) await recalcular();
    return true;
  }

  /*
    "Incluir por decisão da coordenação" e "Revogar decisão": candidatos
    [{ codigo, vaga }] e o motivo. O banco põe (ou tira) do lote na hora e
    abre (ou tira do lote) a ficha; a aba relê. Devolve { ok, erro }.
  */
  async function decidir(acao, candidatos, motivo) {
    const editalId = estado.editalId;
    if (!editalId) return { ok: false, erro: "Escolha o edital." };
    try {
      const r = await decidirNoLote(rpc, acao, editalId, candidatos, motivo);
      toast(r.texto, "success");
      if (estado.editalId === editalId) await carregar(editalId);
      return { ok: true, quantidade: r.quantidade };
    } catch (erro) {
      return { ok: false, erro: mensagemDoBanco(erro) };
    }
  }

  function recusado(doEdital, motivo) {
    const texto = `Recálculo não pedido: ${motivo}`;
    doEdital({ pedidoEm: null, aviso: { tom: "danger", texto } });
    toast(texto, "error");
    return false;
  }

  /*
    Relê até a execução pedida terminar: sem execução em andamento e com uma
    última execução diferente da que havia no clique. Para no tempo limite do
    workflow, ao trocar de edital ou num pedido novo.
  */
  function acompanhar(editalId, antes, desde) {
    const meu = acompanhamento;
    const vale = () => meu === acompanhamento && estado.editalId === editalId;
    const passo = async () => {
      if (!vale()) return;
      await carregar(editalId);
      if (!vale()) return;
      const d = estado.dados;
      const ultima = d?.ultima_execucao;
      if (
        d &&
        !d.em_andamento &&
        ultima?.id &&
        ultima.id !== antes &&
        ultima.situacao !== "EM_ANDAMENTO"
      ) {
        const falhou = ultima.situacao === "FALHOU";
        const texto = falhou
          ? `O recálculo falhou${ultima.mensagem ? `: ${ultima.mensagem}` : "."}`
          : `Pré-classificação recalculada às ${hora(ultima.fim ? new Date(ultima.fim) : agora())}.`;
        publicar({
          pedidoEm: null,
          aviso: { tom: falhou ? "danger" : "info", texto },
        });
        toast(texto, falhou ? "error" : "success");
        return;
      }
      if (agora().getTime() - desde.getTime() >= LIMITE_DO_ACOMPANHAMENTO_MS) {
        publicar({
          pedidoEm: null,
          aviso: {
            tom: "warning",
            texto: "O recálculo ainda não terminou. Use Atualizar mais tarde.",
          },
        });
        return;
      }
      agendar(passo, INTERVALO_DO_ACOMPANHAMENTO_MS);
    };
    agendar(passo, INTERVALO_DO_ACOMPANHAMENTO_MS);
  }

  /* Registra a lista PROVISORIA ou LOTE (o banco monta o retrato). */
  async function registrarLista(tipo, lote = null) {
    const editalId = estado.editalId;
    const chave = chaveDaLista(tipo, lote);
    publicar({ registrando: chave });
    try {
      const r = await rpc(RPC_REGISTRAR_LISTA, {
        p_edital: editalId,
        p_tipo: tipo,
        p_lote: lote,
      });
      if (editalId === estado.editalId)
        publicar({
          registradas: {
            ...estado.registradas,
            [chave]: { meta: r?.lista, retrato: r?.resultado },
          },
        });
      toast("Lista registrada. Copie para o SEI ou baixe o DOCX.", "success");
      void carregar(editalId);
      return true;
    } catch (erro) {
      toast(`Não foi possível registrar: ${mensagemDoBanco(erro)}`, "error");
      return false;
    } finally {
      publicar({ registrando: "" });
    }
  }

  async function publicarLista(id) {
    try {
      await rpc(RPC_PUBLICAR_LISTA, { p_lista: id });
      toast("Lista marcada como publicada.", "success");
      void carregar();
      return true;
    } catch (erro) {
      toast(`Não foi possível marcar: ${mensagemDoBanco(erro)}`, "error");
      return false;
    }
  }

  function documento(registrado, lista = "todas") {
    if (!registrado?.retrato) return null;
    return documentoOficial(registrado.retrato, {
      lista,
      regra: estado.dados?.regra_classificacao?.configuracao || {},
      treinamento:
        Boolean(estado.dados?.edital?.treinamento) ||
        ehEditalDeTreinamento(registrado.retrato.edital),
    });
  }

  function marca() {
    let texto = "";
    try {
      texto = String(cabecalho() ?? "").trim();
    } catch {
      texto = "";
    }
    return { cabecalho: texto || CABECALHO_PADRAO, logo: LOGO_PADRAO_DA_BARRA };
  }

  /* DOCX timbrado ou impressão (PDF) de uma lista registrada; lista = todas | eliminados. */
  async function exportar(registrado, formato, lista = "todas") {
    const doc = documento(registrado, lista);
    if (!doc) return false;
    const m = marca();
    if (formato === "docx") {
      const logo = await Promise.resolve()
        .then(() => carregarLogo())
        .catch(() => null);
      baixar(
        gerarDocxOficial(doc, { cabecalho: m.cabecalho, logo }),
        `${nomeDoArquivo(registrado.retrato, lista)}.docx`,
        MIME_DOCX,
      );
    } else imprimir(paginaDaPrevia(doc, m));
    return true;
  }

  async function copiarParaSei(registrado, lista = "todas") {
    const doc = documento(registrado, lista);
    if (!doc) return "";
    const resultado = await copiar({
      html: htmlParaSei(doc),
      texto: textoParaSei(doc),
    });
    if (resultado === "html")
      toast(
        "Copiado. No SEI, cole no editor do documento (Ctrl+V).",
        "success",
      );
    else if (resultado === "texto")
      toast(
        "Copiado só como texto: o navegador não liberou o formato com tabelas. Use o DOCX.",
        "warn",
      );
    else
      toast(
        "Não foi possível copiar. Libere a área de transferência ou use o DOCX.",
        "error",
      );
    return resultado;
  }

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    recalcular,
    descongelar,
    incluirPorDecisao: (candidatos, motivo) =>
      decidir("incluir", candidatos, motivo),
    revogarDecisao: (candidatos, motivo) =>
      decidir("revogar", candidatos, motivo),
    registrarLista,
    publicarLista,
    exportar,
    copiarParaSei,
  };
}
