/*
  Globais que só os testes escrevem (não existem nos tipos do React):
  `IS_REACT_ACT_ENVIRONMENT` avisa o React que `act` está em uso
  (tests/componentes/interacoes.ts) e o gancho das DevTools é o que
  tests/componentes/contar-renders.ts instala para contar os desenhos.
*/
export {};

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
  var __REACT_DEVTOOLS_GLOBAL_HOOK__: object | undefined;
}
