/*
  Estado das visões "Conduzir entrevistas" e "Roteiros" do painel de
  entrevistas, fora do React (como estado.js, o da visão "Resultados"): os
  roteiros da área, os editais, o edital aberto (o payload de
  `obter_entrevistas_do_edital`) e as ações que escrevem no banco, uma por
  vez (`acao`). Os componentes leem com `useSyncExternalStore`. Este arquivo
  não importa React.

  As RPCs são as da migration 20260930220000_entrevistas_roteiros_e_notas.sql.
  Todas as de escrita do edital devolvem o payload atualizado, que substitui o
  da tela. Notas, convocação e desconvocação mudam o que a visão "Resultados"
  mostra (a mesma TB_ENTREVISTA): `aoMudarResultados` pede a releitura dela.

  A lista de editais vem do monitoramento (TB_MONITORAMENTO_INDIGENA, com a
  área e o recorte da coordenação aplicados pela política de leitura), somada
  aos editais que já têm entrevistas no painel — quem só tem o módulo
  Entrevistas pode não ler o monitoramento.
*/
import {
  comTempoLimite,
  ehFalhaDeConexao,
  mensagemDeFalha,
} from "../../lib/falha-de-rede.js";
import {
  editaisParaConduzir,
  mensagemDoErroDaEntrevista,
} from "../../lib/conducao-de-entrevista.js";

const TEMPO_LIMITE_MS = 30000;

/* As RPCs (src/lib/rpc-contrato.js); chamadas por `rpc()`, com tempo limite. */
const RPC_LISTAR_ROTEIROS = "listar_roteiros_entrevista";
const RPC_SALVAR_ROTEIRO = "salvar_roteiro_entrevista";
const RPC_OBTER_EDITAL = "obter_entrevistas_do_edital";
const RPC_CONFIGURAR = "configurar_entrevista_edital";
const RPC_CONVOCAR = "convocar_para_entrevista";
const RPC_DESCONVOCAR = "desconvocar_da_entrevista";
const RPC_LANCAR_NOTAS = "lancar_notas_entrevista";

const LISTA_VAZIA = Object.freeze({
  lista: [],
  carregando: false,
  carregado: false,
  erro: "",
});

const ESTADO_INICIAL = Object.freeze({
  area: "",
  roteiros: LISTA_VAZIA,
  editais: LISTA_VAZIA,
  editalId: "",
  /** Payload de `obter_entrevistas_do_edital` do edital aberto. */
  edital: null,
  carregandoEdital: false,
  erroDoEdital: "",
  /** `pode_editar` do último edital aberto (os roteiros não o devolvem). */
  podeEditar: null,
  /** `{ tipo, rotulo }` da gravação em curso, ou `null`. */
  acao: null,
});

export function mensagemDe(erro) {
  return ehFalhaDeConexao(erro)
    ? mensagemDeFalha(erro)
    : mensagemDoErroDaEntrevista(erro);
}

