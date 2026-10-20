/*
  Conta quantas vezes cada componente React desenhou, sem mexer no código da
  tela: faz o papel do gancho das DevTools do React, que o react-dom chama a
  cada commit, e percorre a árvore só onde ela foi refeita (o ramo que o React
  pulou — props iguais, memo — fica com o mesmo filho de antes e não conta).

  Tem de ser importado ANTES do react-dom (o primeiro import do teste): o
  react-dom procura o gancho uma vez, quando carrega.

    import { renders } from "../componentes/contar-renders.js";
    renders.zerar();
    ... troca um filtro ...
    expect(renders.de("LinhaDoRelatorio")).toBe(0);
*/

const FUNCAO = 0;
const FORWARD_REF = 11;
const MEMO = 14;
const MEMO_SIMPLES = 15;
const DESENHOU = 1; // PerformedWork

const contagem = new Map();

/* O nome da função; o esbuild renomeia `const X = memo(function X…)` para X2. */
function nomeDe(fibra) {
  const tipo = fibra.type?.type ?? fibra.type?.render ?? fibra.type;
  return (tipo?.displayName || tipo?.name || "").replace(/\d+$/, "");
}

function percorrer(fibra) {
  for (let filho = fibra.child; filho; filho = filho.sibling) {
    if ([FUNCAO, FORWARD_REF, MEMO, MEMO_SIMPLES].includes(filho.tag)) {
      const montou = filho.alternate === null;
      if (montou || filho.flags & DESENHOU) {
        const nome = nomeDe(filho);
        contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
      }
    }
    // Filho igual ao do commit anterior: o React não refez este ramo.
    if (filho.alternate && filho.child === filho.alternate.child) continue;
    percorrer(filho);
  }
}

if (!globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  let proximo = 1;
  globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    isDisabled: false,
    renderers: new Map(),
    inject(renderizador) {
      const id = proximo++;
      this.renderers.set(id, renderizador);
      return id;
    },
    onCommitFiberRoot(_id, raiz) {
      const atual = raiz.current;
      if (atual.alternate && atual.child === atual.alternate.child) return;
      percorrer(atual);
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onScheduleFiberRoot() {},
    setStrictMode() {},
    checkDCE() {},
  };
}

export const renders = {
  zerar: () => contagem.clear(),
  /** Quantas vezes o componente `nome` desenhou desde o último `zerar()`. */
  de: (nome) => contagem.get(nome) ?? 0,
  todos: () => Object.fromEntries(contagem),
};
