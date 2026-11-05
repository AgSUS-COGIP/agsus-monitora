/*
  Fogos de artifício das comemorações, sem DOM: o roteiro do show, a física
  das faíscas e a paleta. O desenho no <canvas> é de src/modulos/comemoracao/,
  que só chama `criarShow`, `avancarShow` e as funções de brilho e cor daqui.
  A Aya, o véu e o som são de src/lib/fogos-cena.ts; o marco desenhado no
  céu (pontos da forma ou do número), de src/lib/fogos-formas.ts.

  O show (5–6 s):
    1. a Aya atravessa a tela voando e solta o primeiro foguete;
    2. foguetes sobem de pontos diferentes da base, desaceleram pela
       gravidade e estouram no ápice, escalonados, em salvas — peônia,
       crisântemo, anel, salgueiro, estalinho, kamuro (chuva dourada lenta),
       glitter (faíscas que piscam), palmeira (braços grossos com rastro) e
       bomba dupla (estoura em dois tempos);
    3. o estouro do marco: as faíscas convergem para a forma (coração,
       estrela, visto ou o número) e brilham ali; sem forma, um crisântemo
       grande no centro;
    4. o grande final: nos últimos ~1,5 s, uma salva de 6–8 estouros quase
       juntos dos lados do marco.
  Cada estouro deixa um pouco de fumaça que sobe e se dissipa.

  Unidades: tempo em segundos, posição em px CSS, velocidade em px/s. O
  sorteio vem de `aleatorio` (padrão Math.random) para os testes fixarem a
  semente com `criarAleatorio`.
*/

import { DURACAO_DOS_FOGOS_MS } from "./comemoracao.ts";
import { dancaDaAya, pontoDaSoltura, trajetoDaAya } from "./fogos-cena.ts";
import {
  contornoDaEstrela,
  contornoDoCoracao,
  pontosDaForma,
  pontosDoLetreiro,
} from "./fogos-formas.ts";
import type { DancaDaAya, TrajetoDaAya } from "./fogos-cena.ts";
import type { AmostrarTexto, PontoDaForma } from "./fogos-formas.ts";

/** Sorteio de 0 (inclusive) a 1 (exclusive), como Math.random. */
export type Aleatorio = () => number;

/** Ponto em px CSS. */
export interface PontoXY {
  x: number;
  y: number;
}

export interface IntensidadeDoShow {
  explosoes: number;
  final: number;
  duracaoMs: number;
  /** Rajadas: sequências de estouros pequenos do mesmo ponto. */
  rajadas: number;
  /** Tiros de cada rajada. */
  tiros: number;
  /** A apoteose: estouros juntos no fim, depois do grande final. */
  apoteose: number;
  /** A Aya volta para dançar no fim (e solta confete). */
  danca: boolean;
  /** O texto do marco escrito no céu no grande final. */
  letreiro: boolean;
}

export type NomeDoFormato =
  | "peonia"
  | "crisantemo"
  | "anel"
  | "salgueiro"
  | "estalinho"
  | "kamuro"
  | "glitter"
  | "palmeira"
  | "pistilo"
  | "bombaDupla"
  | "coracao"
  | "estrela"
  | "cometa"
  | "crepitante";

/** Um formato de estouro (ver o comentário de FORMATOS). */
export interface FormatoDosFogos {
  faiscas: number;
  forca: number;
  atrito: number;
  peso: number;
  vida: readonly [number, number];
  rastro: number;
  tamanho: number;
  cintila?: boolean;
  dourado?: boolean;
  estala?: boolean;
  pisca?: readonly [number, number];
  emite?: number;
  nucleo?: number;
  segundo?: { formato: NomeDoFormato; atraso: number };
  /** As brasas que solta (`emite`) são da cor da faísca, não douradas. */
  brasaDaCor?: boolean;
  /** Não encolhe em tela pequena (poucos braços: palmeira, cometa). */
  inteiro?: boolean;
}

/** O formato pelo nome, de um texto qualquer. */
type FormatosPorNome = Readonly<Record<string, FormatoDosFogos | undefined>>;

export interface PaletaDosFogos {
  cores: string[];
  dourado: string;
  ambar: string;
  centelha: string;
  fumaca: string;
  composicao: GlobalCompositeOperation;
  /** A cor da área atual (SI, SEDE, Projetos), quando o tema a tem. */
  area?: string | null;
}

export type PapelDoEstouro =
  "aya" | "comum" | "rajada" | "marco" | "letreiro" | "final" | "apoteose";

/** Um foguete do roteiro. `formato` é um NomeDoFormato ou "marco". */
export interface PlanoDoFoguete {
  formato: string;
  papel: PapelDoEstouro;
  estouro: number;
  lancamento: number;
  xBase: number;
  yBase: number;
  xAlvo: number;
  yAlvo: number;
  cor: string;
  cor2: string | null;
  corFinal: string | null;
  vidaFator: number;
  /** Rajada: estouro menor (fração das faíscas e da força). */
  porte?: number;
  /** O foguete assobia ao subir (o som). */
  assobia?: boolean;
  /** Só no marco com forma: os pontos do desenho. */
  pontos?: readonly PontoDaForma[] | null;
  fimDaForma?: number;
}

export interface FogueteNoAr extends PontoXY {
  plano: PlanoDoFoguete;
  vx: number;
  vy: number;
  gravidade: number;
  idade: number;
  subida: number;
}

/** O que toda partícula dos fogos tem. */
interface BaseDaParticula extends PontoXY {
  vx: number;
  vy: number;
  atrito: number;
  gravidade: number;
  vida: number;
  vidaMax: number;
  cor: string;
  tamanho: number;
  rastro: number;
  corFinal?: string | null;
  cintila?: boolean;
  estala?: boolean;
  /** Glitter: piscadas por segundo (0, não pisca). */
  pisca?: number;
  fase?: number;
  /** Palmeira: brasas por segundo. */
  emite?: number;
  /** Fumaça: quanto cresce por segundo. */
  cresce?: number;
  /** A cor das brasas que solta (cometa); sem ela, dourado. */
  brasa?: string;
}
export interface ParticulaComum extends BaseDaParticula {
  tipo: "faisca" | "clarao" | "fumaca" | "centelha";
}
/** A faísca do marco: curva até o lugar, brilha e cai. */
export interface ParticulaDoAlvo extends BaseDaParticula {
  tipo: "alvo";
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  xa: number;
  ya: number;
  idade: number;
  convergencia: number;
  segura: number;
  fase: number;
  caindo?: number;
}
/** O segundo tempo da bomba dupla: estoura de novo ao apagar. */
export interface SementeDosFogos extends BaseDaParticula {
  tipo: "semente";
  plano: PlanoDoFoguete;
}
export type ParticulaDosFogos =
  ParticulaComum | ParticulaDoAlvo | SementeDosFogos;

/**
 * Evento ainda não tocado (som): o estouro, o lançamento de um foguete que
 * assobia (`subida`: quanto sobe, em s) e o confete da Aya dançando.
 */
export interface EventoDoEstouro extends PontoXY {
  tipo: "estouro" | "lancamento" | "confete";
  formato: string;
  papel: PapelDoEstouro;
  subida?: number;
}

export interface ShowDeFogos {
  t: number;
  duracao: number;
  escala: number;
  fator: number;
  paleta: PaletaDosFogos;
  limite: number;
  aleatorio: Aleatorio;
  aya: TrajetoDaAya | null;
  /** A Aya dançando no fim (Normal e Festa). */
  danca: DancaDaAya | null;
  /** O confete da dança já saiu. */
  confeteSolto: boolean;
  pontos: PontoDaForma[];
  /** O letreiro: o texto do marco escrito no céu. */
  letreiro: PontoDaForma[];
  planos: PlanoDoFoguete[];
  proximo: number;
  foguetes: FogueteNoAr[];
  particulas: ParticulaDosFogos[];
  estouros: number;
  eventos: EventoDoEstouro[];
}

