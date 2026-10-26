/*
  Motor de efeitos das comemorações, sem DOM: monta a CENA de um efeito
  (fogos, confete, serpentina, chuva de estrelas, corações, balões, a Aya
  comemorando ou o combinado), avança a física quadro a quadro e desenha as
  partículas num contexto 2D recebido. Quem cria o <canvas>, chama
  requestAnimationFrame, pausa com a aba oculta e limpa ao fim é
  src/modules/comemoracao.js (`soltarFogos`).

  Os fogos continuam sendo o show de src/lib/fogos.ts (roteiro, rastro de
  subida, estouros em camadas, cintilação, gravidade, fumaça e o marco
  desenhado no céu); a cena só o embute. Os outros efeitos são partículas
  simples daqui, com física mínima: atrito do ar, gravidade (ou empuxo, nos
  balões e corações), balanço lateral e giro.

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
import type {
  Aleatorio,
  PaletaDosFogos,
  PontoXY,
  ShowDeFogos,
} from "./fogos.ts";
import type { AmostrarTexto } from "./fogos-formas.ts";

export type NomeDoEfeito =
  | "fogos"
  | "confete"
  | "serpentina"
  | "estrelas"
  | "coracoes"
  | "baloes"
  | "aya"
  | "combinado";
export type NomeDoNivel = "suave" | "normal" | "festa";

/** Uma leva de partículas: quando, de que peça, quantas e de onde. */
export interface LoteDoMotor {
  t: number;
  peca: string;
  quantos: number;
  origem: string;
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
  fase: number;
  vfase: number;
  balanco: number;
  frequencia: number;
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

/** Estouro ainda não tocado (som): dos fogos ou de um canhão do motor. */
export interface EventoDaCena {
  tipo: "estouro";
  formato: string;
  papel: string;
  x?: number;
  y?: number;
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
  eventos: EventoDaCena[];
}
/** O que o nascimento das partículas lê da cena. */
export type CenaParaNascer = Pick<
  CenaDeEfeitos,
  "largura" | "altura" | "escala" | "aleatorio" | "paleta"
>;

export const EFEITOS: readonly NomeDoEfeito[] = Object.freeze([
  "fogos",
  "confete",
  "serpentina",
  "estrelas",
  "coracoes",
  "baloes",
  "aya",
  "combinado",
]);

export const ROTULOS_DOS_EFEITOS = Object.freeze({
  fogos: "Fogos",
  confete: "Confete",
  serpentina: "Serpentina",
  estrelas: "Chuva de estrelas",
  coracoes: "Corações",
  baloes: "Balões",
  aya: "Aya comemorando",
  combinado: "Combinado",
});

/*
  Intensidade: quanto de partícula (multiplicador) e o show de fogos
  equivalente (src/lib/fogos.ts INTENSIDADES).
*/
export const NIVEIS = Object.freeze({
  suave: Object.freeze({ quantidade: 0.55, fogos: "pequeno" }),
  normal: Object.freeze({ quantidade: 1, fogos: "cheio" }),
  festa: Object.freeze({ quantidade: 1.7, fogos: "festa" }),
});
export const ROTULOS_DOS_NIVEIS = Object.freeze({
  suave: "Suave",
  normal: "Normal",
  festa: "Festa",
});

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

export const DURACAO_PADRAO_MS = 5000;
export const DURACAO_MINIMA_MS = 2000;
export const DURACAO_MAXIMA_MS = 15000;
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

const entre = (aleatorio: Aleatorio, min: number, max: number): number =>
  min + (max - min) * aleatorio();
const limitar = (valor: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, valor));
const sortear = <T>(aleatorio: Aleatorio, lista: readonly T[]): T =>
  lista[Math.floor(aleatorio() * lista.length) % lista.length]!;

// ── Lotes: quando e de onde nasce cada leva de partículas ───────────────────

