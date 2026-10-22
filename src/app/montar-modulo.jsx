import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./ErrorBoundary.jsx";

/**
 * O jeito único de montar uma ilha React do MONITORA: `createRoot` +
 * `StrictMode` + `ErrorBoundary` (um erro no módulo não derruba a página).
 *
 * `flushSync: true` desenha na hora, antes de a chamada voltar — para quando
 * o código seguinte precisa do DOM do módulo (a barra lateral, que o legado
 * lê logo depois; os painéis, que já saem com o skeleton).
 *
 * Devolve `{ raiz, desmontar }`. A `raiz` (do React) continua exposta nos
 * controladores porque os testes desmontam por ela (`controlador.raiz.unmount()`).
 * @param {import("react-dom/client").Container} elemento
 * @param {import("react").ReactNode} componente
 * @param {{ flushSync?: boolean, nome?: string }} [opcoes]
 */
export function montarModulo(
  elemento,
  componente,
  { flushSync: sincrono = false, nome } = {},
) {
  const raiz = createRoot(elemento);
  const arvore = (
    <StrictMode>
      <ErrorBoundary nome={nome}>{componente}</ErrorBoundary>
    </StrictMode>
  );
  if (sincrono) flushSync(() => raiz.render(arvore));
  else raiz.render(arvore);
  return { raiz, desmontar: () => raiz.unmount() };
}
