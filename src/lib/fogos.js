/*
  Fogos de artifício das comemorações, sem DOM: o roteiro do show, a física
  das faíscas e a paleta. O desenho no <canvas> é de src/modules/comemoracao.js,
  que só chama `criarShow`, `avancarShow` e as funções de brilho e cor daqui.
  A Aya, o véu e o som são de src/lib/fogos-cena.js; o marco desenhado no
  céu (pontos da forma ou do número), de src/lib/fogos-formas.js.

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

import { DURACAO_DOS_FOGOS_MS } from "./comemoracao.js";
import { pontoDaSoltura, trajetoDaAya } from "./fogos-cena.js";
import { pontosDaForma } from "./fogos-formas.js";

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
  pequeno: Object.freeze({ explosoes: 6, final: 6, duracaoMs: 5000 }),
  cheio: Object.freeze({
    explosoes: 9,
    final: 7,
    duracaoMs: DURACAO_DOS_FOGOS_MS,
  }),
  fogos: Object.freeze({ explosoes: 10, final: 7, duracaoMs: 5500 }),
  festa: Object.freeze({ explosoes: 12, final: 8, duracaoMs: 6000 }),
});

export const intensidadeDoShow = (nome) =>
  INTENSIDADES[nome] || INTENSIDADES.cheio;

/* A duração que Configurações › Comemorações pode pedir aos fogos (s). */
export const DURACAO_MINIMA_DOS_FOGOS_S = 4;
export const DURACAO_MAXIMA_DOS_FOGOS_S = 15;

/**
 * A duração do show (s): a pedida (`duracaoMs`, limitada a 4–15 s) ou a da
 * intensidade. Show mais longo solta proporcionalmente mais estouros comuns.
 */
export function duracaoDoShow(intensidade, duracaoMs = null) {
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
  segundo), se é dourado e se tem um segundo tempo (bomba dupla).
*/
export const FORMATOS = Object.freeze({
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
});
export const NOMES_DOS_FORMATOS = Object.freeze(Object.keys(FORMATOS));
/* O grande final usa só formatos curtos e cheios. */
export const FORMATOS_DO_FINAL = Object.freeze([
  "peonia",
  "crisantemo",
  "glitter",
  "anel",
  "estalinho",
  "pistilo",
]);

