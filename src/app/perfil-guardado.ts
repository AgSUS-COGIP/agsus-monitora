/*
  A cópia do perfil para entrar sem rede (src/lib/sessao/sessao-sem-rede.ts), no
  IndexedDB das cópias de payload (src/modules/cache-de-payload-indexeddb.ts):
  de um usuário só e por 48 h; sai com as outras cópias ao Sair, no "Limpar
  sessão", ao perder o acesso e quando outra pessoa entra no navegador.
*/
import { criarCacheDePayload } from "../lib/carga/cache-de-payload";
import type { ArmazenamentoDoCache } from "../lib/carga/cache-de-payload";
import {
  PERFIL_GUARDADO,
  perfilParaGuardar,
  type PerfilParaGuardar,
} from "../lib/sessao/perfil-sem-rede.ts";
import { armazenamentoDePayload } from "../modules/cache-de-payload-indexeddb.ts";

/* Sobe quando o formato guardado muda (a cópia antiga deixa de servir). */
const VERSAO_DO_PERFIL = "perfil:1";

export interface PerfilGuardado {
  /** O perfil guardado deste usuário, ou null. Nunca lança. */
  ler(usuarioId: string): Promise<PerfilParaGuardar | null>;
  /** Guarda o perfil lido do banco. Nunca lança. */
  guardar(usuarioId: string, contexto: PerfilParaGuardar): Promise<unknown>;
}

export function criarPerfilGuardado(
  armazenamento: ArmazenamentoDoCache = armazenamentoDePayload,
): PerfilGuardado {
  const cache = criarCacheDePayload({
    armazenamento,
    versao: VERSAO_DO_PERFIL,
    tipo: PERFIL_GUARDADO,
  });
  return {
    async ler(usuarioId) {
      if (!usuarioId) return null;
      const lido = await cache.ler({ usuarioId });
      return lido ? (lido as PerfilParaGuardar) : null;
    },
    guardar(usuarioId, contexto) {
      if (!usuarioId) return Promise.resolve(false);
      return cache.guardar({ usuarioId }, perfilParaGuardar(contexto));
    },
  };
}
