import {
  comemoracoesPessoaisLigadas,
  decidirComemoracao,
  duracaoMsDasOpcoes,
  letreiroDaComemoracao,
} from "../../lib/catalogo-de-comemoracoes.ts";
import type { FormaDoMarco } from "../../lib/catalogo-de-comemoracoes.ts";
import type { JanelaDaComemoracao } from "./desenho.ts";

/*
  O que uma comemoração mostra: o plano (efeito, intensidade, duração, som,
  mensagem e o letreiro — o texto escrito no céu no fim dos fogos) a partir do marco do catálogo (Configurações › Comemorações) ou do
  pedido direto, e as opções de `comemorar`. Sem DOM e sem React.
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
  /** O texto no céu; sem ele, o do marco (ou, no Festa, "Parabéns!"). */
  letreiro?: string | null;
  janela?: JanelaDaComemoracao;
}

/** O que soltar: o efeito, a intensidade, a duração, o som e a mensagem. */
export interface PlanoDaComemoracao {
  efeito: string | null;
  intensidade: string | null;
  duracaoMs: number | null;
  som: boolean;
  mensagem: string;
  /** O texto escrito no céu no grande final dos fogos (Normal e Festa). */
  letreiro: string | null;
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
  letreiro?: string | null;
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

/**
 * O que soltar: com `marco`, a configuração dele (ou nada, se desligado —
 * no marco ou na preferência pessoal); sem `marco`, o pedido direto
 * (`efeito`/`intensidade`/`duracaoMs`, ou `confete`, o nome antigo da
 * intensidade dos fogos: "pequeno", "cheio", "fogos", "festa" ou false).
 */
export function planoDaComemoracao({
  marco = "",
  teste = false,
  confete = "cheio",
  efeito = null,
  intensidade = null,
  duracaoMs = null,
  som = false,
  letreiro,
  janela = globalThis.window,
}: PedidoDoPlano = {}): PlanoDaComemoracao | null {
  const comLetreiro = (
    plano: Omit<PlanoDaComemoracao, "letreiro">,
  ): PlanoDaComemoracao => ({
    ...plano,
    letreiro: plano.efeito
      ? letreiroDaComemoracao({
          marco,
          letreiro,
          intensidade: plano.intensidade,
        })
      : null,
  });
  if (marco) {
    const { mostrar, opcoes } = decidirComemoracao({
      marco,
      teste,
      pessoal: comemoracoesPessoaisLigadas(armazenamentoDa(janela)),
    });
    if (!mostrar) return null;
    if (opcoes && !(teste && efeito))
      return comLetreiro({
        efeito: opcoes.efeito,
        intensidade: opcoes.intensidade,
        duracaoMs: duracaoMsDasOpcoes(opcoes),
        som: opcoes.som,
        mensagem: opcoes.mensagem,
      });
  } else if (!teste && !comemoracoesPessoaisLigadas(armazenamentoDa(janela)))
    return null;
  if (efeito)
    return comLetreiro({
      efeito,
      intensidade: intensidade || "normal",
      duracaoMs,
      som: som === true,
      mensagem: "",
    });
  return comLetreiro(
    confete
      ? {
          efeito: "fogos",
          intensidade: confete === true ? "cheio" : confete,
          duracaoMs: null,
          som: false,
          mensagem: "",
        }
      : {
          efeito: null,
          intensidade: null,
          duracaoMs: null,
          som: false,
          mensagem: "",
        },
  );
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
