/*
  As partículas do motor de efeitos (src/lib/motor-de-efeitos.ts), sem DOM:
  o roteiro de cada peça (quando e quantas nascem), o nascimento, a física
  e o desenho num contexto 2D recebido. Os fogos são de src/lib/fogos.ts.

  O que deixa o movimento bonito:
  - Profundidade: cada partícula tem `z` (0, longe; 1, perto). As de longe
    são menores, mais lentas e mais apagadas; são desenhadas primeiro.
  - Confete em 3D: gira no plano (rot) e vira em dois eixos (fase e giroY);
    a face de trás é mais escura e a da frente brilha quando encara a tela.
    De chapa, o ar segura mais (cai devagar e balança); de lado, cai rápido.
  - Roteiro coreografado: abertura (canhões), clímax (chafariz, chuva de
    meteoros, onda de balões) e dispersão (a chuva rareia até o fim).
    Suave, Normal e Festa mudam a quantidade e também o roteiro (Festa tem
    mais ondas; Suave não tem clímax).

  Unidades: tempo em s, posição em px CSS, velocidade em px/s.
*/

import type { Aleatorio, PaletaDosFogos, PontoXY } from "./fogos.ts";
import type { NomeDoNivel } from "./efeitos-das-comemoracoes.ts";

/**
 * Uma leva de partículas: quando, de que peça, quantas e de onde. Origem
 * "ponto": de (x, y) — o confete que a Aya solta dançando.
 */
export interface LoteDoMotor {
  t: number;
  peca: string;
  quantos: number;
  origem: string;
  x?: number;
  y?: number;
}

/** O que toda partícula do motor tem; o resto depende do tipo. */
interface BaseDaParticulaDoMotor extends PontoXY {
  vx: number;
  vy: number;
  atrito: number;
  gravidade: number;
  vida: number;
  vidaMax: number;
  idade: number;
  cor: string;
  /** Profundidade: 0 (longe, pequena e apagada) a 1 (perto). */
  z: number;
  forma?: string;
  largura?: number;
  altura?: number;
  rot?: number;
  vrot?: number;
  fase?: number;
  vfase?: number;
  balanco?: number;
  frequencia?: number;
  giro?: number;
  trocaDoGiro?: number;
  relogio?: number;
  rastro?: PontoXY[];
  espessura?: number;
  tamanho?: number;
  cintila?: number;
}
export interface ConfeteDoMotor extends BaseDaParticulaDoMotor {
  tipo: "confete";
  forma: string;
  largura: number;
  altura: number;
  rot: number;
  vrot: number;
  /** Virada em x (achata a altura) e em y (achata a largura). */
  fase: number;
  vfase: number;
  giroY: number;
  vgiroY: number;
  balanco: number;
  frequencia: number;
  /** Metálico: brilho forte quando encara a tela. */
  metalico: boolean;
}
export interface SerpentinaDoMotor extends BaseDaParticulaDoMotor {
  tipo: "serpentina";
  giro: number;
  trocaDoGiro: number;
  relogio: number;
  rastro: PontoXY[];
  espessura: number;
}
export interface CometaDoMotor extends BaseDaParticulaDoMotor {
  tipo: "cometa";
  rastro: PontoXY[];
  tamanho: number;
}
export interface EstrelaDoMotor extends BaseDaParticulaDoMotor {
  tipo: "estrela";
  rot: number;
  vrot: number;
  fase: number;
  cintila: number;
  tamanho: number;
}
/** Coração e balão: sobem balançando. */
export interface FlutuanteDoMotor extends BaseDaParticulaDoMotor {
  tipo: "coracao" | "balao";
  fase: number;
  balanco: number;
  frequencia: number;
  tamanho: number;
}
export type ParticulaDoMotor =
  | ConfeteDoMotor
  | SerpentinaDoMotor
  | CometaDoMotor
  | EstrelaDoMotor
  | FlutuanteDoMotor;
/** A partícula ao nascer, antes de `vidaMax` e `idade`. */
type ParticulaNascendo<T = ParticulaDoMotor> = T extends unknown
  ? Omit<T, "vidaMax" | "idade">
  : never;

/** O que o nascimento das partículas lê da cena. */
export interface CenaParaNascer {
  largura: number;
  altura: number;
  escala: number;
  aleatorio: Aleatorio;
  paleta: PaletaDosFogos;
}

const entre = (aleatorio: Aleatorio, min: number, max: number): number =>
  min + (max - min) * aleatorio();
const limitar = (valor: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, valor));
const sortear = <T>(aleatorio: Aleatorio, lista: readonly T[]): T =>
  lista[Math.floor(aleatorio() * lista.length) % lista.length]!;

