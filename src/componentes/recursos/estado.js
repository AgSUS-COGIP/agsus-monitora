/*
  Estado da aba Recursos, fora do React: o que o banco devolve para a área
  atual, o recurso aberto na gaveta (com o detalhe e o histórico), o formulário
  aberto e as ações que escrevem no banco. Os componentes leem com
  `useSyncExternalStore`; o legado chega aqui pelo controlador de
  `recursos.jsx` (`window.recursosController`). Este arquivo não importa React.

  Tudo passa por RPC (supabase/migrations/20260929120000_recursos.sql):
  `get_recursos_da_area` numa chamada só (json), o detalhe sob demanda, a
  busca do candidato nas análises do edital e as três escritas. O banco confere
  permissão e área em todas; `pode_editar` vem dele.

  Sem tela de carregamento: antes da primeira carga a página desenha skeleton
  (`carregado` falso); uma falha nela vira `erroAoCarregar`, com "Tentar de
  novo". Uma ação por vez (`executar`): o botão dela mostra o rótulo, os outros
  ficam desativados.
*/
import { csvDosRecursos } from "../../lib/recursos-dos-candidatos.js";

/* Aberta de novo depois disto, a aba relê o banco por trás, sem skeleton. */
const VALIDADE_MS = 60 * 1000;

const ESTADO_INICIAL = Object.freeze({
  /** A página já foi aberta (a carga só começa aí, não na entrada). */
  ativa: false,
  area: "",
  dados: null,
  carregado: false,
  erroAoCarregar: "",
  atualizando: false,
  carregadoEm: 0,
  /** A ação em curso, `{ tipo, rotulo }`, ou `null`. */
  acao: null,
  /** id do recurso aberto na gaveta, ou `null`. */
  gaveta: null,
  /** id → detalhe (`get_recurso_candidato_detalhe`) ou `{ erro }`. */
  detalhes: new Map(),
  /** `{ modo: "novo" | "edicao", id, abertura }` ou `null`. */
  formulario: null,
});

const mensagemDe = (erro) =>
  String(erro?.message || erro || "erro desconhecido");

function mensagemDaCarga(erro) {
  if (erro?.code === "PGRST202")
    return "A aba Recursos ainda não foi publicada no banco.";
  if (erro?.code === "42501")
    return "Seu acesso não inclui os recursos desta área.";
  return mensagemDe(erro);
}

