/*
  Estado de Configurações › Automação, fora do React: as chaves lidas
  (`obter_chaves_da_automacao`), a mudança em curso e o aviso da última
  recusa. Ligar e desligar é uma chave por vez, com motivo
  (`alterar_chave_da_automacao`); o banco devolve a lista nova. Este arquivo
  não importa React; as regras ficam em src/lib/chaves-da-automacao.ts.
*/
import { isAdminGlobal } from "../../lib/access-roles.ts";
import {
  mensagemDaRecusa,
  motivoValido,
  normalizarChaves,
  type ChavesDaAutomacao,
} from "../../lib/chaves-da-automacao.ts";
import { comTempoLimite, mensagemDeFalha } from "../../lib/falha-de-rede";

export const RPC_OBTER_CHAVES = "obter_chaves_da_automacao";
export const RPC_ALTERAR_CHAVE = "alterar_chave_da_automacao";
const TEMPO_LIMITE_MS = 30000;

type Resposta = {
  data: unknown;
  error: { message?: string; code?: string } | null;
};
export interface ClienteDaAutomacao {
  rpc(nome: "obter_chaves_da_automacao"): PromiseLike<Resposta>;
  rpc(
    nome: "alterar_chave_da_automacao",
    parametros: { p_chave: string; p_ligar: boolean; p_motivo: string },
  ): PromiseLike<Resposta>;
}
export interface SnapshotDaAutomacao {
  readonly perfil: Record<string, unknown> | null;
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly dados: ChavesDaAutomacao | null;
  readonly erro: string;
  readonly erroCodigo: string;
  /** A chave sendo mudada agora (uma por vez). */
  readonly mudando: string | null;
  readonly aviso: { tom: "danger" | "success"; texto: string } | null;
}
export interface DependenciasDaAutomacao {
  supabase?: ClienteDaAutomacao | null;
  getProfile?: () => Record<string, unknown> | null;
  toast?: (mensagem: string) => void;
}
export interface EstadoDaAutomacao {
  obter(): SnapshotDaAutomacao;
  assinar(ouvinte: () => void): () => void;
  carregar(): Promise<void>;
  alterar(chave: string, ligar: boolean, motivo: string): Promise<boolean>;
}

const INICIAL: SnapshotDaAutomacao = Object.freeze({
  perfil: null,
  status: "idle",
  dados: null,
  erro: "",
  erroCodigo: "",
  mudando: null,
  aviso: null,
});

export function criarEstadoDaAutomacao({
  supabase = null,
  getProfile = () => null,
  toast = () => {},
}: DependenciasDaAutomacao = {}): EstadoDaAutomacao {
  let estado = INICIAL;
  let pedido = 0;
  const ouvintes = new Set<() => void>();
  const publicar = (mudancas: Partial<SnapshotDaAutomacao>) => {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  };

  async function carregar() {
    const meu = ++pedido;
    const perfil = getProfile?.() || null;
    publicar({ perfil, status: estado.dados ? "ready" : "loading" });
    if (perfil && !isAdminGlobal(perfil)) return;
    if (!supabase) {
      publicar({
        status: "error",
        erro: "Sem conexão com o banco.",
        erroCodigo: "",
      });
      return;
    }
    try {
      const { data, error } = await comTempoLimite(
        supabase.rpc(RPC_OBTER_CHAVES),
        TEMPO_LIMITE_MS,
      );
      if (meu !== pedido) return;
      if (error) {
        publicar({
          status: "error",
          erro: mensagemDaRecusa(error),
          erroCodigo: error.code || "",
        });
        return;
      }
      publicar({
        status: "ready",
        dados: normalizarChaves(data),
        erro: "",
        erroCodigo: "",
      });
    } catch (falha) {
      if (meu !== pedido) return;
      publicar({
        status: "error",
        erro: mensagemDeFalha(falha),
        erroCodigo: "",
      });
    }
  }

  async function alterar(chave: string, ligar: boolean, motivo: string) {
    if (estado.mudando || !supabase || !motivoValido(motivo)) return false;
    publicar({ mudando: chave, aviso: null });
    try {
      const { data, error } = await comTempoLimite(
        supabase.rpc(RPC_ALTERAR_CHAVE, {
          p_chave: chave,
          p_ligar: ligar,
          p_motivo: motivo.trim(),
        }),
        TEMPO_LIMITE_MS,
      );
      if (error) {
        publicar({
          mudando: null,
          aviso: { tom: "danger", texto: mensagemDaRecusa(error) },
        });
        if (error.code === "55000") void carregar();
        return false;
      }
      ++pedido;
      const dados = normalizarChaves(data);
      const nome = dados.chaves.find((c) => c.chave === chave)?.nome || chave;
      const texto = `${nome}: automação ${ligar ? "ligada" : "desligada"}.`;
      publicar({
        mudando: null,
        status: "ready",
        dados,
        aviso: { tom: "success", texto },
      });
      toast(texto);
      return true;
    } catch (falha) {
      publicar({
        mudando: null,
        aviso: { tom: "danger", texto: mensagemDeFalha(falha) },
      });
      return false;
    }
  }

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    alterar,
  };
}
