import { trocarEstadoGuardado } from "../lib/comemoracao.ts";
import type { ArmazenamentoSimples } from "../lib/comemoracao.ts";
import type { JanelaDaComemoracao } from "../modulos/comemoracao/desenho.ts";
import type { OpcoesDaComemoracao } from "../modulos/comemoracao/plano.ts";
import type { ComemoracaoAberta } from "../modulos/comemoracao/comemoracoes.tsx";

/*
  As comemorações sob demanda. O desenho delas
  (src/modulos/comemoracao/comemoracoes.tsx: o aviso, o canvas, o motor de
  efeitos e os fogos e o CSS, ~120 kB) sai do pacote principal e só baixa
  quando uma comemoração vai aparecer; a casca o desenha enquanto houver
  alguma na fila (src/app/fila-de-comemoracoes.ts). Quem comemora importa daqui: `comemorar` devolve a promessa do
  aviso (ou null), e a regra do marco (`avaliarMarco`) continua síncrona — só
  o desenho espera o download.

  Falhou o download (rede, versão nova publicada): a comemoração não aparece
  e nada mais muda — sem recarregar a página no meio do trabalho.
*/

type Comemoracao = typeof import("../modulos/comemoracao/comemoracoes.tsx");

let pedido: Promise<Comemoracao> | null = null;

/** Baixa o desenho das comemorações (uma vez); serve também para pedir antes. */
export function carregarComemoracao(): Promise<Comemoracao> {
  pedido ??= import("../modulos/comemoracao/comemoracoes.tsx").catch(
    (erro: unknown) => {
      pedido = null;
      throw erro;
    },
  );
  return pedido;
}

/** Aviso + efeito (ver `comemorar` em src/modulos/comemoracao/comemoracoes.tsx). */
export function comemorar(
  opcoes: OpcoesDaComemoracao = {},
): Promise<ComemoracaoAberta | null> {
  return carregarComemoracao().then(
    (modulo) => modulo.comemorar(opcoes),
    (erro: unknown) => {
      console.warn("Comemoração indisponível:", erro);
      return null;
    },
  );
}

/** As opções de `avaliarMarco`; `A` é o estado guardado, `C` a comemoração. */
export interface OpcoesDoMarco<A, C> {
  armazenamento?: ArmazenamentoSimples | null;
  chave: string;
  atual: unknown;
  ligadas: boolean;
  decidir: (anterior: A) => C | null | undefined;
  confete?: string | boolean;
  doc?: Document;
  janela?: JanelaDaComemoracao;
}

/**
 * Um tipo de marco num painel: troca o estado guardado (linha de base na
 * primeira vez) e, se `decidir(anterior)` devolver `{ texto, itens, forma,
 * marco }` e as comemorações estiverem ligadas, comemora (`marco` é o id
 * do catálogo: a configuração dele decide o efeito). O estado é guardado
 * mesmo desligado, para que religar não traga o que aconteceu no meio.
 */
export function avaliarMarco<A, C extends OpcoesDaComemoracao>({
  armazenamento = globalThis.window?.localStorage,
  chave,
  atual,
  ligadas,
  decidir,
  confete = "cheio",
  doc = globalThis.document,
  janela = globalThis.window,
}: OpcoesDoMarco<A, C>): C | null {
  const anterior = trocarEstadoGuardado({ armazenamento, chave, atual });
  if (anterior === null || !ligadas) return null;
  // O estado guardado é o JSON que o próprio painel gravou (`atual`).
  const comemoracao = decidir(anterior as A);
  if (!comemoracao) return null;
  void comemorar({ ...comemoracao, confete, doc, janela });
  return comemoracao;
}
