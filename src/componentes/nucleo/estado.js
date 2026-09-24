/*
  Estado da página "Editais" (Equipe Núcleo), fora do React: o resumo dos
  cronogramas, o filtro do painel operacional, qual modal está aberto e as
  ações que vão ao banco. As linhas e o catálogo de unidades não moram aqui:
  são do legado (`dados-do-monitoramento.js`). Este arquivo não importa React.

  O resumo alimenta duas coisas — os indicadores e a lista de "copiar
  cronograma" — com UMA carga (`resumo.js`). Trocar de usuário na mesma aba
  apaga tudo o que era da sessão anterior, inclusive a resposta que ainda
  estiver a caminho.
*/

import { canManageEditais } from "../../lib/access-roles.js";
import { exigirSessao } from "../../lib/sessao.js";
import { analisarCronograma } from "../../lib/cronograma-do-edital.js";
import { carregarResumoDoNucleo, createNucleoSummaryStore } from "./resumo.js";

const RPC_CRONOGRAMA = "get_monitoramento_cronograma";
const RPC_SALVAR = "salvar_monitoramento_com_cronograma_v2";
export const EVENTO_CRONOGRAMA_SALVO = "agsus:nucleo-cronograma-saved";

const txt = (valor) => String(valor ?? "").trim();

const ESTADO_INICIAL = Object.freeze({
  perfil: null,
  resumo: Object.freeze([]),
  /** "idle" (nada pedido), "loading", "ready" ou "error". */
  statusDoResumo: "idle",
  atualizandoResumo: false,
  filtro: "todos",
  /*
    O modal aberto, ou `null`. `abertura` muda a cada abertura, e o componente
    a usa como `key`: reabrir começa de um formulário limpo.
      { tipo: "edital", id }          id vazio = edital novo
      { tipo: "linha-do-tempo", id }
  */
  modal: null,
  salvando: false,
  /** Muda quando a sessão troca de usuário: o que foi pedido antes não vale. */
  geracao: 0,
});

/* Depois de salvar: o legado recarrega tudo (mapa incluído) e reabre a página. */
async function recarregarPeloLegado() {
  await window.refreshData?.();
  window.navigate?.("nucleo");
}

