/*
  Motor de efeitos das comemorações, sem DOM: monta a CENA de um efeito
  (fogos, confete, serpentina, chuva de estrelas, corações, balões, a Aya
  comemorando ou o combinado), avança a física quadro a quadro e desenha as
  partículas num contexto 2D recebido. Quem cria o <canvas>, chama
  requestAnimationFrame, pausa com a aba oculta e limpa ao fim é
  src/modulos/comemoracao/comemoracoes.tsx (`Fogos`).

  Os fogos continuam sendo o show de src/lib/fogos.ts (roteiro, rastro de
  subida, estouros em camadas, cintilação, gravidade, fumaça e o marco
  desenhado no céu); a cena só o embute. Os outros efeitos (confete,
  serpentina, estrelas, corações, balões) são de src/lib/particulas-do-motor.ts:
  o roteiro (abertura, clímax, dispersão), a física com profundidade e o
  desenho.

  Desempenho: teto de partículas (LIMITE_DO_MOTOR, além do teto dos fogos),
  passo máximo de simulação (aba que volta do fundo não "pula") e tudo some
  sozinho até o fim da duração. Sorteio por `aleatorio` (criarAleatorio de
  fogos.ts nos testes): a mesma semente e os mesmos passos dão a mesma cena.

  Unidades: tempo em s, posição em px CSS, velocidade em px/s.
*/

import {
  avancarShow,
  criarShow,
  escalaDaTela,
  fatorDeFaiscas,
  fatorDeSaida,
  INTENSIDADES,
  paletaDosFogos,
  PASSO_MAXIMO_S,
  showAcabou,
} from "./fogos.ts";
import type { Aleatorio, PaletaDosFogos, ShowDeFogos } from "./fogos.ts";
import {
  desenharParticulas,
  moverParticulaDoMotor,
  lotesDaPeca,
  nascerLote,
} from "./particulas-do-motor.ts";
import type { LoteDoMotor, ParticulaDoMotor } from "./particulas-do-motor.ts";
import type { AmostrarTexto } from "./fogos-formas.ts";
import {
  DURACAO_MAXIMA_MS,
  DURACAO_MINIMA_MS,
  DURACAO_PADRAO_MS,
  EFEITOS,
  NIVEIS,
} from "./efeitos-das-comemoracoes.ts";
import type { NomeDoEfeito, NomeDoNivel } from "./efeitos-das-comemoracoes.ts";

export {
  DURACAO_MAXIMA_MS,
  DURACAO_MINIMA_MS,
  DURACAO_PADRAO_MS,
  EFEITOS,
  NIVEIS,
  ROTULOS_DOS_EFEITOS,
  ROTULOS_DOS_NIVEIS,
} from "./efeitos-das-comemoracoes.ts";
export type { NomeDoEfeito, NomeDoNivel } from "./efeitos-das-comemoracoes.ts";
export {
  brilhoDoMotor,
  moverParticulaDoMotor,
  nascerLote,
} from "./particulas-do-motor.ts";
export type {
  CenaParaNascer,
  CometaDoMotor,
  ConfeteDoMotor,
  EstrelaDoMotor,
  FlutuanteDoMotor,
  LoteDoMotor,
  ParticulaDoMotor,
  SerpentinaDoMotor,
} from "./particulas-do-motor.ts";

/**
 * Evento ainda não tocado (som): estouro, lançamento que assobia e o confete
 * da Aya (dos fogos), ou o tiro de um canhão do motor.
 */
export interface EventoDaCena {
  tipo: "estouro" | "lancamento" | "confete";
  formato: string;
  papel: string;
  x?: number;
  y?: number;
  subida?: number;
}

export interface CenaDeEfeitos {
  t: number;
  duracao: number;
  efeito: NomeDoEfeito;
  intensidade: NomeDoNivel;
  componentes: readonly string[];
  show: ShowDeFogos | null;
  lotes: LoteDoMotor[];
  proximo: number;
  particulas: ParticulaDoMotor[];
  limite: number;
  aleatorio: Aleatorio;
  largura: number;
  altura: number;
  escala: number;
  paleta: PaletaDosFogos;
  comVeu: boolean;
  chamaAya: boolean;
  /** Desenha partículas do motor: tem lotes ou a Aya dança (e solta confete). */
  usaMotor: boolean;
  eventos: EventoDaCena[];
}
/* Os nomes antigos das intensidades dos fogos, no nível equivalente. */
const NIVEL_DOS_FOGOS: Readonly<Record<string, NomeDoNivel>> = Object.freeze({
  pequeno: "suave",
  cheio: "normal",
  fogos: "normal",
  festa: "festa",
});

