import {
  comemoracoesPessoaisLigadas,
  decidirComemoracao,
  duracaoMsDasOpcoes,
  marcoSoComAviso,
  reservarEfeitoDoDia,
} from "../../lib/catalogo-de-comemoracoes.ts";
import { hojeEmBrasilia } from "../../lib/avaliacao-documental/datas-do-vinculo.ts";
import type { FormaDoMarco } from "../../lib/catalogo-de-comemoracoes.ts";
import type { JanelaDaComemoracao } from "./desenho.ts";

/*
  O que uma comemoração mostra: o plano (efeito, intensidade, duração, som e
  mensagem) a partir do marco do catálogo (Configurações › Comemorações) ou
  do pedido direto, e as opções de `comemorar`. Sem DOM e sem React.

  Só o aviso, sem efeito: o marco só de aviso (fila zerada, vaga pronta,
  personalizados) e a segunda comemoração com efeito do mesmo dia (uma por
  dia neste navegador, `reservarEfeitoDoDia`). O teste não conta nem é
  limitado.
*/

export const TEMPO_DO_AVISO_MS = 12000;

/** O pedido de comemoração: o marco do catálogo ou o efeito direto. */
export interface PedidoDoPlano {
  marco?: string;
  teste?: boolean;
  confete?: string | boolean;
  efeito?: string | null;
  intensidade?: string | null;
  duracaoMs?: number | null;
  som?: boolean;
  /** O dia (AAAA-MM-DD) do limite de um efeito por dia; padrão: hoje em Brasília. */
  hoje?: string;
  janela?: JanelaDaComemoracao;
}

/** O que soltar: o efeito, a intensidade, a duração, o som e a mensagem. */
export interface PlanoDaComemoracao {
  efeito: string | null;
  intensidade: string | null;
  duracaoMs: number | null;
  som: boolean;
  mensagem: string;
}

/** As opções de `comemorar`. */
export interface OpcoesDaComemoracao {
  texto?: string;
  itens?: readonly string[];
  tituloDosItens?: string;
  forma?: FormaDoMarco | string;
  confete?: string | boolean;
  marco?: string;
  teste?: boolean;
  efeito?: string | null;
  intensidade?: string | null;
  duracaoMs?: number | null;
  som?: boolean;
  doc?: Document;
  janela?: JanelaDaComemoracao;
  aleatorio?: () => number;
}

function armazenamentoDa(janela: Window | undefined): Storage | null {
  try {
    return janela?.localStorage || null;
  } catch {
    return null;
  }
}

const soOAviso = (mensagem = ""): PlanoDaComemoracao => ({
  efeito: null,
  intensidade: null,
  duracaoMs: null,
  som: false,
  mensagem,
});

/* O plano do pedido, antes do limite de um efeito por dia. */
function planoPedido({
  marco = "",
  teste = false,
  confete = "cheio",
  efeito = null,
  intensidade = null,
  duracaoMs = null,
  som = false,
  janela = globalThis.window,
}: PedidoDoPlano): PlanoDaComemoracao | null {
  if (marco) {
    const { mostrar, opcoes } = decidirComemoracao({
      marco,
      teste,
      pessoal: comemoracoesPessoaisLigadas(armazenamentoDa(janela)),
    });
    if (!mostrar) return null;
    if (marcoSoComAviso(marco)) return soOAviso(opcoes?.mensagem);
    if (opcoes && !(teste && efeito))
      return {
        efeito: opcoes.efeito,
        intensidade: opcoes.intensidade,
        duracaoMs: duracaoMsDasOpcoes(opcoes),
        som: opcoes.som,
        mensagem: opcoes.mensagem,
      };
  } else if (!teste && !comemoracoesPessoaisLigadas(armazenamentoDa(janela)))
    return null;
  if (efeito)
    return {
      efeito,
      intensidade: intensidade || "normal",
      duracaoMs,
      som: som === true,
      mensagem: "",
    };
  if (!confete) return soOAviso();
  return {
    efeito: "fogos",
    intensidade: confete === true ? "cheio" : confete,
    duracaoMs: null,
    som: false,
    mensagem: "",
  };
}

/**
 * O que soltar: com `marco`, a configuração dele (ou nada, se desligado —
 * no marco ou na preferência pessoal; só o aviso, se o marco é só de
 * aviso); sem `marco`, o pedido direto (`efeito`/`intensidade`/`duracaoMs`,
 * ou `confete`, o nome antigo da intensidade dos fogos: "pequeno", "cheio",
 * "fogos", "festa" ou false). Fora do teste, o efeito é um por dia: já
 * houve outro hoje, só o aviso.
 */
export function planoDaComemoracao(
  pedido: PedidoDoPlano = {},
): PlanoDaComemoracao | null {
  const plano = planoPedido(pedido);
  if (!plano?.efeito || pedido.teste) return plano;
  return reservarEfeitoDoDia(
    armazenamentoDa(pedido.janela ?? globalThis.window),
    pedido.hoje ?? hojeEmBrasilia(),
  )
    ? plano
    : soOAviso(plano.mensagem);
}

/** Uma comemoração na tela (src/app/fila-de-comemoracoes.ts). */
export interface ComemoracaoNaTela {
  readonly id: number;
  readonly texto: string;
  readonly itens: readonly string[];
  readonly tituloDosItens: string;
  readonly plano: PlanoDaComemoracao;
  /** Há efeito e a pessoa não pediu menos movimento. */
  readonly animar: boolean;
  readonly forma: FormaDoMarco | string | null;
  readonly doc: Document;
  readonly janela: JanelaDaComemoracao | undefined;
  readonly aleatorio?: (() => number) | undefined;
}
