import { createContext, useContext, useSyncExternalStore } from "react";
import { avisar } from "./avisos.ts";
import { ESTADO_INICIAL_DA_NAVEGACAO } from "./navegacao.ts";
import type { EstadoDaNavegacao, LeituraDaNavegacao } from "./navegacao.ts";
import type { AvisoDeVersao } from "./aviso-de-versao.ts";
import type { Moldura } from "./moldura.ts";
import type { PresencaDoCabecalho } from "../componentes/pessoas-online/pessoas-online.tsx";
import type { EstadoDoEncerramentoControle } from "../modulos/encerramento-do-edital/estado.ts";

/*
  O que a raiz do app (src/app/raiz.tsx) entrega a todo o React: a navegação
  (a tela aberta, o título, o endereço) e o aviso curto (toast). O estado continua fora do React
  (src/app/navegacao.ts), lido com `useSyncExternalStore`; o contexto só diz
  qual navegação ler — nos testes, uma falsa.

  Fora da raiz (a casca desenhada sozinha num teste), vale a navegação
  parada: Visão geral, sem título.

  As peças do sistema (`pecas`, de src/app/sistema.ts e da sessão) são o
  estado das partes da casca que eram ilhas: Pessoas online, aviso de versão,
  encerramento e selos do edital, Aya e busca global. Sem elas (um teste da
  casca sozinha), essas partes não aparecem.
*/
const NAVEGACAO_PARADA: LeituraDaNavegacao = Object.freeze({
  obter: () => ESTADO_INICIAL_DA_NAVEGACAO,
  assinar: () => () => {},
  esquecerEditalEVisao: () => {},
  abrirRegrasDoEdital: () => false,
  fecharRegrasDoEdital: () => {},
  irParaInicio: () => {},
});

/** Um valor assinável (o padrão dos estados do app, fora do React). */
export interface Assinavel<T> {
  obter(): T;
  assinar(ouvinte: () => void): () => unknown;
}

/** O estado das partes da casca que dependem do sistema e da sessão. */
export interface PecasDoApp {
  presenca: PresencaDoCabecalho;
  avisoDeVersao: AvisoDeVersao;
  encerramento: EstadoDoEncerramentoControle;
  /** O app abriu (a sessão está abrindo ou conectada): a Aya pode baixar. */
  appAberto: Assinavel<boolean>;
  /** Há usuário conectado (a busca global só abre assim). */
  estaConectado: () => boolean;
  /** Relê os painéis externos do menu (Módulos e abas salvou). */
  recarregarPaineisExternos?: () => unknown;
  /** Barra, tema, tela cheia e relatório (src/app/moldura.ts); a casca aplica na página. */
  moldura?: Moldura;
}

export interface ContextoDoApp {
  navegacao: LeituraDaNavegacao;
  avisar: (texto: string, tom?: string) => void;
  pecas: PecasDoApp | null;
}

export const ContextoDoApp = createContext<ContextoDoApp>({
  navegacao: NAVEGACAO_PARADA,
  avisar,
  pecas: null,
});

/** As peças do sistema (null fora da raiz). */
export function usarPecasDoApp(): PecasDoApp | null {
  return useContext(ContextoDoApp).pecas;
}

/** O aviso curto do app (src/app/avisos.ts; nos testes, um falso). */
export function usarAviso(): ContextoDoApp["avisar"] {
  return useContext(ContextoDoApp).avisar;
}

/** A navegação da raiz. */
export function usarNavegacao(): LeituraDaNavegacao {
  return useContext(ContextoDoApp).navegacao;
}

/** O estado da navegação (a tela aberta, o título), relido a cada mudança. */
export function usarEstadoDaNavegacao(): EstadoDaNavegacao {
  const navegacao = usarNavegacao();
  return useSyncExternalStore(
    navegacao.assinar,
    navegacao.obter,
    navegacao.obter,
  );
}
