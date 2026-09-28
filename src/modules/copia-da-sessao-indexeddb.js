/*
  Onde a cópia da sessão mora: um registro só, no IndexedDB do navegador.

  IndexedDB e não `localStorage`: o mapa (`lmap`, `rede_cnes`) passa com folga
  do limite de alguns megabytes do `localStorage`. As regras de quando a cópia
  serve estão em `src/lib/copia-da-sessao.js`.

  Nada aqui lança erro: janela anônima, armazenamento bloqueado ou cheio viram
  "não há cópia", e a entrada segue pela rede como antes.
*/

import { apagarCacheDasAnalises } from "./cache-das-analises-indexeddb.js";

const BANCO = "agsus-monitora";
const LOJA = "copia-da-sessao";
const CHAVE = "sessao";

/*
  Versão da cópia. `import.meta.url` é o endereço do bundle publicado, que traz o
  hash do conteúdo: cada publicação nova invalida as cópias antigas sozinha, sem
  depender de alguém lembrar de mudar um número quando as colunas mudarem. O
  número à frente é para mudança do formato do registro.
*/
export const VERSAO_DA_COPIA = `1:${import.meta.url}`;

function abrirBanco() {
  return new Promise((resolver, rejeitar) => {
    const pedido = globalThis.indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA);
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rejeitar(pedido.error);
    pedido.onblocked = () => rejeitar(new Error("IndexedDB bloqueado"));
  });
}

async function naLoja(modo, operar) {
  const banco = await abrirBanco();
  try {
    return await new Promise((resolver, rejeitar) => {
      const transacao = banco.transaction(LOJA, modo);
      const pedido = operar(transacao.objectStore(LOJA));
      transacao.oncomplete = () => resolver(pedido.result);
      transacao.onerror = () => rejeitar(transacao.error);
      transacao.onabort = () => rejeitar(transacao.error);
    });
  } finally {
    banco.close();
  }
}

/** A cópia guardada, ou `null` se não houver ou o armazenamento falhar. */
export async function lerCopiaDaSessao() {
  try {
    return (await naLoja("readonly", (loja) => loja.get(CHAVE))) ?? null;
  } catch {
    return null;
  }
}

/** Substitui a cópia guardada. Devolve se conseguiu. */
export async function guardarCopiaDaSessao(copia) {
  try {
    await naLoja("readwrite", (loja) => loja.put(copia, CHAVE));
    return true;
  } catch {
    return false;
  }
}

/*
  Apaga a cópia da sessão e, junto, a cópia do painel de análises (outro banco,
  mesma pessoa): "Limpar sessão", acesso revogado e outro usuário entrando
  levam as duas.
*/
export async function apagarCopiaDaSessao() {
  try {
    await naLoja("readwrite", (loja) => loja.delete(CHAVE));
  } catch {
    // Sem armazenamento, não há o que apagar.
  }
  await apagarCacheDasAnalises();
}