/* Quanto tempo um formato brilha depois do estouro (com o segundo tempo). */
export function duracaoDoFormato(nome) {
  const formato = FORMATOS[nome] || FORMATOS.peonia;
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

/* Gerador com semente (mulberry32), para testes repetíveis. */
export function criarAleatorio(semente = 1) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const entre = (aleatorio, min, max) => min + (max - min) * aleatorio();
const limitar = (valor, min, max) => Math.min(max, Math.max(min, valor));
const sortear = (aleatorio, lista) =>
  lista[Math.floor(aleatorio() * lista.length) % lista.length];

function embaralhar(lista, aleatorio) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/* A escala da tela: estouros proporcionais ao menor lado (tela de 800 px = 1). */
export const escalaDaTela = (largura, altura) =>
  limitar(Math.min(largura, altura) / 800, 0.55, 1.4);

/* Telas pequenas soltam menos faíscas (metade, no mínimo). */
export const fatorDeFaiscas = (largura, altura) =>
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
const DOURADOS = ["#ffd23f", "#ffb627"];
const BRANCO = "#fff6dc";
/* Cores vivas que brilham sobre o véu; no tema claro, somam-se às da marca. */
const VIVAS = ["#59f2c8", "#4fdcff", "#ff7a59", "#c38cff"];

/**
 * As cores do show: os tokens do tema que tiverem valor, mais dourado e
 * branco. Com o véu escuro por baixo, a luz se soma ("lighter") nos dois
 * temas; no claro, que tem tokens escuros, entram também cores vivas.
 * `lerToken` devolve o valor do token (ou vazio). Sem token, a reserva.
 */
export function paletaDosFogos(lerToken = () => "", { escuro = true } = {}) {
  const daMarca = TOKENS_DA_PALETA.map((nome) => {
    try {
      return String(lerToken(nome) || "").trim();
    } catch {
      return "";
    }
  }).filter((cor) => /^(#|rgb|hsl)/i.test(cor));
  const base = daMarca.length ? daMarca : VIVAS;
  return {
    cores: [
      ...new Set([...base, ...(escuro ? [] : VIVAS), ...DOURADOS, BRANCO]),
    ],
    dourado: DOURADOS[0],
    ambar: DOURADOS[1],
    centelha: BRANCO,
    fumaca: escuro ? "#9aa6bd" : "#c9d2e3",
    composicao: "lighter",
  };
}

// ── Roteiro ─────────────────────────────────────────────────────────────────

/* Tempo de subida até o ápice a `altura` px acima da base. */
export const tempoDeSubida = (altura, gravidade = GRAVIDADE_DO_FOGUETE) =>
  Math.sqrt((2 * Math.max(0, altura)) / gravidade);

/* Quanto o foguete solto pela Aya leva até estourar. */
export const SUBIDA_DA_AYA = 0.55;

/* Os instantes dos estouros comuns: salvas de 1 a 3 entre `primeiro` e `ultimo`. */
function instantesComuns({ explosoes, primeiro, ultimo, aleatorio }) {
  const instantes = [];
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
  { formato, estouro, papel, xAlvo, yAlvo, base = null },
  { largura, altura, duracao, gravidade, paleta, aleatorio },
) {
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
  const dourado = FORMATOS[formato]?.dourado;
  return {
    formato,
    papel,
    estouro,
    lancamento: estouro - subida,
    xBase,
    yBase,
    xAlvo,
    yAlvo,
    cor: dourado ? paleta.dourado : sortear(aleatorio, paleta.cores),
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
 * pontosDaForma) fazem do estouro do marco o desenho. Estouros comuns
 * escalonados e espalhados pela largura (uma faixa para cada), o marco no
 * centro e o grande final dos lados, todos terminando a tempo de apagar.
 */
export function planejarShow({
  largura = 800,
  altura = 600,
  intensidade = "cheio",
  paleta = paletaDosFogos(),
  aleatorio = Math.random,
  aya = null,
  pontos = [],
  duracaoMs = null,
} = {}) {
  const base = intensidadeDoShow(intensidade);
  const duracao = duracaoDoShow(intensidade, duracaoMs);
  const final = base.final;
  const explosoes = Math.max(
    base.explosoes,
    Math.round((base.explosoes * duracao) / (base.duracaoMs / 1000)),
  );
  const escala = escalaDaTela(largura, altura);
  const contexto = {
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
  let sacola = [];
  const comuns = instantes.map((estouro, i) => {
    if (!sacola.length) sacola = embaralhar(NOMES_DOS_FORMATOS, aleatorio);
    const daAya = Boolean(soltura) && i === 0;
    return planoDoFoguete(
      {
        formato: sacola.pop(),
        estouro: daAya ? primeiro : estouro,
        papel: daAya ? "aya" : "comum",
        xAlvo:
          largura *
          (0.08 +
            (0.84 * (faixas[i] + entre(aleatorio, 0.2, 0.8))) / explosoes),
        yAlvo: daAya
          ? Math.min(
              soltura.y - altura * 0.18,
              altura * entre(aleatorio, 0.12, 0.3),
            )
          : altura * entre(aleatorio, 0.1, 0.45),
        base: daAya ? soltura : null,
      },
      contexto,
    );
  });

  // O marco: no centro, a forma (ou um crisântemo grande).
  const comForma = Array.isArray(pontos) && pontos.length > 0;
  const centro = comForma
    ? {
        x: pontos.reduce((s, p) => s + p.x, 0) / pontos.length,
        y: pontos.reduce((s, p) => s + p.y, 0) / pontos.length,
      }
    : { x: largura / 2, y: altura * 0.3 };
  const marco = {
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
    cor2: comForma ? paleta.centelha : null,
  };
  if (comForma) {
    marco.formato = "marco";
    marco.pontos = pontos;
    marco.fimDaForma = duracao - MARCO.desfazAntes;
  }

  // O grande final: `final` estouros quase juntos, dos lados do marco.
  const inicioDoFinal = duracao - 1.6;
  const fimDoFinal = duracao - 1.2;
  let formatosDoFinal = [];
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
        formato: formatosDoFinal.pop(),
        estouro: limitar(
          inicioDoFinal +
            ((fimDoFinal - inicioDoFinal) * j) / Math.max(1, final - 1) +
            entre(aleatorio, -0.04, 0.04),
          inicioDoFinal,
          fimDoFinal,
        ),
        papel: "final",
        xAlvo: largura * (fracao + entre(aleatorio, -0.03, 0.03)),
        yAlvo: altura * entre(aleatorio, 0.1, comForma ? 0.6 : 0.42),
      },
      contexto,
    );
  });

  return [...comuns, marco, ...finais].sort(
    (a, b) => a.lancamento - b.lancamento,
  );
}

/**
 * O foguete de um plano no instante do lançamento: sobe com velocidade para
 * chegar ao alvo exatamente no instante do estouro (do chão, é o ápice).
 */
export function lancarFoguete(plano, escala = 1) {
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
export function moverFoguete(foguete, dt) {
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
  Direção de uma faísca: esfera vista de frente (mais densa na borda), anel
  inclinado ou os braços da palmeira (igualmente espaçados).
*/
function direcao(formato, i, total, aleatorio, inclinacao, giro) {
  if (formato === "anel") {
    const angulo = (i / total) * Math.PI * 2;
    const x = Math.cos(angulo);
    const y = Math.sin(angulo) * inclinacao;
    return [
      x * Math.cos(giro) - y * Math.sin(giro),
      x * Math.sin(giro) + y * Math.cos(giro),
    ];
  }
  if (formato === "palmeira") {
    const angulo =
      giro + (i / total) * Math.PI * 2 + entre(aleatorio, -0.08, 0.08);
    return [Math.cos(angulo), Math.sin(angulo)];
  }
  const z = entre(aleatorio, -1, 1);
  const angulo = aleatorio() * Math.PI * 2;
  const raio = Math.sqrt(1 - z * z);
  return [Math.cos(angulo) * raio, Math.sin(angulo) * raio];
}

const clarao = (x, y, cor, escala) => ({
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
function faiscasDoMarco(plano, { x, y, escala, cabem, aleatorio }) {
  const pontos = plano.pontos.slice(0, Math.max(0, cabem));
  const segura = Math.max(
    MARCO.convergencia + 0.1,
    (plano.fimDaForma ?? plano.estouro + 1.6) - plano.estouro,
  );
  return pontos.map((alvo, i) => {
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
export function estourar(
  plano,
  {
    x,
    y,
    escala = 1,
    fator = 1,
    cabem = Infinity,
    aleatorio = Math.random,
  } = {},
) {
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
  const formato = FORMATOS[plano.formato] || FORMATOS.peonia;
  const segundo = formato.segundo;
  const total = Math.max(
    0,
    Math.min(
      Math.round(formato.faiscas * (plano.formato === "palmeira" ? 1 : fator)),
      cabem - 1 - (segundo ? 1 : 0),
    ),
  );
  const velocidade =
    330 * escala * formato.forca * (plano.papel === "marco" ? 1.2 : 1);
  const vidaFator = plano.vidaFator ?? 1;
  const inclinacao = entre(aleatorio, 0.25, 0.7);
  const giro = aleatorio() * Math.PI;
  const faiscas = [];
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
      clarao(x, y, plano.cor, escala * (plano.papel === "marco" ? 1.5 : 1)),
    );
  return faiscas;
}

/* Fumaça de um estouro: algumas nuvens claras, que crescem, sobem e somem. */
export function fumacaDoEstouro(
  { x, y },
  { cor, escala = 1, cabem = Infinity, aleatorio = Math.random } = {},
) {
  const quantas = Math.max(0, Math.min(3 + Math.floor(aleatorio() * 2), cabem));
  return Array.from({ length: quantas }, () => {
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
function moverAlvo(p, dt) {
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
export function moverParticula(p, dt) {
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
  p,
  { cor, escala = 1, cabem = Infinity, aleatorio = Math.random } = {},
) {
  const quantas = Math.max(0, Math.min(2 + Math.floor(aleatorio() * 3), cabem));
  return Array.from({ length: quantas }, () => {
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
  origem,
  { escala = 1, cor, aleatorio = Math.random, vida = [0.25, 0.5] } = {},
) {
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
 * Brilho (0–1) de uma partícula: acende rápido, apaga no fim da vida; se
 * cintila, falha na segunda metade; se pisca (glitter), acende e apaga num
 * ritmo próprio. O clarão some em curva; a fumaça é sempre tênue; a faísca
 * do marco ganha força ao chegar e pulsa enquanto forma o desenho.
 */
export function brilhoDaParticula(p, aleatorio = Math.random) {
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
  return brilho;
}

/** A cor do momento: crisântemo e kamuro mudam no último terço da vida. */
export const corDaParticula = (p) =>
  p.corFinal && p.vida / p.vidaMax < 0.35 ? p.corFinal : p.cor;

/** Quanto do quadro anterior apagar (rastro), pelo tempo do quadro. */
export const alfaDoRastro = (dt) => 1 - Math.pow(0.74, Math.max(0, dt) * 60);

/** O fim do show apaga tudo em 0,4 s em vez de cortar. */
export function fatorDeSaida(t, duracao) {
  return limitar((duracao - t) / 0.4, 0, 1);
}

// ── O show inteiro ──────────────────────────────────────────────────────────

/**
 * O estado inicial do show para uma tela e intensidade. `comAya` põe a Aya
 * voando (e soltando o primeiro foguete); `forma` (ver fogos-formas.js) é o
 * marco desenhado no estouro do marco, e `amostrarTexto`, quem desenha texto
 * em pixels (o canvas fora da tela, no navegador).
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
  amostrarTexto = null,
  duracaoMs = null,
} = {}) {
  const fator = fatorDeFaiscas(largura, altura);
  const aya = comAya ? trajetoDaAya({ largura, altura }) : null;
  const pontos = pontosDaForma(forma, {
    largura,
    altura,
    quantidade: Math.round(MARCO.pontos * Math.max(0.75, fator)),
    amostrarTexto,
  });
  return {
    t: 0,
    duracao: duracaoDoShow(intensidade, duracaoMs),
    escala: escalaDaTela(largura, altura),
    fator,
    paleta,
    limite,
    aleatorio,
    aya,
    pontos,
    planos: planejarShow({
      largura,
      altura,
      intensidade,
      paleta,
      aleatorio,
      aya,
      pontos,
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
function registrarEstouro(show, plano, { x, y }, novas, cabem) {
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
export function avancarShow(show, dt) {
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
    show.planos[show.proximo].lancamento <= show.t
  ) {
    show.foguetes.push(lancarFoguete(show.planos[show.proximo], escala));
    show.proximo += 1;
  }
  const novas = [];
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
            cor: paleta.dourado,
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
export function showAcabou(show) {
  if (show.t >= show.duracao) return true;
  return (
    show.proximo >= show.planos.length &&
    !show.foguetes.length &&
    !show.particulas.length
  );
}
