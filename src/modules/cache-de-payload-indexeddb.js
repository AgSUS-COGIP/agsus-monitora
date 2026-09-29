/*
  Onde as cópias de payload moram (painel de análises e lista de aprovados):
  no IndexedDB do navegador, num banco próprio (o do MONITORA, `agsus-monitora`,
  é aberto na versão 1 pelo outro bundle; dividir o mesmo banco obrigaria os
  dois a subir de versão juntos). O nome do banco continua o de quando só o
  painel o usava: as cópias já guardadas e a limpeza seguem valendo.

  IndexedDB e não `localStorage`: o payload da Saúde Indígena (≈3,5 MB de
  texto) passa do limite do `localStorage`. As regras de quando a cópia serve
  estão em `src/lib/cache-de-payload.js`; cada tela guarda com a própria chave
  (área e escopo no painel, `aprovados:<área>` na lista de aprovados), e o dono
  das cópias é um só.

  O painel roda num iframe da mesma origem do MONITORA: os dois veem o mesmo
  banco. O MONITORA apaga tudo daqui ao "Limpar sessão", ao sair pelo botão e
  quando o acesso é revogado (ver `apagarCopiaDaSessao`).

  Nada aqui lança erro para quem usa `armazenamentoDePayload` pelo
  `criarCacheDePayload`; `apagarCacheDePayload` também nunca lança.
*/

const BANCO = "agsus-monitora-analises";
const LOJA = "payload";

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
    // Conexão fechada a cada operação: o "apagar" do MONITORA nunca fica bloqueado.
    banco.close();
  }
}

/** O armazenamento que `criarCacheDePayload` espera. Estas funções podem lançar. */
export const armazenamentoDePayload = Object.freeze({
  async ler(chave) {
    return (await naLoja("readonly", (loja) => loja.get(chave))) ?? null;
  },
  async guardar(chave, valor) {
    await naLoja("readwrite", (loja) => loja.put(valor, chave));
  },
  async apagarTudo() {
    await naLoja("readwrite", (loja) => loja.clear());
  },
});

/**
 * Apaga o banco inteiro (todas as telas, áreas e escopos). Não cria o banco se ele não
 * existir e não espera além do necessário: bloqueado, segue.
 */
export function apagarCacheDePayload() {
  return new Promise((resolver) => {
    try {
      const pedido = globalThis.indexedDB.deleteDatabase(BANCO);
      pedido.onsuccess = () => resolver();
      pedido.onerror = () => resolver();
      pedido.onblocked = () => resolver();
    } catch {
      resolver();
    }
  });
}