interface ContextoDoPlano {
  largura: number;
  altura: number;
  duracao: number;
  gravidade: number;
  paleta: PaletaDosFogos;
  aleatorio: Aleatorio;
}

/* Gravidade das faíscas e dos foguetes (px/s² numa tela de referência). */
export const GRAVIDADE = 240;
/* Foguete "pesado": sobe em ~0,9 s, para caber no show de 5–6 s. */
export const GRAVIDADE_DO_FOGUETE = 1300;
/* Teto de partículas vivas ao mesmo tempo, em qualquer tela. */
export const LIMITE_DE_PARTICULAS = 3000;
/* Passo máximo da simulação: aba que volta do fundo não "pula" o show. */
export const PASSO_MAXIMO_S = 1 / 20;

/*
  Por intensidade: estouros comuns, estouros do grande final e duração (ms).
  Todas entre 5 e 6 s; o estouro do marco vem sempre, além destes.
*/
export const INTENSIDADES = Object.freeze({
  pequeno: Object.freeze({
    explosoes: 6,
    final: 6,
    duracaoMs: 5000,
    rajadas: 0,
    tiros: 0,
    apoteose: 0,
    danca: false,
    letreiro: false,
  }),
  cheio: Object.freeze({
    explosoes: 9,
    final: 7,
    duracaoMs: DURACAO_DOS_FOGOS_MS,
    rajadas: 1,
    tiros: 4,
    apoteose: 3,
    danca: true,
    letreiro: true,
  }),
  fogos: Object.freeze({
    explosoes: 10,
    final: 7,
    duracaoMs: 5500,
    rajadas: 1,
    tiros: 5,
    apoteose: 3,
    danca: true,
    letreiro: true,
  }),
  /* Festa: onde vale tudo. */
  festa: Object.freeze({
    explosoes: 12,
    final: 8,
    duracaoMs: 6000,
    rajadas: 2,
    tiros: 6,
    apoteose: 6,
    danca: true,
    letreiro: true,
  }),
});

export const intensidadeDoShow = (nome: unknown): IntensidadeDoShow =>
  (INTENSIDADES as Readonly<Record<string, IntensidadeDoShow | undefined>>)[
    nome as string
  ] || INTENSIDADES.cheio;

/* A duração que Configurações › Comemorações pode pedir aos fogos (s). */
export const DURACAO_MINIMA_DOS_FOGOS_S = 4;
export const DURACAO_MAXIMA_DOS_FOGOS_S = 15;

/**
 * A duração do show (s): a pedida (`duracaoMs`, limitada a 4–15 s) ou a da
 * intensidade. Show mais longo solta proporcionalmente mais estouros comuns.
 */
export function duracaoDoShow(
  intensidade: unknown,
  duracaoMs: unknown = null,
): number {
  const base = intensidadeDoShow(intensidade).duracaoMs / 1000;
  const pedida = Number(duracaoMs);
  if (!duracaoMs || !Number.isFinite(pedida)) return base;
  return Math.min(
    DURACAO_MAXIMA_DOS_FOGOS_S,
    Math.max(DURACAO_MINIMA_DOS_FOGOS_S, pedida / 1000),
  );
}

/*
  Os formatos: quantas faíscas, força do estouro (fração da velocidade de
  referência), atrito do ar (por segundo), peso da gravidade, vida (s),
  comprimento do rastro, se cintila, se estala ao apagar, se pisca (glitter:
  piscadas por segundo), se solta brasas pelo caminho (palmeira: por
  segundo), se é dourado e se tem um segundo tempo (bomba dupla). Coração
  e estrela desenham a forma com as faíscas (a velocidade de cada uma segue
  o contorno); cometa são poucos riscos grossos e coloridos que soltam
  brasas da própria cor; crepitante é o crisântemo cujas pontas estalam.
*/
export const FORMATOS: Readonly<Record<NomeDoFormato, FormatoDosFogos>> =
  Object.freeze({
    peonia: {
      faiscas: 160,
      forca: 1,
      atrito: 1.7,
      peso: 1,
      vida: [1.0, 1.4],
      rastro: 0.5,
      tamanho: 2,
    },
    crisantemo: {
      faiscas: 180,
      forca: 1.05,
      atrito: 1.4,
      peso: 0.9,
      vida: [1.3, 1.75],
      rastro: 1.5,
      tamanho: 1.7,
      cintila: true,
    },
    anel: {
      faiscas: 90,
      forca: 0.95,
      atrito: 1.6,
      peso: 0.8,
      vida: [1.0, 1.3],
      rastro: 0.6,
      tamanho: 2.1,
    },
    salgueiro: {
      faiscas: 120,
      forca: 0.8,
      atrito: 2.6,
      peso: 0.55,
      vida: [1.9, 2.4],
      rastro: 2.2,
      tamanho: 1.5,
      cintila: true,
      dourado: true,
    },
    estalinho: {
      faiscas: 100,
      forca: 0.85,
      atrito: 1.9,
      peso: 1,
      vida: [0.75, 1.05],
      rastro: 0.4,
      tamanho: 1.8,
      estala: true,
    },
    kamuro: {
      faiscas: 150,
      forca: 0.9,
      atrito: 2.3,
      peso: 0.32,
      vida: [2.3, 2.8],
      rastro: 2.8,
      tamanho: 1.6,
      cintila: true,
      dourado: true,
    },
    glitter: {
      faiscas: 130,
      forca: 0.95,
      atrito: 1.8,
      peso: 0.8,
      vida: [1.2, 1.6],
      rastro: 0.25,
      tamanho: 2,
      pisca: [9, 16],
    },
    palmeira: {
      faiscas: 14,
      forca: 1.15,
      atrito: 1.2,
      peso: 0.9,
      vida: [1.4, 1.8],
      rastro: 3,
      tamanho: 3.6,
      emite: 26,
      dourado: true,
      inteiro: true,
    },
    /* Camadas: casca por fora e um miolo (pistilo) de outra cor, mais lento. */
    pistilo: {
      faiscas: 170,
      nucleo: 0.3,
      forca: 1,
      atrito: 1.7,
      peso: 0.95,
      vida: [1.1, 1.5],
      rastro: 0.7,
      tamanho: 2,
      cintila: true,
    },
    bombaDupla: {
      faiscas: 80,
      forca: 0.55,
      atrito: 1.9,
      peso: 0.9,
      vida: [0.45, 0.6],
      rastro: 0.5,
      tamanho: 1.8,
      segundo: { formato: "peonia", atraso: 0.38 },
    },
    coracao: {
      faiscas: 120,
      forca: 0.85,
      atrito: 2,
      peso: 0.3,
      vida: [1.2, 1.5],
      rastro: 0.5,
      tamanho: 2.1,
      cintila: true,
    },
    estrela: {
      faiscas: 110,
      forca: 0.95,
      atrito: 2,
      peso: 0.35,
      vida: [1.1, 1.4],
      rastro: 0.5,
      tamanho: 2,
      cintila: true,
    },
    cometa: {
      faiscas: 7,
      forca: 1.2,
      atrito: 0.9,
      peso: 1,
      vida: [1.3, 1.7],
      rastro: 3.4,
      tamanho: 3.2,
      emite: 34,
      brasaDaCor: true,
      inteiro: true,
    },
    crepitante: {
      faiscas: 170,
      forca: 1.05,
      atrito: 1.5,
      peso: 0.9,
      vida: [1.1, 1.5],
      rastro: 1.2,
      tamanho: 1.7,
      cintila: true,
      estala: true,
    },
  });
