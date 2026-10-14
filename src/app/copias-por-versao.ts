/*
  A cópia no navegador das leituras por versão da Avaliação documental e da
  Classificação (src/lib/avaliacao-documental/leitura-por-versao.ts): o
  payload como o banco mandou (com a versão), no IndexedDB das cópias de
  payload (src/modules/cache-de-payload-indexeddb.js), pelas regras de
  src/lib/cache-de-payload.js — de um usuário só, por chave, por 7 dias.

  Reabrir a tela num dia seguinte (ou depois de recarregar a página) manda a
  versão guardada e recebe só { inalterado } quando nada mudou, em vez de
  0,5 a 1 MB. Sem IndexedDB (aba anônima, teste) a leitura segue só com a
  memória da página.
*/
import { criarCacheDePayload } from "../lib/cache-de-payload.js";
import type { CopiasPorChave } from "../lib/avaliacao-documental/leitura-por-versao.ts";
import { armazenamentoDePayload } from "../modules/cache-de-payload-indexeddb.js";

/* Sobe quando o formato guardado muda (a cópia antiga deixa de servir). */
const VERSAO_DAS_COPIAS = "leitura-por-versao:1";

type LerSessao = () => Promise<{
  data?: { session?: { user?: { id?: string } | null } | null } | null;
}>;

const registro = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};

/**
 * As cópias de uma RPC (`nome` separa as chaves de cada uma). Devolve null sem
 * cliente com sessão.
 */
export function criarCopiasPorVersao(
  supabase: unknown,
  nome: string,
): CopiasPorChave | null {
  const auth = registro(registro(supabase).auth);
  if (typeof auth.getSession !== "function") return null;
  const lerSessao = () => (auth.getSession as LerSessao).call(auth);
  const tipo = Object.freeze({
    nome,
    chave: ({ chave }: { chave?: unknown }) => `${nome}:${String(chave ?? "")}`,
    esquema: (payload: unknown) =>
      Number(registro(payload).schema_version ?? 0),
    esquemas: Object.freeze([1, 2]),
    valido: (payload: unknown) =>
      typeof registro(payload).versao === "string" &&
      registro(payload).inalterado !== true,
  });
  const cache = criarCacheDePayload({
    armazenamento: armazenamentoDePayload,
    versao: VERSAO_DAS_COPIAS,
    tipo,
  });
  async function usuarioId(): Promise<string> {
    try {
      const r = await lerSessao();
      return String(r?.data?.session?.user?.id ?? "");
    } catch {
      return "";
    }
  }
  return {
    async ler(chave) {
      const id = await usuarioId();
      return id ? cache.ler({ usuarioId: id, chave }) : null;
    },
    async guardar(chave, payload) {
      const id = await usuarioId();
      return id ? cache.guardar({ usuarioId: id, chave }, payload) : false;
    },
  };
}