// ── Curvas (easing) ─────────────────────────────────────────────────────────

/** Suave nas duas pontas (smoothstep): 0 → 1 com u de 0 a 1. */
export const suavizar = (u: number): number => {
  const x = limitar(u, 0, 1);
  return x * x * (3 - 2 * x);
};

/** Sai rápido e chega devagar (ease-out cúbico). */
export const desacelerar = (u: number): number =>
  1 - (1 - limitar(u, 0, 1)) ** 3;

/* O pico da chuva (fração da duração): o clímax do roteiro. */
export const PICO_DA_CHUVA = 0.45;

/**
 * Quanto chove (0–1) em `u` (fração da duração): abre em 35%, sobe até o
 * clímax e rareia até 15% no fim — a dispersão.
 */
export function envelopeDaChuva(u: number): number {
  const x = limitar(u, 0, 1);
  if (x <= PICO_DA_CHUVA) return 0.35 + 0.65 * suavizar(x / PICO_DA_CHUVA);
  return 1 - 0.85 * suavizar((x - PICO_DA_CHUVA) / (1 - PICO_DA_CHUVA));
}

/**
 * A batida do coração (0–1) em `t` s: duas batidas (tum-tum) a cada 1,1 s.
 */
export function batidaDoCoracao(t: number): number {
  const ciclo = ((t % 1.1) + 1.1) % 1.1;
  const pulso = (centro: number, forca: number) =>
    forca * Math.exp(-(((ciclo - centro) / 0.06) ** 2));
  return Math.min(1, pulso(0.08, 1) + pulso(0.3, 0.6));
}

/** Tamanho, brilho e velocidade pela profundidade (z de 0 a 1). */
export const tamanhoNaProfundidade = (z: number): number =>
  0.6 + 0.55 * limitar(z, 0, 1);
export const brilhoNaProfundidade = (z: number): number =>
  0.55 + 0.45 * limitar(z, 0, 1);
const velocidadeNaProfundidade = (z: number): number =>
  0.7 + 0.45 * limitar(z, 0, 1);

// ── Roteiro: quando e de onde nasce cada leva ───────────────────────────────

/*
  Chuva com envelope: um lote a cada `intervalo`, com `porLote` vezes o
  envelope (abre, clímax, dispersão). Lote que daria zero não entra.
*/
function chuva(
  peca: string,
  {
    de,
    ate,
    intervalo,
    porLote,
    origem,
    duracao,
  }: {
    de: number;
    ate: number;
    intervalo: number;
    porLote: number;
    origem: string;
    duracao: number;
  },
): LoteDoMotor[] {
  const lotes: LoteDoMotor[] = [];
  for (let t = de; t <= ate + 1e-9; t += intervalo) {
    const quantos = Math.round(porLote * envelopeDaChuva(t / duracao));
    if (quantos > 0) lotes.push({ t, peca, quantos, origem });
  }
  return lotes;
}

const dosDoisLados = (
  t: number,
  peca: string,
  quantos: number,
): LoteDoMotor[] => [
  { t, peca, quantos, origem: "canhao-esquerdo" },
  { t, peca, quantos, origem: "canhao-direito" },
];

/**
 * O roteiro de uma peça: abertura, clímax (fora do Suave) e a chuva que
 * rareia. `quantidade` multiplica tudo; `nivel` muda o roteiro.
 */
