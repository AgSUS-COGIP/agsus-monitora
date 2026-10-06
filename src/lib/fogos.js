/*
  Fogos de artifício das comemorações, sem DOM: o roteiro do show, a física
  das faíscas e a paleta. O desenho no <canvas> é de src/modules/comemoracao.js,
  que só chama `criarShow`, `avancarShow` e as funções de brilho e cor daqui.

  O show: foguetes sobem de pontos diferentes da base da tela, desaceleram
  pela gravidade e estouram no alto (o ápice), em alturas e momentos
  escalonados — algumas salvas quase simultâneas. Cada estouro abre um
  formato (peônia, crisântemo, anel, salgueiro, estalinho) com centenas de
  faíscas sob gravidade e atrito do ar, que cintilam e se apagam.

  Unidades: tempo em segundos, posição em px CSS, velocidade em px/s. O
  sorteio vem de `aleatorio` (padrão Math.random) para os testes fixarem a
  semente com `criarAleatorio`.
*/

import { DURACAO_DOS_FOGOS_MS } from "./comemoracao.js";

/* Gravidade das faíscas e dos foguetes (px/s² numa tela de referência). */
export const GRAVIDADE = 240;
export const GRAVIDADE_DO_FOGUETE = 720;
/* Teto de faíscas vivas ao mesmo tempo, em qualquer tela. */
export const LIMITE_DE_PARTICULAS = 2600;
/* Passo máximo da simulação: aba que volta do fundo não "pula" o show. */
export const PASSO_MAXIMO_S = 1 / 20;

/* Quantos estouros e quanto dura cada intensidade (ms). */
export const INTENSIDADES = Object.freeze({
  pequeno: Object.freeze({ explosoes: 5, duracaoMs: 3200 }),
  cheio: Object.freeze({ explosoes: 8, duracaoMs: DURACAO_DOS_FOGOS_MS }),
  fogos: Object.freeze({ explosoes: 9, duracaoMs: 4000 }),
  festa: Object.freeze({ explosoes: 12, duracaoMs: 4500 }),
});

export const intensidadeDoShow = (nome) =>
  INTENSIDADES[nome] || INTENSIDADES.cheio;

/*
  Os formatos: quantas faíscas, força do estouro (fração da velocidade de
  referência), atrito do ar (por segundo), peso da gravidade, vida (s),
  comprimento do rastro, se cintila e se estala ao apagar.
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
});
export const NOMES_DOS_FORMATOS = Object.freeze(Object.keys(FORMATOS));
const VIDA_MAXIMA = (formato) => FORMATOS[formato].vida[1];

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
const DOURADOS = {
  escuro: ["#ffd23f", "#ffb627"],
  claro: ["#e0a100", "#d98c00"],
};
const BRANCO = "#fff6dc";

/**
 * As cores do show: os tokens do tema que tiverem valor, mais dourado (e
 * branco no tema escuro, onde brilha; no claro some no fundo). `lerToken`
 * devolve o valor do token (ou vazio). Sem token nenhum, a paleta reserva.
 */
