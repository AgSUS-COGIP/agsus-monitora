/*
  As cópias da condução de entrevistas no aparelho (fila do dia e ficha): a
  lista de editais da área e o edital aberto (convocados, notas, agenda e
  previsão), no IndexedDB das cópias de payload
  (src/modules/cache-de-payload-indexeddb.ts), pelas regras de
  src/lib/carga/cache-de-payload.ts: de um usuário só, por chave e por 48 h; saem ao
  Sair, no "Limpar sessão", ao perder o acesso e quando outra pessoa entra.

  São gravadas a cada leitura com rede e lidas só quando o banco não responde
  por falta de conexão (src/modulos/entrevistas/estado-da-conducao.ts): a tela
  abre da cópia, só para consulta, com a data dela. CPF e contatos não vêm
  nas RPCs da condução e não ficam no aparelho.
*/
import { criarCacheDePayload } from "../lib/carga/cache-de-payload";
import type { CopiasDaConducao } from "../modulos/entrevistas/tipos-do-estado-da-conducao.ts";
import { armazenamentoDePayload } from "../modules/cache-de-payload-indexeddb.ts";

/* Sobe quando o formato guardado muda (a cópia antiga deixa de servir). */
const VERSAO_DAS_COPIAS = "conducao:1";

type LerSessao = () => Promise<{
  data?: { session?: { user?: { id?: string } | null } | null } | null;
}>;

const registro = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};

const TIPO = Object.freeze({
  nome: "condução de entrevistas",
  chave: ({ chave }: { chave?: unknown }) => `conducao:${String(chave ?? "")}`,
  esquema: (payload: unknown) => Number(registro(payload).formato ?? 0),
  esquemas: Object.freeze([1]),
  valido: (payload: unknown) => registro(payload).formato === 1,
});

/** As cópias da condução; null sem cliente com sessão. */
export function criarCopiasDaConducao(
  supabase: unknown,
): CopiasDaConducao | null {
  const auth = registro(registro(supabase).auth);
  if (typeof auth.getSession !== "function") return null;
  const lerSessao = () => (auth.getSession as LerSessao).call(auth);
  const cache = criarCacheDePayload({
    armazenamento: armazenamentoDePayload,
    versao: VERSAO_DAS_COPIAS,
    tipo: TIPO,
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
      return id ? cache.lerComData({ usuarioId: id, chave }) : null;
    },
    async guardar(chave, payload) {
      const id = await usuarioId();
      return id ? cache.guardar({ usuarioId: id, chave }, payload) : false;
    },
  };
}
