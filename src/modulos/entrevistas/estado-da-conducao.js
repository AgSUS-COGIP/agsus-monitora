/*
  Estado das visões "Conduzir entrevistas" e "Roteiros" da tela de
  Entrevistas, fora do React (como estado.js, o da visão "Resultados"): os
  roteiros da área atual do app, os editais, o edital aberto (o payload de
  `obter_entrevistas_do_edital`) e as ações que escrevem no banco, uma por
  vez (`acao`). Os componentes leem com `useSyncExternalStore`. Este arquivo
  não importa React.

  As RPCs são as da migration 20260930220000_entrevistas_roteiros_e_notas.sql.
  Todas as de escrita do edital devolvem o payload atualizado, que substitui o
  da tela. Notas, convocação e desconvocação mudam o que a visão "Resultados"
  mostra (a mesma TB_ENTREVISTA): `aoMudarResultados` pede a releitura dela.

  A lista de editais vem de `listar_editais_entrevista` (migration
  20260930235000): só os editais na janela da entrevista pelo cronograma, os
  liberados pelo administrador global e os com convocado sem parecer. O
  administrador global pode pedir todos (`todos`) e liberar um edital fora
  da janela até uma data (`liberarEdital`).

  A agenda das entrevistas do edital (montada na Classificação › Agenda) vem
  junto ao abrir o edital, por `obter_agenda_entrevista` (migration
  20261005120000): só leitura aqui, para quem conduz ver a agenda do dia.
  Sem a migration ou sem acesso, `agenda` fica nula e a condução segue igual.

  A área é a do app: `trocarArea` (chamado pelo controlador e na troca de
  área com a tela aberta) descarta o que era da outra. Outro usuário na mesma
  aba também zera tudo.
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
const RPC_LISTAR_EDITAIS = "listar_editais_entrevista";
const RPC_LIBERAR_EDITAL = "liberar_entrevista_edital";
const RPC_OBTER_AGENDA = "obter_agenda_entrevista";

const LISTA_VAZIA = Object.freeze({
  lista: [],
  carregando: false,
  carregado: false,
  erro: "",
});

const EDITAIS_VAZIOS = Object.freeze({
  ...LISTA_VAZIA,
  /** O administrador global vê o filtro "todos" e libera editais. */
  admin: false,
  todos: false,
});

const ESTADO_INICIAL = Object.freeze({
  area: "",
  roteiros: LISTA_VAZIA,
  editais: EDITAIS_VAZIOS,
  editalId: "",
  /** Payload de `obter_entrevistas_do_edital` do edital aberto. */
  edital: null,
  /** Payload de `obter_agenda_entrevista` do edital aberto (ou null). */
  agenda: null,
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
  /* Cada carga de lista leva um número; a troca de área ou de usuário também
     avança, para a resposta de uma carga antiga não cair sobre a tela nova. */
  let pedidoDosRoteiros = 0;
  let pedidoDosEditais = 0;
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
      pedidoDosRoteiros += 1;
      pedidoDosEditais += 1;
      publicar({ ...ESTADO_INICIAL, area });
    }
  }

  let identidade;
  supabase?.auth?.onAuthStateChange?.((_evento, sessao) => {
    const atual = sessao?.user?.id || null;
    if (atual === identidade) return;
    // O primeiro aviso da página só registra quem é; não há o que limpar.
    if (identidade !== undefined || !atual) {
      pedidoDoEdital += 1;
      pedidoDosRoteiros += 1;
      pedidoDosEditais += 1;
      publicar(ESTADO_INICIAL);
    }
    identidade = atual;
  });

  // ── Roteiros ────────────────────────────────────────────────────────

  async function carregarRoteiros(area = estado.area) {
    trocarArea(area);
    const meu = ++pedidoDosRoteiros;
    publicar({ roteiros: { ...estado.roteiros, carregando: true, erro: "" } });
    try {
      const lista = await rpc(RPC_LISTAR_ROTEIROS, { p_area: area });
      if (meu !== pedidoDosRoteiros) return false;
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
      if (meu !== pedidoDosRoteiros) return false;
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

  /** `doPainel`: as entrevistas da visão "Resultados" (com `edital_id`). */
  async function carregarEditais(
    area = estado.area,
    doPainel = [],
    { todos = estado.editais.todos } = {},
  ) {
    trocarArea(area);
    const meu = ++pedidoDosEditais;
    publicar({ editais: { ...estado.editais, carregando: true, erro: "" } });
    try {
      const dados = await rpc(RPC_LISTAR_EDITAIS, {
        p_area: area,
        p_todos: Boolean(todos),
      });
      if (meu !== pedidoDosEditais) return [];
      const admin = Boolean(dados?.admin_global);
      const lista = editaisParaConduzir(dados?.editais || [], doPainel);
      publicar({
        editais: {
          lista,
          carregando: false,
          carregado: true,
          admin,
          todos: admin && Boolean(todos),
          erro: lista.length ? "" : "Nenhum edital na janela da entrevista.",
        },
      });
      return lista;
    } catch (erro) {
      if (meu !== pedidoDosEditais) return [];
      publicar({
        editais: {
          ...EDITAIS_VAZIOS,
          carregado: true,
          erro: `Não foi possível carregar os editais: ${mensagemDe(erro)}`,
        },
      });
      return [];
    }
  }

  /** Administrador global: libera o edital até `ate` (ou encerra, com `ate` vazio). */
  function liberarEdital(id, ate, motivo, doPainel = []) {
    return executar("liberar", ate ? "Liberando…" : "Encerrando…", async () => {
      await rpc(RPC_LIBERAR_EDITAL, {
        p_edital: id,
        p_ate: ate || null,
        p_motivo: motivo,
      });
      toast(
        ate ? "Edital liberado para a equipe." : "Liberação encerrada.",
        "ok",
      );
      await carregarEditais(estado.area, doPainel);
      return { ok: true };
    });
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
    const mesmo = id && estado.edital?.edital?.id === id;
    publicar({
      editalId: id || "",
      edital: mesmo ? estado.edital : null,
      agenda: mesmo ? estado.agenda : null,
      carregandoEdital: Boolean(id),
      erroDoEdital: "",
    });
    if (!id) return false;
    try {
      const [dados, agenda] = await Promise.all([
        rpc(RPC_OBTER_EDITAL, { p_edital: id }),
        rpc(RPC_OBTER_AGENDA, { p_edital: id }).catch(() => null),
      ]);
      if (meu !== pedidoDoEdital) return false;
      publicar({ agenda: agenda || null });
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
    trocarArea,
    carregarRoteiros,
    salvarRoteiro,
    carregarEditais,
    liberarEdital,
    abrirEdital,
    recarregarEdital,
    configurar,
    convocar,
    desconvocar,
    lancarNotas,
  };
}
