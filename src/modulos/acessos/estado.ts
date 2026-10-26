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

import { exigirSessao } from "../../lib/sessao";
import { comTempoLimite, mensagemDeFalha } from "../../lib/falha-de-rede";
import { ehConflitoDeVersao } from "../../lib/conflito-de-versao.ts";
import {
  alteracoesDoRascunho,
  avisoDoConflito,
  contarPendencias,
  rebasearRascunho,
  registrarNoRascunho,
  separarRascunhoDaPessoa,
} from "../../lib/matriz-de-acessos.ts";
import { isAdminGlobal, isOwnAccessProfile } from "../../lib/access-roles.ts";
import {
  argumentosDaReativacao,
  contasDaResposta,
  mensagemDaRecusaDeReativacao,
  mensagemDeContaReativada,
} from "../../lib/contas-desativadas.ts";
import type {
  ContaDesativada,
  ContextoRecebido,
  CoordenacaoDeAcesso,
  CoordenacaoParaSalvar,
  GrupoDeAcesso,
  GrupoParaSalvar,
  UsuarioDaMatriz,
  ValoresDaReativacao,
} from "../../lib/tipos-dos-acessos.ts";
import type {
  ArgumentosDaRecusa,
  ContaDesativadaDosAcessos,
  ConvitePronto,
  ErroDoBanco,
  EscolhaDaAprovacao,
  MatrizDosAcessos,
  MudancasDaMatriz,
  NovaPessoa,
  OpcoesDoEstadoDosAcessos,
  PedidoPendente,
  RespostaDaGravacao,
  ResultadoDaAcao,
  RpcDosAcessos,
  SnapshotDosAcessos,
  UnidadeDaArea,
} from "./tipos.ts";

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
const RPC_CONTAS_DESATIVADAS = "listar_contas_desativadas";
const RPC_REATIVAR_USUARIO = "reativar_acesso_usuario";

/* salvar_matriz_acessos: o lote deixaria alguém ativo sem nenhuma área. */
const SEM_AREA = "23514";
/*
  Uma chamada que não volta (rede caída, VPN, servidor parado) não pode deixar
  o botão em "Salvando…" para sempre: passado o limite, ela falha como erro de
  rede, o `executar` devolve o botão e o aviso diz o que fazer.
*/
const TEMPO_LIMITE_MS = 30000;
/* Linhas por página de obter_matriz_acessos (o `limit 30` da função no banco). */
export const POR_PAGINA = 30;