export function lotesDaPeca(
  peca: string,
  {
    duracao,
    quantidade,
    nivel = "normal",
  }: { duracao: number; quantidade: number; nivel?: NomeDoNivel },
): LoteDoMotor[] {
  const fim = Math.max(0.6, duracao - 1.6);
  const q = (n: number): number => Math.max(1, Math.round(n * quantidade));
  const climax = duracao * PICO_DA_CHUVA;
  const festa = nivel === "festa";
  const suave = nivel === "suave";
  switch (peca) {
    case "confete":
      return [
        ...dosDoisLados(0.05, peca, q(75)),
        ...(festa ? dosDoisLados(0.4, peca, q(45)) : []),
        ...(!suave && duracao > 3
          ? [{ t: climax, peca, quantos: q(95), origem: "chafariz" }]
          : []),
        ...(festa && duracao > 3
          ? dosDoisLados(climax + 0.25, peca, q(55))
          : []),
        ...chuva(peca, {
          de: 0.45,
          ate: fim,
          intervalo: 0.12,
          porLote: 4.5 * quantidade,
          origem: "topo",
          duracao,
        }),
      ];
    case "serpentina":
      return [
        ...dosDoisLados(0.1, peca, q(9)),
        ...(!suave && duracao > 3 ? dosDoisLados(climax, peca, q(6)) : []),
        ...chuva(peca, {
          de: 0.8,
          ate: fim,
          intervalo: 0.45,
          porLote: 2.2 * quantidade,
          origem: "topo",
          duracao,
        }),
      ];
    case "estrelas":
      return [
        ...(!suave && duracao > 3
          ? [
              { t: climax, peca: "cometa", quantos: q(7), origem: "ceu" },
              ...(festa
                ? [
                    {
                      t: climax + 0.45,
                      peca: "cometa",
                      quantos: q(6),
                      origem: "ceu",
                    },
                  ]
                : []),
            ]
          : []),
        ...chuva("cometa", {
          de: 0.25,
          ate: fim,
          intervalo: 0.3,
          porLote: 1.3 * quantidade,
          origem: "ceu",
          duracao,
        }),
        ...chuva("estrela", {
          de: 0.05,
          ate: fim,
          intervalo: 0.12,
          porLote: 2.6 * quantidade,
          origem: "topo",
          duracao,
        }),
      ];
    case "coracoes":
      return [
        ...(!suave && duracao > 3
          ? [{ t: climax, peca: "coracao", quantos: q(16), origem: "chafariz" }]
          : []),
        ...chuva("coracao", {
          de: 0.05,
          ate: Math.max(0.3, duracao - 2.6),
          intervalo: 0.14,
          porLote: 2.4 * quantidade,
          origem: "base",
          duracao,
        }),
      ];
    case "baloes":
      return [
        { t: 0.05, peca: "balao", quantos: q(6), origem: "base" },
        ...(!suave && duracao > 4
          ? [{ t: climax * 0.8, peca: "balao", quantos: q(10), origem: "onda" }]
          : []),
        ...chuva("balao", {
          de: 0.3,
          ate: Math.max(0.4, duracao - 3),
          intervalo: 0.26,
          porLote: 1.5 * quantidade,
          origem: "base",
          duracao,
        }),
      ];
    default:
      return [];
  }
}

// ── Nascimento ──────────────────────────────────────────────────────────────

const FORMAS_DO_CONFETE = ["retangulo", "retangulo", "tira", "circulo"];

function confete(
  cena: CenaParaNascer,
  origem: string,
  ponto?: PontoXY | null,
): ParticulaNascendo<ConfeteDoMotor> {
  const { largura, altura, escala, aleatorio, paleta } = cena;
  const z = aleatorio();
  const tamanho = tamanhoNaProfundidade(z) * escala;
  const cor = sortear(aleatorio, paleta.cores);
  const base = {
    tipo: "confete" as const,
    z,
    forma: sortear(aleatorio, FORMAS_DO_CONFETE),
    cor,
    metalico: cor === paleta.dourado || cor === paleta.ambar,
    largura: entre(aleatorio, 7, 12) * tamanho,
    altura: entre(aleatorio, 3.5, 6.5) * tamanho,
    rot: aleatorio() * Math.PI * 2,
    vrot: entre(aleatorio, -6, 6),
    fase: aleatorio() * Math.PI * 2,
    vfase: entre(aleatorio, 4, 11) * (aleatorio() < 0.5 ? -1 : 1),
    giroY: aleatorio() * Math.PI * 2,
    vgiroY: entre(aleatorio, 1.5, 5) * (aleatorio() < 0.5 ? -1 : 1),
    balanco: entre(aleatorio, 22, 52) * escala,
    frequencia: entre(aleatorio, 0.7, 1.6),
    atrito: entre(aleatorio, 1.5, 2.1),
    gravidade: 360 * escala * velocidadeNaProfundidade(z),
    vida: entre(aleatorio, 4.5, 7.5),
  };
  if (origem === "topo")
    return {
      ...base,
      x: entre(aleatorio, -0.02, 1.02) * largura,
      y: -14 * escala,
      vx: entre(aleatorio, -40, 40) * escala,
      vy: entre(aleatorio, 30, 100) * escala,
      atrito: entre(aleatorio, 2.4, 3.2),
    };
  if (origem === "ponto" && ponto) {
    // Do ponto (a Aya): um leque para cima, que abre e cai.
    const angulo = entre(aleatorio, -0.75, 0.75);
    const forca = entre(aleatorio, 0.35, 0.75) * altura;
    return {
      ...base,
      x: ponto.x,
      y: ponto.y,
      vx: Math.sin(angulo) * forca,
      vy: -Math.cos(angulo) * forca,
    };
  }
  if (origem === "chafariz") {
    // O clímax: um chafariz do pé da tela, no meio, que abre em leque.
    const angulo = entre(aleatorio, -0.42, 0.42);
    const forca = entre(aleatorio, 0.85, 1.3) * altura * 1.5;
    return {
      ...base,
      x: largura * (0.5 + entre(aleatorio, -0.05, 0.05)),
      y: altura + 6,
      vx: Math.sin(angulo) * forca,
      vy: -Math.cos(angulo) * forca,
    };
  }
  const esquerda = origem === "canhao-esquerdo";
  // Canhão: dispara para cima e para dentro (ângulo a partir da vertical).
  const angulo = entre(aleatorio, 0.18, 0.62) * (esquerda ? 1 : -1);
  const forca = entre(aleatorio, 0.75, 1.25) * altura * 1.45;
  return {
    ...base,
    x: esquerda ? largura * 0.02 : largura * 0.98,
    y: altura + 6,
    vx: Math.sin(angulo) * forca,
    vy: -Math.cos(angulo) * forca,
  };
}

