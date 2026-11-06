/* Fogos: o estouro e a física das faíscas (API pública em src/lib/fogos.ts). */

import { contornoDaEstrela, contornoDoCoracao } from "./fogos-formas.ts";
import {
  FORMATOS,
  GRAVIDADE,
  MARCO,
  entre,
  limitar,
} from "./fogos-parametros.ts";
import type {
  Aleatorio,
  BaseDaParticula,
  FormatosPorNome,
  ParticulaComum,
  ParticulaDoAlvo,
  ParticulaDosFogos,
  PlanoDoFoguete,
  PontoXY,
} from "./fogos-tipos.ts";

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
