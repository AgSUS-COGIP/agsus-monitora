import { normalizarDuracao } from "../../lib/motor-de-efeitos.ts";
import { razaoDeContraste } from "../../lib/contraste.ts";
import type { PlanoDaComemoracao } from "./plano.ts";

/*
  O letreiro da comemoração (a frase do marco, ex.: "Parabéns!") como texto
  de verdade, sem DOM e sem React: quando aparece, o tamanho da fonte, o
  atraso de cada letra e as cores da placa. Quem desenha é `Letreiro`
  (letreiro.tsx).

  Antes, a frase era escrita com faíscas dos fogos, em pontinhos — sobre a
  tela clara e com confete por cima, ficava ilegível. Agora a leitura vem
  primeiro: letra cheia, peso 800, branca sobre uma placa escura
  translúcida, por cima das partículas.
*/

/* Até 14 caracteres: cabe numa linha, em qualquer tela. */
export const TAMANHO_MAXIMO_DO_LETREIRO = 14;

/** O texto do letreiro, limpo e curto; vazio, null. */
export function textoDoLetreiro(texto: unknown): string | null {
  const limpo = String(texto ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TAMANHO_MAXIMO_DO_LETREIRO)
    .trim();
  return limpo || null;
}

/**
 * O letreiro aparece? Só com texto e fora do Suave (o Suave é discreto: só
 * o aviso e o efeito).
 */
export function mostrarLetreiro(
  plano: Pick<PlanoDaComemoracao, "letreiro" | "intensidade"> | null,
): boolean {
  if (!plano || !textoDoLetreiro(plano.letreiro)) return false;
  return plano.intensidade !== "suave" && plano.intensidade !== "pequeno";
}

// ── Tempo ───────────────────────────────────────────────────────────────────

/* Entrada (letra a letra), leitura mínima com a frase parada e saída (s). */
export const ENTRADA_DO_LETREIRO = 0.8;
export const LEITURA_MINIMA = 2.6;
export const SAIDA_DO_LETREIRO = 0.6;
/* Atraso entre uma letra e a próxima, e o teto da soma (s). */
export const ATRASO_POR_LETRA = 0.045;
export const ATRASO_MAXIMO = 0.5;

export interface TempoDoLetreiro {
  /** Quando começa a entrar (s, desde o início do efeito). */
  inicio: number;
  /** Quando começa a sair. */
  saida: number;
  /** Quando some de vez. */
  fim: number;
}

/**
 * A duração do efeito (s) pelo plano: a pedida ou a padrão (fogos ~5,5 s,
 * nunca abaixo de 4 s; os outros, 5 s). Basta a estimativa: o letreiro
 * tem a leitura mínima garantida.
 */
export function duracaoDoEfeito(
  plano: Pick<PlanoDaComemoracao, "efeito" | "duracaoMs">,
): number {
  const comFogos = plano.efeito === "fogos" || plano.efeito === "combinado";
  const pedida = normalizarDuracao(plano.duracaoMs);
  if (pedida) return Math.max(comFogos ? 4 : 0, pedida / 1000);
  return comFogos ? 5.5 : 5;
}

/**
 * Quando o letreiro entra e sai: no clímax do efeito (fogos, perto do
 * grande final; os outros, logo depois da abertura), saindo antes do fim do
 * efeito — mas sempre com LEITURA_MINIMA de frase parada, mesmo que passe
 * do efeito. Com menos movimento, entra logo e fica o mesmo tempo.
 */
export function tempoDoLetreiro({
  duracao,
  efeito,
  reduzido = false,
}: {
  duracao: number;
  efeito?: string | null;
  reduzido?: boolean;
}): TempoDoLetreiro {
  const comFogos = efeito === "fogos" || efeito === "combinado";
  const preferido = reduzido ? 0.2 : duracao * (comFogos ? 0.38 : 0.18);
  const saidaDoEfeito = duracao - 0.15 - SAIDA_DO_LETREIRO;
  const inicio = reduzido
    ? preferido
    : Math.max(
        0.3,
        Math.min(
          preferido,
          saidaDoEfeito - ENTRADA_DO_LETREIRO - LEITURA_MINIMA,
        ),
      );
  const saida = Math.max(
    saidaDoEfeito,
    inicio + ENTRADA_DO_LETREIRO + LEITURA_MINIMA,
  );
  return { inicio, saida, fim: saida + SAIDA_DO_LETREIRO };
}

export type FaseDoLetreiro = "antes" | "entrando" | "saindo" | "fim";

/** A fase em `t` s. */
export function faseDoLetreiro(
  t: number,
  tempo: TempoDoLetreiro,
): FaseDoLetreiro {
  if (t < tempo.inicio) return "antes";
  if (t < tempo.saida) return "entrando";
  if (t < tempo.fim) return "saindo";
  return "fim";
}

