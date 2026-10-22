/*
  Estado das Configurações, fora do React: os valores carregados (o legado
  lê a TB_CONFIGURACAO em `loadConfig` e a TB_PAINEL_EXTERNO em `loadPanels`
  e publica aqui), o rascunho das seções (campos e painéis externos), a seção
  aberta, a publicação versionada com motivo
  (salvar_configuracoes_e_paineis_v2), o histórico e a restauração. Este
  arquivo não importa React; as RPCs ficam aqui (o check:rpc-contract só lê
  `.js`). A regra da publicação é de `src/lib/publicacao-de-configuracoes.js`
  e a dos painéis, de `src/lib/paineis-externos-das-configuracoes.js`. As
  imagens da Aparência (arte de fundo e logo da barra) são de `imagens.js`.
*/

import { comTempoLimite, mensagemDeFalha } from "../../lib/falha-de-rede.js";
import {
  alteracoesDaVersao,
  buildChanges,
  errosDasSecoes,
  linhasDasSecoes,
  normalizarValoresCarregados,
} from "../../lib/publicacao-de-configuracoes.js";
import {
  chaveDoErroDoPainel,
  errosDosPaineis,
  linhasDosPaineis,
  mudarRascunhoDoPainel,
  normalizarPaineis,
  paineisComRascunho,
} from "../../lib/paineis-externos-das-configuracoes.js";
import { getSupabaseClient } from "../../lib/supabaseClient.js";

const RPC_SNAPSHOT = "get_configuracoes_snapshot";
const RPC_SAVE_V2 = "salvar_configuracoes_e_paineis_v2";
const RPC_HISTORY = "get_configuracoes_historico";
const RPC_RESTORE = "restaurar_configuracoes_versao";
const TEMPO_LIMITE_MS = 30000;

/* Seções que salvam pela própria tela React, com motivo: sem barra de salvar. */
export const SECOES_COM_SALVAR_PROPRIO = Object.freeze(["acessos", "modulos"]);

const txt = (valor) => String(valor ?? "").trim();

// ── Estado ─────────────────────────────────────────────────────────────────

const ESTADO_INICIAL = Object.freeze({
  /** Valores lidos da TB_CONFIGURACAO: Map chave → valor. */
  valores: new Map(),
  carregado: false,
  /** Alterações das seções: Map chave → valor. */
  rascunho: new Map(),
  /** Painéis externos lidos da TB_PAINEL_EXTERNO (normalizarPaineis). */
  paineis: Object.freeze([]),
  /** Alterações dos painéis: Map id → { titulo?, url?, ativo?, em_manutencao? }. */
  rascunhoDosPaineis: new Map(),
  /** Seção aberta (id de SECOES, secoes.js). */
  secao: "",
  salvando: false,
  /** Mensagens da última validação, e o erro de cada campo. */
  errosDaValidacao: [],
  errosDosCampos: new Map(),
  /*
    Diálogo aberto, ou null:
      { tipo: "erros", mensagens }        corrigir antes de publicar
      { tipo: "vazio" }                   nada para publicar
      { tipo: "falha", titulo, detalhe }  a revisão não pôde ser preparada
      { tipo: "revisar", alteracoes, linhas, paineis, enviando, erro }
      { tipo: "restaurar", versao, alteracoes, enviando, erro }
  */
  modal: null,
  /** { status: "idle" | "loading" | "ready" | "error", itens, erro } */
  historico: Object.freeze({ status: "idle", itens: [], erro: "" }),
});

