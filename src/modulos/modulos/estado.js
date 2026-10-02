/*
  Estado de Configurações › Módulos e abas, fora do React: a árvore lida
  (`obter_modulos_e_abas`), o rascunho das alterações e o salvamento em lote
  com motivo (`salvar_situacao_modulos`), uma ação por vez (`executar` /
  `acao`, como em Acessos). Este arquivo não importa React; as RPCs ficam
  aqui (o check:rpc-contract só lê `.js`). A regra do rascunho é de
  `src/lib/modulos-e-abas.js`.

  O RASCUNHO mora aqui, não no componente: a guarda de saída do legado
  (`navigate`) e a troca de seção de Configurações perguntam a este estado se
  há alteração não salva (`confirmarSaida`).
*/

import { isAdminGlobal } from "../../lib/access-roles.js";
import { exigirSessao } from "../../lib/sessao.js";
import { comTempoLimite, mensagemDeFalha } from "../../lib/falha-de-rede.js";
import {
  alteracoesDoRascunho,
  contarPendencias,
  originaisDaArvore,
  registrarCampo,
  registrarEstado,
} from "../../lib/modulos-e-abas.js";

const RPC_MODULOS_E_ABAS = "obter_modulos_e_abas";
const RPC_SALVAR_SITUACAO_MODULOS = "salvar_situacao_modulos";

const TEMPO_LIMITE_MS = 30000;

/* Códigos do banco (migration 20260930140000_modulos_e_manutencao.sql). */
const SEM_PERMISSAO = "42501";
const ULTIMA_AREA = "23514";
const INVALIDO = "22023";

const ESTADO_INICIAL = Object.freeze({
  perfil: null,
  /** Resposta de obter_modulos_e_abas. */
  arvore: null,
  originais: new Map(),
  /** "idle", "loading", "ready" ou "error". */
  status: "idle",
  erro: "",
  erroCodigo: "",
  rascunho: new Map(),
  /** { tipo, rotulo } da ação em curso, ou null. */
  acao: null,
  /** Aviso depois de uma recusa: { tom, texto } ou null. */
  aviso: null,
  geracao: 0,
});

/** O que dizer quando o banco recusa: claro e com o que fazer. */
export function mensagemDaRecusa(erro) {
  if (erro?.code === ULTIMA_AREA)
    return "Pelo menos uma área precisa ficar ativa. Reative uma área e salve de novo.";
  if (erro?.code === SEM_PERMISSAO)
    return "Só o administrador global pode mudar módulos e abas.";
  if (erro?.code === INVALIDO)
    return `O banco recusou a alteração: ${mensagemDeFalha(erro)}`;
  return mensagemDeFalha(erro);
}

