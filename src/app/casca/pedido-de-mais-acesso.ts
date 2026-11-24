/*
  O estado do "Pedir mais acesso" na gaveta Meus acessos: o último pedido de
  mais acesso (obter_minha_solicitacao_acesso, que com perfil ativo devolve só
  esse), os grupos que se podem pedir (listar_opcoes_da_solicitacao_acesso),
  o envio (registrar_solicitacao_acesso com p_tipo) e o cancelamento
  (cancelar_minha_solicitacao_acesso). Sem React (`obter`/`assinar`); as
  regras são de src/lib/acessos/pedido-de-mais-acesso.ts e o desenho, de
  meus-acessos.tsx. A aprovação é de Configurações › Acessos › Pendentes.
*/
import {
  argumentosDoPedidoDeMaisAcesso,
  ehPedidoDeMaisAcesso,
  type CamposDoPedidoDeMaisAcesso,
  type GrupoParaPedir,
  type PedidoDeMaisAcesso,
} from "../../lib/acessos/pedido-de-mais-acesso.ts";
import { getSupabaseClient } from "../../lib/sessao/supabaseClient";
import { mensagemDoEnvio } from "../entrada/pedido-de-acesso.ts";

const RPC_MEU_PEDIDO = "obter_minha_solicitacao_acesso";
const RPC_OPCOES_DO_PEDIDO = "listar_opcoes_da_solicitacao_acesso";
const RPC_PEDIR = "registrar_solicitacao_acesso";
const RPC_CANCELAR_PEDIDO = "cancelar_minha_solicitacao_acesso";

type ErroDoBanco = { message?: string; code?: string } | null;
type ClienteDoPedido = {
  rpc: (
    nome: string,
    argumentos?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: ErroDoBanco }>;
};

export type EstadoDoPedidoDeMaisAcesso = Readonly<{
  status: "idle" | "carregando" | "pronto" | "erro";
  pedido: PedidoDeMaisAcesso | null;
  grupos: readonly GrupoParaPedir[];
  enviando: boolean;
  cancelando: boolean;
  /** Erro do envio ou do cancelamento, em texto para a pessoa. */
  erro: string;
}>;

const INICIAL: EstadoDoPedidoDeMaisAcesso = Object.freeze({
  status: "idle",
  pedido: null,
  grupos: Object.freeze([]),
  enviando: false,
  cancelando: false,
  erro: "",
});

export type PedidoDeMaisAcessoDoApp = ReturnType<
  typeof criarPedidoDeMaisAcesso
>;

export function criarPedidoDeMaisAcesso({
  cliente = getSupabaseClient as () => ClienteDoPedido | null,
}: { cliente?: () => ClienteDoPedido | null } = {}) {
  let estado = INICIAL;
  const ouvintes = new Set<() => void>();
  const definir = (parcial: Partial<EstadoDoPedidoDeMaisAcesso>) => {
    estado = Object.freeze({ ...estado, ...parcial });
    ouvintes.forEach((ouvinte) => ouvinte());
  };

  async function lerPedido(sb: ClienteDoPedido) {
    const { data, error } = await sb.rpc(RPC_MEU_PEDIDO);
    if (error) throw error;
    const pedido = data as PedidoDeMaisAcesso | null;
    return ehPedidoDeMaisAcesso(pedido) ? pedido : null;
  }

  /** Lê o último pedido e os grupos (ao abrir a gaveta). */
  async function carregar() {
    const sb = cliente();
    if (!sb) return definir({ status: "erro" });
    definir({ status: "carregando", erro: "" });
    try {
      const [pedido, opcoes] = await Promise.all([
        lerPedido(sb),
        sb.rpc(RPC_OPCOES_DO_PEDIDO),
      ]);
      const grupos = opcoes.error
        ? []
        : ((opcoes.data as { grupos?: GrupoParaPedir[] } | null)?.grupos ?? []);
      definir({ status: "pronto", pedido, grupos: Object.freeze([...grupos]) });
    } catch (erro) {
      console.warn("Não foi possível ler o pedido de mais acesso:", erro);
      definir({ status: "erro" });
    }
  }

  /** Envia o pedido (já validado pela tela). Devolve se deu certo. */
  async function enviar(campos: CamposDoPedidoDeMaisAcesso) {
    const sb = cliente();
    if (!sb || estado.enviando) return false;
    definir({ enviando: true, erro: "" });
    try {
      const { error } = await sb.rpc(
        RPC_PEDIR,
        argumentosDoPedidoDeMaisAcesso(campos),
      );
      if (error) throw error;
      definir({ pedido: await lerPedido(sb) });
      return true;
    } catch (erro) {
      definir({
        erro: `Não foi possível enviar o pedido: ${mensagemDoEnvio(erro)}`,
      });
      return false;
    } finally {
      definir({ enviando: false });
    }
  }

  /** Cancela o pedido pendente. */
  async function cancelar() {
    const sb = cliente();
    if (!sb || estado.cancelando) return false;
    definir({ cancelando: true, erro: "" });
    try {
      const { error } = await sb.rpc(RPC_CANCELAR_PEDIDO);
      if (error) throw error;
      definir({ pedido: await lerPedido(sb) });
      return true;
    } catch (erro) {
      definir({
        erro: `Não foi possível cancelar o pedido: ${mensagemDoEnvio(erro)}`,
      });
      return false;
    } finally {
      definir({ cancelando: false });
    }
  }

  return {
    obter: () => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    enviar,
    cancelar,
  };
}