/** O nível (suave, normal, festa) de uma intensidade nova ou antiga. */
export const nivelDaIntensidade = (intensidade: unknown): NomeDoNivel =>
  Object.hasOwn(NIVEIS, intensidade as PropertyKey)
    ? (intensidade as NomeDoNivel)
    : (NIVEL_DOS_FOGOS as Readonly<Record<string, NomeDoNivel | undefined>>)[
        intensidade as string
      ] || "normal";

/* Quantos confetes a Aya solta dançando (no Normal, tela grande). */
export const CONFETE_DA_AYA = 70;

/* Partículas vivas do motor ao mesmo tempo (os fogos têm o teto deles). */
export const LIMITE_DO_MOTOR = 900;

/* As peças de cada efeito; "aya" não desenha nada (só chama a mascote). */
const COMPONENTES: Readonly<Record<NomeDoEfeito, readonly string[]>> =
  Object.freeze({
    fogos: ["fogos"],
    confete: ["confete"],
    serpentina: ["serpentina"],
    estrelas: ["estrelas"],
    coracoes: ["coracoes"],
    baloes: ["baloes"],
    aya: [],
    combinado: ["fogos", "confete", "serpentina"],
  });

export const componentesDoEfeito = (efeito: unknown): readonly string[] =>
  (COMPONENTES as Readonly<Record<string, readonly string[] | undefined>>)[
    efeito as string
  ] || COMPONENTES.fogos;

/** O efeito chama a Aya para comemorar (evento `aya:estado`). */
export const efeitoChamaAya = (efeito: unknown): boolean =>
  efeito === "aya" || efeito === "combinado";

/** Fogos e estrelas brilham sobre o véu escuro; os outros, sobre a tela. */
export const efeitoComVeu = (efeito: unknown): boolean =>
  componentesDoEfeito(efeito).some((c) => c === "fogos" || c === "estrelas");

/** Duração pedida em ms, limitada; inválida ou vazia, `null` (a padrão). */
export function normalizarDuracao(duracaoMs: unknown): number | null {
  const numero = Number(duracaoMs);
  if (!duracaoMs || !Number.isFinite(numero)) return null;
  return Math.round(
    Math.min(DURACAO_MAXIMA_MS, Math.max(DURACAO_MINIMA_MS, numero)),
  );
}
const limitar = (valor: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, valor));

// ── A cena ──────────────────────────────────────────────────────────────────

/**
 * A cena de um efeito para uma tela. `intensidade`: suave, normal ou festa;
 * `duracaoMs`: 2–15 s (fogos: 4–15 s; vazio, a padrão de cada um);
 * `forma`, `letreiro`, `comAya` e `amostrarTexto` vão para os fogos
 * (fogos.ts).
 */
export function criarCena({
  efeito = "fogos",
  intensidade = "normal",
  duracaoMs = null,
  largura = 800,
  altura = 600,
  paleta = paletaDosFogos(),
  aleatorio = Math.random,
  forma = null,
  letreiro = null,
  comAya = true,
  amostrarTexto = null,
  limite = LIMITE_DO_MOTOR,
}: {
  efeito?: string;
  intensidade?: string;
  duracaoMs?: number | null;
  largura?: number;
  altura?: number;
  paleta?: PaletaDosFogos;
  aleatorio?: Aleatorio;
  forma?: unknown;
  letreiro?: string | null;
  comAya?: boolean;
  amostrarTexto?: AmostrarTexto | null;
  limite?: number;
} = {}): CenaDeEfeitos {
  const nome = (EFEITOS as readonly string[]).includes(efeito)
    ? (efeito as NomeDoEfeito)
    : "fogos";
  const nomeDoNivel = nivelDaIntensidade(intensidade);
  const nivel = NIVEIS[nomeDoNivel];
  // Nome antigo dos fogos ("fogos", do fim do tour) vale como foi pedido.
  const intensidadeDosFogos = Object.hasOwn(INTENSIDADES, intensidade)
    ? intensidade
    : nivel.fogos;
  const componentes = componentesDoEfeito(nome);
  const pedida = normalizarDuracao(duracaoMs);
  const show = componentes.includes("fogos")
    ? criarShow({
        largura,
        altura,
        intensidade: intensidadeDosFogos,
        paleta,
        aleatorio,
        comAya: comAya !== false,
        forma,
        letreiro,
        amostrarTexto,
        duracaoMs: pedida,
      })
    : null;
  const duracao = show ? show.duracao : (pedida ?? DURACAO_PADRAO_MS) / 1000;
  const quantidade = nivel.quantidade * fatorDeFaiscas(largura, altura);
  const lotes = componentes
    .filter((c) => c !== "fogos")
    .flatMap((peca) =>
      lotesDaPeca(peca, { duracao, quantidade, nivel: nomeDoNivel }),
    )
    .sort((a, b) => a.t - b.t);
  return {
    t: 0,
    duracao,
    efeito: nome,
    intensidade: nomeDoNivel,
    componentes,
    show,
    lotes,
    proximo: 0,
    particulas: [],
    limite,
    aleatorio,
    largura,
    altura,
    escala: escalaDaTela(largura, altura),
    paleta,
    comVeu: efeitoComVeu(nome),
    chamaAya: efeitoChamaAya(nome),
    usaMotor: lotes.length > 0 || Boolean(show?.danca),
    /* Estouros ainda não tocados (som): o desenho esvazia a lista. */
    eventos: [],
  };
}

