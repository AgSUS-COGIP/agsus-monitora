/*
  Estado de Configurações › Acessos, fora do React: a matriz carregada, o
  rascunho das permissões, as solicitações pendentes, a gaveta aberta e as
  ações que vão ao banco (uma por vez, `executar` / `acao`, como na Lista de
  aprovados). Este arquivo não importa React; as RPCs ficam aqui (o
  check:rpc-contract só lê `.js`).

  O RASCUNHO mora aqui, não no componente: a guarda de saída do legado
  (`navigate`) e a troca de seção de Configurações perguntam a este estado se
  há alteração não salva (`confirmarSaida`).
*/

import { exigirSessao } from "../../lib/sessao.js";
import {
  alteracoesDoRascunho,
  contarPendencias,
  rebasearRascunho,
  registrarNoRascunho,
} from "../../lib/matriz-de-acessos.js";

const RPC_MATRIZ = "obter_matriz_acessos";
const RPC_SALVAR_MATRIZ = "salvar_matriz_acessos";
const RPC_SOLICITACOES = "listar_solicitacoes_acesso";
const RPC_APROVAR = "aprovar_solicitacao_acesso";
const RPC_RECUSAR = "recusar_solicitacao_acesso";
const RPC_SALVAR_GRUPO = "salvar_grupo_acesso";
const RPC_REMOVER_GRUPO = "remover_grupo_acesso";
const RPC_SALVAR_COORDENACAO = "salvar_coordenacao";
const RPC_DESATIVAR_COORDENACAO = "desativar_coordenacao";
const RPC_CONTEXTO_DE_USUARIO = "obter_contexto_de_usuario";
const RPC_DESATIVAR_USUARIO = "desativar_acesso_usuario";
const RPC_UNIDADES_POR_AREA = "listar_unidades_por_area";
const RPC_ADICIONAR_PESSOA = "adicionar_pessoa_acesso";
const RPC_MOVER_PARA_COORDENACOES = "mover_conta_para_coordenacoes";

const CONFLITO = "40001";

const ESTADO_INICIAL = Object.freeze({
  perfil: null,
  /** Resposta de obter_matriz_acessos. */
  matriz: null,
  /** "idle", "loading", "ready" ou "error". */
  status: "idle",
  erro: "",
  /** Código do erro do PostgREST (PGRST202 = banco sem a função/assinatura nova). */
  erroCodigo: "",
  busca: "",
  offset: 0,
  /** "" todas · "__sem__" sem coordenação · código da coordenação. */
  filtroCoordenacao: "",
  /** "" todos · código do grupo. */
  filtroGrupo: "",
  rascunho: new Map(),
  solicitacoes: Object.freeze([]),
  statusDasSolicitacoes: "idle",
  /** { tipo, rotulo } da ação em curso, ou null. */
  acao: null,
  /** Gaveta da pessoa: { usuarioId, abertura } ou null. */
  gaveta: null,
  /** Modal "Adicionar pessoa" aberto (número da abertura) ou 0. */
  adicionando: 0,
  /** Aviso depois de salvar ou de um conflito. */
  aviso: null,
  geracao: 0,
});

