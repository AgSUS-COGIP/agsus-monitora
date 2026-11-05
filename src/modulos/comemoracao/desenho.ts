import {
  alfaDoRastro,
  brilhoDaParticula,
  corDaParticula,
  fatorDeSaida,
  paletaDosFogos,
} from "../../lib/fogos.ts";
import { desenharParticulasDoMotor } from "../../lib/motor-de-efeitos.ts";
import type { PaletaDosFogos, ShowDeFogos } from "../../lib/fogos.ts";
import type { CenaDeEfeitos } from "../../lib/motor-de-efeitos.ts";

/*
  O desenho das comemorações no <canvas>, sem React e sem biblioteca: a
  paleta do tema, os halos (bloom barato), um quadro dos fogos (rastro,
  fumaça, foguetes, faíscas e o marco), a prévia do Palco de testes e o texto
  do marco em pixels. Quem cria os canvas e anda os quadros é o componente
  (comemoracoes.tsx, `usarFogos`); a física e o roteiro são de
  src/lib/fogos.ts e src/lib/motor-de-efeitos.ts.
*/

export type JanelaDaComemoracao = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
  CustomEvent?: typeof CustomEvent;
};

/** O halo de uma cor (canvas pronto para `drawImage`), ou null sem gradiente. */
export type Halo = (cor: string) => HTMLCanvasElement | null;

/** O que cada quadro desenha: o tamanho da tela, o tempo do quadro e o halo. */
export interface QuadroDoDesenho {
  largura: number;
  altura: number;
  dt: number;
  halo: Halo;
}

/* Densidade de pixels no canvas: nítido em tela retina, sem passar de 2x. */
export const DPR_MAXIMO = 2;
export function semMovimento(
  janela: JanelaDaComemoracao | undefined = globalThis.window,
): boolean {
  try {
    return Boolean(
      janela?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    );
  } catch {
    return false;
  }
}

/* O tema do app (html[data-theme="dark"]) e as cores dele para os fogos. */
export function paletaDoTema(doc: Document, janela: Window): PaletaDosFogos {
  const raiz = doc.documentElement;
  const escuro = raiz?.getAttribute?.("data-theme") === "dark";
  let estilo: CSSStyleDeclaration | null = null;
  try {
    estilo = janela.getComputedStyle?.(raiz) || null;
  } catch {
    estilo = null;
  }
  return paletaDosFogos((nome) => estilo?.getPropertyValue?.(nome), {
    escuro,
  });
}

/*
  O brilho (bloom barato): um halo por cor — gradiente radial branco que
  some, tingido com 'source-in' —, feito uma vez e reaproveitado com
  drawImage. Sem gradiente (canvas limitado), sem halo.
*/
export function criarHalos(doc: Document): Halo {
  const feitos = new Map<string, HTMLCanvasElement | null>();
  return (cor) => {
    if (feitos.has(cor)) return feitos.get(cor)!;
    let halo: HTMLCanvasElement | null = null;
    try {
      const canvas = doc.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const contexto = canvas.getContext?.("2d");
      const gradiente = contexto?.createRadialGradient?.(32, 32, 0, 32, 32, 32);
      if (gradiente) {
        gradiente.addColorStop(0, "rgba(255, 255, 255, 1)");
        gradiente.addColorStop(0.2, "rgba(255, 255, 255, 0.55)");
        gradiente.addColorStop(1, "rgba(255, 255, 255, 0)");
        contexto!.fillStyle = gradiente;
        contexto!.fillRect(0, 0, 64, 64);
        contexto!.globalCompositeOperation = "source-in";
        contexto!.fillStyle = cor;
        contexto!.fillRect(0, 0, 64, 64);
        halo = canvas;
      }
    } catch {
      halo = null;
    }
    feitos.set(cor, halo);
    return halo;
  };
}

function ponto(
  contexto: CanvasRenderingContext2D,
  x: number,
  y: number,
  raio: number,
) {
  contexto.beginPath();
  contexto.arc(x, y, raio, 0, Math.PI * 2);
  contexto.fill();
}

