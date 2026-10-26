/*
  O pedido de acesso — o estado da página de quem entrou com Google e não
  tem perfil ativo: situação do pedido, opções da área (unidades e
  coordenações), formulário, validação, envio, edição e cancelamento, tudo
  por RPC. Estado sem React (`obter`/`assinar`); o desenho é de
  solicitacao-de-acesso.tsx e as regras e listas, de
  src/lib/solicitacao-de-acesso.ts. A análise dos pedidos é de
  Configurações › Acessos (src/modulos/acessos/).

  O sistema não concede acesso automático: sem perfil ativo, a pessoa pede, e
  quem gerencia acessos aprova (ou ela foi convidada e entra com o e-mail
  convidado). Não há aviso por e-mail: a situação aparece aqui quando ela
  entra de novo.
*/

import {
  contaMarcadaComoDesativada,
  lembrarContaDesativada,
  marcarBoasVindasPendentes,
} from "../../lib/acesso-liberado.ts";
import { mensagemDeFalha } from "../../lib/falha-de-rede";
import { normalizePlatformContext } from "../../lib/platform-context";
import {
  AREAS_DA_SOLICITACAO,
  CAMPOS_VAZIOS,
  argumentosDaSolicitacao,
  camposDoPedido,
  camposNaArea,
  telaDaSolicitacao,
  validarSolicitacao,
  type CamposDaSolicitacao,
  type CodigoDaArea,
  type ErrosDaSolicitacao,
  type MinhaSolicitacao,
  type TelaDaSolicitacao,
} from "../../lib/solicitacao-de-acesso.ts";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { nomeDoUsuario } from "../sessao.js";

const RPC_OPCOES = "listar_opcoes_da_solicitacao_acesso";
const RPC_MINHA_SOLICITACAO = "obter_minha_solicitacao_acesso";
const RPC_REGISTRAR_SOLICITACAO = "registrar_solicitacao_acesso";
const RPC_CANCELAR_SOLICITACAO = "cancelar_minha_solicitacao_acesso";
const RPC_CONTEXTO = "obter_contexto_monitora";
const RPC_MINHA_CONTA_DESATIVADA = "minha_conta_desativada";

export const TITULO_VERIFICANDO = "Verificando seu acesso…";
export const AVISO_SEM_CONSULTA =
  "Não foi possível consultar seu pedido anterior. Você pode enviar um pedido agora.";
export const AVISO_CANCELADO = "Pedido cancelado.";

type ErroDoBanco = { message?: string; code?: string } | null;
type RespostaDoBanco<T = unknown> = { data: T | null; error: ErroDoBanco };
type ClienteSupabase = {
  rpc: (
    nome: string,
    argumentos?: Record<string, unknown>,
  ) => PromiseLike<RespostaDoBanco>;
};

export type Unidade = {
  area: string;
  nome: string;
  sigla?: string | null;
  tipo?: string | null;
};
export type CoordenacaoDaArea = { codigo: string; nome: string; area: string };

export type OpcoesDoPedido = {
  status: "idle" | "carregando" | "pronto" | "erro";
  unidades: Unidade[];
  coordenacoes: CoordenacaoDaArea[];
};

type JanelaDoPedido = (Window & typeof globalThis) | undefined;

export type Aviso = { tom: "info" | "warn" | "danger"; texto: string };

export type EstadoDoPedido = {
  usuarioId: string;
  email: string;
  /** O nome que veio do Google (preenche o campo, editável). */
  nomeDoGoogle: string;
  carregando: boolean;
  solicitacao: MinhaSolicitacao | null;
  tela: TelaDaSolicitacao;
  /** Pedido pendente aberto para edição (o resumo vira formulário). */
  editando: boolean;
  /** "Pedir reativação" aberto (conta desativada). */
  modoReativacao: boolean;
  aviso: Aviso | null;
  campos: CamposDaSolicitacao;
  erros: ErrosDaSolicitacao;
  enviando: boolean;
  cancelando: boolean;
  opcoes: OpcoesDoPedido;
  /** Muda para levar o foco ao primeiro campo (abrir edição ou reativação). */
  focoNoFormulario: number;
};