export function criarEstadoDasConfiguracoes({
  supabase = () => null,
  documento = globalThis.document,
  confirmar = (mensagem) => window.confirm(mensagem),
  alertar = (mensagem) => window.alert(mensagem),
  recarregar = () => window.location.reload(),
} = {}) {
  let estado = ESTADO_INICIAL;
  let cliente = null;
  const ouvintes = new Set();

  const obterCliente = () => (cliente ||= supabase());

  function publicar(mudancas) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  const temAlteracoes = () =>
    estado.rascunho.size > 0 || estado.rascunhoDosPaineis.size > 0;

  /** Os painéis como a tela os mostra (carregados + rascunho). */
  const paineisAtuais = () =>
    paineisComRascunho(estado.paineis, estado.rascunhoDosPaineis);

  const valor = (chave) =>
    estado.rascunho.has(chave)
      ? estado.rascunho.get(chave)
      : (estado.valores.get(chave) ?? "");

  function valoresAtuais() {
    const valores = new Map(estado.valores);
    for (const [chave, novo] of estado.rascunho) valores.set(chave, novo);
    return valores;
  }

  /** O legado terminou de ler a TB_CONFIGURACAO (`loadConfig`). */
  function definirValoresCarregados(config = {}) {
    publicar({
      valores: normalizarValoresCarregados(config),
      carregado: true,
      rascunho: new Map(),
      errosDosCampos: new Map(),
      errosDaValidacao: [],
    });
  }

  /*
    Valores gravados fora da publicação (a arte de fundo da tela de acesso,
    aplicada na hora por imagens.js): passam a ser os publicados.
  */
  function definirValoresPublicados(novos) {
    const valores = new Map(estado.valores);
    const rascunho = new Map(estado.rascunho);
    for (const [chave, novo] of Object.entries(novos)) {
      valores.set(chave, novo);
      rascunho.delete(chave);
    }
    publicar({ valores, rascunho });
  }

  function mudarCampo(chave, novo) {
    const rascunho = new Map(estado.rascunho);
    if (txt(novo) === txt(estado.valores.get(chave))) rascunho.delete(chave);
    else rascunho.set(chave, novo);
    const errosDosCampos = new Map(estado.errosDosCampos);
    errosDosCampos.delete(chave);
    publicar({ rascunho, errosDosCampos });
  }

  /** O legado terminou de ler a TB_PAINEL_EXTERNO (`loadPanels`). */
  function definirPaineisCarregados(lista = []) {
    publicar({
      paineis: Object.freeze(normalizarPaineis(lista)),
      rascunhoDosPaineis: new Map(),
    });
  }

  function mudarPainel(id, campo, novo) {
    const errosDosCampos = new Map(estado.errosDosCampos);
    errosDosCampos.delete(chaveDoErroDoPainel(id));
    publicar({
      rascunhoDosPaineis: mudarRascunhoDoPainel(
        estado.rascunhoDosPaineis,
        estado.paineis,
        id,
        campo,
        novo,
      ),
      errosDosCampos,
    });
  }

  function definirSecao(secao) {
    if (secao !== estado.secao) publicar({ secao });
  }

  function descartar() {
    publicar({
      rascunho: new Map(),
      rascunhoDosPaineis: new Map(),
      errosDosCampos: new Map(),
      errosDaValidacao: [],
    });
  }

  const fecharModal = () => {
    if (estado.modal?.enviando) return;
    publicar({ modal: null });
  };

  function mudarModal(mudancas) {
    if (estado.modal) publicar({ modal: { ...estado.modal, ...mudancas } });
  }

  // ── Publicação ───────────────────────────────────────────────────────────

  function validar() {
    const errosDosCampos = new Map([
      ...errosDasSecoes(valoresAtuais()),
      ...errosDosPaineis(paineisAtuais()),
    ]);
    const errosDaValidacao = [...new Set(errosDosCampos.values())];
    publicar({ errosDosCampos, errosDaValidacao });
    return errosDaValidacao;
  }

  /* Todas as chaves das seções no mesmo `p_config_rows` (uma chamada, uma transação). */
  const linhasDaPublicacao = () => linhasDasSecoes(valoresAtuais());

  /* Desligar o login Google (o acesso institucional principal) pede confirmação. */
  const desligaOGoogle = () =>
    valor("auth_google_enabled") === "false" &&
    estado.valores.get("auth_google_enabled") !== "false";

  /** O "Salvar alterações" (botão da barra e Ctrl+S): valida e abre a revisão. */
  async function revisar() {
    if (estado.salvando) return false;
    const mensagens = validar();
    if (mensagens.length) {
      publicar({ modal: { tipo: "erros", mensagens } });
      return false;
    }

    if (
      desligaOGoogle() &&
      !confirmar(
        "O login Google será desativado. Como este é o acesso institucional principal, usuários podem ficar sem conseguir entrar. Deseja continuar?",
      )
    )
      return false;

    const client = obterCliente();
    if (!client) {
      publicar({
        modal: {
          tipo: "falha",
          titulo: "Publicação indisponível",
          detalhe: "O servidor de dados não está configurado neste ambiente.",
        },
      });
      return false;
    }

    publicar({ salvando: true });
    try {
      const { data: retrato, error } = await comTempoLimite(
        client.rpc(RPC_SNAPSHOT),
        TEMPO_LIMITE_MS,
      );
      if (error) throw error;
      const linhas = linhasDaPublicacao();
      const paineis = linhasDosPaineis(paineisAtuais());
      const alteracoes = buildChanges(retrato, linhas, paineis);
      if (!alteracoes.length) {
        descartar();
        publicar({ salvando: false, modal: { tipo: "vazio" } });
        return true;
      }
      publicar({
        salvando: false,
        modal: {
          tipo: "revisar",
          alteracoes,
          linhas,
          paineis,
          enviando: false,
          erro: "",
        },
      });
      return true;
    } catch (erro) {
      publicar({
        salvando: false,
        modal: {
          tipo: "falha",
          titulo: "Não foi possível preparar a publicação",
          detalhe: mensagemDeFalha(erro),
        },
      });
      return false;
    }
  }

  async function confirmarPublicacao(motivo) {
    const modal = estado.modal;
    if (modal?.tipo !== "revisar" || modal.enviando || !txt(motivo)) return;
    mudarModal({ enviando: true, erro: "" });
    let data;
    try {
      const resposta = await comTempoLimite(
        obterCliente().rpc(RPC_SAVE_V2, {
          p_config_rows: modal.linhas,
          p_paineis: modal.paineis,
          p_motivo: txt(motivo),
        }),
        TEMPO_LIMITE_MS,
      );
      if (resposta.error) throw resposta.error;
      data = resposta.data;
      if (!data?.ok) throw new Error("O servidor não confirmou a publicação.");
    } catch (erro) {
      mudarModal({ enviando: false, erro: mensagemDeFalha(erro) });
      return;
    }
    descartar();
    publicar({ modal: null });
    await carregarHistorico(true);
    documento.defaultView?.dispatchEvent(
      new documento.defaultView.CustomEvent("agsus:config-saved", {
        detail: data,
      }),
    );
    alertar(
      `${data.total_alteracoes || modal.alteracoes.length} alteração(ões) publicada(s) e auditada(s). A página será recarregada para aplicar os novos valores.`,
    );
    recarregar();
  }

  // ── Histórico e restauração ──────────────────────────────────────────────

  async function carregarHistorico(forcar = false) {
    if (!forcar && estado.historico.status !== "idle") return;
    const client = obterCliente();
    if (!client) {
      publicar({
        historico: {
          status: "error",
          itens: [],
          erro: "Servidor de dados indisponível.",
        },
      });
      return;
    }
    publicar({ historico: { ...estado.historico, status: "loading" } });
    try {
      const { data, error } = await comTempoLimite(
        client.rpc(RPC_HISTORY, { p_limit: 30 }),
        TEMPO_LIMITE_MS,
      );
      if (error) throw error;
      publicar({
        historico: {
          status: "ready",
          itens: Array.isArray(data) ? data : [],
          erro: "",
        },
      });
    } catch (erro) {
      publicar({
        historico: {
          status: "error",
          itens: estado.historico.itens,
          erro: mensagemDeFalha(erro),
        },
      });
    }
  }

  function abrirRestauracao(id) {
    const versao = estado.historico.itens.find(
      (item) => String(item.id) === String(id),
    );
    if (!versao) return;
    publicar({
      modal: {
        tipo: "restaurar",
        versao,
        alteracoes: alteracoesDaVersao(versao),
        enviando: false,
        erro: "",
      },
    });
  }

  async function confirmarRestauracao(motivo) {
    const modal = estado.modal;
    if (modal?.tipo !== "restaurar" || modal.enviando || !txt(motivo)) return;
    if (
      !confirmar(
        "Confirmar restauração desta versão? Os valores atuais serão substituídos.",
      )
    )
      return;
    mudarModal({ enviando: true, erro: "" });
    let data;
    try {
      const resposta = await comTempoLimite(
        obterCliente().rpc(RPC_RESTORE, {
          p_versao_id: modal.versao.id,
          p_motivo: txt(motivo),
        }),
        TEMPO_LIMITE_MS,
      );
      if (resposta.error) throw resposta.error;
      data = resposta.data;
      if (!data?.ok) throw new Error("O servidor não confirmou a restauração.");
    } catch (erro) {
      mudarModal({ enviando: false, erro: mensagemDeFalha(erro) });
      return;
    }
    descartar();
    publicar({ modal: null });
    alertar(
      `${data.total_alteracoes || 0} alteração(ões) restaurada(s). A página será recarregada.`,
    );
    recarregar();
  }

  // ── Saída e eventos da página ────────────────────────────────────────────

  /**
   * Pode sair de Configurações? Sem alteração não salva, sim; com, pergunta
   * e, confirmado, descarta. Chamado pelo `navigate` do legado.
   */
  function confirmarSaida(perguntar = confirmar) {
    if (!temAlteracoes()) return true;
    if (
      !perguntar(
        "Existem alterações não salvas em Configurações. Sair e descartar essas alterações?",
      )
    )
      return false;
    descartar();
    return true;
  }

  /* Liga os eventos de página; devolve a função que os desliga. */
  function instalar(pagina) {
    const janela = documento.defaultView;
    const aoTeclar = (evento) => {
      if (
        !(evento.ctrlKey || evento.metaKey) ||
        evento.key.toLowerCase() !== "s"
      )
        return;
      if (!pagina.isConnected || !pagina.classList.contains("active")) return;
      evento.preventDefault();
      if (SECOES_COM_SALVAR_PROPRIO.includes(estado.secao)) return;
      if (temAlteracoes() && !estado.salvando && !estado.modal) void revisar();
    };
    const aoSairDaPagina = (evento) => {
      if (!temAlteracoes()) return;
      evento.preventDefault();
      evento.returnValue = "";
    };
    documento.addEventListener("keydown", aoTeclar);
    janela?.addEventListener("beforeunload", aoSairDaPagina);
    return () => {
      documento.removeEventListener("keydown", aoTeclar);
      janela?.removeEventListener("beforeunload", aoSairDaPagina);
    };
  }

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    valor,
    paineisAtuais,
    temAlteracoes,
    definirValoresCarregados,
    definirPaineisCarregados,
    definirValoresPublicados,
    mudarCampo,
    mudarPainel,
    definirSecao,
    revisar,
    confirmarPublicacao,
    carregarHistorico,
    abrirRestauracao,
    confirmarRestauracao,
    fecharModal,
    confirmarSaida,
    instalar,
  };
}

/*
  A instância da página: o legado publica aqui o que `loadConfig` leu e
  pergunta a ela antes de sair de Configurações (`navigate`); o React
  (`configuracoes.jsx`) desenha a partir dela.
*/
export const estadoDasConfiguracoes = criarEstadoDasConfiguracoes({
  supabase: getSupabaseClient,
});
