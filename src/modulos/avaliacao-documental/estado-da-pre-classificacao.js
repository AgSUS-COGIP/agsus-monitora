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
  "Recalcular": POST /api/rodar-carga { robo: "pre_classificacao", edital }
  (api/rodar-carga.js confere no banco se quem clicou coordena o edital).
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
import { nomeDoArquivo } from "../../lib/classificacao/exportacao.js";
import { CABECALHO_PADRAO } from "../../lib/cabecalho-dos-documentos.js";
import { MIME_DOCX } from "../../lib/documento-da-resposta.js";
import { comTempoLimite, mensagemDeFalha } from "../../lib/falha-de-rede.js";
import { LOGO_PADRAO_DA_BARRA } from "../../lib/marca-da-barra-lateral.js";
import {
  ENDERECO_RODAR_CARGA,
  MENSAGENS_DO_DISPARO,
} from "../../lib/robos-de-carga.js";
import { exigirSessao } from "../../lib/sessao.js";
import { baixarNoNavegador } from "../classificacao/estado.js";
import {
  copiarParaAreaDeTransferencia,
  imprimirPagina,
  logoEmPng,
} from "../classificacao/documento-no-navegador.js";
import { mensagemDoBanco } from "./estado.js";

const RPC_OBTER_PRE_CLASSIFICACAO = "obter_pre_classificacao";
const RPC_REGISTRAR_LISTA = "registrar_lista_pre_classificacao";
const RPC_PUBLICAR_LISTA = "publicar_lista_classificacao";
const TEMPO_LIMITE_MS = 45000;
/* O job leva de segundos a poucos minutos: a tela relê nestes momentos. */
const RELEITURAS_MS = [45000, 120000];

const INICIAL = Object.freeze({
  editalId: "",
  dados: null,
  carregando: false,
  erro: "",
  pedidoEm: null,
  registrando: "",
  registradas: {},
});

export function chaveDaLista(tipo, lote = null) {
  return lote ? `${tipo}:${lote}` : tipo;
}

export function criarEstadoDaPreClassificacao({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  buscar = (...args) => globalThis.fetch(...args),
  obterToken = async () => (await exigirSessao(supabase)).access_token,
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
    publicar({ pedidoEm: agora() });
    let resposta;
    try {
      const token = await obterToken();
      resposta = await comTempoLimite(
        buscar(ENDERECO_RODAR_CARGA, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ robo: "pre_classificacao", edital: editalId }),
        }),
        20000,
      );
    } catch (falha) {
      publicar({ pedidoEm: null });
      toast(mensagemDeFalha(falha), "error");
      return false;
    }
    const corpo = await resposta.json().catch(() => ({}));
    if (resposta.status === 202) {
      toast(
        "Recálculo pedido. A lista atualiza quando o job terminar.",
        "success",
      );
      for (const ms of RELEITURAS_MS)
        agendar(() => {
          if (estado.editalId === editalId) void carregar(editalId);
        }, ms);
      return true;
    }
    publicar({ pedidoEm: resposta.status === 409 ? estado.pedidoEm : null });
    toast(
      resposta.status === 409
        ? MENSAGENS_DO_DISPARO.rodando
        : corpo?.erro ||
            (resposta.status === 404
              ? "Só na versão publicada."
              : "Não foi possível pedir o recálculo."),
      resposta.status === 409 ? "info" : "error",
    );
    return false;
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
    registrarLista,
    publicarLista,
    exportar,
    copiarParaSei,
  };
}