const OPCOES_VAZIAS: OpcoesDoPedido = Object.freeze({
  status: "idle",
  unidades: [],
  coordenacoes: [],
}) as OpcoesDoPedido;

const INICIAL: EstadoDoPedido = Object.freeze({
  usuarioId: "",
  email: "",
  nomeDoGoogle: "",
  carregando: false,
  solicitacao: null,
  tela: telaDaSolicitacao({}),
  editando: false,
  modoReativacao: false,
  aviso: null,
  campos: { ...CAMPOS_VAZIOS },
  erros: {},
  enviando: false,
  cancelando: false,
  opcoes: OPCOES_VAZIAS,
  focoNoFormulario: 0,
}) as EstadoDoPedido;

/** Erro do banco no envio, em texto para a pessoa. */
export function mensagemDoEnvio(erro: ErroDoBanco | Error | unknown): string {
  const texto = String((erro as { message?: string })?.message || "");
  if (
    texto.includes("permission denied") ||
    texto.includes("violates row-level security")
  )
    return "Permissão insuficiente para esta ação. Verifique o perfil do usuário e as políticas RLS.";
  // 22023: a validação do banco (mesmas regras da tela) já vem em português.
  if ((erro as { code?: string })?.code === "22023" && texto) return texto;
  return mensagemDeFalha(erro);
}

/** As unidades da lista de uma área (nomes), na ordem: DSEI antes de CASAI. */
export function lotacoesDaArea(
  opcoes: OpcoesDoPedido,
  area: CodigoDaArea,
): Unidade[] {
  const ordem = (u: Unidade) => (u.tipo === "CASAI" ? 1 : 0);
  return opcoes.unidades
    .filter((u) => u.area === area)
    .sort(
      (a, b) => ordem(a) - ordem(b) || a.nome.localeCompare(b.nome, "pt-BR"),
    );
}

export function coordenacoesDaArea(
  opcoes: OpcoesDoPedido,
  area: CodigoDaArea,
): CoordenacaoDaArea[] {
  return opcoes.coordenacoes.filter((c) => c.area === area);
}

export type VisaoDoPedido = {
  verificando: boolean;
  titulo: string;
  /** A faixa de situação (tela do banco) ou um aviso (falha, cancelado). */
  faixa: {
    tom: string;
    titulo: string;
    texto: string;
    triste: boolean;
    oferecerReativacao: boolean;
    entrar: boolean;
  } | null;
  aviso: Aviso | null;
  conteudo: "formulario" | "resumo" | "oculto";
  /** Formulário de reativação: sem abas, só nome e justificativa. */
  reativacao: boolean;
  /** As abas por área aparecem. */
  abas: boolean;
  rotuloDoBotao: string;
  /** "Voltar" (desistir da edição do pedido pendente). */
  podeVoltar: boolean;
  /** Editar e Cancelar no resumo. */
  podeEditar: boolean;
};

/** O que a página mostra, derivado do estado (sem DOM). */
export function visaoDoPedido(estado: EstadoDoPedido): VisaoDoPedido {
  if (estado.carregando)
    return {
      verificando: true,
      titulo: TITULO_VERIFICANDO,
      faixa: null,
      aviso: null,
      conteudo: "oculto",
      reativacao: false,
      abas: false,
      rotuloDoBotao: "Enviar pedido",
      podeVoltar: false,
      podeEditar: false,
    };
  const { tela } = estado;
  const reativacao = estado.modoReativacao || tela.reativacao;
  const desativada = tela.triste || reativacao;
  let conteudo = tela.conteudo;
  if (estado.modoReativacao || (estado.editando && conteudo === "resumo"))
    conteudo = "formulario";
  const editandoPendente = estado.editando && tela.conteudo === "resumo";
  return {
    verificando: false,
    titulo: desativada ? "Acesso desativado" : "Solicitação de acesso",
    faixa:
      tela.texto && !editandoPendente
        ? {
            tom: tela.tom,
            titulo: tela.titulo,
            texto: tela.texto,
            triste: tela.triste,
            oferecerReativacao:
              tela.oferecerReativacao && !estado.modoReativacao,
            entrar: tela.entrar,
          }
        : null,
    aviso: estado.aviso,
    conteudo,
    reativacao,
    abas: conteudo === "formulario" && !reativacao,
    rotuloDoBotao: editandoPendente
      ? "Salvar alterações"
      : reativacao
        ? "Pedir reativação"
        : tela.situacao === "recusado"
          ? "Enviar novo pedido"
          : "Enviar pedido",
    podeVoltar: editandoPendente || estado.modoReativacao,
    podeEditar: tela.conteudo === "resumo" && !estado.editando,
  };
}