// ── Layout ──────────────────────────────────────────────────────────────────

/* Largura média de um caractere em peso 800, em em (medida da fonte do sistema). */
const LARGURA_DO_CARACTERE_EM = 0.62;
/* A frase ocupa até esta fração da largura da tela. */
const OCUPACAO_MAXIMA = 0.86;
export const FONTE_MINIMA_PX = 30;
export const FONTE_MAXIMA_PX = 112;

export interface LetraDoLetreiro {
  letra: string;
  /** Atraso da entrada (s). */
  atraso: number;
  espaco: boolean;
}

export interface LayoutDoLetreiro {
  texto: string;
  letras: LetraDoLetreiro[];
  /** O tamanho da fonte (CSS clamp: mínimo, pela largura da tela, máximo). */
  fonte: string;
  /** A fração da largura da tela (vw) do meio do clamp. */
  vw: number;
}

/**
 * O layout do letreiro: as letras com o atraso de cada uma (da esquerda
 * para a direita, ATRASO_POR_LETRA cada, somando até ATRASO_MAXIMO) e a
 * fonte responsiva — quanto mais curta a frase, maior, sem passar de
 * OCUPACAO_MAXIMA da largura da tela.
 */
export function layoutDoLetreiro(texto: unknown): LayoutDoLetreiro | null {
  const limpo = textoDoLetreiro(texto);
  if (!limpo) return null;
  const letras = Array.from(limpo);
  const passo = Math.min(
    ATRASO_POR_LETRA,
    letras.length > 1 ? ATRASO_MAXIMO / (letras.length - 1) : 0,
  );
  const vw =
    Math.round(
      ((OCUPACAO_MAXIMA * 100) /
        (Math.max(4, letras.length) * LARGURA_DO_CARACTERE_EM)) *
        10,
    ) / 10;
  return {
    texto: limpo,
    letras: letras.map((letra, i) => ({
      letra,
      atraso: Math.round(i * passo * 1000) / 1000,
      espaco: letra === " ",
    })),
    fonte: `clamp(${FONTE_MINIMA_PX}px, ${vw}vw, ${FONTE_MAXIMA_PX}px)`,
    vw,
  };
}

/**
 * Cabe na tela? A largura estimada (px) da frase com a fonte do clamp numa
 * tela de `largura` px.
 */
export function larguraDoLetreiro(
  layout: LayoutDoLetreiro,
  largura: number,
): number {
  const fonte = Math.min(
    FONTE_MAXIMA_PX,
    Math.max(FONTE_MINIMA_PX, (layout.vw / 100) * largura),
  );
  return layout.letras.length * LARGURA_DO_CARACTERE_EM * fonte;
}

// ── Cores (contraste) ───────────────────────────────────────────────────────

/*
  A placa é escura e translúcida nos dois temas; o texto, branco com um
  degradê dourado claro. A conta do contraste usa o pior fundo (branco no
  tema claro, para a placa; preto não piora texto claro).
*/
export const CORES_DO_LETREIRO = Object.freeze({
  placa: "#0b1530",
  alfaDaPlaca: 0.8,
  texto: "#ffffff",
  destaque: "#ffe08a",
  contorno: "#0b1530",
});

const canais = (cor: string): [number, number, number] => [
  parseInt(cor.slice(1, 3), 16),
  parseInt(cor.slice(3, 5), 16),
  parseInt(cor.slice(5, 7), 16),
];
const hex = (valor: number) =>
  Math.round(Math.min(255, Math.max(0, valor)))
    .toString(16)
    .padStart(2, "0");

/** A cor de `frente` (hex) com `alfa` sobre `fundo` (hex). */
export function corComposta(
  frente: string,
  alfa: number,
  fundo: string,
): string {
  const f = canais(frente);
  const b = canais(fundo);
  return `#${f.map((c, i) => hex(c * alfa + b[i]! * (1 - alfa))).join("")}`;
}

/**
 * O menor contraste do letreiro (texto e destaque) sobre a placa, com a
 * placa por cima de cada fundo dado (hex).
 */
export function contrasteDoLetreiro(
  fundos: readonly string[] = ["#ffffff", "#000000"],
  cores = CORES_DO_LETREIRO,
): number {
  let menor = Infinity;
  for (const fundo of fundos) {
    const placa = corComposta(cores.placa, cores.alfaDaPlaca, fundo);
    for (const texto of [cores.texto, cores.destaque])
      menor = Math.min(menor, razaoDeContraste(texto, placa));
  }
  return menor;
}
