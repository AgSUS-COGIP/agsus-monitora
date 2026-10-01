/*
  Estado das Configurações, fora do React: os valores carregados (o legado
  lê a TB_CONFIGURACAO em `loadConfig` e a TB_PAINEL_EXTERNO em `loadPanels`
  e publica aqui), o rascunho das seções já em React (campos e painéis
  externos), a seção aberta, a publicação versionada com motivo
  (salvar_configuracoes_e_paineis_v2), o histórico e a restauração. Este
  arquivo não importa React; as RPCs ficam aqui (o check:rpc-contract só lê
  `.js`). A regra da publicação é de `src/lib/publicacao-de-configuracoes.js`
  e a dos painéis, de `src/lib/paineis-externos-das-configuracoes.js`.

  TRANSIÇÃO. Enquanto houver seção legada (Página inicial, Tela de acesso,
  Aparência), a publicação também lê os campos `cfg*` do index.html
  (CAMPOS_DO_LEGADO) e as chaves da barra lateral (`sidebar-branding.js`), e
  digitar num campo legado marca a página como alterada. Cada seção migrada
  tira daqui a sua parte de DOM; quando não restar nenhuma, as funções
  `…DoLegado` saem.
*/

import { comTempoLimite, mensagemDeFalha } from "../../lib/falha-de-rede.js";
import { isValidAccessAssetUrl } from "../../lib/config-validation.js";
import {
  alteracoesDaVersao,
  buildChanges,
  CAMPOS_DO_LEGADO,
  dominioValido,
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
import { linhasDeConfiguracaoDaSidebar } from "../../modules/sidebar-branding.js";
import { getSupabaseClient } from "../../lib/supabaseClient.js";

const RPC_SNAPSHOT = "get_configuracoes_snapshot";
const RPC_SAVE_V2 = "salvar_configuracoes_e_paineis_v2";
const RPC_HISTORY = "get_configuracoes_historico";
const RPC_RESTORE = "restaurar_configuracoes_versao";
const TEMPO_LIMITE_MS = 30000;

/* Seções que salvam pela própria tela React, com motivo: sem barra de salvar. */
export const SECOES_COM_SALVAR_PROPRIO = Object.freeze(["acessos", "modulos"]);

const txt = (valor) => String(valor ?? "").trim();

// ── Legado (transição) ─────────────────────────────────────────────────────

/**
 * Só os campos de configuração legados (`cfg*`) marcam a página como
 * alterada pelo DOM. Busca, matriz de acessos e os campos das seções em
 * React (ids `config…`, sem o prefixo `cfg`) não: estes vão pelo estado.
 */
export function ehCampoDeConfiguracao(campo) {
  const Janela = campo?.ownerDocument?.defaultView;
  if (
    !Janela ||
    !(
      campo instanceof Janela.HTMLInputElement ||
      campo instanceof Janela.HTMLTextAreaElement ||
      campo instanceof Janela.HTMLSelectElement
    )
  )
    return false;
  if (campo.closest("[data-acessos], [data-configuracoes]")) return false;
  return /^cfg/.test(campo.id);
}

function linhasDoLegado(documento) {
  return CAMPOS_DO_LEGADO.map(([id, chave, descricao, reserva = ""]) => ({
    chave,
    valor: txt(documento.getElementById(id)?.value ?? reserva),
    descricao,
  }));
}

/** [{ campo, mensagem }] dos campos legados. */
function errosDoLegado(documento) {
  const $ = (id) => documento.getElementById(id);
  const erros = [];
  const erro = (campo, mensagem) => erros.push({ campo, mensagem });

  const titulo = $("cfgPageTitle");
  if (titulo && !txt(titulo.value))
    erro(titulo, "Informe o título da página inicial.");

  const dominio = $("cfgGoogleDomainHint");
  if (dominio && !dominioValido(dominio.value))
    erro(
      dominio,
      "O domínio Google deve estar no formato agenciasus.org.br, sem https://, @ ou barras.",
    );

  const logo = $("cfgAccessLogoUrl");
  if (logo && !isValidAccessAssetUrl(logo.value))
    erro(logo, "URL inválida no campo Logo da AgSUS no acesso.");

  return erros;
}

function marcarInvalidosDoLegado(documento, erros) {
  for (const campo of documento.querySelectorAll(
    "#page-config .config-field-invalid",
  )) {
    campo.classList.remove("config-field-invalid");
    campo.removeAttribute("aria-invalid");
  }
  for (const { campo } of erros) {
    campo?.classList.add("config-field-invalid");
    campo?.setAttribute("aria-invalid", "true");
  }
}

// ── Estado ─────────────────────────────────────────────────────────────────

const ESTADO_INICIAL = Object.freeze({
  /** Valores lidos da TB_CONFIGURACAO: Map chave → valor. */
  valores: new Map(),
  carregado: false,
  /** Alterações das seções em React: Map chave → valor. */
  rascunho: new Map(),
  /** Painéis externos lidos da TB_PAINEL_EXTERNO (normalizarPaineis). */
  paineis: Object.freeze([]),
  /** Alterações dos painéis: Map id → { titulo?, url?, ativo?, em_manutencao? }. */
  rascunhoDosPaineis: new Map(),
  /** Algum campo legado foi alterado desde a carga. */
  legadoAlterado: false,
  /** Seção aberta (id de SECOES, config-secoes.js). */
  secao: "",
  salvando: false,
  /** Mensagens da última validação, e o erro de cada campo em React. */
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
    estado.rascunho.size > 0 ||
    estado.rascunhoDosPaineis.size > 0 ||
    estado.legadoAlterado;

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
      legadoAlterado: false,
      errosDosCampos: new Map(),
      errosDaValidacao: [],
    });
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

  function marcarLegadoAlterado() {
    if (!estado.legadoAlterado) publicar({ legadoAlterado: true });
  }

  function definirSecao(secao) {
    if (secao !== estado.secao) publicar({ secao });
  }

  function descartar() {
    publicar({
      rascunho: new Map(),
      rascunhoDosPaineis: new Map(),
      legadoAlterado: false,
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
    const legado = errosDoLegado(documento);
    marcarInvalidosDoLegado(documento, legado);
    const errosDosCampos = new Map([
      ...errosDasSecoes(valoresAtuais()),
      ...errosDosPaineis(paineisAtuais()),
    ]);
    const errosDaValidacao = [
      ...new Set([
        ...errosDosCampos.values(),
        ...legado.map((erro) => erro.mensagem),
      ]),
    ];
    publicar({ errosDosCampos, errosDaValidacao });
    return errosDaValidacao;
  }

  /* As chaves da barra lateral viajam no mesmo `p_config_rows` (uma chamada, uma transação). */
  const linhasDaPublicacao = () => [
    ...linhasDoLegado(documento),
    ...linhasDasSecoes(valoresAtuais()),
    ...linhasDeConfiguracaoDaSidebar(),
  ];

  /** O "Salvar alterações" (botão da barra e Ctrl+S): valida e abre a revisão. */
  async function revisar() {
    if (estado.salvando) return false;
    const mensagens = validar();
    if (mensagens.length) {
      publicar({ modal: { tipo: "erros", mensagens } });
      return false;
    }

    if (
      documento.getElementById("cfgGoogleEnabled")?.value === "false" &&
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
    const aoMudarLegado = (evento) => {
      if (!ehCampoDeConfiguracao(evento.target)) return;
      marcarLegadoAlterado();
      evento.target.classList.remove("config-field-invalid");
      evento.target.removeAttribute("aria-invalid");
    };
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
    pagina.addEventListener("input", aoMudarLegado);
    pagina.addEventListener("change", aoMudarLegado);
    documento.addEventListener("keydown", aoTeclar);
    janela?.addEventListener("beforeunload", aoSairDaPagina);
    return () => {
      pagina.removeEventListener("input", aoMudarLegado);
      pagina.removeEventListener("change", aoMudarLegado);
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