function serpentina(
  cena: CenaParaNascer,
  origem: string,
): ParticulaNascendo<SerpentinaDoMotor> {
  const { largura, altura, escala, aleatorio, paleta } = cena;
  const z = aleatorio();
  const esquerda = origem === "canhao-esquerdo";
  const doTopo = origem === "topo";
  const angulo = entre(aleatorio, 0.2, 0.7) * (esquerda ? 1 : -1);
  const forca = entre(aleatorio, 0.8, 1.2) * altura * 1.3;
  const x = doTopo
    ? entre(aleatorio, 0.05, 0.95) * largura
    : esquerda
      ? largura * 0.03
      : largura * 0.97;
  const y = doTopo ? -10 : altura + 6;
  return {
    tipo: "serpentina",
    z,
    x,
    y,
    vx: doTopo ? entre(aleatorio, -60, 60) * escala : Math.sin(angulo) * forca,
    vy: doTopo ? entre(aleatorio, 30, 90) * escala : -Math.cos(angulo) * forca,
    atrito: doTopo ? 1.6 : 1.25,
    gravidade: 300 * escala * velocidadeNaProfundidade(z),
    // Cacho: a direção gira, e o giro troca de sentido de vez em quando.
    giro: entre(aleatorio, 3.5, 7.5) * (aleatorio() < 0.5 ? -1 : 1),
    trocaDoGiro: entre(aleatorio, 0.35, 0.8),
    relogio: 0,
    rastro: [{ x, y }],
    cor: sortear(aleatorio, paleta.cores),
    espessura:
      entre(aleatorio, 2.4, 3.8) *
      Math.max(0.8, escala) *
      tamanhoNaProfundidade(z),
    vida: entre(aleatorio, 4, 6.5),
  };
}

function cometa(cena: CenaParaNascer): ParticulaNascendo<CometaDoMotor> {
  const { largura, altura, escala, aleatorio, paleta } = cena;
  const z = 0.4 + 0.6 * aleatorio();
  const angulo = entre(aleatorio, 0.35, 0.7); // abaixo da horizontal
  const velocidade =
    entre(aleatorio, 650, 1050) * escala * velocidadeNaProfundidade(z);
  const x = entre(aleatorio, -0.15, 0.75) * largura;
  const y = entre(aleatorio, -0.05, 0.3) * altura;
  return {
    tipo: "cometa",
    z,
    x,
    y,
    vx: Math.cos(angulo) * velocidade,
    vy: Math.sin(angulo) * velocidade,
    atrito: 0.25,
    gravidade: 60 * escala,
    rastro: [{ x, y }],
    cor: aleatorio() < 0.5 ? paleta.centelha : sortear(aleatorio, paleta.cores),
    tamanho:
      entre(aleatorio, 1.6, 2.6) *
      Math.max(0.8, escala) *
      tamanhoNaProfundidade(z),
    vida: entre(aleatorio, 0.8, 1.3),
  };
}

function estrela(cena: CenaParaNascer): ParticulaNascendo<EstrelaDoMotor> {
  const { largura, escala, aleatorio, paleta } = cena;
  const z = aleatorio();
  return {
    tipo: "estrela",
    z,
    x: entre(aleatorio, 0, largura),
    y: -10 * escala,
    vx: entre(aleatorio, -15, 15) * escala,
    vy: entre(aleatorio, 45, 110) * escala * velocidadeNaProfundidade(z),
    atrito: 0.4,
    gravidade: 25 * escala,
    rot: aleatorio() * Math.PI,
    vrot: entre(aleatorio, -2, 2),
    fase: aleatorio() * Math.PI * 2,
    cintila: entre(aleatorio, 4, 9),
    cor: aleatorio() < 0.45 ? paleta.dourado : sortear(aleatorio, paleta.cores),
    tamanho: entre(aleatorio, 4, 9) * escala * tamanhoNaProfundidade(z),
    vida: entre(aleatorio, 3, 5),
  };
}

