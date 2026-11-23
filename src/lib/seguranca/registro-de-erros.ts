/*
  Registro dos erros do navegador, sem DOM: a referência, a limpeza, o tipo, a
  janela de repetição e o pedido à RPC `registrar_erro_da_aplicacao`. Quem
  escuta os erros e manda é src/app/registro-de-erros.ts.

  O desenho vem do SIGAV: cada erro ganha uma referência opaca (UUID), que a
  pessoa vê curta ("Código do erro: 3F2A9C1B") e passa ao suporte; o texto sai
  daqui sem dado pessoal e o banco limpa de novo (private."FC_LIMPAR_TEXTO_ERRO",
  migration 20261123150000). As duas limpezas são a mesma: o teste do banco
  compara uma com a outra.
*/

export const TIPOS_DE_ERRO = [
  "CLIENTE",
  "SERVIDOR",
  "REDE",
  "BANCO",
  "DESCONHECIDO",
] as const;
export type TipoDeErro = (typeof TIPOS_DE_ERRO)[number];

/** O mesmo erro (tipo, rota, mensagem, status) não vai de novo antes disto. */
export const JANELA_DA_REPETICAO_MS = 30_000;
export const LIMITE_DA_MENSAGEM = 500;
export const LIMITE_DA_ROTA = 200;
export const LIMITE_DO_CONTEXTO = 1500;

type Gerador = {
  randomUUID?: () => string;
  getRandomValues?: <T extends Uint8Array>(lista: T) => T;
};

/** 32 dígitos hexadecimais no formato do UUID v4. */
function formatarComoUuid(hex: string): string {
  const h = hex.padEnd(32, "0").slice(0, 32).split("");
  h[12] = "4";
  h[16] = "89ab"[Number.parseInt(h[16] ?? "0", 16) % 4] ?? "8";
  const t = h.join("");
  return `${t.slice(0, 8)}-${t.slice(8, 12)}-${t.slice(12, 16)}-${t.slice(16, 20)}-${t.slice(20)}`;
}

/**
 * A referência do erro: `crypto.randomUUID()`; sem ele (navegador antigo, http),
 * um UUID montado com `getRandomValues` ou, no último caso, com o relógio e
 * `Math.random`. Sempre minúsculas, letras, dígitos e hífen.
 */
export function criarReferenciaDoErro(
  gerador: Gerador | undefined = globalThis.crypto,
): string {
  try {
    const uuid = gerador?.randomUUID?.();
    if (typeof uuid === "string" && /^[0-9a-f-]{36}$/i.test(uuid))
      return uuid.toLowerCase();
  } catch {
    // segue para o próximo jeito
  }
  try {
    if (gerador?.getRandomValues) {
      const bytes = gerador.getRandomValues(new Uint8Array(16));
      return formatarComoUuid(
        Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""),
      );
    }
  } catch {
    // segue para o último jeito
  }
  const relogio = Date.now().toString(16).padStart(12, "0");
  let resto = "";
  while (resto.length < 20)
    resto += Math.floor(Math.random() * 16).toString(16);
  return formatarComoUuid(relogio + resto);
}

/** O começo da referência que a pessoa vê e passa ao suporte. */
export function referenciaCurta(referencia: string): string {
  return referencia.replace(/-/g, "").slice(0, 8).toUpperCase();
}

const SUBSTITUICOES: ReadonlyArray<readonly [RegExp, string]> = [
  // eslint-disable-next-line no-control-regex -- tira caracteres de controle
  [/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " "],
  [/(bearer)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [token]"],
  [/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)?/g, "[token]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[e-mail]"],
  [/[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}/g, "[número]"],
  [/\(?[0-9]{2}\)?\s?[0-9]{4,5}-[0-9]{4}/g, "[número]"],
  [/[0-9]{5,}/g, "[número]"],
];

/**
 * Tira do texto o que pode ser dado pessoal ou segredo: token (Bearer e JWT),
 * e-mail, CPF com pontuação, telefone e qualquer sequência de 5 ou mais
 * dígitos; corta no limite. A mesma regra de private."FC_LIMPAR_TEXTO_ERRO".
 */
