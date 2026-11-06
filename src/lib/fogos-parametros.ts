/* Fogos: constantes, intensidades, formatos e sorteio (API pública em src/lib/fogos.ts). */

import { DURACAO_DOS_FOGOS_MS } from "./comemoracao.ts";
import type {
  Aleatorio,
  FormatoDosFogos,
  FormatosPorNome,
  IntensidadeDoShow,
  NomeDoFormato,
} from "./fogos-tipos.ts";

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

export const entre = (aleatorio: Aleatorio, min: number, max: number): number =>
  min + (max - min) * aleatorio();
export const limitar = (valor: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, valor));
export const sortear = <T>(aleatorio: Aleatorio, lista: readonly T[]): T =>
  lista[Math.floor(aleatorio() * lista.length) % lista.length]!;

export function embaralhar<T>(lista: readonly T[], aleatorio: Aleatorio): T[] {
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