export const NOMES_DOS_FORMATOS: readonly string[] = Object.freeze(
  Object.keys(FORMATOS),
);
/* Os formatos das rajadas: estouros pequenos, um atrás do outro. */
export const FORMATOS_DA_RAJADA: readonly string[] = Object.freeze([
  "estalinho",
  "glitter",
  "peonia",
  "estrela",
  "crepitante",
]);
/* A apoteose: curtos, cheios e com as formas (coração e estrela). */
export const FORMATOS_DA_APOTEOSE: readonly string[] = Object.freeze([
  "crepitante",
  "coracao",
  "estrela",
  "peonia",
  "glitter",
  "anel",
]);
/* O grande final usa só formatos curtos e cheios. */
export const FORMATOS_DO_FINAL: readonly string[] = Object.freeze([
  "peonia",
  "crisantemo",
  "glitter",
  "anel",
  "estalinho",
  "pistilo",
]);

/* Quanto tempo um formato brilha depois do estouro (com o segundo tempo). */
export function duracaoDoFormato(nome: unknown): number {
  const formato =
    (FORMATOS as FormatosPorNome)[nome as string] || FORMATOS.peonia;
  const segundo = formato.segundo;
  return (
    formato.vida[1] +
    (segundo ? segundo.atraso + FORMATOS[segundo.formato].vida[1] : 0)
  );
}

/* O estouro do marco: as faíscas que formam o desenho e o tempo de cada fase. */
export const MARCO = Object.freeze({
  /* Quantos pontos na forma (numa tela de referência). */
  pontos: 280,
  /* Segundos até as faíscas chegarem ao lugar. */
  convergencia: 0.8,
  /* A forma se desfaz este tanto antes do fim e cai até apagar. */
  desfazAntes: 0.75,
  queda: 0.6,
});

/*
  O letreiro: estoura pouco antes do marco (as faíscas levam ~0,8 s para
  chegar) e fica legível até perto do fim, junto com a forma, o grande
  final e a apoteose.
*/
export const LETREIRO = Object.freeze({
  /* Quantos pontos no texto (numa tela de referência). */
  pontos: 420,
  estouraAntes: 2.6,
  desfazAntes: 0.5,
});

/* As rajadas: um tiro a cada `intervalo` s, cada um com `porte` do estouro. */
export const RAJADA = Object.freeze({ intervalo: 0.13, porte: 0.45 });

/* A apoteose: começa este tanto antes do fim e se espalha nesta janela (s). */
export const APOTEOSE = Object.freeze({ estouraAntes: 1.1, janela: 0.2 });

/* Gerador com semente (mulberry32), para testes repetíveis. */
export function criarAleatorio(semente = 1): Aleatorio {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const entre = (aleatorio: Aleatorio, min: number, max: number): number =>
  min + (max - min) * aleatorio();
const limitar = (valor: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, valor));
const sortear = <T>(aleatorio: Aleatorio, lista: readonly T[]): T =>
  lista[Math.floor(aleatorio() * lista.length) % lista.length]!;

function embaralhar<T>(lista: readonly T[], aleatorio: Aleatorio): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}

/* A escala da tela: estouros proporcionais ao menor lado (tela de 800 px = 1). */
export const escalaDaTela = (largura: number, altura: number): number =>
  limitar(Math.min(largura, altura) / 800, 0.55, 1.4);

/* Telas pequenas soltam menos faíscas (metade, no mínimo). */
export const fatorDeFaiscas = (largura: number, altura: number): number =>
  limitar((largura * altura) / (1280 * 720), 0.5, 1);

// ── Paleta ──────────────────────────────────────────────────────────────────

/* Tokens da marca usados nos estouros (o tema decide o valor). */
export const TOKENS_DA_PALETA = Object.freeze([
  "--brand-primary",
  "--brand-accent",
  "--series-1",
  "--series-2",
  "--series-3",
  "--series-4",
  "--series-5",
]);
const DOURADOS = ["#ffd23f", "#ffb627"] as const;
const BRANCO = "#fff6dc";
/* Cores vivas que brilham sobre o véu; no tema claro, somam-se às da marca. */
const VIVAS = ["#59f2c8", "#4fdcff", "#ff7a59", "#c38cff"];

/*
  A cor de cada área (src/styles/barra-lateral.css, [data-cor-da-area]): o
  token que o tema dá a ela. Os fogos puxam essa cor para a forma, o
  letreiro e parte dos estouros.
*/
export const TOKENS_DAS_AREAS: Readonly<Record<string, string>> = Object.freeze(
  {
    "saude-indigena": "--state-success",
    sede: "--state-info",
    projetos: "--state-warning",
  },
);

/**
 * As cores do show: os tokens do tema que tiverem valor, mais dourado e
 * branco. Com o véu escuro por baixo, a luz se soma ("lighter") nos dois
 * temas; no claro, que tem tokens escuros, entram também cores vivas.
 * `lerToken` devolve o valor do token (ou vazio). Sem token, a reserva.
 */