/*
  Cada peça vira uma lista de lotes { t, peca, quantos, origem }. Rajadas no
  começo (canhões dos cantos) e chuva contínua até ~1,5 s antes do fim, para
  tudo sair de cena a tempo.
*/
function chuva(
  peca: string,
  {
    de,
    ate,
    intervalo,
    porLote,
    origem,
  }: {
    de: number;
    ate: number;
    intervalo: number;
    porLote: number;
    origem: string;
  },
): LoteDoMotor[] {
  const lotes: LoteDoMotor[] = [];
  for (let t = de; t <= ate; t += intervalo)
    lotes.push({ t, peca, quantos: porLote, origem });
  return lotes;
}

function lotesDaPeca(
  peca: string,
  { duracao, quantidade }: { duracao: number; quantidade: number },
): LoteDoMotor[] {
  const fim = Math.max(0.6, duracao - 1.6);
  const q = (n: number): number => Math.max(1, Math.round(n * quantidade));
  switch (peca) {
    case "confete":
      return [
        { t: 0.05, peca, quantos: q(80), origem: "canhao-esquerdo" },
        { t: 0.05, peca, quantos: q(80), origem: "canhao-direito" },
        ...(duracao > 4
          ? [
              {
                t: duracao * 0.45,
                peca,
                quantos: q(45),
                origem: "canhao-esquerdo",
              },
              {
                t: duracao * 0.45,
                peca,
                quantos: q(45),
                origem: "canhao-direito",
              },
            ]
          : []),
        ...chuva(peca, {
          de: 0.5,
          ate: fim,
          intervalo: 0.2,
          porLote: q(5),
          origem: "topo",
        }),
      ];
    case "serpentina":
      return [
        { t: 0.1, peca, quantos: q(9), origem: "canhao-esquerdo" },
        { t: 0.1, peca, quantos: q(9), origem: "canhao-direito" },
        ...chuva(peca, {
          de: 0.8,
          ate: fim,
          intervalo: 0.55,
          porLote: q(2),
          origem: "topo",
        }),
      ];
    case "estrelas":
      return [
        ...chuva("cometa", {
          de: 0.2,
          ate: fim,
          intervalo: 0.32,
          porLote: q(1.4),
          origem: "ceu",
        }),
        ...chuva("estrela", {
          de: 0.1,
          ate: fim,
          intervalo: 0.16,
          porLote: q(3),
          origem: "topo",
        }),
      ];
    case "coracoes":
      return chuva("coracao", {
        de: 0.05,
        ate: Math.max(0.3, duracao - 2.6),
        intervalo: 0.16,
        porLote: q(2.5),
        origem: "base",
      });
    case "baloes":
      return chuva("balao", {
        de: 0.05,
        ate: Math.max(0.3, duracao - 3),
        intervalo: 0.28,
        porLote: q(1.5),
        origem: "base",
      });
    default:
      return [];
  }
}

// ── Nascimento das partículas ───────────────────────────────────────────────

const FORMAS_DO_CONFETE = ["retangulo", "retangulo", "tira", "circulo"];

function confete(
  cena: CenaParaNascer,
  origem: string,
): ParticulaNascendo<ConfeteDoMotor> {
  const { largura, altura, escala, aleatorio, paleta } = cena;
  const base = {
    tipo: "confete" as const,
    forma: sortear(aleatorio, FORMAS_DO_CONFETE),
    cor: sortear(aleatorio, paleta.cores),
    largura: entre(aleatorio, 6, 11) * escala,
    altura: entre(aleatorio, 3, 6) * escala,
    rot: aleatorio() * Math.PI * 2,
    vrot: entre(aleatorio, -9, 9),
    fase: aleatorio() * Math.PI * 2,
    vfase: entre(aleatorio, 5, 13),
    balanco: entre(aleatorio, 18, 46) * escala,
    frequencia: entre(aleatorio, 1, 2.4),
    atrito: entre(aleatorio, 1.3, 2),
    gravidade: 380 * escala,
    vida: entre(aleatorio, 4, 7),
  };
  if (origem === "topo")
    return {
      ...base,
      x: entre(aleatorio, 0, largura),
      y: -12 * escala,
      vx: entre(aleatorio, -40, 40) * escala,
      vy: entre(aleatorio, 40, 120) * escala,
      atrito: entre(aleatorio, 2.2, 3),
    };
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
    x,
    y,
    vx: doTopo ? entre(aleatorio, -60, 60) * escala : Math.sin(angulo) * forca,
    vy: doTopo ? entre(aleatorio, 30, 90) * escala : -Math.cos(angulo) * forca,
    atrito: doTopo ? 1.6 : 1.25,
    gravidade: 300 * escala,
    // Cacho: a direção gira, e o giro troca de sentido de vez em quando.
    giro: entre(aleatorio, 3.5, 7.5) * (aleatorio() < 0.5 ? -1 : 1),
    trocaDoGiro: entre(aleatorio, 0.35, 0.8),
    relogio: 0,
    rastro: [{ x, y }],
    cor: sortear(aleatorio, paleta.cores),
    espessura: entre(aleatorio, 2.2, 3.6) * Math.max(0.8, escala),
    vida: entre(aleatorio, 4, 6.5),
  };
}