/*
  Um quadro: apaga parte do anterior (rastro), desenha a fumaça por cima do
  véu e acende, somando luz, foguetes, faíscas, halos e o marco.
*/
export function desenhar(
  contexto: CanvasRenderingContext2D,
  show: ShowDeFogos,
  { largura, altura, dt, halo }: QuadroDoDesenho,
) {
  contexto.globalCompositeOperation = "destination-out";
  contexto.globalAlpha = 1;
  contexto.fillStyle = `rgba(0, 0, 0, ${alfaDoRastro(dt)})`;
  contexto.fillRect(0, 0, largura, altura);
  const saida = fatorDeSaida(show.t, show.duracao);

  // Fumaça: nuvens macias (o mesmo halo, grande e tênue).
  contexto.globalCompositeOperation = "source-over";
  for (const p of show.particulas) {
    if (p.tipo !== "fumaca") continue;
    const nuvem = halo(p.cor);
    if (!nuvem) continue;
    contexto.globalAlpha = brilhoDaParticula(p) * saida;
    const r = p.tamanho;
    contexto.drawImage(nuvem, p.x - r, p.y - r, 2 * r, 2 * r);
  }

  contexto.globalCompositeOperation = show.paleta.composicao;
  contexto.lineCap = "round";
  for (const f of show.foguetes) {
    contexto.globalAlpha = saida;
    contexto.fillStyle = show.paleta.dourado;
    ponto(contexto, f.x, f.y, 2.2 * show.escala);
    const brilho = halo(show.paleta.dourado);
    if (brilho) {
      const r = 12 * show.escala;
      contexto.globalAlpha = 0.5 * saida;
      contexto.drawImage(brilho, f.x - r, f.y - r, 2 * r, 2 * r);
    }
  }
  show.particulas.forEach((p, i) => {
    if (p.tipo === "fumaca" || p.tipo === "semente") return;
    const brilho = brilhoDaParticula(p, show.aleatorio) * saida;
    if (brilho <= 0.01) return;
    const cor = corDaParticula(p);
    if (p.tipo === "clarao") {
      const imagem = halo(cor);
      const raio = p.tamanho * (1.4 - p.vida / p.vidaMax);
      contexto.globalAlpha = brilho;
      if (imagem)
        contexto.drawImage(imagem, p.x - raio, p.y - raio, 2 * raio, 2 * raio);
      else {
        contexto.fillStyle = cor;
        ponto(contexto, p.x, p.y, raio * 0.6);
      }
      return;
    }
    contexto.globalAlpha = brilho;
    if (Math.hypot(p.vx, p.vy) < 4) {
      // Parada (a forma do marco): um ponto.
      contexto.fillStyle = cor;
      ponto(contexto, p.x, p.y, p.tamanho * 0.8);
    } else {
      // Um traço do ponto até onde estava há pouco: o rastro de cada faísca.
      const recuo = 0.016 + 0.03 * p.rastro;
      contexto.strokeStyle = cor;
      contexto.lineWidth = p.tamanho;
      contexto.beginPath();
      contexto.moveTo(p.x - p.vx * recuo, p.y - p.vy * recuo);
      contexto.lineTo(p.x, p.y);
      contexto.stroke();
    }
    // Halo: em toda faísca do marco; nas outras, nas mais fortes (metade).
    const doMarco = p.tipo === "alvo";
    if (!doMarco && (brilho < 0.35 || p.tamanho < 1.6 || i % 2)) return;
    const imagem = halo(cor);
    if (!imagem) return;
    const raio = p.tamanho * (doMarco ? 3.5 : 4);
    contexto.globalAlpha = brilho * (doMarco ? 0.4 : 0.3);
    contexto.drawImage(imagem, p.x - raio, p.y - raio, 2 * raio, 2 * raio);
  });
}

/**
 * Um quadro de uma cena inteira (fogos + motor) num contexto só, limpo a
 * cada quadro: a prévia do Palco de testes (Configurações › Comemorações).
 */
export function desenharPrevia(
  contexto: CanvasRenderingContext2D,
  cena: CenaDeEfeitos,
  { largura, altura, dt, halo }: QuadroDoDesenho,
): void {
  contexto.globalCompositeOperation = "source-over";
  contexto.clearRect?.(0, 0, largura, altura);
  if (cena.show) desenhar(contexto, cena.show, { largura, altura, dt, halo });
  contexto.globalCompositeOperation = "source-over";
  desenharParticulasDoMotor(contexto, cena);
}

/*
  O texto do marco em pixels: escrito num canvas fora da tela (fillText) e
  lido com getImageData. Sem canvas 2D, null (src/lib/fogos-formas.ts usa a fonte de
  pontos).
*/
export function amostrarTexto(
  doc: Document,
  janela: Window,
  texto: string,
): ImageData | null {
  try {
    const canvas = doc.createElement("canvas");
    const largura = 640;
    const altura = 220;
    canvas.width = largura;
    canvas.height = altura;
    const contexto = canvas.getContext?.("2d", { willReadFrequently: true });
    if (!contexto?.fillText || !contexto.getImageData) return null;
    let familia = "system-ui, sans-serif";
    try {
      familia = janela.getComputedStyle?.(doc.body)?.fontFamily || familia;
    } catch {
      /* fica a padrão */
    }
    let corpo = 170;
    contexto.font = `800 ${corpo}px ${familia}`;
    const medida = contexto.measureText?.(texto)?.width || 0;
    if (medida > largura * 0.94) {
      corpo = Math.floor((corpo * largura * 0.94) / medida);
      contexto.font = `800 ${corpo}px ${familia}`;
    }
    contexto.textAlign = "center";
    contexto.textBaseline = "middle";
    contexto.fillStyle = "#fff";
    contexto.fillText(texto, largura / 2, altura / 2);
    const imagem = contexto.getImageData(0, 0, largura, altura);
    return imagem?.data ? imagem : null;
  } catch {
    return null;
  }
}

/**
 * O documento e a janela desenham? Canvas 2D, requestAnimationFrame e sem
 * pedido de menos movimento.
 */
export function podeDesenhar(
  doc: Document | undefined,
  janela: JanelaDaComemoracao | undefined,
): boolean {
  if (!doc?.body || !janela?.requestAnimationFrame || semMovimento(janela))
    return false;
  try {
    return Boolean(doc.createElement("canvas").getContext?.("2d"));
  } catch {
    return false;
  }
}
