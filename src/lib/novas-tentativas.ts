/*
  Novas tentativas automáticas das chamadas ao Supabase — a regra única.

  Antes, quem repetia uma chamada era o próprio postgrest-js (GET, 3 vezes,
  1 s → 2 s → 4 s, sem sorteio e sem teto para o `Retry-After`): numa queda,
  todas as abas abertas voltavam ao banco no mesmo segundo. Agora o cliente
  único (src/lib/supabaseClient.ts) desliga a repetição da biblioteca
  (`db.retry: false`) e passa todo `fetch` do banco por `comNovasTentativas`:

  - só repete o que é seguro repetir: leitura (GET/HEAD/OPTIONS) que falhou
    na rede ou voltou com status passageiro (408, 429, 502, 503, 504, 520).
    Gravação (POST/PATCH/DELETE, inclusive RPC) nunca é repetida às cegas;
  - a espera cresce (base × 2ⁿ) até o teto, com metade sorteada — abas
    diferentes não voltam juntas; `Retry-After` maior que o teto não é
    esperado: a resposta volta para quem chamou;
  - limite de tentativas por chamada e um orçamento comum a todas as chamadas
    (N novas tentativas por janela): com o banco fora, ninguém fica em laço;
  - token vencido (401 PGRST301/PGRST303 ou "JWT expired"): renova a sessão
    uma vez e reenvia a mesma chamada — o PostgREST recusa antes de executar,
    então vale para gravação também;
  - cancelamento (AbortError/TimeoutError) e chamadas fora do banco (Auth,
    Realtime, Edge Functions, que têm a própria regra) passam direto.

  Sem estado global: o orçamento nasce em `criarOrcamento` e quem cria o
  cliente guarda a instância.
*/

export type PoliticaDeNovasTentativas = Readonly<{
  /** Tentativas por chamada, contando a primeira. */
  maximoDeTentativas: number;
  /** Espera antes da primeira nova tentativa (a média fica entre metade e o valor). */
  baseMs: number;
  /** Maior espera aceita, inclusive a pedida pelo servidor (`Retry-After`). */
  tetoMs: number;
  /** Novas tentativas somadas de todas as chamadas, por janela. */
  novasPorJanela: number;
  janelaMs: number;
}>;

export const POLITICA_PADRAO: PoliticaDeNovasTentativas = Object.freeze({
  maximoDeTentativas: 3,
  baseMs: 500,
  tetoMs: 8000,
  novasPorJanela: 8,
  janelaMs: 30_000,
});

export const STATUS_PASSAGEIROS: ReadonlySet<number> = new Set([
  408, 429, 502, 503, 504, 520,
]);

const METODOS_IDEMPOTENTES = new Set(["GET", "HEAD", "OPTIONS"]);

/* Os serviços do Supabase cujas chamadas passam por esta regra. */
const CAMINHOS_DO_BANCO = /\/(rest|storage)\/v1\//;

/**
 * Espera antes da `n`-ésima nova tentativa (1 = a primeira): metade fixa,
 * metade sorteada, dobrando a cada vez até o teto.
 */
export function esperaAntesDaTentativa(
  n: number,
  politica: Pick<
    PoliticaDeNovasTentativas,
    "baseMs" | "tetoMs"
  > = POLITICA_PADRAO,
  sorteio: () => number = Math.random,
): number {
  const expoente = Math.max(0, Math.floor(n) - 1);
  const limite = Math.min(politica.tetoMs, politica.baseMs * 2 ** expoente);
  return Math.round(limite / 2 + sorteio() * (limite / 2));
}

/** `Retry-After` em ms (segundos ou data HTTP); null se ausente ou ilegível. */
export function esperaPedidaPeloServidor(
  valor: string | null | undefined,
  agora: number = Date.now(),
): number | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  if (/^\d+$/.test(texto)) return Number(texto) * 1000;
  const quando = Date.parse(texto);
  return Number.isFinite(quando) ? Math.max(0, quando - agora) : null;
}

export function ehMetodoIdempotente(metodo: string | null | undefined) {
  return METODOS_IDEMPOTENTES.has(String(metodo || "GET").toUpperCase());
}

export function ehChamadaDoBanco(url: string) {
  return CAMINHOS_DO_BANCO.test(url);
}

/** 401 do PostgREST por token vencido (não por falta de permissão). */
export function ehTokenVencido(corpo: unknown): boolean {
  if (!corpo || typeof corpo !== "object") return false;
  const { code, message } = corpo as { code?: unknown; message?: unknown };
  if (code === "PGRST301" || code === "PGRST303") return true;
  return /jwt expired/i.test(String(message ?? ""));
}

/** Orçamento comum: no máximo `novasPorJanela` novas tentativas a cada `janelaMs`. */
export function criarOrcamento(
  politica: Pick<
    PoliticaDeNovasTentativas,
    "novasPorJanela" | "janelaMs"
  > = POLITICA_PADRAO,
  agora: () => number = Date.now,
) {
  let gastas: number[] = [];
  return {
    gastar(): boolean {
      const momento = agora();
      gastas = gastas.filter((quando) => momento - quando < politica.janelaMs);
      if (gastas.length >= politica.novasPorJanela) return false;
      gastas.push(momento);
      return true;
    },
  };
}

