import { StrictMode, act, createElement } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { ErrorBoundary } from "../src/app/ErrorBoundary.tsx";
import { PortaisAvulsos } from "../src/app/portais-avulsos.tsx";

/*
  Os testes desenham as telas e as peças do app como a raiz faz
  (src/app/raiz.tsx e src/app/telas.tsx): `StrictMode` + `ErrorBoundary`,
  sem a navegação. A raiz do React volta junto: os testes desmontam por ela.
*/

/** O mínimo que `montarTela` usa do controlador (ControladorDeTela). */
interface ControladorMontavel {
  readonly conteudo: ReactNode;
  readonly nome: string;
}

/** A seção onde a tela é desenhada, no lugar do elemento com o `id`. */
interface SecaoDaTela {
  secao?: HTMLElement | null | undefined;
}

/**
 * Cria a tela (`criarX` de src/modulos/) e a desenha na seção dela
 * (`secao`, ou o elemento com o `id` padrão). Devolve o controlador com a
 * `raiz`.
 */
export function montarTela<O, C extends ControladorMontavel>(
  criar: (opcoes: O) => C,
  id: string,
  { secao, ...opcoes }: NonNullable<O> & SecaoDaTela,
): C & { raiz: Root | null } {
  const controlador = criar(opcoes as O);
  const elemento = secao === undefined ? document.getElementById(id) : secao;
  const { raiz } = desenharNoTeste(elemento, controlador.conteudo, {
    nome: controlador.nome,
  });
  return { ...controlador, raiz };
}

interface OpcoesDoDesenho {
  nome?: string | undefined;
  sincrono?: boolean | undefined;
}

interface Desenho<R extends Root | null> {
  raiz: R;
  desmontar: () => void;
}

/** Desenha um componente no elemento; `sincrono` desenha na hora (flushSync). */
export function desenharNoTeste(
  elemento: Element,
  componente: ReactNode,
  opcoes?: OpcoesDoDesenho,
): Desenho<Root>;
export function desenharNoTeste(
  elemento: Element | null,
  componente: ReactNode,
  opcoes?: OpcoesDoDesenho,
): Desenho<Root | null>;
export function desenharNoTeste(
  elemento: Element | null,
  componente: ReactNode,
  { nome, sincrono }: OpcoesDoDesenho = {},
): Desenho<Root | null> {
  if (!elemento) return { raiz: null, desmontar: () => {} };
  const raiz = createRoot(elemento);
  const arvore = createElement(
    StrictMode,
    null,
    createElement(ErrorBoundary, { nome }, componente),
  );
  if (sincrono) flushSync(() => raiz.render(arvore));
  else raiz.render(arvore);
  return { raiz, desmontar: () => raiz.unmount() };
}

/**
 * Os portais avulsos da raiz (src/app/portais-avulsos.tsx: a arara dos fogos,
 * a cobertura do painel externo), desenhados como a raiz faz. Devolve o
 * desmonte.
 */
export function montarPortaisNoTeste(): () => void {
  const elemento = document.createElement("div");
  document.body.append(elemento);
  const raiz = createRoot(elemento);
  act(() => raiz.render(createElement(PortaisAvulsos)));
  return () => {
    act(() => raiz.unmount());
    elemento.remove();
  };
}
