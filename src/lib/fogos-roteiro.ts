/* Fogos: o roteiro do show e o voo dos foguetes (API pública em src/lib/fogos.ts). */

import { pontoDaSoltura } from "./fogos-cena.ts";
import type { TrajetoDaAya } from "./fogos-cena.ts";
import type { PontoDaForma } from "./fogos-formas.ts";
import { paletaDosFogos } from "./fogos-paleta.ts";
import {
  APOTEOSE,
  FORMATOS,
  FORMATOS_DA_APOTEOSE,
  FORMATOS_DA_RAJADA,
  FORMATOS_DO_FINAL,
  GRAVIDADE_DO_FOGUETE,
  LETREIRO,
  MARCO,
  NOMES_DOS_FORMATOS,
  RAJADA,
  duracaoDoFormato,
  duracaoDoShow,
  embaralhar,
  entre,
  escalaDaTela,
  intensidadeDoShow,
  limitar,
  sortear,
} from "./fogos-parametros.ts";
import type {
  Aleatorio,
  ContextoDoPlano,
  FogueteNoAr,
  FormatosPorNome,
  PaletaDosFogos,
  PapelDoEstouro,
  PlanoDoFoguete,
  PontoXY,
} from "./fogos-tipos.ts";

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