export type Orcamento = ReturnType<typeof criarOrcamento>;

function foiCancelada(erro: unknown, sinal?: AbortSignal | null) {
  if (sinal?.aborted) return true;
  const nome = (erro as { name?: unknown } | null)?.name;
  return nome === "AbortError" || nome === "TimeoutError";
}

function esperarPadrao(ms: number, sinal?: AbortSignal | null) {
  return new Promise<void>((pronto, falhar) => {
    if (sinal?.aborted) {
      falhar(sinal.reason);
      return;
    }
    const relogio = setTimeout(() => {
      sinal?.removeEventListener("abort", aoCancelar);
      pronto();
    }, ms);
    function aoCancelar() {
      clearTimeout(relogio);
      falhar(sinal!.reason);
    }
    sinal?.addEventListener("abort", aoCancelar, { once: true });
  });
}

function urlDe(entrada: RequestInfo | URL) {
  if (typeof entrada === "string") return entrada;
  if (entrada instanceof URL) return entrada.href;
  return entrada.url;
}

function bearerDe(cabecalhos: HeadersInit | undefined) {
  if (!cabecalhos) return "";
  const valor = new Headers(cabecalhos).get("Authorization") || "";
  return valor.replace(/^Bearer\s+/i, "");
}

/* Corpo que dá para mandar de novo (o de leitura única, não). */
function corpoReenviavel(corpo: BodyInit | null | undefined) {
  return !(
    typeof ReadableStream !== "undefined" && corpo instanceof ReadableStream
  );
}

export type OpcoesDasNovasTentativas = {
  politica?: PoliticaDeNovasTentativas;
  orcamento?: Orcamento;
  /**
   * Token novo depois de um 401 por token vencido (o antigo vem para quem
   * renova não renovar duas vezes); null quando não há sessão a renovar.
   */
  renovarToken?: (antigo: string) => Promise<string | null>;
  esperar?: (ms: number, sinal?: AbortSignal | null) => Promise<void>;
  sorteio?: () => number;
  agora?: () => number;
};

/** O `fetch` do cliente com a regra de novas tentativas (ver o topo). */
export function comNovasTentativas(
  base: typeof fetch,
  {
    politica = POLITICA_PADRAO,
    orcamento = criarOrcamento(politica),
    renovarToken = async () => null,
    esperar = esperarPadrao,
    sorteio = Math.random,
    agora = Date.now,
  }: OpcoesDasNovasTentativas = {},
): typeof fetch {
  return async (entrada, opcoes) => {
    if (!ehChamadaDoBanco(urlDe(entrada))) return base(entrada, opcoes);
    const pedido = entrada instanceof Request ? entrada : null;
    const metodo = opcoes?.method || pedido?.method || "GET";
    const sinal = opcoes?.signal ?? pedido?.signal ?? null;
    const idempotente = ehMetodoIdempotente(metodo);
    let atuais = opcoes;
    let novas = 0;
    let renovou = false;

    const podeTentarDeNovo = () =>
      idempotente &&
      novas + 1 < politica.maximoDeTentativas &&
      orcamento.gastar();

    for (;;) {
      let resposta: Response;
      try {
        resposta = await base(entrada, atuais);
      } catch (erro) {
        if (foiCancelada(erro, sinal) || !podeTentarDeNovo()) throw erro;
        novas += 1;
        await esperar(esperaAntesDaTentativa(novas, politica, sorteio), sinal);
        continue;
      }

      if (resposta.status === 401) {
        const antigo = bearerDe(atuais?.headers);
        if (renovou || pedido || !antigo || !corpoReenviavel(atuais?.body))
          return resposta;
        const corpo = await resposta
          .clone()
          .json()
          .catch(() => null);
        if (!ehTokenVencido(corpo)) return resposta;
        renovou = true;
        const novo = await renovarToken(antigo).catch(() => null);
        if (!novo || novo === antigo) return resposta;
        const cabecalhos = new Headers(atuais?.headers);
        cabecalhos.set("Authorization", `Bearer ${novo}`);
        atuais = { ...atuais, headers: cabecalhos };
        continue;
      }

      if (!STATUS_PASSAGEIROS.has(resposta.status)) return resposta;
      const pedida = esperaPedidaPeloServidor(
        resposta.headers.get("Retry-After"),
        agora(),
      );
      // O servidor pede mais do que o teto: quem chamou decide.
      if (pedida !== null && pedida > politica.tetoMs) return resposta;
      if (!podeTentarDeNovo()) return resposta;
      novas += 1;
      await resposta.text().catch(() => "");
      await esperar(
        pedida ?? esperaAntesDaTentativa(novas, politica, sorteio),
        sinal,
      );
    }
  };
}