const CORES_DOS_CORACOES = ["#ff4d6d", "#ff758f", "#ff8fab", "#e5383b"];

function coracao(
  cena: CenaParaNascer,
  origem: string,
): ParticulaNascendo<FlutuanteDoMotor> {
  const { largura, altura, escala, aleatorio, paleta } = cena;
  const z = aleatorio();
  const chafariz = origem === "chafariz";
  const angulo = chafariz ? entre(aleatorio, -0.5, 0.5) : 0;
  const forca = chafariz
    ? entre(aleatorio, 0.55, 0.85) * altura
    : entre(aleatorio, 90, 180) * escala * velocidadeNaProfundidade(z);
  return {
    tipo: "coracao",
    z,
    x: chafariz
      ? largura * (0.5 + entre(aleatorio, -0.04, 0.04))
      : entre(aleatorio, 0.04, 0.96) * largura,
    y: altura + 20 * escala,
    vx: Math.sin(angulo) * forca,
    vy: -Math.cos(angulo) * forca,
    atrito: chafariz ? 1.1 : 0.35,
    gravidade: -18 * escala, // empuxo: sobe devagar
    fase: aleatorio() * Math.PI * 2,
    balanco: entre(aleatorio, 25, 55) * escala,
    frequencia: entre(aleatorio, 0.6, 1.3),
    cor:
      aleatorio() < 0.8
        ? sortear(aleatorio, CORES_DOS_CORACOES)
        : sortear(aleatorio, paleta.cores),
    tamanho: entre(aleatorio, 11, 24) * escala * tamanhoNaProfundidade(z),
    vida: entre(aleatorio, 3, 4.5),
  };
}

function balao(
  cena: CenaParaNascer,
  origem: string,
): ParticulaNascendo<FlutuanteDoMotor> {
  const { largura, altura, escala, aleatorio, paleta } = cena;
  const z = aleatorio();
  const raio = entre(aleatorio, 17, 30) * escala * tamanhoNaProfundidade(z);
  // A onda do clímax sai em fileira, da esquerda para a direita.
  const x =
    origem === "onda"
      ? entre(aleatorio, 0.08, 0.92) * largura
      : entre(aleatorio, 0.05, 0.95) * largura;
  return {
    tipo: "balao",
    z,
    x,
    y: altura + raio * (origem === "onda" ? 2 + 3 * (x / largura) : 3),
    vx: 0,
    vy:
      -entre(aleatorio, 75, 140) *
      escala *
      velocidadeNaProfundidade(z) *
      (origem === "onda" ? 1.25 : 1),
    atrito: 0.25,
    gravidade: -14 * escala,
    fase: aleatorio() * Math.PI * 2,
    balanco: entre(aleatorio, 14, 30) * escala,
    frequencia: entre(aleatorio, 0.4, 0.9),
    cor: sortear(aleatorio, paleta.cores),
    tamanho: raio,
    vida: entre(aleatorio, 6, 9),
  };
}

type Nascer = (
  cena: CenaParaNascer,
  origem: string,
  ponto?: PontoXY | null,
) => ParticulaNascendo;

const NASCER: Readonly<Record<string, Nascer | undefined>> = Object.freeze({
  confete,
  serpentina,
  cometa,
  estrela,
  coracao,
  balao,
});

/** As partículas de um lote, sem passar do teto (`cabem`). */
export function nascerLote(
  cena: CenaParaNascer,
  lote: LoteDoMotor,
  cabem = Infinity,
): ParticulaDoMotor[] {
  const quantos = Math.max(0, Math.min(lote.quantos, cabem));
  const nascer = NASCER[lote.peca];
  if (!nascer) return [];
  return Array.from({ length: quantos }, () => {
    const p = nascer(
      cena,
      lote.origem,
      lote.x !== undefined && lote.y !== undefined
        ? { x: lote.x, y: lote.y }
        : null,
    );
    return { ...p, vidaMax: p.vida, idade: 0 } as ParticulaDoMotor;
  });
}

// ── Física ──────────────────────────────────────────────────────────────────

const MAXIMO_DO_RASTRO: Readonly<Record<string, number>> = Object.freeze({
  serpentina: 22,
  cometa: 14,
});

/**
 * Quanto o ar segura o confete (multiplica o atrito vertical): de chapa
 * para a tela (|cos| perto de 1), segura mais; de lado, quase nada.
 */
export const arrastoDoConfete = (fase: number, giroY: number): number =>
  0.45 + 1.1 * Math.abs(Math.cos(fase) * Math.cos(giroY));