export function criarEstadoDaConducao({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  aoMudarResultados = () => {},
  tempoLimiteMs = TEMPO_LIMITE_MS,
} = {}) {
  let estado = ESTADO_INICIAL;
  let pedidoDoEdital = 0;
  const ouvintes = new Set();

  function publicar(mudancas) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  async function rpc(nome, argumentos) {
    if (!supabase) throw new Error("Sem conexão com o banco.");
    const { data, error } = await comTempoLimite(
      supabase.rpc(nome, argumentos),
      tempoLimiteMs,
    );
    if (error) throw error;
    return data;
  }

  async function executar(tipo, rotulo, fazer) {
    if (estado.acao) return { erro: "Aguarde a gravação em curso." };
    publicar({ acao: { tipo, rotulo } });
    try {
      return await fazer();
    } catch (erro) {
      const mensagem = mensagemDe(erro);
      if (erro?.code === "42501" && tipo === "roteiro")
        publicar({ podeEditar: false });
      toast(mensagem, "error");
      return { erro: mensagem, codigo: erro?.code || "" };
    } finally {
      publicar({ acao: null });
    }
  }

  function trocarArea(area) {
    if (area && area !== estado.area) {
      pedidoDoEdital += 1;
      publicar({ ...ESTADO_INICIAL, area });
    }
  }

  // ── Roteiros ────────────────────────────────────────────────────────

  async function carregarRoteiros(area = estado.area) {
    trocarArea(area);
    publicar({ roteiros: { ...estado.roteiros, carregando: true, erro: "" } });
    try {
      const lista = await rpc(RPC_LISTAR_ROTEIROS, { p_area: area });
      publicar({
        roteiros: {
          lista: Array.isArray(lista) ? lista : [],
          carregando: false,
          carregado: true,
          erro: "",
        },
      });
      return true;
    } catch (erro) {
      publicar({
        roteiros: {
          ...estado.roteiros,
          carregando: false,
          erro: mensagemDe(erro),
        },
      });
      return false;
    }
  }

  /** `{ ok, roteiro }` ou `{ erro }`. */
  function salvarRoteiro(dados) {
    return executar("roteiro", "Salvando o roteiro…", async () => {
      const roteiro = await rpc(RPC_SALVAR_ROTEIRO, {
        p_dados: dados,
      });
      toast(
        dados.origem
          ? `Roteiro salvo: versão ${roteiro?.versao ?? ""}.`
          : "Roteiro criado.",
        "ok",
      );
      publicar({ podeEditar: true });
      await carregarRoteiros();
      return { ok: true, roteiro };
    });
  }

  // ── Editais ─────────────────────────────────────────────────────────

  async function lerMonitoramento(area) {
    // Pelo módulo Entrevistas (listar_editais_entrevista, com o recorte da
    // coordenação); a leitura direta da tabela fica só de reserva.
    if (typeof supabase?.rpc === "function") {
      try {
        const { data, error } = await comTempoLimite(
          supabase.rpc("listar_editais_entrevista", { p_area: area }),
          tempoLimiteMs,
        );
        if (!error && Array.isArray(data)) return data;
      } catch (erro) {
        console.warn("listar_editais_entrevista indisponível:", erro);
      }
    }
    if (typeof supabase?.from !== "function") return [];
    try {
      const { data, error } = await comTempoLimite(
        supabase
          .from("TB_MONITORAMENTO_INDIGENA")
          .select("id,edital,unidade")
          .eq("CO_AREA", area)
          .eq("ativo", true)
          .order("edital", { ascending: true }),
        tempoLimiteMs,
      );
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    } catch (erro) {
      console.warn("Editais do monitoramento indisponíveis:", erro);
      return [];
    }
  }

  /** `doPainel`: as entrevistas da visão "Resultados" (com `edital_id`). */
  async function carregarEditais(area = estado.area, doPainel = []) {
    trocarArea(area);
    publicar({ editais: { ...estado.editais, carregando: true, erro: "" } });
    const monitoramento = await lerMonitoramento(area);
    const lista = editaisParaConduzir(monitoramento, doPainel);
    publicar({
      editais: {
        lista,
        carregando: false,
        carregado: true,
        erro: lista.length ? "" : "Nenhum edital desta área disponível.",
      },
    });
    return lista;
  }

  function mostrarEdital(dados) {
    publicar({
      edital: dados || null,
      carregandoEdital: false,
      erroDoEdital: "",
      podeEditar: Boolean(dados?.pode_editar),
    });
  }

  async function abrirEdital(id) {
    const meu = ++pedidoDoEdital;
    publicar({
      editalId: id || "",
      edital: id && estado.edital?.edital?.id === id ? estado.edital : null,
      carregandoEdital: Boolean(id),
      erroDoEdital: "",
    });
    if (!id) return false;
    try {
      const dados = await rpc(RPC_OBTER_EDITAL, { p_edital: id });
      if (meu !== pedidoDoEdital) return false;
      mostrarEdital(dados);
      return true;
    } catch (erro) {
      if (meu !== pedidoDoEdital) return false;
      publicar({ carregandoEdital: false, erroDoEdital: mensagemDe(erro) });
      return false;
    }
  }

  const recarregarEdital = () => abrirEdital(estado.editalId);

  /* Resposta de escrita: o payload novo entra na tela (se o edital é o mesmo). */
  function aplicar(dados, editalId) {
    if (editalId === estado.editalId) mostrarEdital(dados);
  }

  function configurar(dados) {
    const editalId = estado.editalId;
    return executar("configurar", "Salvando a configuração…", async () => {
      const novo = await rpc(RPC_CONFIGURAR, {
        p_edital: editalId,
        p_dados: dados,
      });
      aplicar(novo, editalId);
      toast("Configuração da entrevista salva.", "ok");
      return { ok: true };
    });
  }

  function convocar(analises) {
    const editalId = estado.editalId;
    return executar("convocar", "Convocando…", async () => {
      const resposta = await rpc(RPC_CONVOCAR, {
        p_edital: editalId,
        p_analises: analises,
      });
      aplicar(resposta?.dados, editalId);
      const quantos = Number(resposta?.convocados) || 0;
      toast(
        `${quantos} ${quantos === 1 ? "candidato convocado" : "candidatos convocados"}.`,
        "ok",
      );
      aoMudarResultados();
      return { ok: true, convocados: quantos };
    });
  }

  function desconvocar(entrevista, motivo) {
    const editalId = estado.editalId;
    return executar("desconvocar", "Desconvocando…", async () => {
      const novo = await rpc(RPC_DESCONVOCAR, {
        p_entrevista: entrevista,
        p_motivo: motivo,
      });
      aplicar(novo, editalId);
      toast("Convocação retirada.", "ok");
      aoMudarResultados();
      return { ok: true };
    });
  }

  function lancarNotas(entrevista, dados) {
    const editalId = estado.editalId;
    return executar("notas", "Salvando as notas…", async () => {
      const novo = await rpc(RPC_LANCAR_NOTAS, {
        p_entrevista: entrevista,
        p_dados: dados,
      });
      aplicar(novo, editalId);
      toast("Notas salvas; o resultado foi recalculado.", "ok");
      aoMudarResultados();
      return { ok: true, dados: novo };
    });
  }

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregarRoteiros,
    salvarRoteiro,
    carregarEditais,
    abrirEdital,
    recarregarEdital,
    configurar,
    convocar,
    desconvocar,
    lancarNotas,
  };
}
