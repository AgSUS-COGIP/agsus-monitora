import type { Novidade } from "./novidades.ts";

/*
  Versão do sistema, sem DOM: a regra do aviso de versão nova
  (src/app/aviso-de-versao.ts).

  - O build grava a própria versão no JS (`__VERSAO_DO_BUILD__`) e publica
    `/versao.json` com a mesma versão e as novidades visíveis (vite.config.js).
    A página aberta compara as duas: diferentes = há versão nova publicada.
  - "Tela antiga": uma chamada ao banco falhou do jeito que só falha quem está
    com a versão anterior aberta — função que não existe mais com aquela
    assinatura (PGRST202) ou a mensagem "recarregue a página" que algumas
    funções devolvem (22023/PT409). O sinal sai do `fetch` do cliente Supabase
    (src/lib/supabaseClient.ts), sem mudar a resposta para quem chamou.
*/

export const ARQUIVO_DA_VERSAO = "/versao.json";

/* Disparado em `globalThis` quando uma RPC falha como "tela antiga". */
export const EVENTO_TELA_ANTIGA = "agsus:tela-antiga";

export type VersaoPublicada = {
  versao: string;
  novidades: Novidade[];
};

export type SinalDeTelaAntiga = { rpc: string; codigo: string };

function ehNovidade(valor: unknown): valor is Novidade {
  if (!valor || typeof valor !== "object") return false;
  const n = valor as Record<string, unknown>;
  return (
    typeof n.id === "string" &&
    typeof n.data === "string" &&
    typeof n.texto === "string" &&
    n.texto.trim() !== "" &&
    n.visivel === true
  );
}

/** O `versao.json` como chegou; null quando não serve (vazio, HTML de erro…). */
export function lerVersaoPublicada(dados: unknown): VersaoPublicada | null {
  if (!dados || typeof dados !== "object") return null;
  const { versao, novidades } = dados as Record<string, unknown>;
  if (typeof versao !== "string" || !versao.trim()) return null;
  return {
    versao: versao.trim(),
    novidades: Array.isArray(novidades) ? novidades.filter(ehNovidade) : [],
  };
}

/**
 * O texto da novidade mais recente da versão publicada que a versão aberta
 * ainda não tem (marcada `visivel` aqui); null quando não há.
 */
export function novidadeParaMostrar(
  publicadas: readonly Novidade[],
  desteBuild: readonly Novidade[],
): string | null {
  const conhecidas = new Set(
    desteBuild.filter((n) => n.visivel).map((n) => n.id),
  );
  const nova = publicadas
    .filter((n) => n.visivel && !conhecidas.has(n.id))
    .toSorted((a, b) => b.data.localeCompare(a.data))[0];
  return nova ? nova.texto : null;
}

const RECARREGUE = /recarregue a p[aá]gina/i;
const CODIGOS_COM_MENSAGEM = new Set(["22023", "PT409"]);

/** O erro do PostgREST é o de quem está com a versão anterior da tela aberta. */
export function ehErroDeTelaAntiga(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  const { code, message } = erro as { code?: unknown; message?: unknown };
  if (code === "PGRST202") return true;
  return (
    typeof code === "string" &&
    CODIGOS_COM_MENSAGEM.has(code) &&
    typeof message === "string" &&
    RECARREGUE.test(message)
  );
}

/* "…/rest/v1/rpc/listar_abas?x=1" → "listar_abas"; outra rota → "". */
function nomeDaRpc(entrada: RequestInfo | URL): string {
  const url =
    typeof entrada === "string"
      ? entrada
      : entrada instanceof URL
        ? entrada.href
        : entrada.url;
  return /\/rest\/v1\/rpc\/([^/?#]+)/.exec(url)?.[1] ?? "";
}

/**
 * Envolve o `fetch` do cliente Supabase: a resposta volta igual para quem
 * chamou; uma RPC que falhou como "tela antiga" avisa `aoSinal` (lê uma cópia
 * do corpo, só nas respostas de erro).
 */
export function observarRespostasDoBanco(
  base: typeof fetch,
  aoSinal: (sinal: SinalDeTelaAntiga) => void,
): typeof fetch {
  return async (entrada, opcoes) => {
    const resposta = await base(entrada, opcoes);
    if (resposta.ok) return resposta;
    const rpc = nomeDaRpc(entrada);
    if (!rpc) return resposta;
    resposta
      .clone()
      .json()
      .then((corpo: unknown) => {
        if (ehErroDeTelaAntiga(corpo))
          aoSinal({ rpc, codigo: String((corpo as { code: unknown }).code) });
      })
      .catch(() => {
        // Corpo que não é JSON: não é o PostgREST falando.
      });
    return resposta;
  };
}