export function criarEstadoDosModulos({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  getProfile = () => null,
  confirmar = (mensagem) => window.confirm(mensagem),
} = {}) {
  let estado = ESTADO_INICIAL;
  let identidade;
  const ouvintes = new Set();

  function publicar(mudancas) {
    const antes = contarPendencias(estado.rascunho);
    estado = { ...estado, ...mudancas };
    const depois = contarPendencias(estado.rascunho);
    if (!antes !== !depois) ligarAvisoDeSaida(depois > 0);
    for (const ouvinte of ouvintes) ouvinte();
  }

  function aoSairDaPagina(evento) {
    evento.preventDefault();
    evento.returnValue = "";
  }
  function ligarAvisoDeSaida(ligar) {
    if (ligar) window.addEventListener("beforeunload", aoSairDaPagina);
    else window.removeEventListener("beforeunload", aoSairDaPagina);
  }

  /** true se pode sair (não há pendência, ou a pessoa aceitou descartar). */
  function confirmarSaida() {
    const pendentes = contarPendencias(estado.rascunho);
    if (!pendentes) return true;
    const ok = confirmar(
      `Há ${pendentes} ${pendentes === 1 ? "alteração de módulos não salva" : "alterações de módulos não salvas"}. Sair e descartar?`,
    );
    if (ok) publicar({ rascunho: new Map(), aviso: null });
    return ok;
  }

  async function rpc(nome, argumentos) {
    if (!supabase) throw new Error("Supabase indisponível.");
    const { data, error } = await comTempoLimite(
      exigirSessao(supabase).then(() => supabase.rpc(nome, argumentos)),
      TEMPO_LIMITE_MS,
    );
    if (error) throw error;
    return data;
  }

  async function executar(tipo, rotulo, fazer) {
    if (estado.acao) return false;
    publicar({ acao: { tipo, rotulo } });
    try {
      return await fazer();
    } finally {
      publicar({ acao: null });
    }
  }

  async function carregar() {
    const geracao = estado.geracao;
    publicar({
      status: estado.arvore ? "ready" : "loading",
      erro: "",
      erroCodigo: "",
    });
    try {
      const arvore = await rpc(RPC_MODULOS_E_ABAS);
      if (geracao !== estado.geracao) return null;
      publicar({
        arvore: arvore || null,
        originais: originaisDaArvore(arvore),
        status: "ready",
      });
      return arvore;
    } catch (erro) {
      if (geracao !== estado.geracao) return null;
      console.error("Erro ao carregar módulos e abas:", erro);
      publicar({
        status: "error",
        erro: mensagemDaRecusa(erro),
        erroCodigo: erro?.code || "",
      });
      return null;
    }
  }

  function mudarCampo(alvo, campo, valor) {
    publicar({
      rascunho: registrarCampo(
        estado.rascunho,
        estado.originais,
        alvo,
        campo,
        valor,
      ),
      aviso: null,
    });
  }

  function mudarEstado(alvo, novo) {
    publicar({
      rascunho: registrarEstado(estado.rascunho, estado.originais, alvo, novo),
      aviso: null,
    });
  }

  const descartar = () => publicar({ rascunho: new Map(), aviso: null });

  function salvar(motivo) {
    const alteracoes = alteracoesDoRascunho(estado.rascunho);
    if (!alteracoes.length) return Promise.resolve(false);
    return executar("salvar", "Salvando…", async () => {
      try {
        const resultado = await rpc(RPC_SALVAR_SITUACAO_MODULOS, {
          p_alteracoes: alteracoes,
          p_motivo: String(motivo || "").trim(),
        });
        const total = resultado?.alteradas ?? alteracoes.length;
        publicar({ rascunho: new Map(), aviso: null });
        toast(
          `${total} ${total === 1 ? "alteração salva" : "alterações salvas"}. Vale para quem abrir ou atualizar o sistema.`,
          "success",
        );
        await carregar();
        return true;
      } catch (erro) {
        publicar({
          aviso: {
            tom: "danger",
            texto: `Não foi possível salvar: ${mensagemDaRecusa(erro)} As alterações continuam pendentes.`,
          },
        });
        return false;
      }
    });
  }

  function reiniciarSessao() {
    publicar({
      ...ESTADO_INICIAL,
      rascunho: new Map(),
      originais: new Map(),
      geracao: estado.geracao + 1,
    });
  }

  const assinaturaDoAuth = supabase?.auth?.onAuthStateChange?.(
    (_evento, sessao) => {
      const atual = sessao?.user?.id || null;
      if (atual === identidade) return;
      if (identidade !== undefined || !atual) reiniciarSessao();
      identidade = atual;
    },
  );

  return {
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    obter: () => estado,
    /** Ao abrir a seção: relê o perfil e carrega o que ainda não veio. */
    garantirCarregado() {
      publicar({ perfil: getProfile() || null });
      // Só o admin global lê a árvore (o banco recusa os demais com 42501).
      if (!isAdminGlobal(estado.perfil)) return Promise.resolve(null);
      if (estado.status === "idle" || estado.status === "error")
        return carregar();
      return Promise.resolve(estado.arvore);
    },
    carregar,
    mudarCampo,
    mudarEstado,
    descartar,
    salvar,
    confirmarSaida,
    temAlteracoesPendentes: () => contarPendencias(estado.rascunho) > 0,
    desligar() {
      ligarAvisoDeSaida(false);
      assinaturaDoAuth?.data?.subscription?.unsubscribe?.();
    },
  };
}
