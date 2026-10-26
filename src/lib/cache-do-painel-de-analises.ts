/*
  A cópia do payload do painel de análises no navegador: o que é só do painel.
  As regras gerais (dono, versão publicada, validade, revalidação por trás)
  estão em `cache-de-payload.js`, as mesmas da lista de aprovados.

  O cache antigo, no `localStorage`, gravava as linhas já decodificadas — bem
  mais que os 5 MB do `localStorage` — e falhava calado: na prática não havia
  cache. As chaves dele são apagadas ao abrir o painel (`chavesDoCacheAntigo`).
*/
import { chaveDoCacheDoPayload } from "./area-do-painel-de-analises.ts";
import {
  criarCacheDePayload,
  revalidarPayload as revalidarCopia,
} from "./cache-de-payload";
import type {
  ArmazenamentoDoCache,
  CacheDePayload,
  TipoDePayload,
} from "./cache-de-payload";

/** O contexto que dá a chave da cópia do painel (além do `usuarioId`). */
export interface ContextoDoPainel {
  area: unknown;
  escopo: unknown;
}

/** As opções de `revalidarPayload` de `cache-de-payload` (`mudou` vem daqui). */
export type OpcoesDaRevalidacaoDoPainel<N> = Parameters<
  typeof revalidarCopia<N>
>[0];

/*
  `schema_version` do payload de get_analises_dashboard_payload_v2 que a cópia
  aceita: 4 é a lista enxuta (20260929150000); 3, a de 35 colunas, que o
  servidor ainda manda até a migration ser aplicada.
*/
export const ESQUEMAS_DO_PAYLOAD = Object.freeze([3, 4]);

/* Chaves do cache antigo no localStorage (e o marcador da migração dele). */
const PREFIXO_DO_CACHE_ANTIGO = "agsus_analises_cache_";
const MARCADOR_DO_CACHE_ANTIGO = "agsus_analises_responsavel_normalizado_v1";

const texto = (valor: unknown) => String(valor ?? "").trim();

/** O que identifica a versão dos dados de um payload. */
export function versaoDoPayload(payload: unknown): string {
  return texto(
    (payload as { generated_at?: unknown } | null | undefined)?.generated_at,
  );
}

/*
  O payload novo traz dados diferentes dos da cópia? O servidor devolve a hora
  em que montou o payload (`generated_at`), que não muda entre um sync e outro.
*/
export function payloadMudou(anterior: unknown, novo: unknown): boolean {
  if (!anterior || !novo) return true;
  const versaoAnterior = versaoDoPayload(anterior);
  return (
    !versaoAnterior ||
    versaoAnterior !== versaoDoPayload(novo) ||
    Number((anterior as { total?: unknown }).total) !==
      Number((novo as { total?: unknown }).total)
  );
}

export const PAINEL_DE_ANALISES: Readonly<TipoDePayload<ContextoDoPainel>> =
  Object.freeze({
    nome: "painel de análises",
    chave: ({ area, escopo }: ContextoDoPainel) =>
      chaveDoCacheDoPayload(area, escopo),
    esquema: (payload: unknown) =>
      (payload as { schema_version?: unknown } | null | undefined)
        ?.schema_version,
    esquemas: ESQUEMAS_DO_PAYLOAD,
    valido: (payload: unknown) =>
      Array.isArray((payload as { rows?: unknown }).rows),
  });

/** Cópias do painel (contexto `{ usuarioId, area, escopo }`). */
export function criarCacheDoPainel(opcoes: {
  armazenamento: ArmazenamentoDoCache;
  versao: unknown;
  relogio?: () => number;
}): CacheDePayload<ContextoDoPainel> {
  return criarCacheDePayload({ ...opcoes, tipo: PAINEL_DE_ANALISES });
}

/** Revalidação da cópia do painel: redesenha quando `payloadMudou`. */
export function revalidarPayload<N>(
  opcoes: OpcoesDaRevalidacaoDoPainel<N>,
): Promise<N | null> {
  return revalidarCopia({ mudou: payloadMudou, ...opcoes });
}

/** Chaves do cache antigo do painel no localStorage, para liberar espaço. */
export function chavesDoCacheAntigo(chaves: Iterable<unknown>): string[] {
  return [...chaves].filter(
    (chave) =>
      typeof chave === "string" &&
      (chave.startsWith(PREFIXO_DO_CACHE_ANTIGO) ||
        chave === MARCADOR_DO_CACHE_ANTIGO),
  ) as string[];
}
