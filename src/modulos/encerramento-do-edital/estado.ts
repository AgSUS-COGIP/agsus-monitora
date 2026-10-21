/*
  Estado do encerramento do edital (sem React): os encerramentos da pessoa,
  a tela aberta e os editais cujos fogos esta página já soltou. Lido com
  useSyncExternalStore pela tela e pelos selos.

  - `verificar()`: lê obter_encerramentos_do_edital (ao abrir o sistema e
    quando os marcos de Análises avisam que um edital zerou). Função ausente
    (migration não aplicada) ou erro: nada a mostrar, sem aviso.
  - A tela só abre com as comemorações ligadas no sistema; desligadas, nada
    é marcado e a tela aparece quando religarem.
  - `fechar()`: grava o visto no banco e abre o próximo, se houver.
*/
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import {
  editaisDoEvento,
  encerramentoAMostrar,
  EVENTO_EDITAL_CONCLUIDO,
  lerEncerramentos,
  RPC_DO_VISTO,
  RPC_DOS_ENCERRAMENTOS,
  type EncerramentoDoEdital,
} from "../../lib/encerramento-do-edital.ts";

type RespostaDaRpc = { data?: unknown; error?: unknown };
export interface ClienteDoEncerramento {
  rpc: (
    nome: string,
    argumentos?: Record<string, unknown>,
  ) => PromiseLike<RespostaDaRpc>;
}

export interface EstadoDoEncerramento {
  encerramentos: readonly EncerramentoDoEdital[];
  aberto: EncerramentoDoEdital | null;
  fogosJaSoltos: ReadonlySet<string>;
}

const VAZIO: EstadoDoEncerramento = Object.freeze({
  encerramentos: Object.freeze([]),
  aberto: null,
  fogosJaSoltos: new Set<string>(),
});

export function criarEstadoDoEncerramento({
  cliente = () =>
    getSupabaseClient() as unknown as ClienteDoEncerramento | null,
  ligadas = () => false,
}: {
  cliente?: () => ClienteDoEncerramento | null;
  ligadas?: () => boolean;
} = {}) {
  let estado: EstadoDoEncerramento = VAZIO;
  let geracao = 0;
  const ouvintes = new Set<() => void>();

  const mudar = (parte: Partial<EstadoDoEncerramento>) => {
    estado = { ...estado, ...parte };
    ouvintes.forEach((ouvinte) => ouvinte());
  };

  const proximo = (lista: readonly EncerramentoDoEdital[]) =>
    ligadas() ? encerramentoAMostrar(lista) : null;

  async function verificar(): Promise<readonly EncerramentoDoEdital[]> {
    const minha = ++geracao;
    try {
      const supabase = cliente();
      if (!supabase?.rpc) return estado.encerramentos;
      const { data, error } = await supabase.rpc(RPC_DOS_ENCERRAMENTOS);
      if (minha !== geracao) return estado.encerramentos;
      if (error) return estado.encerramentos;
      const encerramentos = lerEncerramentos(data);
      mudar({
        encerramentos,
        aberto: estado.aberto ?? proximo(encerramentos),
      });
    } catch {
      // Encerramento nunca atrapalha a entrada.
    }
    return estado.encerramentos;
  }

  async function fechar() {
    const atual = estado.aberto;
    if (!atual) return;
    const encerramentos = estado.encerramentos.map((e) =>
      e.id === atual.id ? { ...e, visto: true } : e,
    );
    mudar({ encerramentos, aberto: null });
    try {
      await cliente()?.rpc(RPC_DO_VISTO, { p_edital: atual.id });
    } catch {
      // Sem o visto gravado, a tela volta na próxima entrada: melhor que sumir.
    }
    mudar({ aberto: proximo(estado.encerramentos) });
  }

  /** A tela de Análises viu o edital zerar (e já soltou os fogos do marco). */
  function editalConcluidoNaTela(detalhe: unknown) {
    const numeros = editaisDoEvento(detalhe);
    if (!numeros.length) return;
    mudar({ fogosJaSoltos: new Set([...estado.fogosJaSoltos, ...numeros]) });
    void verificar();
  }

  return {
    obter: () => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    verificar,
    fechar,
    editalConcluidoNaTela,
    /** Liga o aviso dos marcos de Análises; devolve o desligamento. */
    acompanhar(janela: Window | undefined = globalThis.window) {
      const ouvir = (evento: Event) =>
        editalConcluidoNaTela((evento as CustomEvent).detail);
      janela?.addEventListener(EVENTO_EDITAL_CONCLUIDO, ouvir);
      return () => janela?.removeEventListener(EVENTO_EDITAL_CONCLUIDO, ouvir);
    },
    /** Saiu da sessão: nada desta pessoa fica. */
    esquecer() {
      geracao += 1;
      mudar({ ...VAZIO, fogosJaSoltos: new Set() });
    },
  };
}

export type EstadoDoEncerramentoControle = ReturnType<
  typeof criarEstadoDoEncerramento
>;