const ESTADO_INICIAL: SnapshotDosAcessos = Object.freeze({
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
  /** Aba "Desativadas" (só admin global): listar_contas_desativadas. */
  desativadas: Object.freeze([]),
  /** "idle", "loading", "ready" ou "error". */
  statusDasDesativadas: "idle",
  buscaDasDesativadas: "",
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
  toast = (mensagem: string) => console.info(mensagem),
  getProfile = () => null,
  confirmar = (mensagem: string) => window.confirm(mensagem),
}: OpcoesDoEstadoDosAcessos = {}) {
  let estado = ESTADO_INICIAL;
  let aberturas = 0;
  let identidade: string | null | undefined;
  let unidadesPorArea: Promise<UnidadeDaArea[]> | null = null;
  const ouvintes = new Set<() => void>();

  function publicar(mudancas: Partial<SnapshotDosAcessos>) {
    const antes = contarPendencias(estado.rascunho);
    estado = { ...estado, ...mudancas };
    const depois = contarPendencias(estado.rascunho);
    if (!antes !== !depois) ligarAvisoDeSaida(depois > 0);
    for (const ouvinte of ouvintes) ouvinte();
  }

  // ── Guarda de saída ───────────────────────────────────────────────────────

  function aoSairDaPagina(evento: BeforeUnloadEvent) {
    evento.preventDefault();
    evento.returnValue = "";
  }
  function ligarAvisoDeSaida(ligar: boolean) {
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

  async function rpc(
    nome: RpcDosAcessos,
    argumentos?: Record<string, unknown>,
  ): Promise<unknown> {
    if (!supabase) throw new Error("Supabase indisponível.");
    const { data, error }: { data: unknown; error: unknown } =
      await comTempoLimite(
        exigirSessao(supabase).then(() => supabase.rpc(nome, argumentos)),
        TEMPO_LIMITE_MS,
      );
    if (error) throw error;
    return data;
  }

  async function executar<T>(
    tipo: string,
    rotulo: string,
    fazer: () => Promise<T>,
  ): Promise<T | false> {
    if (estado.acao) return false;
    publicar({ acao: { tipo, rotulo } });
    try {
      return await fazer();
    } finally {
      publicar({ acao: null });
    }
  }

  // "Failed to fetch" vira "Não foi possível falar com o servidor…".
  const mensagemDoErro = (erro: unknown): string =>
    erro ? mensagemDeFalha(erro) : "Tente de novo em instantes.";

  // ── Matriz ──────────────────────────────────────────────────────────────────

  /* Busca, filtros e página disparam cargas sem esperar a anterior: só a
     resposta do último pedido entra na tela (a geração cobre a troca de sessão). */
  let pedidoDaMatriz = 0;
  let pedidoDasDesativadas = 0;

  async function carregarMatriz(
    mudancas: MudancasDaMatriz = {},
  ): Promise<MatrizDosAcessos | null> {
    const alvo = {
      busca: mudancas.busca ?? estado.busca,
      offset: mudancas.offset ?? estado.offset,
      filtroCoordenacao: mudancas.filtroCoordenacao ?? estado.filtroCoordenacao,
      filtroGrupo: mudancas.filtroGrupo ?? estado.filtroGrupo,
    };
    const geracao = estado.geracao;
    const meu = ++pedidoDaMatriz;
    const antigo = () => geracao !== estado.geracao || meu !== pedidoDaMatriz;
    publicar({
      ...alvo,
      status: estado.matriz ? "ready" : "loading",
      erro: "",
      erroCodigo: "",
    });
    try {
      // A forma vem de obter_matriz_acessos.
      const matriz = (await rpc(RPC_MATRIZ, {
        p_busca: alvo.busca,
        p_offset: alvo.offset,
        p_coordenacao: alvo.filtroCoordenacao,
        p_grupo: alvo.filtroGrupo,
      })) as MatrizDosAcessos | null;
      if (antigo()) return null;
      /* A página ficou vazia (desativou ou moveu a única pessoa da última
         página): volta para a última página que ainda tem gente. */
      const total = Number(matriz?.total) || 0;
      if (alvo.offset > 0 && total > 0 && !matriz?.usuarios?.length) {
        const ultima = Math.floor((total - 1) / POR_PAGINA) * POR_PAGINA;
        return carregarMatriz({ offset: ultima });
      }
      publicar({ matriz, status: "ready" });
      return matriz;
    } catch (erro) {
      if (antigo()) return null;
      console.error("Erro ao carregar os acessos:", erro);
      publicar({
        status: "error",
        erro: mensagemDoErro(erro),
        erroCodigo: (erro as ErroDoBanco | null)?.code || "",
      });
      return null;
    }
  }

  function registrar(
    usuario: UsuarioDaMatriz,
    alvo: string,
    valor: string | null,
  ) {
    try {
      publicar({
        rascunho: registrarNoRascunho(estado.rascunho, usuario, alvo, valor),
        aviso: null,
      });
    } catch (erro) {
      toast(mensagemDoErro(erro), "error");
    }
  }

  const descartar = () => publicar({ rascunho: new Map(), aviso: null });
  /* Descartar da gaveta: só o que mudou nesta pessoa. */
  const descartarDaPessoa = (usuarioId: string) =>
    publicar({
      rascunho: separarRascunhoDaPessoa(estado.rascunho, usuarioId).resto,
      aviso: null,
    });

  /*
    Sem `usuarioId`: grava o rascunho inteiro (barra da página). Com
    `usuarioId`: só o que mudou naquela pessoa (Salvar da gaveta); o resto do
    rascunho continua pendente.
  */
  function salvar(
    motivo: string,
    { usuarioId = null }: { usuarioId?: string | null } = {},
  ): Promise<boolean> {
    const lote = usuarioId
      ? separarRascunhoDaPessoa(estado.rascunho, usuarioId).daPessoa
      : estado.rascunho;
    const alteracoes = alteracoesDoRascunho(lote);
    if (!alteracoes.length) return Promise.resolve(false);
    return executar("salvar", "Salvando…", async () => {
      try {
        const resultado = (await rpc(RPC_SALVAR_MATRIZ, {
          p_alteracoes: alteracoes,
          p_motivo: String(motivo || "").trim(),
        })) as { alteradas?: number | null } | null;
        const total = resultado?.alteradas ?? alteracoes.length;
        publicar({
          rascunho: usuarioId
            ? separarRascunhoDaPessoa(estado.rascunho, usuarioId).resto
            : new Map(),
          aviso: null,
        });
        toast(
          `${total} ${total === 1 ? "alteração salva" : "alterações salvas"}. Vale na próxima vez que a pessoa abrir o sistema.`,
          "success",
        );
        await carregarMatriz();
        return true;
      } catch (erro) {
        if (ehConflitoDeVersao(erro)) {
          const matriz = await carregarMatriz();
          /* Sem a lista nova, rebasear na velha repetiria o conflito. */
          if (!matriz) {
            publicar({
              aviso: {
                tom: "danger",
                texto:
                  "Os acessos mudaram enquanto você editava e a lista não pôde ser recarregada. As alterações continuam pendentes; recarregue e salve de novo.",
              },
            });
            return false;
          }
          const { rascunho, conflitos, foraDaLista } = rebasearRascunho(
            estado.rascunho,
            matriz.usuarios || [],
          );
          publicar({
            rascunho,
            aviso: {
              tom: "warn",
              texto: avisoDoConflito(conflitos, foraDaLista),
            },
          });
          return false;
        }
        // Sem área: a mensagem do banco já diz quem e o que fazer.
        publicar({
          aviso:
            (erro as ErroDoBanco | null)?.code === SEM_AREA
              ? {
                  tom: "warn",
                  texto: `${mensagemDoErro(erro)} Nada foi salvo; as alterações continuam pendentes.`,
                }
              : {
                  tom: "danger",
                  texto: `Não foi possível salvar: ${mensagemDoErro(erro)} As alterações continuam pendentes.`,
                },
        });
        return false;
      }
    });
  }

  /* `convite`: cancelar o convite de quem nunca entrou (a mesma desativação). */
  function desativarUsuario(
    usuario: Pick<UsuarioDaMatriz, "id" | "nome" | "email">,
    motivo: string,
    { convite = false }: { convite?: boolean } = {},
  ) {
    return executar(`desativar:${usuario.id}`, "Desativando…", async () => {
      try {
        await rpc(RPC_DESATIVAR_USUARIO, {
          p_perfil_usuario_id: usuario.id,
          p_motivo: motivo,
        });
        toast(
          convite
            ? `Convite de ${usuario.nome || usuario.email} cancelado.`
            : `Acesso de ${usuario.nome || usuario.email} desativado.`,
          "success",
        );
        publicar({ gaveta: null });
        // A conta sai de Ativos e entra em Desativadas.
        await Promise.all([carregarMatriz(), recarregarDesativadas()]);
        return true;
      } catch (erro) {
        toast(`Não foi possível desativar: ${mensagemDoErro(erro)}`, "error");
        return false;
      }
    });
  }

  // ── Contas desativadas (admin global) ─────────────────────────────────────

  async function carregarDesativadas({
    busca,
  }: { busca?: string } = {}): Promise<ContaDesativadaDosAcessos[] | null> {
    const alvo = busca ?? estado.buscaDasDesativadas;
    const geracao = estado.geracao;
    const meu = ++pedidoDasDesativadas;
    const antigo = () =>
      geracao !== estado.geracao || meu !== pedidoDasDesativadas;
    publicar({
      buscaDasDesativadas: alvo,
      statusDasDesativadas:
        estado.statusDasDesativadas === "ready" ? "ready" : "loading",
    });
    try {
      const resposta = await rpc(RPC_CONTAS_DESATIVADAS, { p_busca: alvo });
      if (antigo()) return null;
      // listar_contas_desativadas manda também grupo_nome e pedido_pendente.
      const contas = contasDaResposta(resposta) as ContaDesativadaDosAcessos[];
      publicar({ desativadas: contas, statusDasDesativadas: "ready" });
      return contas;
    } catch (erro) {
      if (antigo()) return null;
      console.error("Erro ao carregar as contas desativadas:", erro);
      publicar({ statusDasDesativadas: "error" });
      return null;
    }
  }

  /* Só recarrega se a aba já foi lida (quem não é admin global nunca a lê). */
  const recarregarDesativadas = () =>
    estado.statusDasDesativadas === "idle"
      ? Promise.resolve(null)
      : carregarDesativadas();

  /*
    Reativa com grupo, coordenação e áreas escolhidos. Devolve { ok } ou
    { ok: false, erro } com a mensagem para o modal mostrar ali mesmo (23514,
    42501 e 22023 vêm do banco já explicadas).
  */
  function reativar(
    conta: ContaDesativada,
    valores: ValoresDaReativacao,
    grupos: readonly GrupoDeAcesso[] = [],
  ): Promise<ResultadoDaAcao> {
    return executar(`reativar:${conta.id}`, "Reativando…", async () => {
      try {
        await rpc(
          RPC_REATIVAR_USUARIO,
          argumentosDaReativacao(conta, valores, grupos),
        );
        toast(mensagemDeContaReativada(conta), "success");
        await Promise.all([carregarMatriz(), carregarDesativadas()]);
        return { ok: true, erro: "" };
      } catch (erro) {
        const mensagem = mensagemDaRecusaDeReativacao(
          erro as ErroDoBanco | null,
        );
        toast(`Não foi possível reativar: ${mensagem}`, "error");
        return { ok: false, erro: mensagem };
      }
    }).then((resultado) => resultado || { ok: false, erro: "" });
  }

  function adicionarPessoa(
    { email, nome, grupo, coordenacao, areas }: NovaPessoa,
    motivo: string,
  ): Promise<ConvitePronto | false> {
    return executar("adicionar", "Adicionando…", async () => {
      try {
        const resposta = (await rpc(RPC_ADICIONAR_PESSOA, {
          p_email: email,
          p_nome: nome,
          p_grupo: grupo,
          p_coordenacao: coordenacao || null,
          p_areas: areas?.length ? areas : null,
          p_motivo: motivo,
        })) as { reativada?: boolean | null } | null;
        toast(
          resposta?.reativada
            ? `Acesso de ${nome} reativado.`
            : `${nome} tem acesso a partir de agora (entra com ${email}).`,
          "success",
        );
        // O modal continua aberto, no passo "Convite pronto".
        // Reativada: a conta também sai de Desativadas.
        await Promise.all([
          carregarMatriz(),
          resposta?.reativada ? recarregarDesativadas() : Promise.resolve(null),
        ]);
        return { nome, email, reativada: Boolean(resposta?.reativada) };
      } catch (erro) {
        toast(`Não foi possível adicionar: ${mensagemDoErro(erro)}`, "error");
        return false;
      }
    });
  }

  /*
    Desativa a conta e cria a coordenação com o nome dela. Nunca na própria
    conta (o banco também recusa); a confirmação escrita fica na gaveta.
  */
  function moverParaCoordenacoes(
    usuario: UsuarioDaMatriz,
    area: string,
    motivo: string,
  ) {
    const eu = estado.perfil
      ? { id: estado.perfil.user_id, email: estado.perfil.email }
      : null;
    if (isOwnAccessProfile(eu, usuario)) {
      toast("Você não pode transformar a sua própria conta.", "error");
      return Promise.resolve(false);
    }
    return executar(`mover:${usuario.id}`, "Movendo…", async () => {
      try {
        const coordenacao = (await rpc(RPC_MOVER_PARA_COORDENACOES, {
          p_perfil_usuario_id: usuario.id,
          p_area: area,
          p_motivo: motivo,
        })) as { nome?: string | null } | null;
        toast(
          `"${coordenacao?.nome || usuario.nome}" agora está em Coordenações; a conta foi desativada.`,
          "success",
        );
        publicar({ gaveta: null });
        // A conta desativada entra em Desativadas.
        await Promise.all([carregarMatriz(), recarregarDesativadas()]);
        return true;
      } catch (erro) {
        toast(`Não foi possível mover: ${mensagemDoErro(erro)}`, "error");
        return false;
      }
    });
  }

  // ── Solicitações ──────────────────────────────────────────────────────────

  async function carregarSolicitacoes(): Promise<void> {
    const geracao = estado.geracao;
    publicar({
      statusDasSolicitacoes:
        estado.statusDasSolicitacoes === "ready" ? "ready" : "loading",
    });
    try {
      const lista = await rpc(RPC_SOLICITACOES, { p_status: "pendente" });
      if (geracao !== estado.geracao) return;
      publicar({
        // A forma vem de listar_solicitacoes_acesso.
        solicitacoes: Array.isArray(lista) ? (lista as PedidoPendente[]) : [],
        statusDasSolicitacoes: "ready",
      });
    } catch (erro) {
      if (geracao !== estado.geracao) return;
      console.error("Erro ao carregar solicitações de acesso:", erro);
      publicar({ statusDasSolicitacoes: "error" });
    }
  }

  function aprovar(
    solicitacao: PedidoPendente,
    { grupo, coordenacao, areas, observacao }: EscolhaDaAprovacao,
  ) {
    return executar(`aprovar:${solicitacao.id}`, "Aprovando…", async () => {
      try {
        await rpc(RPC_APROVAR, {
          p_solicitacao_id: solicitacao.id,
          p_grupo: grupo,
          p_coordenacao: coordenacao || null,
          p_areas: areas?.length ? areas : null,
          p_observacao_admin: observacao || null,
        });
        toast(
          `Acesso de ${solicitacao.nome || solicitacao.email} aprovado.`,
          "success",
        );
        // Aprovar um pedido de reativação tira a conta de Desativadas.
        await Promise.all([
          carregarSolicitacoes(),
          carregarMatriz(),
          solicitacao.reativacao
            ? recarregarDesativadas()
            : Promise.resolve(null),
        ]);
        return true;
      } catch (erro) {
        toast(`Não foi possível aprovar: ${mensagemDoErro(erro)}`, "error");
        return false;
      }
    });
  }

  /**
   * Recusa com o motivo da lista (`argumentos` de validarRecusa, em
   * src/lib/solicitacao-de-acesso.ts). Devolve { ok, erro }.
   */
  function recusar(
    solicitacao: PedidoPendente,
    { p_motivo, p_complemento }: ArgumentosDaRecusa,
  ): Promise<ResultadoDaAcao> {
    return executar(`recusar:${solicitacao.id}`, "Recusando…", async () => {
      try {
        await rpc(RPC_RECUSAR, {
          p_solicitacao_id: solicitacao.id,
          p_motivo,
          p_complemento: p_complemento || null,
        });
        toast(
          `Solicitação de ${solicitacao.nome || solicitacao.email} recusada.`,
          "success",
        );
        await carregarSolicitacoes();
        return { ok: true, erro: "" };
      } catch (erro) {
        const mensagem = mensagemDoErro(erro);
        toast(`Não foi possível recusar: ${mensagem}`, "error");
        return { ok: false, erro: mensagem };
      }
    }).then((resultado) => resultado || { ok: false, erro: "" });
  }

  // ── Grupos e coordenações (admin global) ────────────────────────────────────

  function gravar(
    tipo: string,
    rotulo: string,
    nome: RpcDosAcessos,
    argumentos: Record<string, unknown>,
    sucesso: string,
  ) {
    return executar(tipo, rotulo, async () => {
      try {
        // salvar_grupo_acesso / salvar_coordenacao devolvem o código gravado.
        const resposta = (await rpc(
          nome,
          argumentos,
        )) as RespostaDaGravacao | null;
        toast(sucesso, "success");
        await carregarMatriz();
        return resposta || true;
      } catch (erro) {
        toast(
          ehConflitoDeVersao(erro)
            ? "Outra pessoa alterou este item. Recarregue a matriz."
            : `Não foi possível salvar: ${mensagemDoErro(erro)}`,
          "error",
        );
        return false;
      }
    });
  }

  const salvarGrupo = (grupo: GrupoParaSalvar, motivo: string) =>
    gravar(
      "grupo",
      "Salvando…",
      RPC_SALVAR_GRUPO,
      { p_grupo: grupo, p_motivo: motivo },
      `Grupo "${grupo.nome}" salvo.`,
    );
  const removerGrupo = (
    grupo: Pick<GrupoDeAcesso, "codigo" | "nome">,
    motivo: string,
  ) =>
    gravar(
      "remover-grupo",
      "Excluindo…",
      RPC_REMOVER_GRUPO,
      { p_codigo: grupo.codigo, p_motivo: motivo },
      `Grupo "${grupo.nome}" excluído.`,
    );
  const salvarCoordenacao = (
    coordenacao: CoordenacaoParaSalvar,
    motivo: string,
  ) =>
    gravar(
      "coordenacao",
      "Salvando…",
      RPC_SALVAR_COORDENACAO,
      { p_coordenacao: coordenacao, p_motivo: motivo },
      `Coordenação "${coordenacao.nome}" salva.`,
    );
  const desativarCoordenacao = (
    coordenacao: Pick<CoordenacaoDeAcesso, "codigo" | "nome">,
    motivo: string,
  ) =>
    gravar(
      "desativar-coordenacao",
      "Desativando…",
      RPC_DESATIVAR_COORDENACAO,
      { p_codigo: coordenacao.codigo, p_motivo: motivo },
      `Coordenação "${coordenacao.nome}" desativada.`,
    );

  function lerUnidadesPorArea(): Promise<UnidadeDaArea[]> {
    if (!unidadesPorArea)
      unidadesPorArea = rpc(RPC_UNIDADES_POR_AREA)
        // A forma vem de listar_unidades_por_area.
        .then((dados) =>
          Array.isArray(dados) ? (dados as UnidadeDaArea[]) : [],
        )
        .catch((erro: ErroDoBanco | null | undefined) => {
          console.warn(
            "Unidades por área indisponíveis:",
            erro?.message || erro,
          );
          unidadesPorArea = null;
          return [];
        });
    return unidadesPorArea;
  }

  const lerContextoDoUsuario = (id: string) =>
    rpc(RPC_CONTEXTO_DE_USUARIO, {
      p_perfil_usuario_id: id,
    }) as Promise<ContextoRecebido>;

  // ── Sessão ────────────────────────────────────────────────────────────────

  function reiniciarSessao() {
    unidadesPorArea = null;
    publicar({
      ...ESTADO_INICIAL,
      rascunho: new Map(),
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
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    obter: () => estado,
    toast,
    confirmar,
    /** Ao abrir a seção: relê o perfil e carrega o que ainda não veio. */
    garantirCarregado() {
      publicar({ perfil: getProfile() || null });
      const tarefas: Promise<unknown>[] = [];
      if (estado.status === "idle" || estado.status === "error")
        tarefas.push(carregarMatriz());
      // Desativadas: só o administrador global lê (o banco recusa os demais com 42501).
      if (
        isAdminGlobal(estado.perfil) &&
        (estado.statusDasDesativadas === "idle" ||
          estado.statusDasDesativadas === "error")
      )
        tarefas.push(carregarDesativadas());
      if (
        estado.statusDasSolicitacoes === "idle" ||
        estado.statusDasSolicitacoes === "error"
      )
        tarefas.push(carregarSolicitacoes());
      return Promise.all(tarefas);
    },
    carregarMatriz,
    registrar,
    descartar,
    descartarDaPessoa,
    salvar,
    desativarUsuario,
    adicionarPessoa,
    moverParaCoordenacoes,
    abrirAdicionar: () => publicar({ adicionando: Date.now() }),
    fecharAdicionar: () => estado.adicionando && publicar({ adicionando: 0 }),
    carregarSolicitacoes,
    carregarDesativadas,
    reativar,
    aprovar,
    recusar,
    salvarGrupo,
    removerGrupo,
    salvarCoordenacao,
    desativarCoordenacao,
    lerUnidadesPorArea,
    lerContextoDoUsuario,
    abrirGaveta(usuarioId: string) {
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
