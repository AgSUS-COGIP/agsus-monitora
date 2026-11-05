import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary.tsx";

/*
  Portais avulsos da raiz do app: um pedaço de React desenhado num elemento
  que o código de fora do React cria e apaga — a arara que voa nos fogos
  (src/modules/comemoracao.ts, um canvas) e a cobertura do painel externo
  enquanto o iframe carrega (src/app/paineis-externos.ts).

  Antes, cada um era uma ilha com `createRoot` próprio (montar-modulo.tsx).
  Agora a raiz (src/app/raiz.tsx) desenha `<PortaisAvulsos />`, e cada
  pedido vira um `createPortal` na mesma árvore: um `createRoot` só, o
  mesmo contexto e um ErrorBoundary por portal (um erro no desenho não
  derruba a página).

  Fica enquanto quem chama ainda é DOM à mão: quando os fogos e o quadro dos
  painéis forem React, eles desenham a arara e a cobertura direto.
*/

interface PortalAvulso {
  readonly chave: number;
  readonly elemento: Element;
  readonly filho: ReactNode;
  readonly nome: string;
}

let portais: readonly PortalAvulso[] = Object.freeze([]);
let proximaChave = 1;
const ouvintes = new Set<() => void>();

function publicar(novos: readonly PortalAvulso[]) {
  portais = Object.freeze(novos);
  ouvintes.forEach((ouvinte) => ouvinte());
}

const obterPortais = () => portais;
function assinarPortais(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/**
 * Desenha `filho` dentro de `elemento` pela raiz do app. Devolve o
 * fechamento (tira o portal; chamar de novo não faz nada).
 */
export function abrirPortalAvulso(
  elemento: Element,
  filho: ReactNode,
  { nome = "" }: { nome?: string } = {},
): () => void {
  const portal: PortalAvulso = {
    chave: proximaChave++,
    elemento,
    filho,
    nome,
  };
  publicar([...portais, portal]);
  return () => {
    if (!portais.includes(portal)) return;
    publicar(portais.filter((outro) => outro !== portal));
  };
}

/** Os portais abertos, desenhados pela raiz do app. */
export function PortaisAvulsos() {
  const abertos = useSyncExternalStore(
    assinarPortais,
    obterPortais,
    obterPortais,
  );
  return (
    <>
      {abertos.map(({ chave, elemento, filho, nome }) =>
        createPortal(
          <ErrorBoundary nome={nome || undefined}>{filho}</ErrorBoundary>,
          elemento,
          String(chave),
        ),
      )}
    </>
  );
}