/**
 * Move uma partícula do motor `dt` s. Devolve se continua viva (vida e
 * dentro da tela, com folga).
 */
export function moverParticulaDoMotor(
  p: ParticulaDoMotor,
  dt: number,
  { largura, altura }: { largura?: number; altura?: number } = {},
): boolean {
  p.idade += dt;
  p.vida -= dt;
  const freio = Math.exp(-p.atrito * dt);
  p.vx = p.vx * freio;
  if (p.tipo === "confete") {
    // Na queda, o ar segura conforme a folhinha está de chapa ou de lado.
    const queda = p.vy > 0 ? arrastoDoConfete(p.fase, p.giroY) : 1;
    p.vy = p.vy * Math.exp(-p.atrito * queda * dt) + p.gravidade * dt;
  } else p.vy = p.vy * freio + p.gravidade * dt;
  if (p.tipo === "serpentina") {
    // Gira o vetor velocidade: o cacho da serpentina.
    p.relogio += dt;
    if (p.relogio > p.trocaDoGiro) {
      p.relogio = 0;
      p.giro = -p.giro;
    }
    const angulo = p.giro * dt * Math.min(1, Math.hypot(p.vx, p.vy) / 120);
    const cos = Math.cos(angulo);
    const sen = Math.sin(angulo);
    [p.vx, p.vy] = [p.vx * cos - p.vy * sen, p.vx * sen + p.vy * cos];
  }
  let deriva = 0;
  if (p.balanco) {
    // O balanço entra aos poucos: o tiro do canhão sai reto e só depois
    // a folhinha começa a planar de um lado para o outro.
    const entrada = p.tipo === "confete" ? suavizar(p.idade / 0.9) : 1;
    deriva =
      Math.cos(p.idade * p.frequencia! * 2 * Math.PI + (p.fase || 0) * 0.15) *
      p.balanco *
      entrada;
  }
  p.x += (p.vx + deriva) * dt;
  p.y += p.vy * dt;
  if (p.vrot) p.rot! += p.vrot * dt;
  if (p.vfase) p.fase! += p.vfase * dt;
  if (p.tipo === "confete") p.giroY += p.vgiroY * dt;
  if (p.rastro) {
    p.rastro.push({ x: p.x, y: p.y });
    const maximo = MAXIMO_DO_RASTRO[p.tipo] || 12;
    if (p.rastro.length > maximo) p.rastro.splice(0, p.rastro.length - maximo);
  }
  const folga = 80;
  const fora =
    (largura && (p.x < -folga * 3 || p.x > largura + folga * 3)) ||
    (altura &&
      ((p.vy > 0 && p.y > altura + folga) ||
        (p.vy < 0 &&
          p.tipo !== "confete" &&
          p.tipo !== "serpentina" &&
          p.y < -folga * 2)));
  return p.vida > 0 && !fora;
}

/**
 * Brilho (0–1): entra rápido (ease-out), sai suave no fim da vida; as de
 * longe são mais apagadas e a estrela cintila.
 */
export function brilhoDoMotor(p: ParticulaDoMotor): number {
  const resto = limitar(p.vida / p.vidaMax, 0, 1);
  const entrada = desacelerar(p.idade / 0.25);
  const saida = resto < 0.3 ? suavizar(resto / 0.3) : 1;
  let brilho = Math.min(entrada, saida) * brilhoNaProfundidade(p.z ?? 1);
  if (p.tipo === "estrela")
    brilho *= 0.55 + 0.45 * Math.sin(p.idade * p.cintila + p.fase);
  return limitar(brilho, 0, 1);
}

// ── Desenho ─────────────────────────────────────────────────────────────────

function caminhoDaEstrela(
  contexto: CanvasRenderingContext2D,
  raio: number,
): void {
  contexto.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 ? raio * 0.45 : raio;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    if (i) contexto.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else contexto.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  contexto.closePath();
}

function caminhoDoCoracao(contexto: CanvasRenderingContext2D, t: number): void {
  contexto.beginPath();
  contexto.moveTo(0, t * 0.35);
  contexto.bezierCurveTo(-t, -t * 0.25, -t * 0.45, -t, 0, -t * 0.45);
  contexto.bezierCurveTo(t * 0.45, -t, t, -t * 0.25, 0, t * 0.35);
  contexto.closePath();
}

