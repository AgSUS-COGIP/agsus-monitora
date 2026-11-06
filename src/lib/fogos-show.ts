/* Fogos: o show inteiro (API pública em src/lib/fogos.ts). */

import { dancaDaAya, trajetoDaAya } from "./fogos-cena.ts";
import { pontosDaForma, pontosDoLetreiro } from "./fogos-formas.ts";
import type { AmostrarTexto } from "./fogos-formas.ts";
import {
  brasa,
  centelhas,
  estourar,
  fumacaDoEstouro,
  moverParticula,
} from "./fogos-fisica.ts";
import { paletaDosFogos } from "./fogos-paleta.ts";
import {
  LETREIRO,
  LIMITE_DE_PARTICULAS,
  MARCO,
  PASSO_MAXIMO_S,
  duracaoDoShow,
  escalaDaTela,
  fatorDeFaiscas,
  intensidadeDoShow,
  limitar,
} from "./fogos-parametros.ts";
import { lancarFoguete, moverFoguete, planejarShow } from "./fogos-roteiro.ts";
import type {
  Aleatorio,
  PaletaDosFogos,
  ParticulaDosFogos,
  PlanoDoFoguete,
  PontoXY,
  ShowDeFogos,
} from "./fogos-tipos.ts";

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
