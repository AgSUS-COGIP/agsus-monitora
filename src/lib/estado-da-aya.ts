/*
  O estado da mascote da Aya (a arara-azul), sem React: os estados, o evento
  global que qualquer tela usa para pedir um estado, a regra de qual estado
  aparece quando vários pedidos chegam juntos e os tempos (piscar, arrepiar,
  dormir). O desenho e as animações são de src/modulos/aya/mascote/.

  Pedir um estado de qualquer lugar (legado ou React):

    definirEstadoDaAya("comemorando", 3000);
    // ou: window.dispatchEvent(new CustomEvent("aya:estado",
    //       { detail: { estado: "comemorando", duracaoMs: 3000 } }));

  Sem duração, os estados de momento (comemorando, acenando) usam a duração
  padrão; os demais valem até o próximo pedido ("parada" limpa o pedido).
*/

export const ESTADOS_DA_MASCOTE = Object.freeze([
  "parada",
  "atenta",
  "falando",
  "pensando",
  "comemorando",
  "dormindo",
  "acenando",
] as const);

export type EstadoDaMascote = (typeof ESTADOS_DA_MASCOTE)[number];

export const EVENTO_ESTADO_DA_AYA = "aya:estado";

/* Estados de momento: sem duração no pedido, valem por este tempo. */
export const DURACAO_PADRAO_MS: Readonly<
  Partial<Record<EstadoDaMascote, number>>
> = Object.freeze({ comemorando: 3200, acenando: 2600 });

/* Sem mexer em nada por este tempo, a arara dorme. */
export const INATIVIDADE_PARA_DORMIR_MS = 3 * 60 * 1000;
/* O ponteiro a menos disto (px) do centro da arara a deixa atenta. */
export const RAIO_DE_ATENCAO_PX = 160;

/* Uma vez por sessão (aba): o aceno de boas-vindas. */
export const CHAVE_DO_ACENO = "agsus_monitora_aya_acenou_v1";
/*
  Preferência pessoal de desligar comemorações (neste navegador): "1" desliga.
  Com ela, a arara não comemora (fica parada) e os pedidos de "comemorando"
  são ignorados.
*/
export const CHAVE_COMEMORACOES_PESSOAIS =
  "agsus_monitora_comemoracoes_desligadas";

export interface PedidoDeEstado {
  estado: EstadoDaMascote;
  duracaoMs: number | null;
}