function desenharRastro(
  contexto: CanvasRenderingContext2D,
  p: ParticulaDoMotor,
  alfa: number,
  espessura: number,
): void {
  const pontos = p.rastro;
  if (!pontos || pontos.length < 2) return;
  contexto.lineCap = "round";
  contexto.lineJoin = "round";
  contexto.strokeStyle = p.cor;
  // Do mais velho (fino e apagado) ao mais novo.
  for (let i = 1; i < pontos.length; i += 1) {
    const u = i / (pontos.length - 1);
    contexto.globalAlpha =
      alfa * (p.tipo === "cometa" ? u * u : 0.35 + 0.65 * u);
    contexto.lineWidth =
      espessura * (p.tipo === "cometa" ? 0.3 + u : 0.55 + 0.45 * u);
    contexto.beginPath();
    contexto.moveTo(pontos[i - 1]!.x, pontos[i - 1]!.y);
    contexto.lineTo(pontos[i]!.x, pontos[i]!.y);
    contexto.stroke();
  }
}

/*
  O confete em 3D: achata em x (giroY) e em y (fase); de costas, a face é
  mais escura; de frente, um brilho que acende quando encara a tela (mais
  forte no metálico). Com qualidade 0, só a cor.
*/
function desenharConfete(
  contexto: CanvasRenderingContext2D,
  p: ConfeteDoMotor,
  alfa: number,
  qualidade: number,
): void {
  const cx = Math.cos(p.giroY);
  const cy = Math.cos(p.fase);
  contexto.rotate(p.rot);
  contexto.scale(
    Math.sign(cx || 1) * Math.max(0.06, Math.abs(cx)),
    Math.max(0.06, Math.abs(cy)),
  );
  const largura = p.forma === "tira" ? p.largura * 1.6 : p.largura;
  const altura = p.forma === "tira" ? p.altura * 0.6 : p.altura;
  const preencher = () => {
    if (p.forma === "circulo") {
      contexto.beginPath();
      contexto.arc(0, 0, p.altura * 0.8, 0, Math.PI * 2);
      contexto.fill();
    } else contexto.fillRect(-largura / 2, -altura / 2, largura, altura);
  };
  contexto.fillStyle = p.cor;
  preencher();
  if (qualidade <= 0) return;
  const frente = cx * cy >= 0;
  const encara = Math.abs(cx * cy);
  if (!frente) {
    contexto.globalAlpha = alfa * 0.34;
    contexto.fillStyle = "#000000";
    preencher();
  } else if (encara > 0.6) {
    contexto.globalAlpha =
      alfa * (p.metalico ? 0.65 : 0.28) * ((encara - 0.6) / 0.4);
    contexto.fillStyle = "#ffffff";
    preencher();
  }
}

function desenharEstrela(
  contexto: CanvasRenderingContext2D,
  p: EstrelaDoMotor,
  alfa: number,
  qualidade: number,
): void {
  const pulso = 0.85 + 0.2 * Math.sin(p.idade * p.cintila + p.fase);
  const raio = p.tamanho * pulso;
  contexto.rotate(p.rot);
  if (qualidade > 0 && p.z > 0.45) {
    // Brilho em volta: a mesma estrela, maior e bem tênue.
    contexto.globalAlpha = alfa * 0.22;
    caminhoDaEstrela(contexto, raio * 1.9);
    contexto.fill();
    contexto.globalAlpha = alfa;
  }
  caminhoDaEstrela(contexto, raio);
  contexto.fill();
  if (qualidade > 0 && pulso > 1 && p.z > 0.6) {
    // No pico da cintilação, a cruz de luz das estrelas grandes.
    contexto.rotate(-p.rot);
    contexto.globalAlpha = alfa * (pulso - 1) * 4;
    contexto.strokeStyle = "#ffffff";
    contexto.lineWidth = 1;
    contexto.beginPath();
    contexto.moveTo(-raio * 2.2, 0);
    contexto.lineTo(raio * 2.2, 0);
    contexto.moveTo(0, -raio * 2.2);
    contexto.lineTo(0, raio * 2.2);
    contexto.stroke();
  }
}

function desenharCoracao(
  contexto: CanvasRenderingContext2D,
  p: FlutuanteDoMotor,
  alfa: number,
  qualidade: number,
): void {
  const surgir = desacelerar(p.idade / 0.35);
  const resto = limitar(p.vida / p.vidaMax, 0, 1);
  // No fim, cresce um pouco enquanto some: dissolve em vez de sumir.
  const final = resto < 0.25 ? 1 + 0.2 * (1 - resto / 0.25) : 1;
  const batida = 1 + 0.12 * batidaDoCoracao(p.idade + p.fase);
  const t = p.tamanho * (0.4 + 0.6 * surgir) * batida * final;
  contexto.rotate(0.18 * Math.sin(p.idade * p.frequencia * 2 * Math.PI));
  caminhoDoCoracao(contexto, t);
  contexto.fill();
  if (qualidade > 0) {
    contexto.globalAlpha = alfa * 0.35;
    contexto.fillStyle = "#ffffff";
    contexto.beginPath();
    contexto.ellipse(
      -t * 0.38,
      -t * 0.5,
      t * 0.14,
      t * 0.22,
      -0.6,
      0,
      Math.PI * 2,
    );
    contexto.fill();
  }
}