/**
 * Avança a cena `dt` s (limitado a PASSO_MAXIMO_S e à duração): o show de
 * fogos, os lotes da hora e a física de cada partícula. Devolve a cena.
 */
export function avancarCena(cena: CenaDeEfeitos, dt: unknown): CenaDeEfeitos {
  const passo = limitar(
    Number(dt) || 0,
    0,
    Math.min(PASSO_MAXIMO_S, Math.max(0, cena.duracao - cena.t)),
  );
  cena.t += passo;
  const novas: ParticulaDoMotor[] = [];
  if (cena.show) {
    avancarShow(cena.show, passo);
    for (const evento of cena.show.eventos.splice(0)) {
      cena.eventos.push(evento);
      // O confete que a Aya solta dançando é do motor.
      if (evento.tipo === "confete")
        novas.push(
          ...nascerLote(
            cena,
            {
              t: cena.t,
              peca: "confete",
              quantos: Math.round(
                CONFETE_DA_AYA *
                  NIVEIS[cena.intensidade].quantidade *
                  fatorDeFaiscas(cena.largura, cena.altura),
              ),
              origem: "ponto",
              x: evento.x,
              y: evento.y,
            },
            cena.limite - cena.particulas.length,
          ),
        );
    }
  }
  while (
    cena.proximo < cena.lotes.length &&
    cena.lotes[cena.proximo]!.t <= cena.t
  ) {
    const lote = cena.lotes[cena.proximo]!;
    const cabem = cena.limite - cena.particulas.length - novas.length;
    novas.push(...nascerLote(cena, lote, cabem));
    if (lote.origem?.startsWith("canhao"))
      cena.eventos.push({
        tipo: "estouro",
        formato: lote.peca,
        papel: "canhao",
      });
    cena.proximo += 1;
  }
  const tela = { largura: cena.largura, altura: cena.altura };
  cena.particulas = cena.particulas.filter((p) =>
    moverParticulaDoMotor(p, passo, tela),
  );
  cena.particulas.push(...novas);
  return cena;
}

/** Acabou: passou da duração, ou já nasceu tudo e nada mais está na tela. */
export function cenaAcabou(cena: CenaDeEfeitos): boolean {
  if (cena.t >= cena.duracao) return true;
  return (
    (!cena.show || showAcabou(cena.show)) &&
    cena.proximo >= cena.lotes.length &&
    !cena.particulas.length
  );
}

/** Quantas partículas a cena tem agora (motor + fogos). */
export const particulasDaCena = (cena: CenaDeEfeitos): number =>
  cena.particulas.length + (cena.show ? cena.show.particulas.length : 0);

/**
 * Desenha as partículas do motor (não os fogos, que são de
 * src/modulos/comemoracao/). `saida` (0–1) apaga tudo no fim da cena;
 * `qualidade` (0–2) corta brilhos e sombras quando o computador não dá conta.
 */
export function desenharParticulasDoMotor(
  contexto: CanvasRenderingContext2D,
  cena: CenaDeEfeitos,
  qualidade = 2,
): void {
  desenharParticulas(contexto, cena.particulas, {
    saida: fatorDeSaida(cena.t, cena.duracao),
    qualidade,
  });
}