function cometa(cena: CenaParaNascer): ParticulaNascendo<CometaDoMotor> {
  const { largura, altura, escala, aleatorio, paleta } = cena;
  const angulo = entre(aleatorio, 0.35, 0.7); // abaixo da horizontal
  const velocidade = entre(aleatorio, 650, 1050) * escala;
  const x = entre(aleatorio, -0.15, 0.75) * largura;
  const y = entre(aleatorio, -0.05, 0.3) * altura;
  return {
    tipo: "cometa",
    x,
    y,
    vx: Math.cos(angulo) * velocidade,
    vy: Math.sin(angulo) * velocidade,
    atrito: 0.25,
    gravidade: 60 * escala,
    rastro: [{ x, y }],
    cor: aleatorio() < 0.5 ? paleta.centelha : sortear(aleatorio, paleta.cores),
    tamanho: entre(aleatorio, 1.6, 2.6) * Math.max(0.8, escala),
    vida: entre(aleatorio, 0.8, 1.3),
  };
}

function estrela(cena: CenaParaNascer): ParticulaNascendo<EstrelaDoMotor> {
  const { largura, escala, aleatorio, paleta } = cena;
  return {
    tipo: "estrela",
    x: entre(aleatorio, 0, largura),
    y: -10 * escala,
    vx: entre(aleatorio, -15, 15) * escala,
    vy: entre(aleatorio, 45, 110) * escala,
    atrito: 0.4,
    gravidade: 25 * escala,
    rot: aleatorio() * Math.PI,
    vrot: entre(aleatorio, -2.5, 2.5),
    fase: aleatorio() * Math.PI * 2,
    cintila: entre(aleatorio, 5, 11),
    cor: aleatorio() < 0.45 ? paleta.dourado : sortear(aleatorio, paleta.cores),
    tamanho: entre(aleatorio, 4, 9) * escala,
    vida: entre(aleatorio, 3, 5),
  };
}

const CORES_DOS_CORACOES = ["#ff4d6d", "#ff758f", "#ff8fab", "#e5383b"];

function coracao(cena: CenaParaNascer): ParticulaNascendo<FlutuanteDoMotor> {
  const { largura, altura, escala, aleatorio, paleta } = cena;
  return {
    tipo: "coracao",
    x: entre(aleatorio, 0.04, 0.96) * largura,
    y: altura + 20 * escala,
    vx: 0,
    vy: -entre(aleatorio, 90, 180) * escala,
    atrito: 0.35,
    gravidade: -18 * escala, // empuxo: sobe devagar
    fase: aleatorio() * Math.PI * 2,
    balanco: entre(aleatorio, 25, 55) * escala,
    frequencia: entre(aleatorio, 0.8, 1.6),
    cor:
      aleatorio() < 0.8
        ? sortear(aleatorio, CORES_DOS_CORACOES)
        : sortear(aleatorio, paleta.cores),
    tamanho: entre(aleatorio, 10, 24) * escala,
    vida: entre(aleatorio, 3, 4.5),
  };
}

