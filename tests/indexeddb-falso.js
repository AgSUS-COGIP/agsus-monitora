/*
  IndexedDB mínimo para os testes (o jsdom não tem um): vários bancos, uma loja
  por banco, get/put/clear e deleteDatabase, tudo assíncrono como no navegador.
*/
export function indexedDBFalso() {
  const bancos = new Map();
  const depois = (fn) => setTimeout(fn, 0);
  return {
    bancos,
    open(nome) {
      const pedido = {};
      depois(() => {
        const novo = !bancos.has(nome);
        if (novo) bancos.set(nome, new Map());
        const lojas = bancos.get(nome);
        pedido.result = {
          createObjectStore: (loja) => lojas.set(loja, new Map()),
          transaction(loja) {
            const transacao = {};
            const mapa = lojas.get(loja);
            const operar = (fazer) => {
              const op = {};
              depois(() => {
                op.result = fazer();
                depois(() => transacao.oncomplete?.());
              });
              return op;
            };
            transacao.objectStore = () => ({
              get: (chave) => operar(() => structuredClone(mapa.get(chave))),
              put: (valor, chave) =>
                operar(() => mapa.set(chave, structuredClone(valor)) && chave),
              clear: () => operar(() => mapa.clear()),
            });
            return transacao;
          },
          close() {},
        };
        if (novo) pedido.onupgradeneeded?.();
        pedido.onsuccess?.();
      });
      return pedido;
    },
    deleteDatabase(nome) {
      const pedido = {};
      depois(() => {
        bancos.delete(nome);
        pedido.onsuccess?.();
      });
      return pedido;
    },
  };
}