export function paletaDosFogos(lerToken = () => "", { escuro = true } = {}) {
  const daMarca = TOKENS_DA_PALETA.map((nome) => {
    try {
      return String(lerToken(nome) || "").trim();
    } catch {
      return "";
    }
  }).filter((cor) => /^(#|rgb|hsl)/i.test(cor));
  const reserva = escuro
    ? ["#59f2c8", "#4fdcff", "#ff7a59", "#8e6cf2"]
    : ["#0f5db7", "#eb6834", "#0090bc", "#6d5efc"];
  const dourados = escuro ? DOURADOS.escuro : DOURADOS.claro;
  return {
    cores: [
      ...new Set([
        ...(daMarca.length ? daMarca : reserva),
        ...dourados,
        ...(escuro ? [BRANCO] : []),
      ]),
    ],
    dourado: dourados[0],
    centelha: escuro ? BRANCO : dourados[1],
    composicao: escuro ? "lighter" : "source-over",
  };
}

// ── Roteiro ─────────────────────────────────────────────────────────────────

/* Tempo de subida até o ápice a `altura` px acima da base. */
export const tempoDeSubida = (altura, gravidade = GRAVIDADE_DO_FOGUETE) =>
  Math.sqrt((2 * Math.max(0, altura)) / gravidade);

/**
 * O roteiro: um foguete por estouro, com base, alvo, formato, cores e o
 * instante do estouro (s). Estouros escalonados ao longo do show, em salvas
 * de 1 a 3 quase simultâneas, espalhados pela largura (uma faixa para cada)
 * e terminando a tempo de apagar antes do fim.
 */
export function planejarShow({
  largura = 800,
  altura = 600,
  intensidade = "cheio",
  paleta = paletaDosFogos(),
  aleatorio = Math.random,
} = {}) {
  const { explosoes, duracaoMs } = intensidadeDoShow(intensidade);
  const duracao = duracaoMs / 1000;
  const escala = escalaDaTela(largura, altura);
  const gravidade = GRAVIDADE_DO_FOGUETE * escala;
  // Instantes: salvas espalhadas entre o primeiro e o último estouro possível.
  const primeiro = 0.6;
  const ultimo = duracao - 1.55;
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
  instantes.sort((a, b) => a - b);
  // Faixas da largura embaralhadas: cada estouro numa parte da tela.
  const faixas = embaralhar([...Array(explosoes).keys()], aleatorio);
  let formatos = [];
  return instantes.map((estouro, i) => {
    if (!formatos.length) formatos = embaralhar(NOMES_DOS_FORMATOS, aleatorio);
    let formato = formatos.pop();
    // O salgueiro cai devagar: só se der tempo de apagar antes do fim.
    if (estouro + VIDA_MAXIMA(formato) > duracao - 0.05) formato = "peonia";
    const xAlvo =
      largura *
      (0.08 + (0.84 * (faixas[i] + entre(aleatorio, 0.2, 0.8))) / explosoes);
    const yAlvo = altura * entre(aleatorio, 0.1, 0.48);
    const xBase = limitar(
      xAlvo + entre(aleatorio, -0.08, 0.08) * largura,
      largura * 0.04,
      largura * 0.96,
    );
    const yBase = altura + 8;
    const subida = Math.min(estouro, tempoDeSubida(yBase - yAlvo, gravidade));
    const cor =
      formato === "salgueiro"
        ? paleta.dourado
        : sortear(aleatorio, paleta.cores);
    return {
      formato,
      estouro,
      lancamento: estouro - subida,
      xBase,
      yBase,
      xAlvo,
      yAlvo,
      cor,
      // Peônia de duas cores, às vezes; o crisântemo termina dourado.
      cor2:
        formato === "peonia" && aleatorio() < 0.45
          ? sortear(aleatorio, paleta.cores)
          : null,
      corFinal: formato === "crisantemo" ? paleta.dourado : null,
    };
  });
}

/**
 * O foguete de um plano no instante do lançamento: sobe com velocidade para
 * chegar ao alvo exatamente no ápice (vy = 0), quando estoura.
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

/** Move o foguete `dt` s. Devolve se chegou ao ápice (hora de estourar). */
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

/* Direção de uma faísca: esfera vista de frente (mais densa na borda) ou anel inclinado. */
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
  const z = entre(aleatorio, -1, 1);
  const angulo = aleatorio() * Math.PI * 2;
  const raio = Math.sqrt(1 - z * z);
  return [Math.cos(angulo) * raio, Math.sin(angulo) * raio];
}

/**
 * As faíscas de um estouro em (x, y). `cabem` limita a quantidade (teto de
 * partículas); `fator` reduz em tela pequena. Inclui um clarão no centro.
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
  const formato = FORMATOS[plano.formato] || FORMATOS.peonia;
  const total = Math.max(
    0,
    Math.min(Math.round(formato.faiscas * fator), cabem - 1),
  );
  const velocidade = 330 * escala * formato.forca;
  const inclinacao = entre(aleatorio, 0.25, 0.7);
  const giro = aleatorio() * Math.PI;
  const faiscas = [];
  for (let i = 0; i < total; i += 1) {
    const [dx, dy] = direcao(
      plano.formato,
      i,
      total,
      aleatorio,
      inclinacao,
      giro,
    );
    const impulso = velocidade * entre(aleatorio, 0.9, 1.06);
    const vida = entre(aleatorio, ...formato.vida);
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
      cor: plano.cor2 && i % 2 ? plano.cor2 : plano.cor,
      corFinal: plano.corFinal || null,
      tamanho: formato.tamanho * Math.max(0.8, escala),
      rastro: formato.rastro,
      cintila: Boolean(formato.cintila),
      estala: Boolean(formato.estala),
    });
  }
  if (total > 0)
    faiscas.push({
      tipo: "clarao",
      x,
      y,
      vx: 0,
      vy: 0,
      atrito: 0,
      gravidade: 0,
      vida: 0.18,
      vidaMax: 0.18,
      cor: plano.cor,
      tamanho: 70 * escala,
      rastro: 0,
    });
  return faiscas;
}

/** Física de uma faísca por `dt` s: atrito do ar, gravidade, posição, vida. */
export function moverParticula(p, dt) {
  const freio = Math.exp(-p.atrito * dt);
  p.vx *= freio;
  p.vy = p.vy * freio + p.gravidade * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
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

/* Faíscas do rastro do foguete subindo. */
function rastroDoFoguete(foguete, { escala, cor, aleatorio }) {
  const vida = entre(aleatorio, 0.25, 0.5);
  return {
    tipo: "faisca",
    x: foguete.x + entre(aleatorio, -1.5, 1.5),
    y: foguete.y,
    vx: entre(aleatorio, -18, 18) * escala,
    vy: entre(aleatorio, 10, 60) * escala,
    atrito: 2.5,
    gravidade: GRAVIDADE * escala * 0.4,
    vida,
    vidaMax: vida,
    cor,
    tamanho: 1.3 * Math.max(0.8, escala),
    rastro: 0.3,
    cintila: true,
  };
}

/**
 * Brilho (0–1) de uma faísca: acende rápido, apaga no fim da vida e, se
 * cintila, pisca na segunda metade. O clarão some em curva.
 */
export function brilhoDaParticula(p, aleatorio = Math.random) {
  const resto = limitar(p.vida / p.vidaMax, 0, 1);
  if (p.tipo === "clarao") return 0.55 * resto * resto;
  let brilho = Math.min(1, resto * 1.8);
  if (p.cintila && resto < 0.6 && aleatorio() < 0.45) brilho *= 0.2;
  return brilho;
}

/** A cor do momento: o crisântemo vira dourado no último terço da vida. */
export const corDaParticula = (p) =>
  p.corFinal && p.vida / p.vidaMax < 0.35 ? p.corFinal : p.cor;

/** Quanto do quadro anterior apagar (rastro), pelo tempo do quadro. */
export const alfaDoRastro = (dt) => 1 - Math.pow(0.74, Math.max(0, dt) * 60);

/** O fim do show apaga tudo em 0,4 s em vez de cortar. */
export function fatorDeSaida(t, duracao) {
  return limitar((duracao - t) / 0.4, 0, 1);
}

// ── O show inteiro ──────────────────────────────────────────────────────────

/** O estado inicial do show para uma tela e intensidade. */
export function criarShow({
  largura = 800,
  altura = 600,
  intensidade = "cheio",
  paleta = paletaDosFogos(),
  aleatorio = Math.random,
  limite = LIMITE_DE_PARTICULAS,
} = {}) {
  return {
    t: 0,
    duracao: intensidadeDoShow(intensidade).duracaoMs / 1000,
    escala: escalaDaTela(largura, altura),
    fator: fatorDeFaiscas(largura, altura),
    paleta,
    limite,
    aleatorio,
    planos: planejarShow({ largura, altura, intensidade, paleta, aleatorio }),
    proximo: 0,
    foguetes: [],
    particulas: [],
    estouros: 0,
  };
}

/**
 * Avança o show `dt` s (limitado a PASSO_MAXIMO_S): lança os foguetes da
 * hora, move-os e estoura os que chegaram ao ápice, move as faíscas e solta
 * os estalos. Nunca passa de `limite` partículas. Devolve o próprio estado.
 */
export function avancarShow(show, dt) {
  const passo = limitar(Number(dt) || 0, 0, PASSO_MAXIMO_S);
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
        novas.push(
          rastroDoFoguete(foguete, { escala, cor: paleta.dourado, aleatorio }),
        );
      return true;
    }
    novas.push(
      ...estourar(foguete.plano, {
        x: foguete.x,
        y: foguete.y,
        escala,
        fator: show.fator,
        cabem: cabem(),
        aleatorio,
      }),
    );
    show.estouros += 1;
    return false;
  });
  show.particulas = show.particulas.filter((p) => {
    if (moverParticula(p, passo)) return true;
    if (p.estala && cabem() > 0)
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