export function paletaDosFogos(
  lerToken: (nome: string) => unknown = () => "",
  {
    escuro = true,
    area = null,
  }: { escuro?: boolean; area?: string | null } = {},
): PaletaDosFogos {
  const ler = (nome: string): string => {
    try {
      return String(lerToken(nome) || "").trim();
    } catch {
      return "";
    }
  };
  const ehCor = (cor: string) => /^(#|rgb|hsl)/i.test(cor);
  const daMarca = TOKENS_DA_PALETA.map(ler).filter(ehCor);
  const tokenDaArea = area ? TOKENS_DAS_AREAS[area] : undefined;
  const lida = tokenDaArea ? ler(tokenDaArea) : "";
  const daArea = ehCor(lida) ? lida : null;
  const base = daMarca.length ? daMarca : VIVAS;
  return {
    cores: [
      ...new Set([
        ...(daArea ? [daArea] : []),
        ...base,
        ...(escuro ? [] : VIVAS),
        ...DOURADOS,
        BRANCO,
      ]),
    ],
    dourado: DOURADOS[0],
    ambar: DOURADOS[1],
    centelha: BRANCO,
    fumaca: escuro ? "#9aa6bd" : "#c9d2e3",
    composicao: "lighter",
    area: daArea,
  };
}

// ── Roteiro ─────────────────────────────────────────────────────────────────

/* Tempo de subida até o ápice a `altura` px acima da base. */
export const tempoDeSubida = (
  altura: number,
  gravidade: number = GRAVIDADE_DO_FOGUETE,
): number => Math.sqrt((2 * Math.max(0, altura)) / gravidade);

/* Quanto o foguete solto pela Aya leva até estourar. */
export const SUBIDA_DA_AYA = 0.55;

/* Os instantes dos estouros comuns: salvas de 1 a 3 entre `primeiro` e `ultimo`. */
function instantesComuns({
  explosoes,
  primeiro,
  ultimo,
  aleatorio,
}: {
  explosoes: number;
  primeiro: number;
  ultimo: number;
  aleatorio: Aleatorio;
}): number[] {
  const instantes: number[] = [];
  const salvas = Math.max(2, Math.round(explosoes / 1.6));
  for (let s = 0; instantes.length < explosoes; s += 1) {
    const base = primeiro + ((ultimo - primeiro) * (s % salvas)) / (salvas - 1);
    const sorteio = aleatorio();
    const tamanho =
      sorteio < 0.18 && explosoes >= 10 ? 3 : sorteio < 0.5 ? 2 : 1;
    for (let j = 0; j < tamanho && instantes.length < explosoes; j += 1)
      instantes.push(
        limitar(
          base +
            entre(aleatorio, -0.12, 0.12) +
            j * entre(aleatorio, 0.04, 0.14),
          primeiro,
          ultimo,
        ),
      );
  }
  return instantes.sort((a, b) => a - b);
}

/* Um plano de foguete: base, alvo, instante do estouro e cores. */
function planoDoFoguete(
  {
    formato,
    estouro,
    papel,
    xAlvo,
    yAlvo,
    base = null,
  }: {
    formato: string;
    estouro: number;
    papel: PapelDoEstouro;
    xAlvo: number;
    yAlvo: number;
    base?: PontoXY | null;
  },
  { largura, altura, duracao, gravidade, paleta, aleatorio }: ContextoDoPlano,
): PlanoDoFoguete {
  const xBase =
    base?.x ??
    limitar(
      xAlvo + entre(aleatorio, -0.08, 0.08) * largura,
      largura * 0.04,
      largura * 0.96,
    );
  const yBase = base?.y ?? altura + 8;
  const subida = base
    ? SUBIDA_DA_AYA
    : Math.min(estouro, tempoDeSubida(yBase - yAlvo, gravidade));
  const dourado = (FORMATOS as FormatosPorNome)[formato]?.dourado;
  // Coração e estrela na cor da área, quando o tema tem uma.
  const daArea =
    Boolean(paleta.area) && (formato === "coracao" || formato === "estrela");
  return {
    formato,
    papel,
    estouro,
    lancamento: estouro - subida,
    xBase,
    yBase,
    xAlvo,
    yAlvo,
    cor: dourado
      ? paleta.dourado
      : daArea
        ? paleta.area!
        : sortear(aleatorio, paleta.cores),
    // Peônia (às vezes), pistilo e bomba dupla de duas cores; crisântemo e
    // kamuro terminam dourados.
    cor2:
      (formato === "peonia" && aleatorio() < 0.45) ||
      formato === "bombaDupla" ||
      formato === "pistilo"
        ? sortear(aleatorio, paleta.cores)
        : null,
    corFinal:
      formato === "crisantemo"
        ? paleta.dourado
        : formato === "kamuro"
          ? paleta.ambar
          : null,
    // Encurta a vida das faíscas para tudo apagar antes do fim do show.
    vidaFator: limitar(
      (duracao - 0.05 - estouro) / duracaoDoFormato(formato),
      0.2,
      1,
    ),
  };
}

/**
 * O roteiro: um foguete por estouro, ordenado pelo lançamento. `aya` (de
 * trajetoDaAya) faz o primeiro foguete nascer dela; `pontos` (de
 * pontosDaForma) fazem do estouro do marco o desenho; `letreiro` (de
 * pontosDoLetreiro), o texto do marco escrito no céu logo depois. Estouros
 * comuns escalonados e espalhados pela largura (uma faixa para cada), as
 * rajadas (tiros pequenos em leque, um atrás do outro), o marco no centro,
 * o grande final dos lados e a apoteose no alto, todos terminando a tempo
 * de apagar.
 */
export function planejarShow({
  largura = 800,
  altura = 600,
  intensidade = "cheio",
  paleta = paletaDosFogos(),
  aleatorio = Math.random,
  aya = null,
  pontos = [],
  letreiro = [],
  duracaoMs = null,
}: {
  largura?: number;
  altura?: number;
  intensidade?: string;
  paleta?: PaletaDosFogos;
  aleatorio?: Aleatorio;
  aya?: TrajetoDaAya | null;
  pontos?: readonly PontoDaForma[];
  letreiro?: readonly PontoDaForma[];
  duracaoMs?: number | null;
} = {}): PlanoDoFoguete[] {
  const base = intensidadeDoShow(intensidade);
  const duracao = duracaoDoShow(intensidade, duracaoMs);
  const final = base.final;
  const explosoes = Math.max(
    base.explosoes,
    Math.round((base.explosoes * duracao) / (base.duracaoMs / 1000)),
  );
  const escala = escalaDaTela(largura, altura);
  const contexto: ContextoDoPlano = {
    largura,
    altura,
    duracao,
    gravidade: GRAVIDADE_DO_FOGUETE * escala,
    paleta,
    aleatorio,
  };
  const soltura = aya ? pontoDaSoltura(aya) : null;
  // O foguete da Aya é o primeiro a estourar; os outros vêm logo depois
  // (do chão, sobem enquanto ela ainda voa).
  const primeiro = aya ? aya.inicio + aya.soltura + SUBIDA_DA_AYA : 0.9;
  const instantes = instantesComuns({
    explosoes,
    primeiro: aya ? primeiro + 0.35 : primeiro,
    ultimo: duracao - 2.45,
    aleatorio,
  });
  // Faixas da largura embaralhadas: cada estouro numa parte da tela.
  const faixas = embaralhar([...Array(explosoes).keys()], aleatorio);
  let sacola: string[] = [];
  const comuns = instantes.map((estouro, i) => {
    if (!sacola.length) sacola = embaralhar(NOMES_DOS_FORMATOS, aleatorio);
    const daAya = Boolean(soltura) && i === 0;
    return planoDoFoguete(
      {
        formato: sacola.pop()!,
        estouro: daAya ? primeiro : estouro,
        papel: daAya ? "aya" : "comum",
        xAlvo:
          largura *
          (0.08 +
            (0.84 * (faixas[i]! + entre(aleatorio, 0.2, 0.8))) / explosoes),
        yAlvo: daAya
          ? Math.min(
              soltura!.y - altura * 0.18,
              altura * entre(aleatorio, 0.12, 0.3),
            )
          : altura * entre(aleatorio, 0.1, 0.45),
        base: daAya ? soltura : null,
      },
      contexto,
    );
  });
  // Um em cada três comuns assobia ao subir (todos juntos cansariam).
  comuns.forEach((plano, i) => {
    if (plano.papel === "comum" && i % 3 === 1) plano.assobia = true;
  });

  // O marco: no centro, a forma (ou um crisântemo grande).
  const comForma = Array.isArray(pontos) && pontos.length > 0;
  const centro = comForma
    ? {
        x: pontos.reduce((s, p) => s + p.x, 0) / pontos.length,
        y: pontos.reduce((s, p) => s + p.y, 0) / pontos.length,
      }
    : { x: largura / 2, y: altura * 0.3 };
  const marco: PlanoDoFoguete = {
    ...planoDoFoguete(
      {
        formato: comForma ? "peonia" : "crisantemo",
        estouro: duracao - 2.25,
        papel: "marco",
        xAlvo: centro.x,
        yAlvo: centro.y,
      },
      contexto,
    ),
    xBase: centro.x,
    cor: paleta.dourado,
    cor2: comForma ? paleta.area || paleta.centelha : null,
    assobia: true,
  };
  if (comForma) {
    marco.formato = "marco";
    marco.pontos = pontos;
    marco.fimDaForma = duracao - MARCO.desfazAntes;
  }

  const comLetreiro = Array.isArray(letreiro) && letreiro.length > 0;
  // O grande final: `final` estouros quase juntos, dos lados do marco.
  const inicioDoFinal = duracao - 1.6;
  const fimDoFinal = duracao - 1.2;
  let formatosDoFinal: string[] = [];
  const finais = Array.from({ length: final }, (_, j) => {
    if (!formatosDoFinal.length)
      formatosDoFinal = embaralhar(FORMATOS_DO_FINAL, aleatorio);
    // Com forma, o meio fica para ela: metade de cada lado.
    const fracao = comForma
      ? j % 2
        ? 0.72 + (0.24 * (j - 1)) / Math.max(1, final - 1)
        : 0.04 + (0.24 * j) / Math.max(1, final - 1)
      : 0.06 + (0.88 * (j + 0.5)) / final;
    return planoDoFoguete(
      {
        formato: formatosDoFinal.pop()!,
        estouro: limitar(
          inicioDoFinal +
            ((fimDoFinal - inicioDoFinal) * j) / Math.max(1, final - 1) +
            entre(aleatorio, -0.04, 0.04),
          inicioDoFinal,
          fimDoFinal,
        ),
        papel: "final",
        xAlvo: largura * (fracao + entre(aleatorio, -0.03, 0.03)),
        // Com letreiro, o final fica acima dele.
        yAlvo:
          altura *
          entre(aleatorio, 0.1, comForma ? (comLetreiro ? 0.5 : 0.6) : 0.42),
      },
      contexto,
    );
  });

  const letreiros = comLetreiro ? [planoDoLetreiro(letreiro, contexto)] : [];
  const rajadas = planosDasRajadas({
    quantas: base.rajadas,
    tiros: base.tiros,
    primeiro: aya ? primeiro + 0.35 : primeiro,
    ultimo: duracao - 2.45,
    contexto,
  });
  const apoteose = planosDaApoteose(base.apoteose, contexto);

  return [
    ...comuns,
    ...rajadas,
    marco,
    ...letreiros,
    ...finais,
    ...apoteose,
  ].sort((a, b) => a.lancamento - b.lancamento);
}

/*
  O letreiro: um foguete do pé da tela, no centro, que estoura pouco antes
  do marco; as faíscas escrevem o texto e ficam até quase o fim, por baixo
  do grande final e da apoteose.
*/
function planoDoLetreiro(
  pontos: readonly PontoDaForma[],
  contexto: ContextoDoPlano,
): PlanoDoFoguete {
  const { duracao, paleta } = contexto;
  const x = pontos.reduce((s, p) => s + p.x, 0) / pontos.length;
  const y = pontos.reduce((s, p) => s + p.y, 0) / pontos.length;
  return {
    ...planoDoFoguete(
      {
        formato: "peonia",
        estouro: duracao - LETREIRO.estouraAntes,
        papel: "letreiro",
        xAlvo: x,
        yAlvo: y,
      },
      contexto,
    ),
    formato: "marco",
    xBase: x,
    cor: paleta.dourado,
    cor2: paleta.area || paleta.centelha,
    assobia: true,
    pontos,
    fimDaForma: duracao - LETREIRO.desfazAntes,
  };
}

/*
  As rajadas: de um ponto da base, `tiros` foguetes pequenos em leque, um a
  cada ~0,13 s, entre os estouros comuns. Show curto demais: sem rajada.
*/
function planosDasRajadas({
  quantas,
  tiros,
  primeiro,
  ultimo,
  contexto,
}: {
  quantas: number;
  tiros: number;
  primeiro: number;
  ultimo: number;
  contexto: ContextoDoPlano;
}): PlanoDoFoguete[] {
  const { largura, altura, aleatorio } = contexto;
  const intervalo = RAJADA.intervalo;
  const ultimoInicio = ultimo - intervalo * (tiros - 1);
  if (quantas <= 0 || tiros <= 0 || ultimoInicio <= primeiro) return [];
  const planos: PlanoDoFoguete[] = [];
  for (let r = 0; r < quantas; r += 1) {
    // Cada rajada numa metade da tela, alternando.
    const lado = r % 2 ? 0.62 : 0.18;
    const xBase = largura * (lado + entre(aleatorio, 0, 0.2));
    const inicio =
      primeiro +
      ((ultimoInicio - primeiro) * (r + entre(aleatorio, 0.2, 0.8))) / quantas;
    const formato = sortear(aleatorio, FORMATOS_DA_RAJADA);
    const yAlvo = altura * entre(aleatorio, 0.22, 0.34);
    for (let k = 0; k < tiros; k += 1) {
      const abertura = (k - (tiros - 1) / 2) / Math.max(1, tiros - 1);
      const plano = planoDoFoguete(
        {
          formato,
          estouro: inicio + k * intervalo,
          papel: "rajada",
          xAlvo: limitar(
            xBase + abertura * largura * 0.32,
            largura * 0.05,
            largura * 0.95,
          ),
          yAlvo: yAlvo + Math.abs(abertura) * altura * 0.1,
        },
        contexto,
      );
      plano.xBase = xBase;
      plano.porte = RAJADA.porte;
      planos.push(plano);
    }
  }
  return planos;
}

/*
  A apoteose: depois do grande final, `quantos` estouros quase juntos no
  alto, de ponta a ponta (com coração e estrela), enquanto o letreiro brilha.
*/
function planosDaApoteose(
  quantos: number,
  contexto: ContextoDoPlano,
): PlanoDoFoguete[] {
  const { largura, altura, duracao, aleatorio } = contexto;
  let formatos: string[] = [];
  return Array.from({ length: Math.max(0, quantos) }, (_, j) => {
    if (!formatos.length)
      formatos = embaralhar(FORMATOS_DA_APOTEOSE, aleatorio);
    return planoDoFoguete(
      {
        formato: formatos.pop()!,
        estouro: limitar(
          duracao -
            APOTEOSE.estouraAntes +
            (APOTEOSE.janela * j) / Math.max(1, quantos - 1) +
            entre(aleatorio, -0.03, 0.03),
          duracao - APOTEOSE.estouraAntes - 0.03,
          duracao - APOTEOSE.estouraAntes + APOTEOSE.janela,
        ),
        papel: "apoteose",
        xAlvo:
          largura *
          (0.08 + (0.84 * (j + entre(aleatorio, 0.3, 0.7))) / quantos),
        yAlvo: altura * entre(aleatorio, 0.1, 0.3),
      },
      contexto,
    );
  });
}

/**
 * O foguete de um plano no instante do lançamento: sobe com velocidade para
 * chegar ao alvo exatamente no instante do estouro (do chão, é o ápice).
 */
export function lancarFoguete(plano: PlanoDoFoguete, escala = 1): FogueteNoAr {
  const gravidade = GRAVIDADE_DO_FOGUETE * escala;
  const subida = Math.max(0.05, plano.estouro - plano.lancamento);
  return {
    plano,
    x: plano.xBase,
    y: plano.yBase,
    vx: (plano.xAlvo - plano.xBase) / subida,
    // Chega ao alvo em `subida` s; com a subida inteira, é o ápice (vy = 0).
    vy: (plano.yAlvo - plano.yBase) / subida - 0.5 * gravidade * subida,
    gravidade,
    idade: 0,
    subida,
  };
}

/** Move o foguete `dt` s. Devolve se chegou ao alvo (hora de estourar). */
export function moverFoguete(foguete: FogueteNoAr, dt: number): boolean {
  const resta = foguete.subida - foguete.idade;
  const passo = Math.min(dt, Math.max(0, resta));
  foguete.x += foguete.vx * passo;
  foguete.y += foguete.vy * passo + 0.5 * foguete.gravidade * passo * passo;
  foguete.vy += foguete.gravidade * passo;
  foguete.idade += passo;
  return foguete.idade >= foguete.subida - 1e-9;
}

// ── Estouro e física ────────────────────────────────────────────────────────

/*
  O contorno do coração e da estrela como direções de estouro: centrado na
  origem e com o ponto mais longe a 1. Um por quantidade (feito uma vez).
*/
const contornosDosEstouros = new Map<string, readonly PontoXY[]>();
function contornoDoEstouro(
  formato: "coracao" | "estrela",
  total: number,
): readonly PontoXY[] {
  const chave = `${formato}:${total}`;
  const pronto = contornosDosEstouros.get(chave);
  if (pronto) return pronto;
  const brutos =
    formato === "coracao"
      ? contornoDoCoracao(total)
      : contornoDaEstrela(total, 0.42);
  const cx = brutos.reduce((s, p) => s + p.x, 0) / brutos.length;
  const cy = brutos.reduce((s, p) => s + p.y, 0) / brutos.length;
  const raio = Math.max(
    1e-6,
    ...brutos.map((p) => Math.hypot(p.x - cx, p.y - cy)),
  );
  const contorno = brutos.map((p) => ({
    x: (p.x - cx) / raio,
    y: (p.y - cy) / raio,
  }));
  contornosDosEstouros.set(chave, contorno);
  return contorno;
}

/*
  Direção de uma faísca: esfera vista de frente (mais densa na borda), anel
  inclinado, os braços da palmeira e do cometa (igualmente espaçados) ou o
  contorno do coração e da estrela (a força segue a forma: o desenho abre
  inteiro e cresce sem deformar).
*/
function direcao(
  formato: string,
  i: number,
  total: number,
  aleatorio: Aleatorio,
  inclinacao: number,
  giro: number,
): [number, number] {
  if (formato === "anel") {
    const angulo = (i / total) * Math.PI * 2;
    const x = Math.cos(angulo);
    const y = Math.sin(angulo) * inclinacao;
    return [
      x * Math.cos(giro) - y * Math.sin(giro),
      x * Math.sin(giro) + y * Math.cos(giro),
    ];
  }
  if (formato === "coracao" || formato === "estrela") {
    const ponto = contornoDoEstouro(formato, total)[i]!;
    // O coração fica quase em pé; a estrela gira à vontade.
    const angulo = formato === "coracao" ? (giro - Math.PI / 2) * 0.25 : giro;
    return [
      ponto.x * Math.cos(angulo) - ponto.y * Math.sin(angulo),
      ponto.x * Math.sin(angulo) + ponto.y * Math.cos(angulo),
    ];
  }
  if (formato === "palmeira" || formato === "cometa") {
    const angulo =
      giro + (i / total) * Math.PI * 2 + entre(aleatorio, -0.08, 0.08);
    return [Math.cos(angulo), Math.sin(angulo)];
  }
  const z = entre(aleatorio, -1, 1);
  const angulo = aleatorio() * Math.PI * 2;
  const raio = Math.sqrt(1 - z * z);
  return [Math.cos(angulo) * raio, Math.sin(angulo) * raio];
}

const clarao = (
  x: number,
  y: number,
  cor: string,
  escala: number,
): ParticulaComum => ({
  tipo: "clarao",
  x,
  y,
  vx: 0,
  vy: 0,
  atrito: 0,
  gravidade: 0,
  vida: 0.18,
  vidaMax: 0.18,
  cor,
  tamanho: 70 * escala,
  rastro: 0,
});

/*
  As faíscas do marco: saem do centro numa curva (para fora e depois para o
  lugar), chegam em ~0,8 s, brilham na forma até `fimDaForma` e caem.
*/
function faiscasDoMarco(
  plano: PlanoDoFoguete,
  {
    x,
    y,
    escala,
    cabem,
    aleatorio,
  }: {
    x: number;
    y: number;
    escala: number;
    cabem: number;
    aleatorio: Aleatorio;
  },
): ParticulaDoAlvo[] {
  const pontos = plano.pontos!.slice(0, Math.max(0, cabem));
  const segura = Math.max(
    MARCO.convergencia + 0.1,
    (plano.fimDaForma ?? plano.estouro + 1.6) - plano.estouro,
  );
  return pontos.map((alvo, i): ParticulaDoAlvo => {
    const angulo = aleatorio() * Math.PI * 2;
    const abertura = entre(aleatorio, 60, 150) * escala;
    const convergencia = MARCO.convergencia * entre(aleatorio, 0.85, 1.1);
    const vida = segura + MARCO.queda * entre(aleatorio, 0.7, 1);
    return {
      tipo: "alvo",
      x,
      y,
      vx: 0,
      vy: 0,
      x0: x,
      y0: y,
      cx: (x + alvo.x) / 2 + Math.cos(angulo) * abertura,
      cy: (y + alvo.y) / 2 + Math.sin(angulo) * abertura,
      xa: alvo.x,
      ya: alvo.y,
      idade: 0,
      convergencia,
      segura,
      fase: aleatorio() * Math.PI * 2,
      atrito: 0.6,
      gravidade: GRAVIDADE * escala * 0.35,
      vida,
      vidaMax: vida,
      cor: plano.cor2 && i % 3 === 0 ? plano.cor2 : plano.cor,
      tamanho: 2.3 * Math.max(0.8, escala),
      rastro: 0.7,
    };
  });
}

/**
 * As faíscas de um estouro em (x, y). `cabem` limita a quantidade (teto de
 * partículas); `fator` reduz em tela pequena. Inclui um clarão no centro; a
 * bomba dupla leva uma "semente" que estoura de novo; o marco, as faíscas da
 * forma (e um enfeite de peônia).
 */
/** Onde e como estourar. `x` e `y` são obrigatórios: os padrões valem para o resto. */
export interface OpcoesDoEstouro extends PontoXY {
  escala?: number;
  fator?: number;
  cabem?: number;
  aleatorio?: Aleatorio;
}

export function estourar(
  plano: PlanoDoFoguete,
  {
    x,
    y,
    escala = 1,
    fator = 1,
    cabem = Infinity,
    aleatorio = Math.random,
  }: OpcoesDoEstouro = {} as OpcoesDoEstouro,
): ParticulaDosFogos[] {
  if (plano.formato === "marco" && plano.pontos?.length) {
    const forma = faiscasDoMarco(plano, {
      x,
      y,
      escala,
      cabem: cabem - 1,
      aleatorio,
    });
    const enfeite = estourar(
      { ...plano, formato: "peonia", pontos: null, vidaFator: 0.6 },
      {
        x,
        y,
        escala,
        fator: fator * 0.35,
        cabem: cabem - forma.length,
        aleatorio,
      },
    );
    return [...forma, ...enfeite];
  }
  const formato =
    (FORMATOS as FormatosPorNome)[plano.formato] || FORMATOS.peonia;
  const segundo = formato.segundo;
  const total = Math.max(
    0,
    Math.min(
      Math.round(
        formato.faiscas * (formato.inteiro ? 1 : fator) * (plano.porte ?? 1),
      ),
      cabem - 1 - (segundo ? 1 : 0),
    ),
  );
  const velocidade =
    330 *
    escala *
    formato.forca *
    (plano.papel === "marco" ? 1.2 : 1) *
    // A rajada abre menor (o porte é das faíscas; a força cai menos).
    Math.sqrt(plano.porte ?? 1);
  const vidaFator = plano.vidaFator ?? 1;
  const inclinacao = entre(aleatorio, 0.25, 0.7);
  const giro = aleatorio() * Math.PI;
  const faiscas: ParticulaDosFogos[] = [];
  // O miolo do pistilo: as primeiras faíscas, mais lentas e da segunda cor.
  const miolo = formato.nucleo ? Math.round(total * formato.nucleo) : 0;
  for (let i = 0; i < total; i += 1) {
    const doMiolo = i < miolo;
    const [dx, dy] = direcao(
      plano.formato,
      i,
      total,
      aleatorio,
      inclinacao,
      giro,
    );
    const impulso =
      velocidade * entre(aleatorio, 0.9, 1.06) * (doMiolo ? 0.42 : 1);
    const vida =
      entre(aleatorio, ...formato.vida) * vidaFator * (doMiolo ? 0.8 : 1);
    faiscas.push({
      tipo: "faisca",
      x,
      y,
      vx: dx * impulso,
      vy: dy * impulso,
      atrito: formato.atrito,
      gravidade: GRAVIDADE * escala * formato.peso,
      vida,
      vidaMax: vida,
      cor: doMiolo
        ? plano.cor2 || plano.cor
        : plano.cor2 && !miolo && i % 2
          ? plano.cor2
          : plano.cor,
      corFinal: plano.corFinal || null,
      tamanho: formato.tamanho * Math.max(0.8, escala),
      rastro: formato.rastro,
      cintila: Boolean(formato.cintila),
      estala: Boolean(formato.estala),
      pisca: formato.pisca ? entre(aleatorio, ...formato.pisca) : 0,
      fase: aleatorio() * Math.PI * 2,
      emite: formato.emite || 0,
      ...(formato.brasaDaCor ? { brasa: plano.cor } : {}),
    });
  }
  if (total > 0 && segundo)
    faiscas.push({
      tipo: "semente",
      x,
      y,
      vx: 0,
      vy: 0,
      atrito: 0,
      gravidade: 0,
      vida: segundo.atraso,
      vidaMax: segundo.atraso,
      cor: plano.cor,
      tamanho: 0,
      rastro: 0,
      plano: {
        ...plano,
        formato: segundo.formato,
        cor: plano.cor2 || plano.cor,
        cor2: null,
        estouro: (plano.estouro ?? 0) + segundo.atraso,
      },
    });
  if (total > 0)
    faiscas.push(
      clarao(
        x,
        y,
        plano.cor,
        escala *
          (plano.papel === "marco" ? 1.5 : 1) *
          Math.sqrt(plano.porte ?? 1),
      ),
    );
  return faiscas;
}

/** Cor e escala das partículas avulsas (fumaça, centelhas). */
export interface OpcoesDaFumaca {
  cor: string;
  escala?: number;
  cabem?: number;
  aleatorio?: Aleatorio;
}

/* Fumaça de um estouro: algumas nuvens claras, que crescem, sobem e somem. */
export function fumacaDoEstouro(
  { x, y }: PontoXY,
  {
    cor,
    escala = 1,
    cabem = Infinity,
    aleatorio = Math.random,
  }: OpcoesDaFumaca = {} as OpcoesDaFumaca,
): ParticulaComum[] {
  const quantas = Math.max(0, Math.min(3 + Math.floor(aleatorio() * 2), cabem));
  return Array.from({ length: quantas }, (): ParticulaComum => {
    const vida = entre(aleatorio, 1.6, 2.4);
    return {
      tipo: "fumaca",
      x: x + entre(aleatorio, -30, 30) * escala,
      y: y + entre(aleatorio, -20, 20) * escala,
      vx: entre(aleatorio, -16, 16) * escala,
      vy: entre(aleatorio, -10, 6) * escala,
      atrito: 0.8,
      gravidade: -10 * escala,
      vida,
      vidaMax: vida,
      cor,
      tamanho: entre(aleatorio, 24, 40) * escala,
      cresce: 22 * escala,
      rastro: 0,
    };
  });
}

/* A faísca do marco: curva até o lugar, brilha parada e depois cai. */
function moverAlvo(p: ParticulaDoAlvo, dt: number): boolean {
  const xAntes = p.x;
  const yAntes = p.y;
  p.idade += dt;
  p.vida -= dt;
  if (p.idade < p.convergencia) {
    const u = 1 - (1 - p.idade / p.convergencia) ** 3;
    const v = 1 - u;
    p.x = v * v * p.x0 + 2 * v * u * p.cx + u * u * p.xa;
    p.y = v * v * p.y0 + 2 * v * u * p.cy + u * u * p.ya;
  } else if (p.idade < p.segura) {
    p.x = p.xa;
    p.y = p.ya;
  } else {
    // Desfaz: cai devagar, como brasa.
    p.caindo = (p.caindo ?? 0) * Math.exp(-p.atrito * dt) + p.gravidade * dt;
    p.y += p.caindo * dt;
  }
  if (dt > 0) {
    p.vx = (p.x - xAntes) / dt;
    p.vy = (p.y - yAntes) / dt;
  }
  return p.vida > 0;
}

/** Física de uma partícula por `dt` s: atrito do ar, gravidade, posição, vida. */
export function moverParticula(p: ParticulaDosFogos, dt: number): boolean {
  if (p.tipo === "alvo") return moverAlvo(p, dt);
  const freio = Math.exp(-p.atrito * dt);
  p.vx *= freio;
  p.vy = p.vy * freio + p.gravidade * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (p.cresce) p.tamanho += p.cresce * dt;
  p.vida -= dt;
  return p.vida > 0;
}

/* Os estalos de uma faísca de estalinho que se apaga: centelhas curtas. */
export function centelhas(
  p: PontoXY,
  {
    cor,
    escala = 1,
    cabem = Infinity,
    aleatorio = Math.random,
  }: OpcoesDaFumaca = {} as OpcoesDaFumaca,
): ParticulaComum[] {
  const quantas = Math.max(0, Math.min(2 + Math.floor(aleatorio() * 3), cabem));
  return Array.from({ length: quantas }, (): ParticulaComum => {
    const vida = entre(aleatorio, 0.08, 0.22);
    const angulo = aleatorio() * Math.PI * 2;
    const impulso = entre(aleatorio, 20, 70) * escala;
    return {
      tipo: "centelha",
      x: p.x,
      y: p.y,
      vx: Math.cos(angulo) * impulso,
      vy: Math.sin(angulo) * impulso,
      atrito: 3,
      gravidade: GRAVIDADE * escala * 0.3,
      vida,
      vidaMax: vida,
      cor,
      tamanho: 1.4 * Math.max(0.8, escala),
      rastro: 0,
    };
  });
}

/* Brasas que caem pelo caminho: do foguete subindo e dos braços da palmeira. */
export function brasa(
  origem: PontoXY,
  {
    escala = 1,
    cor,
    aleatorio = Math.random,
    vida = [0.25, 0.5],
  }: {
    escala?: number;
    cor: string;
    aleatorio?: Aleatorio;
    vida?: readonly [number, number];
  } = {} as { cor: string },
): ParticulaComum {
  const tempo = entre(aleatorio, ...vida);
  return {
    tipo: "faisca",
    x: origem.x + entre(aleatorio, -1.5, 1.5),
    y: origem.y,
    vx: entre(aleatorio, -18, 18) * escala,
    vy: entre(aleatorio, 10, 60) * escala,
    atrito: 2.5,
    gravidade: GRAVIDADE * escala * 0.4,
    vida: tempo,
    vidaMax: tempo,
    cor,
    tamanho: 1.3 * Math.max(0.8, escala),
    rastro: 0.3,
    cintila: true,
  };
}

/**
 * Brilho (0–1) de uma partícula: acende rápido, apaga no fim da vida (e,
 * nos últimos instantes, pisca como brasa que se apaga); se cintila, falha
 * na segunda metade; se pisca (glitter), acende e apaga num
 * ritmo próprio. O clarão some em curva; a fumaça é sempre tênue; a faísca
 * do marco ganha força ao chegar e pulsa enquanto forma o desenho.
 */
export function brilhoDaParticula(
  p: ParticulaDosFogos,
  aleatorio: Aleatorio = Math.random,
): number {
  const resto = limitar(p.vida / p.vidaMax, 0, 1);
  if (p.tipo === "clarao") return 0.4 * resto * resto;
  if (p.tipo === "semente") return 0;
  if (p.tipo === "fumaca")
    return 0.06 * Math.min(1, (1 - resto) * 6) * Math.min(1, resto * 2);
  if (p.tipo === "alvo") {
    if (p.idade < p.convergencia)
      return 0.55 + 0.45 * (p.idade / p.convergencia);
    if (p.idade < p.segura)
      return 0.84 + 0.16 * Math.sin(p.idade * 11 + p.fase);
    return limitar(p.vida / Math.max(1e-6, p.vidaMax - p.segura), 0, 1);
  }
  let brilho = Math.min(1, resto * 1.8);
  if (p.pisca) {
    const idade = p.vidaMax - p.vida;
    const acesa =
      Math.sin(2 * Math.PI * p.pisca * idade + (p.fase || 0)) > -0.1;
    return brilho * (acesa ? 1 : 0.06);
  }
  if (p.cintila && resto < 0.6 && aleatorio() < 0.45) brilho *= 0.2;
  else if (resto < 0.18 && p.tipo === "faisca" && aleatorio() < 0.3)
    brilho *= 0.35;
  return brilho;
}

/** A cor do momento: crisântemo e kamuro mudam no último terço da vida. */
export const corDaParticula = (
  p: Pick<BaseDaParticula, "corFinal" | "vida" | "vidaMax" | "cor">,
): string => (p.corFinal && p.vida / p.vidaMax < 0.35 ? p.corFinal : p.cor);

/** Quanto do quadro anterior apagar (rastro), pelo tempo do quadro. */
export const alfaDoRastro = (dt: number): number =>
  1 - Math.pow(0.74, Math.max(0, dt) * 60);

/** O fim do show apaga tudo em 0,4 s em vez de cortar. */
export function fatorDeSaida(t: number, duracao: number): number {
  return limitar((duracao - t) / 0.4, 0, 1);
}

// ── O show inteiro ──────────────────────────────────────────────────────────

/**
 * O estado inicial do show para uma tela e intensidade. `comAya` põe a Aya
 * voando (e soltando o primeiro foguete) e, fora do Suave, dançando no fim;
 * `forma` (ver fogos-formas.ts) é o marco desenhado no estouro do marco;
 * `letreiro`, o texto do marco escrito no céu no grande final (fora do
 * Suave); `amostrarTexto`, quem desenha texto em pixels (o canvas fora da
 * tela, no navegador).
 */
export function criarShow({
  largura = 800,
  altura = 600,
  intensidade = "cheio",
  paleta = paletaDosFogos(),
  aleatorio = Math.random,
  limite = LIMITE_DE_PARTICULAS,
  comAya = false,
  forma = null,
  letreiro = null,
  amostrarTexto = null,
  duracaoMs = null,
}: {
  largura?: number;
  altura?: number;
  intensidade?: string;
  paleta?: PaletaDosFogos;
  aleatorio?: Aleatorio;
  limite?: number;
  comAya?: boolean;
  forma?: unknown;
  letreiro?: string | null;
  amostrarTexto?: AmostrarTexto | null;
  duracaoMs?: number | null;
} = {}): ShowDeFogos {
  const fator = fatorDeFaiscas(largura, altura);
  const nivel = intensidadeDoShow(intensidade);
  const duracao = duracaoDoShow(intensidade, duracaoMs);
  const aya = comAya ? trajetoDaAya({ largura, altura }) : null;
  const pontos = pontosDaForma(forma, {
    largura,
    altura,
    quantidade: Math.round(MARCO.pontos * Math.max(0.75, fator)),
    amostrarTexto,
  });
  const pontosDoTexto = nivel.letreiro
    ? pontosDoLetreiro(letreiro, {
        largura,
        altura,
        quantidade: Math.round(LETREIRO.pontos * Math.max(0.75, fator)),
        amostrarTexto,
      })
    : [];
  return {
    t: 0,
    duracao,
    escala: escalaDaTela(largura, altura),
    fator,
    paleta,
    limite,
    aleatorio,
    aya,
    danca: nivel.danca ? dancaDaAya(aya, { largura, altura, duracao }) : null,
    confeteSolto: false,
    pontos,
    letreiro: pontosDoTexto,
    planos: planejarShow({
      largura,
      altura,
      intensidade,
      paleta,
      aleatorio,
      aya,
      pontos,
      letreiro: pontosDoTexto,
      duracaoMs,
    }),
    proximo: 0,
    foguetes: [],
    particulas: [],
    estouros: 0,
    /* Estouros ainda não tocados (som): o desenho esvazia a lista. */
    eventos: [],
  };
}

/* Um estouro: faíscas, fumaça e o evento (para o som). */
function registrarEstouro(
  show: ShowDeFogos,
  plano: PlanoDoFoguete,
  { x, y }: PontoXY,
  novas: ParticulaDosFogos[],
  cabem: () => number,
): void {
  const { escala, aleatorio, paleta } = show;
  novas.push(
    ...estourar(plano, {
      x,
      y,
      escala,
      fator: show.fator,
      cabem: cabem(),
      aleatorio,
    }),
  );
  novas.push(
    ...fumacaDoEstouro(
      { x, y },
      { cor: paleta.fumaca, escala, cabem: Math.min(4, cabem()), aleatorio },
    ),
  );
  show.eventos.push({
    tipo: "estouro",
    formato: plano.formato,
    papel: plano.papel,
    x,
    y,
  });
}

/**
 * Avança o show `dt` s (limitado a PASSO_MAXIMO_S): lança os foguetes da
 * hora, move-os e estoura os que chegaram, move as partículas, solta os
 * estalos, o segundo tempo da bomba dupla e as brasas da palmeira. Nunca
 * passa de `limite` partículas. Devolve o próprio estado.
 */
export function avancarShow(show: ShowDeFogos, dt: unknown): ShowDeFogos {
  // Nunca passa da duração: o último passo só vai até o fim.
  const passo = limitar(
    Number(dt) || 0,
    0,
    Math.min(PASSO_MAXIMO_S, Math.max(0, show.duracao - show.t)),
  );
  const { escala, aleatorio, paleta, limite } = show;
  show.t += passo;
  while (
    show.proximo < show.planos.length &&
    show.planos[show.proximo]!.lancamento <= show.t
  ) {
    const plano = show.planos[show.proximo]!;
    const foguete = lancarFoguete(plano, escala);
    show.foguetes.push(foguete);
    if (plano.assobia)
      show.eventos.push({
        tipo: "lancamento",
        formato: plano.formato,
        papel: plano.papel,
        x: foguete.x,
        y: foguete.y,
        subida: foguete.subida,
      });
    show.proximo += 1;
  }
  // A Aya dançando solta o confete (a cena faz o confete; aqui, o evento).
  if (show.danca && !show.confeteSolto && show.t >= show.danca.confete) {
    show.confeteSolto = true;
    show.eventos.push({
      tipo: "confete",
      formato: "confete",
      papel: "aya",
      x: show.danca.x,
      y: show.danca.y - show.danca.tamanho * 0.35,
    });
  }
  const novas: ParticulaDosFogos[] = [];
  const cabem = () => limite - show.particulas.length - novas.length;
  show.foguetes = show.foguetes.filter((foguete) => {
    const chegou = moverFoguete(foguete, passo);
    if (!chegou) {
      if (cabem() > 0 && aleatorio() < 0.8)
        novas.push(brasa(foguete, { escala, cor: paleta.dourado, aleatorio }));
      return true;
    }
    registrarEstouro(show, foguete.plano, foguete, novas, cabem);
    show.estouros += 1;
    return false;
  });
  show.particulas = show.particulas.filter((p) => {
    if (moverParticula(p, passo)) {
      if (p.emite && cabem() > 0 && aleatorio() < p.emite * passo)
        novas.push(
          brasa(p, {
            escala,
            cor: p.brasa || paleta.dourado,
            aleatorio,
            vida: [0.4, 0.8],
          }),
        );
      return true;
    }
    if (p.tipo === "semente") registrarEstouro(show, p.plano, p, novas, cabem);
    else if (p.estala && cabem() > 0)
      novas.push(
        ...centelhas(p, {
          cor: paleta.centelha,
          escala,
          cabem: cabem(),
          aleatorio,
        }),
      );
    return false;
  });
  show.particulas.push(
    ...novas.slice(0, Math.max(0, limite - show.particulas.length)),
  );
  return show;
}

/** Acabou: passou da duração, ou já estourou tudo e nada mais brilha. */
export function showAcabou(show: ShowDeFogos): boolean {
  if (show.t >= show.duracao) return true;
  return (
    show.proximo >= show.planos.length &&
    !show.foguetes.length &&
    !show.particulas.length
  );
}