/** Cria o estado do pedido. `cliente` devolve o cliente Supabase único. */
export function criarPedidoDeAcesso({
  cliente = getSupabaseClient as () => ClienteSupabase | null,
  janela = globalThis.window as JanelaDoPedido,
}: {
  cliente?: () => ClienteSupabase | null;
  janela?: JanelaDoPedido;
} = {}) {
  let estado: EstadoDoPedido = INICIAL;
  const ouvintes = new Set<() => void>();
  let versao = 0;

  function definir(parcial: Partial<EstadoDoPedido>) {
    estado = { ...estado, ...parcial };
    ouvintes.forEach((ouvinte) => ouvinte());
  }

  async function carregarOpcoes(sb: ClienteSupabase) {
    if (
      estado.opcoes.status === "pronto" ||
      estado.opcoes.status === "carregando"
    )
      return;
    definir({ opcoes: { ...estado.opcoes, status: "carregando" } });
    try {
      const { data, error } = await sb.rpc(RPC_OPCOES);
      const dados = data as {
        unidades?: Unidade[];
        coordenacoes?: CoordenacaoDaArea[];
      } | null;
      if (error || !dados) throw error || new Error("sem opções");
      definir({
        opcoes: {
          status: "pronto",
          unidades: Array.isArray(dados.unidades) ? dados.unidades : [],
          coordenacoes: Array.isArray(dados.coordenacoes)
            ? dados.coordenacoes
            : [],
        },
      });
    } catch (erro) {
      console.warn("Não foi possível carregar as opções do pedido:", erro);
      definir({ opcoes: { ...estado.opcoes, status: "erro" } });
    }
  }

  /*
    Desenha a situação. O formulário (sem pedido, recusado, cancelado) vem
    com o que a pessoa pediu da última vez; conta desativada deixa a marca
    por usuário (na volta, "Bem-vindo(a) de volta").
  */
  function desenhar(
    tela: TelaDaSolicitacao,
    solicitacao: MinhaSolicitacao | null,
    aviso: Aviso | null = null,
  ) {
    definir({
      tela,
      solicitacao,
      aviso,
      editando: false,
      modoReativacao: false,
      erros: {},
      campos: solicitacao
        ? camposDoPedido(solicitacao, estado.nomeDoGoogle)
        : { ...estado.campos, nome: estado.campos.nome || estado.nomeDoGoogle },
    });
    if (tela.triste) lembrarContaDesativada(estado.usuarioId, janela);
  }

  async function lerEDesenhar(
    sb: ClienteSupabase,
    minhaVersao: number,
    aviso: Aviso | null,
  ) {
    void carregarOpcoes(sb);
    const [{ data, error }, contaDesativada] = await Promise.all([
      sb.rpc(RPC_MINHA_SOLICITACAO),
      Promise.resolve()
        .then(() => sb.rpc(RPC_MINHA_CONTA_DESATIVADA))
        .then((r) => !r?.error && r?.data === true)
        .catch(() => false),
    ]);
    if (minhaVersao !== versao) return null;
    if (error) {
      const tela = telaDaSolicitacao({ contaDesativada });
      desenhar(
        tela,
        null,
        contaDesativada ? null : { tom: "warn", texto: AVISO_SEM_CONSULTA },
      );
      return null;
    }
    const solicitacao = (data as MinhaSolicitacao | null) || null;
    let perfilAtivo = false;
    if (!contaDesativada && solicitacao?.status === "aprovado") {
      const contexto = await sb.rpc(RPC_CONTEXTO);
      perfilAtivo =
        !contexto.error && Boolean(normalizePlatformContext(contexto.data));
    }
    if (minhaVersao !== versao) return null;
    /*
      O banco só diz "desativada" quando a conta existe; a marca de quando a
      tela de desativada foi mostrada segura a situação depois do pedido de
      reativação (senão viraria um "Pedido enviado" comum).
    */
    const desativada =
      contaDesativada ||
      (!perfilAtivo && contaMarcadaComoDesativada(estado.usuarioId, janela));
    desenhar(
      telaDaSolicitacao({
        solicitacao,
        contaDesativada: desativada,
        perfilAtivo,
      }),
      solicitacao,
      aviso,
    );
    return solicitacao;
  }

  /**
   * Abre a página para `usuario`. Até saber a situação, ela fica em
   * "Verificando seu acesso…" (sem formulário); `consultar: false` mostra o
   * formulário direto (a carga do login falhou e não há o que consultar).
   */
  async function carregar({
    usuario,
    consultar = true,
    carregando = true,
    aviso = null,
  }: {
    usuario?: { id?: string; email?: string } | null;
    consultar?: boolean;
    carregando?: boolean;
    aviso?: Aviso | null;
  } = {}) {
    const minhaVersao = ++versao;
    const usuarioId = usuario?.id || estado.usuarioId;
    const trocou = usuarioId !== estado.usuarioId;
    const nomeDoGoogle = usuario ? nomeDoUsuario(usuario) : estado.nomeDoGoogle;
    const campos = trocou ? { ...CAMPOS_VAZIOS } : estado.campos;
    definir({
      usuarioId,
      email: usuario?.email || estado.email,
      nomeDoGoogle,
      campos: { ...campos, nome: campos.nome || nomeDoGoogle },
      ...(trocou
        ? { erros: {}, aviso: null, solicitacao: null, editando: false }
        : {}),
      enviando: false,
      cancelando: false,
    });
    const sb = cliente();
    if (!consultar || !sb) {
      if (sb) void carregarOpcoes(sb);
      definir({
        carregando: false,
        modoReativacao: false,
        tela: telaDaSolicitacao({}),
      });
      return null;
    }
    if (carregando) definir({ carregando: true });
    try {
      return await lerEDesenhar(sb, minhaVersao, aviso);
    } catch (erro) {
      console.warn("Não foi possível consultar o pedido de acesso:", erro);
      if (minhaVersao === versao)
        desenhar(telaDaSolicitacao({}), null, {
          tom: "warn",
          texto: AVISO_SEM_CONSULTA,
        });
      return null;
    } finally {
      if (minhaVersao === versao) definir({ carregando: false });
    }
  }

  function atualizarCampo<K extends keyof CamposDaSolicitacao>(
    chave: K,
    valor: CamposDaSolicitacao[K],
  ) {
    const erros = { ...estado.erros };
    delete erros[chave];
    definir({ campos: { ...estado.campos, [chave]: valor }, erros });
  }

  function escolherArea(area: CodigoDaArea) {
    if (!AREAS_DA_SOLICITACAO.some((a) => a.codigo === area)) return;
    const { justificativa, nome } = estado.erros;
    definir({
      campos: camposNaArea(estado.campos, area),
      erros: {
        ...(nome ? { nome } : {}),
        ...(justificativa ? { justificativa } : {}),
      },
    });
  }

  /** "Editar pedido": o resumo vira formulário, com o que foi pedido. */
  function editar() {
    if (estado.tela.conteudo !== "resumo") return;
    definir({
      editando: true,
      aviso: null,
      erros: {},
      campos: camposDoPedido(estado.solicitacao, estado.nomeDoGoogle),
      focoNoFormulario: estado.focoNoFormulario + 1,
    });
  }

  /** "Voltar": desiste da edição (ou da reativação) sem gravar. */
  function voltar() {
    definir({
      editando: false,
      modoReativacao: false,
      erros: {},
      campos: estado.solicitacao
        ? camposDoPedido(estado.solicitacao, estado.nomeDoGoogle)
        : estado.campos,
    });
  }

  /** "Pedir reativação": só nome e justificativa, nome já preenchido. */
  function abrirReativacao() {
    if (!estado.tela.oferecerReativacao) return;
    definir({
      modoReativacao: true,
      erros: {},
      aviso: null,
      focoNoFormulario: estado.focoNoFormulario + 1,
    });
  }

  function recarregarOpcoes() {
    const sb = cliente();
    if (!sb) return;
    definir({ opcoes: { ...estado.opcoes, status: "idle" } });
    void carregarOpcoes(sb);
  }

  const emReativacao = () =>
    estado.modoReativacao || estado.tela.reativacao === true;

  /**
   * Valida e envia (novo pedido ou edição do pendente — o banco decide).
   * Com erro de campo, nada vai ao banco. Devolve { ok, erros }.
   */
  async function enviar() {
    const sb = cliente();
    if (!sb || estado.enviando) return { ok: false, erros: {} };
    const reativacao = emReativacao();
    const lotacoes =
      estado.opcoes.status === "pronto"
        ? lotacoesDaArea(estado.opcoes, estado.campos.area).map((u) => u.nome)
        : undefined;
    const erros = validarSolicitacao(estado.campos, { reativacao, lotacoes });
    definir({ erros });
    if (Object.keys(erros).length) return { ok: false, erros };
    definir({ enviando: true, aviso: null });
    // try/finally: a rede que cai (a promessa rejeita) não deixa o botão preso em "Enviando".
    try {
      const { error } = await sb.rpc(
        RPC_REGISTRAR_SOLICITACAO,
        argumentosDaSolicitacao(estado.campos, { reativacao }),
      );
      if (error) throw error;
      await carregar({ carregando: false });
      return { ok: true, erros: {} };
    } catch (erro) {
      definir({
        aviso: {
          tom: "danger",
          texto: "Não foi possível enviar o pedido: " + mensagemDoEnvio(erro),
        },
      });
      return { ok: false, erros: {} };
    } finally {
      definir({ enviando: false });
    }
  }

  /** "Cancelar pedido" (já confirmado na tela). */
  async function cancelar() {
    const sb = cliente();
    if (!sb || estado.cancelando) return false;
    definir({ cancelando: true, aviso: null });
    try {
      const { error } = await sb.rpc(RPC_CANCELAR_SOLICITACAO);
      if (error) throw error;
      await carregar({
        carregando: false,
        aviso: { tom: "info", texto: AVISO_CANCELADO },
      });
      return true;
    } catch (erro) {
      definir({
        aviso: {
          tom: "danger",
          texto: "Não foi possível cancelar o pedido: " + mensagemDoEnvio(erro),
        },
      });
      return false;
    } finally {
      definir({ cancelando: false });
    }
  }

  /** "Entrar agora" (pedido liberado): marca as boas-vindas e recarrega. */
  function entrarAgora() {
    marcarBoasVindasPendentes(janela);
    janela?.location?.reload();
  }

  /** A pessoa saiu: a página volta ao início (nada da conta anterior fica). */
  function limpar() {
    versao += 1;
    definir({
      ...INICIAL,
      campos: { ...CAMPOS_VAZIOS },
      opcoes: estado.opcoes,
    });
  }

  return {
    obter: () => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    carregar,
    atualizarCampo,
    escolherArea,
    editar,
    voltar,
    abrirReativacao,
    recarregarOpcoes,
    enviar,
    cancelar,
    entrarAgora,
    limpar,
  };
}

export type PedidoDeAcesso = ReturnType<typeof criarPedidoDeAcesso>;
