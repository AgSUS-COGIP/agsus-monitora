/*
  A varredura das cópias de payload na abertura do app: apaga as vencidas
  (`registroVencido`, 48 h), de todas as telas, mesmo as que nunca mais forem
  abertas. Baixa sob demanda (src/app/sistema.ts), fora do pedaço da entrada.
*/
import { registroVencido } from "../lib/carga/validade-das-copias";
import {
  BANCO,
  LOJA,
  abrirBanco,
} from "../modules/cache-de-payload-indexeddb.ts";

/** Apaga as cópias vencidas; devolve quantas. Nunca lança; sem o banco, não o cria. */
export async function apagarCopiasVencidas(
  agora: number = Date.now(),
): Promise<number> {
  try {
    const bancos = await globalThis.indexedDB.databases?.();
    if (bancos && !bancos.some((b) => b.name === BANCO)) return 0;
    const banco = await abrirBanco();
    try {
      return await new Promise<number>((resolver, rejeitar) => {
        let apagadas = 0;
        const transacao = banco.transaction(LOJA, "readwrite");
        const cursor = transacao.objectStore(LOJA).openCursor();
        cursor.onsuccess = () => {
          const atual = cursor.result;
          if (!atual) return;
          if (registroVencido(atual.value, agora)) {
            atual.delete();
            apagadas += 1;
          }
          atual.continue();
        };
        transacao.oncomplete = () => resolver(apagadas);
        transacao.onerror = () => rejeitar(transacao.error);
        transacao.onabort = () => rejeitar(transacao.error);
      });
    } finally {
      banco.close();
    }
  } catch {
    return 0;
  }
}