export function limparTextoDoErro(
  texto: unknown,
  limite = LIMITE_DA_MENSAGEM,
): string {
  let limpo = String(texto ?? "").slice(0, 20_000);
  for (const [padrao, troca] of SUBSTITUICOES)
    limpo = limpo.replace(padrao, troca);
  // Como o btrim e o left do banco: só espaços nas pontas; corte por caractere.
  return Array.from(limpo.replace(/^ +| +$/g, ""))
    .slice(0, Math.min(Math.max(limite, 1), 4000))
    .join("");
}

/** Só o caminho da página, sem consulta nem âncora (os filtros podem ter nome). */
export function rotaDoErro(caminho: unknown): string {
  const semConsulta = String(caminho ?? "")
    .split("?")[0]
    ?.split("#")[0];
  return limparTextoDoErro(semConsulta, LIMITE_DA_ROTA);
}

/** Endereço de arquivo de script: só o caminho (sem origem nem consulta). */
export function arquivoDoErro(endereco: unknown): string {
  const texto = String(endereco ?? "").trim();
  if (!texto) return "";
  try {
    const url = new URL(texto);
    if (url.protocol === "http:" || url.protocol === "https:")
      return rotaDoErro(url.pathname);
    return url.protocol;
  } catch {
    return rotaDoErro(texto);
  }
}

export type ErroLido = {
  mensagem: string;
  pilha: string;
  nome: string;
  codigo: string;
  status: number | null;
};

const CODIGO_DO_BANCO = /^(PGRST\d{3}|[0-9A-Z]{5})$/;
const FALHA_DE_REDE =
  /failed to fetch|networkerror|load failed|network request failed|err_internet_disconnected|err_network/i;

/** Lê o que importa de qualquer coisa lançada (Error, erro do PostgREST, texto…). */
export function lerErro(erro: unknown): ErroLido {
  if (erro && typeof erro === "object") {
    const e = erro as Record<string, unknown>;
    const status =
      typeof e.status === "number" &&
      Number.isInteger(e.status) &&
      e.status >= 100 &&
      e.status <= 599
        ? e.status
        : null;
    return {
      mensagem: typeof e.message === "string" ? e.message : String(erro),
      pilha: typeof e.stack === "string" ? e.stack : "",
      nome: typeof e.name === "string" ? e.name : "",
      codigo:
        typeof e.code === "string" && e.code.length <= 12
          ? e.code.toUpperCase()
          : "",
      status,
    };
  }
  return {
    mensagem: erro === undefined || erro === null ? "" : String(erro),
    pilha: "",
    nome: "",
    codigo: "",
    status: null,
  };
}

/**
 * O tipo do erro: sem rede, ou falha de rede, é REDE; resposta 5xx é
 * SERVIDOR; código do PostgREST/PostgreSQL é BANCO; um Error do código é
 * CLIENTE; o resto, DESCONHECIDO.
 */
export function tipoDoErro(erro: ErroLido, online: boolean): TipoDeErro {
  if (!online || FALHA_DE_REDE.test(erro.mensagem)) return "REDE";
  if (erro.status !== null && erro.status >= 500) return "SERVIDOR";
  if (CODIGO_DO_BANCO.test(erro.codigo)) return "BANCO";
  if (erro.nome || erro.pilha) return "CLIENTE";
  return "DESCONHECIDO";
}

/**
 * Lembra o que já foi mandado: o mesmo erro (a chave) só vai de novo depois da
 * janela. Devolve a referência do registro anterior quando é repetição (a
 * pessoa vê o código do que foi gravado), ou null quando é para mandar. Uma
 * por página (src/app/registro-de-erros.ts).
 */
export function criarJanelaDaRepeticao(janelaMs = JANELA_DA_REPETICAO_MS) {
  const vistos = new Map<string, { quando: number; referencia: string }>();
  return (chave: string, agora: number, referencia: string): string | null => {
    for (const [k, visto] of vistos)
      if (agora - visto.quando >= janelaMs) vistos.delete(k);
    const anterior = vistos.get(chave);
    if (anterior) return anterior.referencia;
    vistos.set(chave, { quando: agora, referencia });
    return null;
  };
}

export type Ocorrencia = {
  erro: unknown;
  /** De onde veio: "janela", "promessa", "tela"… */
  origem: string;
  rota: string;
  online: boolean;
  /** Mensagem do evento, quando o erro em si não tem (ErrorEvent.message). */
  mensagem?: string | undefined;
  arquivo?: string | undefined;
  linha?: number | undefined;
  coluna?: number | undefined;
  /** O nome da parte da tela (ErrorBoundary). */
  parte?: string | undefined;
  versao?: string | null | undefined;
  area?: string | null | undefined;
};