function baixarNoNavegador(conteudo, nome) {
  const arquivo = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(arquivo);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function criarEstadoDosRecursos({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  getProfile = () => null,
  baixar = baixarNoNavegador,
  agora = () => Date.now(),
} = {}) {
  let estado = ESTADO_INICIAL;
  let aberturas = 0;
  let pedido = 0;
  const ouvintes = new Set();

  function publicar(mudancas) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  async function executar(tipo, rotulo, fazer) {
    if (estado.acao) return null;
    publicar({ acao: { tipo, rotulo } });
    try {
      return await fazer();
    } finally {
      publicar({ acao: null });
    }
  }

  // ── Leitura ─────────────────────────────────────────────────────────────

  /*
    Troca de área descarta o que era da outra (skeleton de novo); na mesma
    área, a tela fica e a releitura corre por trás. Resposta de um pedido
    antigo (a área mudou no meio) é ignorada.
  */
  async function carregar(area = estado.area) {
    if (!area) return false;
    const meu = ++pedido;
    if (area !== estado.area) {
      publicar({
        ...ESTADO_INICIAL,
        ativa: estado.ativa,
        area,
        detalhes: new Map(),
      });
    } else {
      publicar({ atualizando: true, erroAoCarregar: "" });
    }
    if (!supabase) {
      publicar({
        erroAoCarregar: "Sem conexão com o banco.",
        atualizando: false,
      });
      return false;
    }
    const { data, error } = await supabase.rpc("get_recursos_da_area", {
      p_area: area,
    });
    if (meu !== pedido) return false;
    if (error) {
      const mensagem = mensagemDaCarga(error);
      if (estado.carregado) {
        publicar({ atualizando: false });
        toast(`Não foi possível atualizar os recursos: ${mensagem}`, "error");
      } else publicar({ erroAoCarregar: mensagem, atualizando: false });
      return false;
    }
    publicar({
      dados: data || {
        recursos: [],
        cronogramas: [],
        origens: [],
        editais: [],
      },
      carregado: true,
      erroAoCarregar: "",
      atualizando: false,
      carregadoEm: agora(),
      detalhes: new Map(),
    });
    if (estado.gaveta) void carregarDetalhe(estado.gaveta);
    return true;
  }

  function garantirCarregado(area) {
    if (!area) return;
    if (area !== estado.area || (!estado.carregado && !estado.erroAoCarregar))
      return void carregar(area);
    if (estado.carregado && agora() - estado.carregadoEm > VALIDADE_MS)
      void carregar(area);
  }

  /* O legado abriu a página: a carga começa (ou revalida, se ficou velha). */
  function ativar() {
    if (!estado.ativa) publicar({ ativa: true });
    else if (estado.area) garantirCarregado(estado.area);
  }

  async function carregarDetalhe(id) {
    const { data, error } = await supabase.rpc(
      "get_recurso_candidato_detalhe",
      { p_id: id },
    );
    const detalhes = new Map(estado.detalhes);
    detalhes.set(id, error ? { erro: mensagemDe(error) } : data || {});
    publicar({ detalhes });
  }

  function abrirGaveta(id) {
    publicar({ gaveta: id });
    if (!estado.detalhes.has(id)) void carregarDetalhe(id);
  }

  const fecharGaveta = () => publicar({ gaveta: null });

  function abrirNovo() {
    aberturas += 1;
    publicar({ formulario: { modo: "novo", id: null, abertura: aberturas } });
  }

  function abrirEdicao(id) {
    aberturas += 1;
    publicar({ formulario: { modo: "edicao", id, abertura: aberturas } });
    if (!estado.detalhes.has(id)) void carregarDetalhe(id);
  }

  const fecharFormulario = () => publicar({ formulario: null });

  /** Candidatos das análises do edital; lança se o banco recusar. */
  async function buscarCandidatos(editalId, busca) {
    const { data, error } = await supabase.rpc("buscar_candidatos_recurso", {
      p_edital_id: editalId,
      p_busca: busca,
    });
    if (error) throw new Error(mensagemDe(error));
    return Array.isArray(data) ? data : [];
  }

  // ── Escrita ─────────────────────────────────────────────────────────────

  /*
    `{ ok: true, id }`, `{ duplicado: nº }` (o banco achou outro em análise e
    a pessoa ainda não confirmou) ou `{ erro }`.
  */
  function salvar(dados) {
    const edicao = Boolean(dados.id);
    return executar("salvar", "Salvando…", async () => {
      const { data, error } = await supabase.rpc("salvar_recurso_candidato", {
        p_dados: dados,
      });
      if (error) {
        if (error.code === "23505") {
          const numero = Number(String(error.hint || "").split(":")[1]);
          return { duplicado: Number.isFinite(numero) ? numero : true };
        }
        const mensagem =
          error.code === "40001"
            ? "Outra pessoa alterou este recurso. Recarregue e tente de novo."
            : mensagemDe(error);
        toast(`Não foi possível salvar: ${mensagem}`, "error");
        return { erro: mensagem };
      }
      toast(
        edicao
          ? `Recurso nº ${data?.nu ?? ""} atualizado.`
          : `Recurso nº ${data?.nu ?? ""} cadastrado.`,
        "ok",
      );
      publicar({ formulario: null });
      await carregar();
      return { ok: true, id: data?.id };
    });
  }

  /* A etapa entra na tela assim que o banco confirma; o histórico é relido. */
  function marcarEtapa(id, etapa, campo, feita) {
    return executar(`etapa:${id}:${etapa}`, "Salvando…", async () => {
      const { data, error } = await supabase.rpc("marcar_etapa_recurso", {
        p_id: id,
        p_etapa: etapa,
        p_feita: feita,
      });
      if (error) {
        toast(`Não foi possível marcar a etapa: ${mensagemDe(error)}`, "error");
        return false;
      }
      if (estado.dados) {
        const recursos = estado.dados.recursos.map((r) =>
          r.id === id
            ? {
                ...r,
                [campo]: data?.em ?? null,
                revisao: data?.revisao ?? r.revisao,
              }
            : r,
        );
        publicar({ dados: { ...estado.dados, recursos } });
      }
      void carregarDetalhe(id);
      return true;
    });
  }

  function excluir(id, motivo) {
    return executar("excluir", "Excluindo…", async () => {
      const { error } = await supabase.rpc("excluir_recurso_candidato", {
        p_id: id,
        p_motivo: motivo,
      });
      if (error) {
        toast(`Não foi possível excluir: ${mensagemDe(error)}`, "error");
        return false;
      }
      toast("Recurso excluído.", "ok");
      publicar({ gaveta: null, formulario: null });
      await carregar();
      return true;
    });
  }

  function exportarCsv(recursos, origens) {
    const dia = new Date(agora()).toISOString().slice(0, 10);
    baixar(
      csvDosRecursos(recursos, origens),
      `recursos-${estado.area}-${dia}.csv`,
    );
  }

  return {
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    obter: () => estado,
    perfil: () => getProfile() || null,
    carregar,
    garantirCarregado,
    ativar,
    carregarDetalhe,
    abrirGaveta,
    fecharGaveta,
    abrirNovo,
    abrirEdicao,
    fecharFormulario,
    buscarCandidatos,
    salvar,
    marcarEtapa,
    excluir,
    exportarCsv,
  };
}