interface Armazenamento {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

export function ehEstadoDaMascote(valor: unknown): valor is EstadoDaMascote {
  return (
    typeof valor === "string" &&
    (ESTADOS_DA_MASCOTE as readonly string[]).includes(valor)
  );
}

/** Lê o pedido de um evento `aya:estado` (ou de argumentos soltos); inválido → null. */
export function lerPedido(
  estado: unknown,
  duracaoMs?: unknown,
): PedidoDeEstado | null {
  if (!ehEstadoDaMascote(estado)) return null;
  const numero = Number(duracaoMs);
  const informada =
    duracaoMs !== undefined &&
    duracaoMs !== null &&
    Number.isFinite(numero) &&
    numero > 0
      ? Math.min(numero, 60_000)
      : null;
  return { estado, duracaoMs: informada ?? DURACAO_PADRAO_MS[estado] ?? null };
}

/**
 * Pede um estado à mascote em toda a tela, pelo evento global `aya:estado`.
 * Devolve se o pedido saiu (estado válido e janela disponível).
 */
export function definirEstadoDaAya(
  estado: EstadoDaMascote,
  duracaoMs?: number,
  janela: (Window & typeof globalThis) | undefined = globalThis.window,
): boolean {
  const pedido = lerPedido(estado, duracaoMs);
  if (!pedido || !janela?.dispatchEvent) return false;
  const Evento = janela.CustomEvent || globalThis.CustomEvent;
  janela.dispatchEvent(
    new Evento(EVENTO_ESTADO_DA_AYA, {
      detail: { estado: pedido.estado, duracaoMs: pedido.duracaoMs },
    }),
  );
  return true;
}

export interface EntradaDoEstado {
  /** Estado imposto por quem monta (prévia, fogos): vence tudo. */
  fixo?: EstadoDaMascote | null;
  /** Pedido global (`aya:estado`) ainda valendo. */
  global?: EstadoDaMascote | null;
  /** O que o painel diz agora: falando, pensando… */
  proprio?: EstadoDaMascote | null;
  /** Estado de momento local (aceno de boas-vindas, atenção ao abrir). */
  momento?: EstadoDaMascote | null;
  perto?: boolean;
  dormindo?: boolean;
  comemoracoesDesligadas?: boolean;
}

/**
 * Qual estado a arara mostra, do mais forte ao mais fraco: fixo, pedido
 * global, o do painel, o de momento, atenta (ponteiro perto), dormindo e
 * parada. Comemorações desligadas: "comemorando" é ignorado.
 */
export function resolverEstado(entrada: EntradaDoEstado): EstadoDaMascote {
  const aceita = (estado: EstadoDaMascote | null | undefined) =>
    Boolean(estado) &&
    estado !== "parada" &&
    !(estado === "comemorando" && entrada.comemoracoesDesligadas);
  if (entrada.fixo) return aceita(entrada.fixo) ? entrada.fixo : "parada";
  for (const candidato of [entrada.global, entrada.proprio, entrada.momento])
    if (candidato && aceita(candidato)) return candidato;
  if (entrada.perto) return "atenta";
  if (entrada.dormindo) return "dormindo";
  return "parada";
}

/**
 * O que aparece de fato. Movimento reduzido: só o piscar — a arara fica
 * parada (dormindo continua de olhos fechados, sem o "z" subindo).
 */
export function estadoVisivel(
  estado: EstadoDaMascote,
  { reduzido = false }: { reduzido?: boolean } = {},
): EstadoDaMascote {
  if (!reduzido) return estado;
  return estado === "dormindo" ? "dormindo" : "parada";
}

type Sorteio = () => number;

const entre = (rng: Sorteio, minimo: number, maximo: number) => {
  const valor = Number(rng());
  const fracao = Number.isFinite(valor) ? Math.min(Math.max(valor, 0), 1) : 0.5;
  return Math.round(minimo + fracao * (maximo - minimo));
};

/** Espera até a próxima piscada: 3 a 7 s, sorteado. */
export const intervaloDaPiscada = (rng: Sorteio = Math.random) =>
  entre(rng, 3000, 7000);

/** Às vezes (de 9 a 16 s) as penas da cabeça arrepiam. */
export const intervaloDoArrepio = (rng: Sorteio = Math.random) =>
  entre(rng, 9000, 16000);

/** Às vezes a arara pisca duas vezes seguidas (1 em 5). */
export const piscadaDupla = (rng: Sorteio = Math.random) => Number(rng()) < 0.2;

/** Mostra o aceno agora? Uma vez por sessão; marca ao responder que sim. */
export function deveAcenar(armazenamento: Armazenamento | null | undefined) {
  try {
    if (!armazenamento) return false;
    if (armazenamento.getItem(CHAVE_DO_ACENO) === "1") return false;
    armazenamento.setItem(CHAVE_DO_ACENO, "1");
    return true;
  } catch {
    return false;
  }
}

export function comemoracoesPessoaisDesligadas(
  armazenamento: Pick<Armazenamento, "getItem"> | null | undefined,
) {
  try {
    return armazenamento?.getItem(CHAVE_COMEMORACOES_PESSOAIS) === "1";
  } catch {
    return false;
  }
}

/** Para onde o olho olha (−1 a 1 em cada eixo), do centro da arara ao ponteiro. */
export function direcaoDoOlhar(
  centro: { x: number; y: number },
  ponteiro: { x: number; y: number },
  alcance = RAIO_DE_ATENCAO_PX,
) {
  const dx = ponteiro.x - centro.x;
  const dy = ponteiro.y - centro.y;
  const distancia = Math.hypot(dx, dy);
  if (!distancia) return { x: 0, y: 0, distancia: 0 };
  const forca = Math.min(1, distancia / Math.max(alcance, 1));
  return {
    x: Number(((dx / distancia) * forca).toFixed(3)),
    y: Number(((dy / distancia) * forca).toFixed(3)),
    distancia,
  };
}
