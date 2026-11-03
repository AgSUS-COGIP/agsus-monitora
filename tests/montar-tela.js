import { StrictMode, createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "../src/app/ErrorBoundary.tsx";

/*
  Os testes desenham as telas e as peças do app como a raiz faz
  (src/app/raiz.tsx e src/app/telas.tsx): `StrictMode` + `ErrorBoundary`,
  sem a navegação. A raiz do React volta junto: os testes desmontam por ela.
*/

/**
 * Cria a tela (`criarX` de src/modulos/) e a desenha na seção dela
 * (`secao`, ou o elemento com o `id` padrão). Devolve o controlador com a
 * `raiz`.
 */
export function montarTela(criar, id, { secao, ...opcoes } = {}) {
  const controlador = criar(opcoes);
  const elemento = secao === undefined ? document.getElementById(id) : secao;
  const { raiz } = desenharNoTeste(elemento, controlador.conteudo, {
    nome: controlador.nome,
  });
  return { ...controlador, raiz };
}

/** Desenha um componente no elemento; `sincrono` desenha na hora (flushSync). */
export function desenharNoTeste(elemento, componente, { nome, sincrono } = {}) {
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