export type PedidoDoRegistro = {
  p_referencia: string;
  p_tipo: TipoDeErro;
  p_mensagem: string;
  p_rota: string;
  p_contexto: Record<string, string | number | boolean>;
  p_versao: string | null;
  p_area: string | null;
  p_status: number | null;
};

const PILHA_LINHAS = 8;

/** A pilha curta: as primeiras linhas, sem a origem dos endereços. */
function pilhaCurta(pilha: string): string {
  return limparTextoDoErro(
    pilha
      .split("\n")
      .slice(0, PILHA_LINHAS)
      .map((linha) => linha.replace(/https?:\/\/[^/\s)]+/g, "").trim())
      .join("\n"),
    LIMITE_DO_CONTEXTO,
  );
}

const numeroPequeno = (n: unknown): number | undefined =>
  typeof n === "number" && Number.isInteger(n) && n >= 0 && n < 100_000
    ? n
    : undefined;

/** Os argumentos de `registrar_erro_da_aplicacao`, já limpos. */
export function montarPedidoDoRegistro(
  ocorrencia: Ocorrencia,
  referencia: string,
): PedidoDoRegistro {
  const lido = lerErro(ocorrencia.erro);
  const mensagem =
    limparTextoDoErro(lido.mensagem || ocorrencia.mensagem || "") ||
    "(sem mensagem)";
  const contexto: Record<string, string | number | boolean> = {
    origem: limparTextoDoErro(ocorrencia.origem, 40),
    online: ocorrencia.online,
  };
  const arquivo = arquivoDoErro(ocorrencia.arquivo);
  if (arquivo) contexto.arquivo = arquivo;
  const linha = numeroPequeno(ocorrencia.linha);
  if (linha !== undefined) contexto.linha = linha;
  const coluna = numeroPequeno(ocorrencia.coluna);
  if (coluna !== undefined) contexto.coluna = coluna;
  if (lido.nome) contexto.nome = limparTextoDoErro(lido.nome, 80);
  if (lido.codigo) contexto.codigo = limparTextoDoErro(lido.codigo, 12);
  if (ocorrencia.parte)
    contexto.parte = limparTextoDoErro(ocorrencia.parte, 120);
  const pilha = pilhaCurta(lido.pilha);
  if (pilha) contexto.pilha = pilha;
  const versao = String(ocorrencia.versao ?? "").trim();
  const area = String(ocorrencia.area ?? "").trim();
  return {
    p_referencia: referencia,
    p_tipo: tipoDoErro(lido, ocorrencia.online),
    p_mensagem: mensagem,
    p_rota: rotaDoErro(ocorrencia.rota),
    p_contexto: contexto,
    p_versao: /^[A-Za-z0-9._-]{1,64}$/.test(versao) ? versao : null,
    p_area: /^[a-z-]{1,40}$/.test(area) ? area : null,
    p_status: lido.status,
  };
}

/** A chave da repetição: tipo, rota, mensagem e status (como o banco). */
export function chaveDaRepeticao(pedido: PedidoDoRegistro): string {
  return [
    pedido.p_tipo,
    pedido.p_rota,
    pedido.p_mensagem,
    pedido.p_status ?? "",
  ].join("|");
}

/**
 * Erro que não vale registrar: sem informação nenhuma ("Script error." de
 * script de outra origem), de extensão do navegador, ou o aviso do
 * ResizeObserver (inofensivo).
 */
export function ehRuido(ocorrencia: Ocorrencia): boolean {
  const arquivo = String(ocorrencia.arquivo ?? "");
  if (/^(chrome|moz|safari)(-web)?-extension:/i.test(arquivo)) return true;
  const { mensagem: doErro, pilha } = lerErro(ocorrencia.erro);
  const mensagem = doErro || String(ocorrencia.mensagem ?? "");
  if (/(chrome|moz|safari)(-web)?-extension:\/\//i.test(pilha)) return true;
  if (/^script error\.?$/i.test(mensagem.trim())) return true;
  return /ResizeObserver loop/i.test(mensagem);
}