export function criarEstadoDoNucleo({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  loader = () => {},
  getProfile = () => null,
  confirmar = (mensagem) => window.confirm(mensagem),
  aoSalvar = recarregarPeloLegado,
} = {}) {
  let estado = ESTADO_INICIAL;
  let aberturas = 0;
  const ouvintes = new Set();
  const resumo = createNucleoSummaryStore({
    loader: () => carregarResumoDoNucleo(supabase),
  });
  let pedido = { fonte: null, pendente: null, token: 0 };
  let identidade;

  function publicar(mudancas) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  const perfil = () => getProfile() || null;

  // ── Resumo ─────────────────────────────────────────────────────────────

  function carregarResumo({ force = false, invalidate = false } = {}) {
    if (invalidate) resumo.invalidate();
    const fonte = resumo.get({ force });
    // Duas chamadas seguidas partilham a mesma carga.
    if (pedido.fonte === fonte) return pedido.pendente;
    const token = pedido.token + 1;
    pedido = { fonte, pendente: null, token };
    publicar({
      atualizandoResumo: true,
      ...(estado.statusDoResumo === "ready"
        ? {}
        : { statusDoResumo: "loading" }),
    });
    const pendente = fonte
      .then((linhas) => {
        if (token !== pedido.token) return linhas;
        publicar({
          resumo: Array.isArray(linhas) ? linhas : [],
          statusDoResumo: "ready",
        });
        return linhas;
      })
      .catch((erro) => {
        if (token !== pedido.token) throw erro;
        // O detalhe técnico fica no console; a tela oferece "Tentar de novo".
        console.error("Erro ao carregar resumo da Equipe Núcleo:", erro);
        publicar({ statusDoResumo: "error" });
        throw erro;
      })
      .finally(() => {
        if (token !== pedido.token) return;
        pedido = { fonte: null, pendente: null, token };
        publicar({ atualizandoResumo: false });
      });
    pedido.pendente = pendente;
    return pendente;
  }

  /** O mesmo resumo, para a lista de "copiar cronograma de outro edital". */
  function editaisParaCopiar() {
    return resumo.get();
  }

  /*
    Sessão de outro usuário na mesma aba: o que era da anterior sai. Nada de
    chamar o `auth` aqui dentro — é o callback do próprio `auth`.
  */
  function reiniciarSessao() {
    resumo.invalidate();
    pedido = { fonte: null, pendente: null, token: pedido.token + 1 };
    publicar({
      resumo: [],
      statusDoResumo: "idle",
      atualizandoResumo: false,
      filtro: "todos",
      geracao: estado.geracao + 1,
    });
  }

  const assinaturaDoAuth = supabase?.auth?.onAuthStateChange?.(
    (_evento, sessao) => {
      const atual = sessao?.user?.id || null;
      if (atual === identidade) return;
      // O primeiro SIGNED_IN da página só registra quem é; não há o que limpar.
      if (identidade !== undefined || !atual) reiniciarSessao();
      identidade = atual;
    },
  );

  // Um cronograma salvo (daqui ou de outra tela) deixa o resumo velho.
  const invalidarResumo = () => resumo.invalidate();
  document.addEventListener(EVENTO_CRONOGRAMA_SALVO, invalidarResumo);

  // ── Cronograma ─────────────────────────────────────────────────────────

  async function lerCronograma(id) {
    if (!supabase) throw new Error("Supabase indisponível.");
    await exigirSessao(supabase);
    const { data, error } = await supabase.rpc(RPC_CRONOGRAMA, {
      p_monitoramento_id: id,
    });
    if (error) throw error;
    return data || {};
  }

  /**
   * Salva o edital e o cronograma numa só RPC, com o motivo no histórico.
   * Erro de validação não chega ao banco; aviso pede confirmação.
   */
  async function salvarEdital({ edital, etapas, motivo, errata }) {
    if (estado.salvando) return false;
    if (!canManageEditais(perfil())) {
      toast("Sem permissão para salvar editais.", "warn");
      return false;
    }
    const analise = analisarCronograma(edital, etapas, motivo);
    if (analise.erros.length) {
      toast(analise.erros[0], "warn");
      return false;
    }
    if (
      analise.avisos.length &&
      !confirmar(
        `Foram encontrados ${analise.avisos.length} ponto(s) para revisão. Deseja salvar mesmo assim?`,
      )
    )
      return false;

    publicar({ salvando: true });
    loader(true, "Editais", "Salvando edital e cronograma...", 70);
    try {
      await exigirSessao(supabase);
      const cronograma = etapas.map((etapa, indice) => ({
        ...etapa,
        ordem: indice + 1,
      }));
      const { data, error } = await supabase.rpc(RPC_SALVAR, {
        p_payload: edital,
        p_cronograma: cronograma,
        p_motivo: txt(motivo),
        p_numero_errata: txt(errata) || null,
      });
      if (error) throw error;
      if (!data?.ok) throw new Error("O Supabase não confirmou o salvamento.");

      /*
        O aviso sai antes de reabrir a página: ele invalida o resumo (aqui e no
        calendário), e a página reaberta já pede o novo.
      */
      publicar({ modal: null });
      document.dispatchEvent(
        new CustomEvent(EVENTO_CRONOGRAMA_SALVO, {
          detail: { id: data?.registro?.id, data },
        }),
      );
      await aoSalvar();
      toast(
        `${edital.edital} salvo. ${cronograma.length} etapa(s) registradas e histórico atualizado.`,
      );
      return true;
    } catch (erro) {
      toast(`Erro ao salvar edital: ${erro?.message || erro}`, "error");
      return false;
    } finally {
      loader(false);
      publicar({ salvando: false });
    }
  }

  // ── Modais ─────────────────────────────────────────────────────────────

  function abrir(modal) {
    aberturas += 1;
    publicar({ modal: { ...modal, abertura: aberturas }, perfil: perfil() });
  }

  function abrirEdital(id = "") {
    if (!canManageEditais(perfil())) {
      toast(
        "Seu perfil pode consultar Editais, mas não editar editais.",
        "warn",
      );
      return;
    }
    abrir({ tipo: "edital", id: txt(id) });
  }

  return {
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    obter: () => estado,
    toast,
    confirmar,
    /* O perfil muda sem aviso do legado: a página relê a cada abertura. */
    sincronizarPerfil: () => publicar({ perfil: perfil() }),
    carregarResumo,
    editaisParaCopiar,
    filtrarPor: (filtro) => publicar({ filtro: filtro || "todos" }),
    abrirEdital,
    abrirLinhaDoTempo: (id) => abrir({ tipo: "linha-do-tempo", id: txt(id) }),
    fecharModal: () => estado.modal && publicar({ modal: null }),
    lerCronograma,
    salvarEdital,
    desligar() {
      assinaturaDoAuth?.data?.subscription?.unsubscribe?.();
      document.removeEventListener(EVENTO_CRONOGRAMA_SALVO, invalidarResumo);
    },
  };
}
