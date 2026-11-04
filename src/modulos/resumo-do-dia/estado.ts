import type { ItemDoResumo, ResumoDoDia } from "../../lib/resumo-do-dia.ts";
import {
  chaveDoVisto,
  lerResumoDoDia,
  semDemanda,
  totalDoResumo,
} from "../../lib/resumo-do-dia.ts";
import { getSupabaseClient } from "../../lib/supabaseClient";

/*
  Estado do resumo do dia (fora do React): o resumo da pessoa logada, se o
  popup está aberto e as ações dele. Uma chamada ao entrar (`verificar` com
  `aoEntrar`, de src/app/sistema.ts) e outra a cada clique no sininho; sem
  polling.

  Abre sozinho só ao entrar, e só se: a pessoa é responsável por algo, há o
  que mostrar, a preferência "Mostrar ao entrar" está ligada, ainda não foi
  fechado hoje neste navegador (localStorage, por pessoa e dia) e a tela está
  livre — nenhum modal aberto nem campo em digitação. Se a tela não está
  livre, não abre: fica o sininho.
*/

type Resposta = PromiseLike<{ data: unknown; error: unknown }>;
export type ClienteDoResumo = {
  rpc: {
    (nome: "obter_meu_resumo_do_dia"): Resposta;
    (
      nome: "salvar_minha_preferencia_do_resumo",
      argumentos: { p_mostrar: boolean },
    ): Resposta;
    (
      nome: "concluir_demanda_interna",
      argumentos: { p_id: string; p_concluida: boolean },
    ): Resposta;
  };
};

export type SnapshotDoResumo = Readonly<{
  resumo: ResumoDoDia | null;
  aberto: boolean;
  erro: string;
}>;

/** O Cronograma relê as demandas quando uma é concluída aqui. */
const EVENTO_CRONOGRAMA_SALVO = "agsus:nucleo-cronograma-saved";

const VAZIO: SnapshotDoResumo = Object.freeze({
  resumo: null,
  aberto: false,
  erro: "",
});

/** Nenhum modal aberto e nenhum campo em digitação. */
export function telaLivre(
  documento: Document | undefined = globalThis.document,
) {
  if (!documento) return false;
  if (documento.querySelector('.modal.show, [aria-modal="true"]')) return false;
  const ativo = documento.activeElement as HTMLElement | null;
  if (!ativo) return true;
  return !(
    ["INPUT", "TEXTAREA", "SELECT"].includes(ativo.tagName) ||
    ativo.isContentEditable
  );
}

function mensagem(erro: unknown, reserva: string) {
  const texto =
    erro && typeof erro === "object"
      ? (erro as { message?: unknown }).message
      : null;
  return typeof texto === "string" && texto ? texto : reserva;
}

export function criarEstadoDoResumoDoDia({
  cliente = () => getSupabaseClient() as unknown as ClienteDoResumo | null,
  armazenamento = () => globalThis.localStorage,
  podeAbrirSozinho = () => telaLivre(),
  documento = () => globalThis.document,
}: {
  cliente?: () => ClienteDoResumo | null;
  armazenamento?: () => Storage | null | undefined;
  podeAbrirSozinho?: () => boolean;
  documento?: () => Document | undefined;
} = {}) {
  let estado: SnapshotDoResumo = VAZIO;
  let geracao = 0;
  const ouvintes = new Set<() => void>();

  const mudar = (parte: Partial<SnapshotDoResumo>) => {
    estado = { ...estado, ...parte };
    ouvintes.forEach((ouvinte) => ouvinte());
  };

  function vistoHoje(resumo: ResumoDoDia) {
    try {
      return Boolean(
        armazenamento()?.getItem(chaveDoVisto(resumo.perfil, resumo.data)),
      );
    } catch {
      return false;
    }
  }

  function marcarVisto(resumo: ResumoDoDia) {
    try {
      armazenamento()?.setItem(chaveDoVisto(resumo.perfil, resumo.data), "1");
    } catch {
      // Sem localStorage: pode voltar a abrir na próxima entrada de hoje.
    }
  }

  async function verificar({ aoEntrar = false } = {}) {
    const minha = ++geracao;
    try {
      const supabase = cliente();
      if (!supabase?.rpc) return estado.resumo;
      const { data, error } = await supabase.rpc("obter_meu_resumo_do_dia");
      if (minha !== geracao || error) return estado.resumo;
      const resumo = lerResumoDoDia(data);
      const abrir =
        aoEntrar &&
        !!resumo &&
        resumo.responsavel &&
        resumo.mostrarAoEntrar &&
        totalDoResumo(resumo) > 0 &&
        !vistoHoje(resumo) &&
        podeAbrirSozinho();
      mudar({ resumo, aberto: estado.aberto || abrir });
    } catch {
      // O resumo nunca atrapalha a entrada (banco sem a RPC: sem sininho).
    }
    return estado.resumo;
  }

  return {
    obter: () => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    verificar,
    /** O sininho: abre já com o que tem e relê. */
    abrir() {
      mudar({ aberto: true, erro: "" });
      void verificar();
    },
    /** Fechar: não volta sozinho no mesmo dia. */
    fechar() {
      if (estado.resumo) marcarVisto(estado.resumo);
      mudar({ aberto: false, erro: "" });
    },
    async concluir(item: ItemDoResumo) {
      const supabase = cliente();
      if (!supabase?.rpc || item.tipo !== "demanda") return;
      try {
        const { error } = await supabase.rpc("concluir_demanda_interna", {
          p_id: item.id,
          p_concluida: true,
        });
        if (error) throw error;
        if (estado.resumo)
          mudar({ resumo: semDemanda(estado.resumo, item.id), erro: "" });
        const doc = documento();
        const Evento = doc?.defaultView?.CustomEvent || globalThis.CustomEvent;
        doc?.dispatchEvent(new Evento(EVENTO_CRONOGRAMA_SALVO));
      } catch (erro) {
        mudar({ erro: mensagem(erro, "Não foi possível concluir.") });
      }
    },
    async mudarPreferencia(mostrar: boolean) {
      const supabase = cliente();
      if (!supabase?.rpc || !estado.resumo) return;
      const anterior = estado.resumo;
      mudar({ resumo: { ...anterior, mostrarAoEntrar: mostrar }, erro: "" });
      try {
        const { error } = await supabase.rpc(
          "salvar_minha_preferencia_do_resumo",
          { p_mostrar: mostrar },
        );
        if (error) throw error;
      } catch (erro) {
        mudar({
          resumo: { ...anterior },
          erro: mensagem(erro, "Não foi possível salvar a preferência."),
        });
      }
    },
    /** Saiu da sessão: nada desta pessoa fica. */
    esquecer() {
      geracao += 1;
      mudar(VAZIO);
    },
  };
}

export type EstadoDoResumoDoDia = ReturnType<typeof criarEstadoDoResumoDoDia>;

/** O do app (src/app/sistema.ts verifica ao entrar e esquece ao sair). */
export const resumoDoDia = criarEstadoDoResumoDoDia();