export function criarEstadoDosAcessos({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  getProfile = () => null,
  confirmar = (mensagem) => window.confirm(mensagem),
} = {}) {
  let estado = ESTADO_INICIAL;
  let aberturas = 0;
  let identidade;
  let unidadesPorArea = null;
  const ouvintes = new Set();

  function publicar(mudancas) {
    const antes = contarPendencias(estado.rascunho);
    estado = { ...estado, ...mudancas };
    const depois = contarPendencias(estado.rascunho);
    if (!antes !== !depois) ligarAvisoDeSaida(depois > 0);
    for (const ouvinte of ouvintes) ouvinte();
  }

  // ── Guarda de saída ───────────────────────────────────────────────────────

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
      `Há ${pendentes} ${pendentes === 1 ? "alteração de acesso não salva" : "alterações de acesso não salvas"}. Sair e descartar?`,
    );
    if (ok) publicar({ rascunho: new Map() });
    return ok;
  }

  // ── Infra ─────────────────────────────────────────────────────────────────

  async function rpc(nome, argumentos) {
    if (!supabase) throw new Error("Supabase indisponível.");
    await exigirSessao(supabase);
    const { data, error } = await supabase.rpc(nome, argumentos);
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

  const mensagemDoErro = (erro) => erro?.message || "Tente de novo em instantes.";

  // ── Matriz ──────────────────────────────────────────────────────────────────

  async function carregarMatriz(mudancas = {}) {
    const alvo = {
      busca: mudancas.busca ?? estado.busca,
      offset: mudancas.offset ?? estado.offset,
      filtroCoordenacao: mudancas.filtroCoordenacao ?? estado.filtroCoordenacao,
      filtroGrupo: mudancas.filtroGrupo ?? estado.filtroGrupo,
    };
    const geracao = estado.geracao;
    publicar({ ...alvo, status: estado.matriz ? "ready" : "loading", erro: "", erroCodigo: "" });
    try {
      const matriz = await rpc(RPC_MATRIZ, {
        p_busca: alvo.busca,
        p_offset: alvo.offset,
        p_coordenacao: alvo.filtroCoordenacao,
        p_grupo: alvo.filtroGrupo,
      });
      if (geracao !== estado.geracao) return null;
      publicar({ matriz, status: "ready" });
      return matriz;
    } catch (erro) {
      if (geracao !== estado.geracao) return null;
      console.error("Erro ao carregar os acessos:", erro);
      publicar({ status: "error", erro: mensagemDoErro(erro), erroCodigo: erro?.code || "" });
      return null;
    }
  }

  function registrar(usuario, alvo, valor) {
    try {
      publicar({ rascunho: registrarNoRascunho(estado.rascunho, usuario, alvo, valor), aviso: null });
    } catch (erro) {
      toast(mensagemDoErro(erro), "error");
    }
  }

  const descartar = () => publicar({ rascunho: new Map(), aviso: null });

  function salvar(motivo) {
    const alteracoes = alteracoesDoRascunho(estado.rascunho);
    if (!alteracoes.length) return Promise.resolve(false);
    return executar("salvar", "Salvando…", async () => {
      try {
        const resultado = await rpc(RPC_SALVAR_MATRIZ, {
          p_alteracoes: alteracoes,
          p_motivo: String(motivo || "").trim(),
        });
        const total = resultado?.alteradas ?? alteracoes.length;
        publicar({ rascunho: new Map(), aviso: null });
        toast(`${total} ${total === 1 ? "alteração salva" : "alterações salvas"}. Vale na próxima vez que a pessoa abrir o sistema.`, "success");
        await carregarMatriz();
        return true;
      } catch (erro) {
        if (erro?.code === CONFLITO) {
          const matriz = await carregarMatriz();
          const { rascunho, conflitos } = rebasearRascunho(estado.rascunho, matriz?.usuarios || []);
          publicar({
            rascunho,
            aviso: {
              tom: "warn",
              texto: conflitos.length
                ? `Outra pessoa mudou ${conflitos.length} ${conflitos.length === 1 ? "acesso" : "acessos"} que você estava alterando; essas alterações saíram. Revise e salve de novo.`
                : "Os acessos mudaram enquanto você editava. A lista foi recarregada com as suas alterações; revise e salve de novo.",
            },
          });
          return false;
        }
        publicar({
          aviso: { tom: "danger", texto: `Não foi possível salvar: ${mensagemDoErro(erro)} As alterações continuam pendentes.` },
        });
        return false;
      }
    });
  }

  function desativarUsuario(usuario, motivo) {
    return executar(`desativar:${usuario.id}`, "Desativando…", async () => {
      try {
        await rpc(RPC_DESATIVAR_USUARIO, { p_perfil_usuario_id: usuario.id, p_motivo: motivo });
        toast(`Acesso de ${usuario.nome || usuario.email} desativado.`, "success");
        publicar({ gaveta: null });
        await carregarMatriz();
        return true;
      } catch (erro) {
        toast(`Não foi possível desativar: ${mensagemDoErro(erro)}`, "error");
        return false;
      }
    });
  }

  function adicionarPessoa({ email, nome, grupo, coordenacao, areas }, motivo) {
    return executar("adicionar", "Adicionando…", async () => {
      try {
        const resposta = await rpc(RPC_ADICIONAR_PESSOA, {
          p_email: email,
          p_nome: nome,
          p_grupo: grupo,
          p_coordenacao: coordenacao || null,
          p_areas: areas?.length ? areas : null,
          p_motivo: motivo,
        });
        toast(resposta?.reativada ? `Acesso de ${nome} reativado.` : `${nome} tem acesso a partir de agora (entra com ${email}).`, "success");
        publicar({ adicionando: 0 });
        await carregarMatriz();
        return true;
      } catch (erro) {
        toast(`Não foi possível adicionar: ${mensagemDoErro(erro)}`, "error");
        return false;
      }
    });
  }

  function moverParaCoordenacoes(usuario, area, motivo) {
    return executar(`mover:${usuario.id}`, "Movendo…", async () => {
      try {
        const coordenacao = await rpc(RPC_MOVER_PARA_COORDENACOES, {
          p_perfil_usuario_id: usuario.id,
          p_area: area,
          p_motivo: motivo,
        });
        toast(`"${coordenacao?.nome || usuario.nome}" agora está em Coordenações; a conta foi desativada.`, "success");
        publicar({ gaveta: null });
        await carregarMatriz();
        return true;
      } catch (erro) {
        toast(`Não foi possível mover: ${mensagemDoErro(erro)}`, "error");
        return false;
      }
    });
  }

  // ── Solicitações ──────────────────────────────────────────────────────────

  async function carregarSolicitacoes() {
    const geracao = estado.geracao;
    publicar({ statusDasSolicitacoes: estado.statusDasSolicitacoes === "ready" ? "ready" : "loading" });
    try {
      const lista = await rpc(RPC_SOLICITACOES, { p_status: "pendente" });
      if (geracao !== estado.geracao) return;
      publicar({ solicitacoes: Array.isArray(lista) ? lista : [], statusDasSolicitacoes: "ready" });
    } catch (erro) {
      if (geracao !== estado.geracao) return;
      console.error("Erro ao carregar solicitações de acesso:", erro);
      publicar({ statusDasSolicitacoes: "error" });
    }
  }

  function aprovar(solicitacao, { grupo, coordenacao, areas, observacao }) {
    return executar(`aprovar:${solicitacao.id}`, "Aprovando…", async () => {
      try {
        await rpc(RPC_APROVAR, {
          p_solicitacao_id: solicitacao.id,
          p_grupo: grupo,
          p_coordenacao: coordenacao || null,
          p_areas: areas?.length ? areas : null,
          p_observacao_admin: observacao || null,
        });
        toast(`Acesso de ${solicitacao.nome || solicitacao.email} aprovado.`, "success");
        await Promise.all([carregarSolicitacoes(), carregarMatriz()]);
        return true;
      } catch (erro) {
        toast(`Não foi possível aprovar: ${mensagemDoErro(erro)}`, "error");
        return false;
      }
    });
  }

  function recusar(solicitacao, observacao) {
    return executar(`recusar:${solicitacao.id}`, "Recusando…", async () => {
      try {
        await rpc(RPC_RECUSAR, { p_solicitacao_id: solicitacao.id, p_observacao_admin: observacao || null });
        toast(`Solicitação de ${solicitacao.nome || solicitacao.email} recusada.`, "success");
        await carregarSolicitacoes();
        return true;
      } catch (erro) {
        toast(`Não foi possível recusar: ${mensagemDoErro(erro)}`, "error");
        return false;
      }
    });
  }

  // ── Grupos e coordenações (admin global) ────────────────────────────────────

  function gravar(tipo, rotulo, nome, argumentos, sucesso) {
    return executar(tipo, rotulo, async () => {
      try {
        const resposta = await rpc(nome, argumentos);
        toast(sucesso, "success");
        await carregarMatriz();
        return resposta || true;
      } catch (erro) {
        toast(
          erro?.code === CONFLITO
            ? "Outra pessoa alterou este item. Recarregue e tente de novo."
            : `Não foi possível salvar: ${mensagemDoErro(erro)}`,
          "error",
        );
        return false;
      }
    });
  }

  const salvarGrupo = (grupo, motivo) =>
    gravar("grupo", "Salvando…", RPC_SALVAR_GRUPO, { p_grupo: grupo, p_motivo: motivo }, `Grupo "${grupo.nome}" salvo.`);
  const removerGrupo = (grupo, motivo) =>
    gravar("remover-grupo", "Excluindo…", RPC_REMOVER_GRUPO, { p_codigo: grupo.codigo, p_motivo: motivo }, `Grupo "${grupo.nome}" excluído.`);
  const salvarCoordenacao = (coordenacao, motivo) =>
    gravar("coordenacao", "Salvando…", RPC_SALVAR_COORDENACAO, { p_coordenacao: coordenacao, p_motivo: motivo }, `Coordenação "${coordenacao.nome}" salva.`);
  const desativarCoordenacao = (coordenacao, motivo) =>
    gravar("desativar-coordenacao", "Desativando…", RPC_DESATIVAR_COORDENACAO, { p_codigo: coordenacao.codigo, p_motivo: motivo }, `Coordenação "${coordenacao.nome}" desativada.`);

  function lerUnidadesPorArea() {
    if (!unidadesPorArea)
      unidadesPorArea = rpc(RPC_UNIDADES_POR_AREA)
        .then((dados) => (Array.isArray(dados) ? dados : []))
        .catch((erro) => {
          console.warn("Unidades por área indisponíveis:", erro?.message || erro);
          unidadesPorArea = null;
          return [];
        });
    return unidadesPorArea;
  }

  const lerContextoDoUsuario = (id) => rpc(RPC_CONTEXTO_DE_USUARIO, { p_perfil_usuario_id: id });

  // ── Sessão ────────────────────────────────────────────────────────────────

  function reiniciarSessao() {
    unidadesPorArea = null;
    publicar({ ...ESTADO_INICIAL, rascunho: new Map(), geracao: estado.geracao + 1 });
  }

  const assinaturaDoAuth = supabase?.auth?.onAuthStateChange?.((_evento, sessao) => {
    const atual = sessao?.user?.id || null;
    if (atual === identidade) return;
    if (identidade !== undefined || !atual) reiniciarSessao();
    identidade = atual;
  });

  return {
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    obter: () => estado,
    toast,
    confirmar,
    /** Ao abrir a seção: relê o perfil e carrega o que ainda não veio. */
    garantirCarregado() {
      publicar({ perfil: getProfile() || null });
      const tarefas = [];
      if (estado.status === "idle" || estado.status === "error") tarefas.push(carregarMatriz());
      if (estado.statusDasSolicitacoes === "idle" || estado.statusDasSolicitacoes === "error")
        tarefas.push(carregarSolicitacoes());
      return Promise.all(tarefas);
    },
    carregarMatriz,
    registrar,
    descartar,
    salvar,
    desativarUsuario,
    adicionarPessoa,
    moverParaCoordenacoes,
    abrirAdicionar: () => publicar({ adicionando: Date.now() }),
    fecharAdicionar: () => estado.adicionando && publicar({ adicionando: 0 }),
    carregarSolicitacoes,
    aprovar,
    recusar,
    salvarGrupo,
    removerGrupo,
    salvarCoordenacao,
    desativarCoordenacao,
    lerUnidadesPorArea,
    lerContextoDoUsuario,
    abrirGaveta(usuarioId) {
      aberturas += 1;
      publicar({ gaveta: { usuarioId, abertura: aberturas } });
    },
    fecharGaveta: () => estado.gaveta && publicar({ gaveta: null }),
    confirmarSaida,
    temAlteracoesPendentes: () => contarPendencias(estado.rascunho) > 0,
    desligar() {
      ligarAvisoDeSaida(false);
      assinaturaDoAuth?.data?.subscription?.unsubscribe?.();
    },
  };
}
