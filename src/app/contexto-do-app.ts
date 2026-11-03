import { createContext, useContext, useSyncExternalStore } from "react";
import { avisar } from "./avisos.ts";
import { ESTADO_INICIAL_DA_NAVEGACAO } from "./navegacao.ts";
import type { EstadoDaNavegacao, LeituraDaNavegacao } from "./navegacao.ts";

/*
  O que a raiz do app (src/app/raiz.tsx) entrega a todo o React: a navegação
  (a tela aberta, o título, o endereço) e o aviso curto (toast). O estado continua fora do React
  (src/app/navegacao.ts), lido com `useSyncExternalStore`; o contexto só diz
  qual navegação ler — nos testes, uma falsa.

  Fora da raiz (a casca desenhada sozinha num teste), vale a navegação
  parada: Visão geral, sem título.
*/
const NAVEGACAO_PARADA: LeituraDaNavegacao = Object.freeze({
  obter: () => ESTADO_INICIAL_DA_NAVEGACAO,
  assinar: () => () => {},
  esquecerEditalEVisao: () => {},
});

export interface ContextoDoApp {
  navegacao: LeituraDaNavegacao;
  avisar: (texto: string, tom?: string) => void;
}

export const ContextoDoApp = createContext<ContextoDoApp>({
  navegacao: NAVEGACAO_PARADA,
  avisar,
});

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
