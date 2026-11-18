/*
  IndexedDB mínimo para os testes (o jsdom não tem um): vários bancos, uma loja
  por banco, get/put/delete/clear, cursor, databases e deleteDatabase, tudo
  assíncrono como no navegador.
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
              delete: (chave) => operar(() => mapa.delete(chave)),
              clear: () => operar(() => mapa.clear()),
              openCursor() {
                const pedido = {};
                const chaves = [...mapa.keys()];
                let i = 0;
                const avancar = () =>
                  depois(() => {
                    if (i >= chaves.length) {
                      pedido.result = null;
                      pedido.onsuccess?.();
                      depois(() => transacao.oncomplete?.());
                      return;
                    }
                    const chave = chaves[i++];
                    pedido.result = {
                      key: chave,
                      value: structuredClone(mapa.get(chave)),
                      delete: () => mapa.delete(chave),
                      continue: avancar,
                    };
                    pedido.onsuccess?.();
                  });
                avancar();
                return pedido;
              },
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
    databases: async () => [...bancos.keys()].map((name) => ({ name })),
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