function balao(cena: CenaParaNascer): ParticulaNascendo<FlutuanteDoMotor> {
  const { largura, altura, escala, aleatorio, paleta } = cena;
  const raio = entre(aleatorio, 16, 30) * escala;
  return {
    tipo: "balao",
    x: entre(aleatorio, 0.05, 0.95) * largura,
    y: altura + raio * 3,
    vx: 0,
    vy: -entre(aleatorio, 70, 135) * escala,
    atrito: 0.25,
    gravidade: -14 * escala,
    fase: aleatorio() * Math.PI * 2,
    balanco: entre(aleatorio, 14, 30) * escala,
    frequencia: entre(aleatorio, 0.5, 1),
    cor: sortear(aleatorio, paleta.cores),
    tamanho: raio,
    vida: entre(aleatorio, 6, 9),
  };
}

const NASCER = Object.freeze({
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
  const nascer = (
    NASCER as Readonly<
      Record<
        string,
        | ((cena: CenaParaNascer, origem: string) => ParticulaNascendo)
        | undefined
      >
    >
  )[lote.peca];
  if (!nascer) return [];
  return Array.from({ length: quantos }, () => {
    const p = nascer(cena, lote.origem);
    return { ...p, vidaMax: p.vida, idade: 0 } as ParticulaDoMotor;
  });
}

// ── Física ──────────────────────────────────────────────────────────────────

const MAXIMO_DO_RASTRO: Readonly<Record<string, number>> = Object.freeze({
  serpentina: 22,
  cometa: 14,
});

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
  p.vy = p.vy * freio + p.gravidade * dt;
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
  if (p.balanco)
    deriva =
      Math.cos(p.idade * p.frequencia! * 2 * Math.PI + (p.fase || 0)) *
      p.balanco;
  p.x += (p.vx + deriva) * dt;
  p.y += p.vy * dt;
  if (p.vrot) p.rot! += p.vrot * dt;
  if (p.vfase) p.fase! += p.vfase * dt;
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

/** Brilho (0–1): entra rápido, sai no fim da vida; a estrela cintila. */
export function brilhoDoMotor(p: ParticulaDoMotor): number {
  const resto = limitar(p.vida / p.vidaMax, 0, 1);
  const entrada = limitar(p.idade / 0.2, 0, 1);
  let brilho = Math.min(entrada, resto < 0.3 ? resto / 0.3 : 1);
  if (p.tipo === "estrela")
    brilho *= 0.55 + 0.45 * Math.sin(p.idade * p.cintila + p.fase);
  return limitar(brilho, 0, 1);
}

// ── A cena ──────────────────────────────────────────────────────────────────

/**
 * A cena de um efeito para uma tela. `intensidade`: suave, normal ou festa;
 * `duracaoMs`: 2–15 s (fogos: 4–15 s; vazio, a padrão de cada um);
 * `forma`, `comAya` e `amostrarTexto` vão para os fogos (fogos.ts).
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
        amostrarTexto,
        duracaoMs: pedida,
      })
    : null;
  const duracao = show ? show.duracao : (pedida ?? DURACAO_PADRAO_MS) / 1000;
  const quantidade = nivel.quantidade * fatorDeFaiscas(largura, altura);
  const lotes = componentes
    .filter((c) => c !== "fogos")
    .flatMap((peca) => lotesDaPeca(peca, { duracao, quantidade }))
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
  if (cena.show) {
    avancarShow(cena.show, passo);
    cena.eventos.push(...cena.show.eventos.splice(0));
  }
  const novas: ParticulaDoMotor[] = [];
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

// ── Desenho (num contexto 2D qualquer) ──────────────────────────────────────

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
    contexto.lineWidth = espessura * (p.tipo === "cometa" ? 0.3 + u : 1);
    contexto.beginPath();
    contexto.moveTo(pontos[i - 1]!.x, pontos[i - 1]!.y);
    contexto.lineTo(pontos[i]!.x, pontos[i]!.y);
    contexto.stroke();
  }
}

/**
 * Desenha as partículas do motor (não os fogos, que são de
 * src/modules/comemoracao.js). `saida` (0–1) apaga tudo no fim da cena.
 */
export function desenharParticulasDoMotor(
  contexto: CanvasRenderingContext2D,
  cena: CenaDeEfeitos,
): void {
  const saida = fatorDeSaida(cena.t, cena.duracao);
  for (const p of cena.particulas) {
    const alfa = brilhoDoMotor(p) * saida;
    if (alfa <= 0.01) continue;
    if (p.tipo === "serpentina") {
      desenharRastro(contexto, p, alfa, p.espessura);
      continue;
    }
    if (p.tipo === "cometa") {
      desenharRastro(contexto, p, alfa, p.tamanho * 1.6);
      contexto.globalAlpha = alfa;
      contexto.fillStyle = p.cor;
      contexto.beginPath();
      contexto.arc(p.x, p.y, p.tamanho * 1.2, 0, Math.PI * 2);
      contexto.fill();
      continue;
    }
    contexto.save();
    contexto.globalAlpha = alfa;
    contexto.fillStyle = p.cor;
    contexto.translate(p.x, p.y);
    if (p.tipo === "confete") {
      contexto.rotate(p.rot);
      // O "virar" da folhinha: achata no eixo y conforme a fase.
      contexto.scale(1, Math.max(0.08, Math.abs(Math.cos(p.fase))));
      if (p.forma === "circulo") {
        contexto.beginPath();
        contexto.arc(0, 0, p.altura * 0.8, 0, Math.PI * 2);
        contexto.fill();
      } else {
        const largura = p.forma === "tira" ? p.largura * 1.6 : p.largura;
        const altura = p.forma === "tira" ? p.altura * 0.6 : p.altura;
        contexto.fillRect(-largura / 2, -altura / 2, largura, altura);
      }
    } else if (p.tipo === "estrela") {
      contexto.rotate(p.rot);
      caminhoDaEstrela(contexto, p.tamanho);
      contexto.fill();
    } else if (p.tipo === "coracao") {
      const surgir = limitar(p.idade / 0.25, 0, 1);
      contexto.rotate(0.15 * Math.sin(p.idade * p.frequencia * 2 * Math.PI));
      caminhoDoCoracao(contexto, p.tamanho * (0.4 + 0.6 * surgir));
      contexto.fill();
    } else if (p.tipo === "balao") {
      const r = p.tamanho;
      const inclina = 0.12 * Math.sin(p.idade * p.frequencia * 2 * Math.PI);
      contexto.rotate(inclina);
      // Barbante: uma curva que balança abaixo do nó.
      contexto.strokeStyle = p.cor;
      contexto.lineWidth = 1;
      contexto.globalAlpha = alfa * 0.7;
      contexto.beginPath();
      contexto.moveTo(0, r * 1.2);
      contexto.quadraticCurveTo(
        r * 0.4 * Math.sin(p.idade * 3 + p.fase),
        r * 2,
        0,
        r * 2.8,
      );
      contexto.stroke();
      contexto.globalAlpha = alfa;
      contexto.beginPath();
      contexto.ellipse(0, 0, r * 0.85, r, 0, 0, Math.PI * 2);
      contexto.fill();
      // Nó e reflexo.
      contexto.beginPath();
      contexto.moveTo(-r * 0.12, r * 1.08);
      contexto.lineTo(r * 0.12, r * 1.08);
      contexto.lineTo(0, r * 0.95);
      contexto.closePath();
      contexto.fill();
      contexto.globalAlpha = alfa * 0.35;
      contexto.fillStyle = "#ffffff";
      contexto.beginPath();
      contexto.ellipse(
        -r * 0.3,
        -r * 0.35,
        r * 0.18,
        r * 0.3,
        -0.5,
        0,
        Math.PI * 2,
      );
      contexto.fill();
    }
    contexto.restore();
  }
  contexto.globalAlpha = 1;
}