function desenharBalao(
  contexto: CanvasRenderingContext2D,
  p: FlutuanteDoMotor,
  alfa: number,
  qualidade: number,
): void {
  const r = p.tamanho;
  const onda = Math.sin(p.idade * p.frequencia * 2 * Math.PI + p.fase);
  contexto.rotate(0.1 * onda);
  // Barbante: atrasa em relação ao balão (a ponta vai para o lado oposto).
  contexto.strokeStyle = p.cor;
  contexto.lineWidth = 1;
  contexto.globalAlpha = alfa * 0.6;
  contexto.beginPath();
  contexto.moveTo(0, r * 1.15);
  contexto.bezierCurveTo(
    -r * 0.35 * onda,
    r * 1.7,
    r * 0.4 * onda,
    r * 2.3,
    -r * 0.25 * onda,
    r * 2.9,
  );
  contexto.stroke();
  contexto.globalAlpha = alfa;
  contexto.fillStyle = p.cor;
  contexto.beginPath();
  contexto.ellipse(0, 0, r * 0.86, r, 0, 0, Math.PI * 2);
  contexto.fill();
  // Nó.
  contexto.beginPath();
  contexto.moveTo(-r * 0.12, r * 1.1);
  contexto.lineTo(r * 0.12, r * 1.1);
  contexto.lineTo(0, r * 0.96);
  contexto.closePath();
  contexto.fill();
  if (qualidade <= 0) return;
  // Volume: sombra embaixo à direita e reflexo em cima à esquerda.
  contexto.globalAlpha = alfa * 0.14;
  contexto.fillStyle = "#000000";
  contexto.beginPath();
  contexto.ellipse(r * 0.22, r * 0.25, r * 0.6, r * 0.72, -0.4, 0, Math.PI * 2);
  contexto.fill();
  contexto.globalAlpha = alfa * 0.45;
  contexto.fillStyle = "#ffffff";
  contexto.beginPath();
  contexto.ellipse(
    -r * 0.32,
    -r * 0.38,
    r * 0.16,
    r * 0.3,
    -0.5,
    0,
    Math.PI * 2,
  );
  contexto.fill();
}

/**
 * Desenha as partículas do motor (não os fogos): as de longe primeiro.
 * `saida` (0–1) apaga tudo no fim da cena; `qualidade` (0–2, de
 * src/modulos/comemoracao/desempenho.ts) corta brilhos e sombras.
 */
export function desenharParticulas(
  contexto: CanvasRenderingContext2D,
  particulas: readonly ParticulaDoMotor[],
  { saida = 1, qualidade = 2 }: { saida?: number; qualidade?: number } = {},
): void {
  for (const camada of [0, 1]) {
    for (const p of particulas) {
      if ((p.z >= 0.5 ? 1 : 0) !== camada) continue;
      const alfa = brilhoDoMotor(p) * saida;
      if (alfa <= 0.01) continue;
      if (p.tipo === "serpentina") {
        desenharRastro(contexto, p, alfa, p.espessura);
        continue;
      }
      if (p.tipo === "cometa") {
        desenharRastro(contexto, p, alfa, p.tamanho * 1.6);
        contexto.fillStyle = p.cor;
        if (qualidade > 0) {
          contexto.globalAlpha = alfa * 0.25;
          contexto.beginPath();
          contexto.arc(p.x, p.y, p.tamanho * 3.2, 0, Math.PI * 2);
          contexto.fill();
        }
        contexto.globalAlpha = alfa;
        contexto.beginPath();
        contexto.arc(p.x, p.y, p.tamanho * 1.2, 0, Math.PI * 2);
        contexto.fill();
        continue;
      }
      contexto.save();
      contexto.globalAlpha = alfa;
      contexto.fillStyle = p.cor;
      contexto.translate(p.x, p.y);
      if (p.tipo === "confete") desenharConfete(contexto, p, alfa, qualidade);
      else if (p.tipo === "estrela")
        desenharEstrela(contexto, p, alfa, qualidade);
      else if (p.tipo === "coracao")
        desenharCoracao(contexto, p, alfa, qualidade);
      else if (p.tipo === "balao") desenharBalao(contexto, p, alfa, qualidade);
      contexto.restore();
    }
  }
  contexto.globalAlpha = 1;
}
