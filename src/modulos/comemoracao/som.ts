import { guardarSom, podeTocarSom, somLigado } from "../../lib/fogos-cena.ts";
import type { SomDoEstouro } from "../../lib/fogos-cena.ts";
import type { JanelaDaComemoracao } from "./desenho.ts";

/*
  O som das comemorações, sintetizado com WebAudio (sem arquivo): ruído
  filtrado e envelopes. Desligado por padrão; liga no botão do aviso.

  - estouro: o estalo seco (ruído agudo, curtíssimo), o corpo (ruído num
    passa-baixa que fecha, como o som que se afasta) e o baque grave (seno
    que cai), com um eco curto de céu aberto;
  - assobio: o foguete subindo (seno que sobe, com vibrato, e um sopro de
    ruído na mesma nota);
  - crepitar: o estouro leve e depois dezenas de estalinhos espalhados (um
    buffer de impulsos esparsos, feito uma vez por áudio);
  - pop: a rajada e o confete da Aya (um "tum" curto).

  Muitos estouros juntos (grande final) não empilham vozes: passou de
  VOZES_SIMULTANEAS em JANELA_DAS_VOZES s, o som seguinte é pulado (o
  grave, nunca).
*/

export interface SomDasComemoracoes {
  readonly ligado: boolean;
  alternar(): boolean;
  tocar(som: SomDoEstouro): boolean;
  fechar(): void;
}

export const VOZES_SIMULTANEAS = 7;
export const JANELA_DAS_VOZES = 0.3;

/* O que o áudio guarda para não refazer a cada som. */
interface Recursos {
  ruido: AudioBuffer;
  crepitar: AudioBuffer;
  /** A entrada do eco (ou o destino, sem DelayNode). */
  eco: AudioNode;
}
const recursosDoAudio = new WeakMap<BaseAudioContext, Recursos>();

/* Ruído branco (1 s): a matéria-prima de estalo, corpo e sopro. */
function bufferDeRuido(audio: BaseAudioContext): AudioBuffer {
  const tamanho = Math.max(1, Math.ceil(audio.sampleRate));
  const buffer = audio.createBuffer(1, tamanho, audio.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < tamanho; i += 1) dados[i] = Math.random() * 2 - 1;
  return buffer;
}

/*
  O crepitar: 1,2 s de silêncio com estalinhos esparsos — cada um, uns
  poucos milissegundos de ruído que decai —, mais densos no começo.
*/
function bufferDoCrepitar(audio: BaseAudioContext): AudioBuffer {
  const taxa = audio.sampleRate;
  const tamanho = Math.max(1, Math.ceil(taxa * 1.2));
  const buffer = audio.createBuffer(1, tamanho, taxa);
  const dados = buffer.getChannelData(0);
  for (let e = 0; e < 46; e += 1) {
    // Potência > 1 no sorteio: mais estalos perto do começo.
    const inicio = Math.floor(Math.random() ** 1.6 * (tamanho - 1));
    const duracao = Math.max(
      2,
      Math.floor(taxa * (0.002 + Math.random() * 0.006)),
    );
    const forca = 0.35 + Math.random() * 0.65;
    for (let i = 0; i < duracao && inicio + i < tamanho; i += 1)
      dados[inicio + i] =
        (dados[inicio + i] ?? 0) +
        (Math.random() * 2 - 1) * forca * (1 - i / duracao) ** 2;
  }
  return buffer;
}

/* Um eco curto, de céu aberto: atraso com realimentação e passa-baixa. */
function criarEco(audio: BaseAudioContext): AudioNode {
  if (typeof audio.createDelay !== "function") return audio.destination;
  const entrada = audio.createGain();
  const atraso = audio.createDelay(1);
  atraso.delayTime.value = 0.13;
  const volta = audio.createGain();
  volta.gain.value = 0.32;
  const abafa = audio.createBiquadFilter();
  abafa.type = "lowpass";
  abafa.frequency.value = 1800;
  const saida = audio.createGain();
  saida.gain.value = 0.35;
  entrada.connect(atraso);
  atraso.connect(abafa);
  abafa.connect(volta);
  volta.connect(atraso);
  abafa.connect(saida);
  saida.connect(audio.destination);
  return entrada;
}

function recursos(audio: BaseAudioContext): Recursos {
  let prontos = recursosDoAudio.get(audio);
  if (!prontos) {
    prontos = {
      ruido: bufferDeRuido(audio),
      crepitar: bufferDoCrepitar(audio),
      eco: criarEco(audio),
    };
    recursosDoAudio.set(audio, prontos);
  }
  return prontos;
}

/* Envelope: sobe em `ataque` s até `pico` e cai (exponencial) até `fim`. */
function envelope(
  ganho: AudioParam,
  {
    inicio,
    ataque,
    pico,
    fim,
  }: { inicio: number; ataque: number; pico: number; fim: number },
) {
  ganho.setValueAtTime(0.0001, inicio);
  ganho.exponentialRampToValueAtTime(Math.max(0.0001, pico), inicio + ataque);
  ganho.exponentialRampToValueAtTime(0.0001, fim);
}

interface OpcoesDoRuido {
  inicio: number;
  duracao: number;
  filtro: BiquadFilterType;
  /** Frequência do filtro no começo e (se fecha ou abre) no fim. */
  de: number;
  ate?: number;
  q?: number;
  pico: number;
  ataque?: number;
  /** Velocidade de leitura do buffer (abaixo de 1, mais grave). */
  taxa?: number;
}

/* Ruído filtrado com envelope (e o filtro que pode mudar com o tempo). */
function ruidoFiltrado(
  audio: BaseAudioContext,
  saida: AudioNode,
  buffer: AudioBuffer,
  {
    inicio,
    duracao,
    filtro,
    de,
    ate = de,
    q = 0.7,
    pico,
    ataque = 0.004,
    taxa = 1,
  }: OpcoesDoRuido,
) {
  const fonte = audio.createBufferSource();
  fonte.buffer = buffer;
  fonte.playbackRate.value = taxa;
  const passa = audio.createBiquadFilter();
  passa.type = filtro;
  passa.Q.value = q;
  passa.frequency.setValueAtTime(de, inicio);
  if (ate !== de)
    passa.frequency.exponentialRampToValueAtTime(ate, inicio + duracao);
  const volume = audio.createGain();
  envelope(volume.gain, { inicio, ataque, pico, fim: inicio + duracao });
  fonte.connect(passa);
  passa.connect(volume);
  volume.connect(saida);
  // Cada som lê um trecho diferente do ruído: nenhum estouro é igual.
  fonte.start(inicio, Math.random() * 0.4);
  fonte.stop(inicio + duracao + 0.02);
}

interface OpcoesDoTom {
  inicio: number;
  duracao: number;
  de: number;
  ate: number;
  pico: number;
  ataque?: number;
}

/* Um tom (seno) que desliza de `de` a `ate` Hz, com envelope. */
function tom(
  audio: BaseAudioContext,
  saida: AudioNode,
  { inicio, duracao, de, ate, pico, ataque = 0.005 }: OpcoesDoTom,
): OscillatorNode {
  const oscilador = audio.createOscillator();
  oscilador.type = "sine";
  oscilador.frequency.setValueAtTime(de, inicio);
  oscilador.frequency.exponentialRampToValueAtTime(ate, inicio + duracao);
  const volume = audio.createGain();
  envelope(volume.gain, { inicio, ataque, pico, fim: inicio + duracao });
  oscilador.connect(volume);
  volume.connect(saida);
  oscilador.start(inicio);
  oscilador.stop(inicio + duracao + 0.02);
  return oscilador;
}

/* O estouro: estalo seco, corpo que se afasta e baque grave. */
function estouro(
  audio: BaseAudioContext,
  saida: AudioNode,
  { ruido }: Recursos,
  inicio: number,
  grave: boolean,
  forca = 1,
) {
  ruidoFiltrado(audio, saida, ruido, {
    inicio,
    duracao: 0.05,
    filtro: "bandpass",
    de: 2600 + Math.random() * 1600,
    q: 0.9,
    pico: 0.9 * forca,
    ataque: 0.001,
  });
  ruidoFiltrado(audio, saida, ruido, {
    inicio,
    duracao: grave ? 1.3 : 0.75,
    filtro: "lowpass",
    de: grave ? 2400 : 3800,
    ate: grave ? 160 : 260,
    pico: (grave ? 1 : 0.75) * forca,
    ataque: 0.006,
    taxa: grave ? 0.7 : 1,
  });
  tom(audio, saida, {
    inicio,
    duracao: grave ? 0.7 : 0.35,
    de: grave ? 95 : 140,
    ate: grave ? 32 : 48,
    pico: (grave ? 0.9 : 0.55) * forca,
  });
}

/* O assobio do foguete subindo: a nota sobe, com vibrato e um sopro. */
function assobio(
  audio: BaseAudioContext,
  saida: AudioNode,
  { ruido }: Recursos,
  inicio: number,
  duracao: number,
) {
  const de = 700 + Math.random() * 300;
  const ate = 2200 + Math.random() * 900;
  const ataque = Math.min(0.12, duracao / 3);
  const nota = tom(audio, saida, {
    inicio,
    duracao,
    de,
    ate,
    pico: 0.16,
    ataque,
  });
  // Vibrato: um oscilador lento mexendo na frequência da nota.
  const vibrato = audio.createOscillator();
  vibrato.frequency.value = 14 + Math.random() * 8;
  const profundidade = audio.createGain();
  profundidade.gain.value = 35;
  vibrato.connect(profundidade);
  profundidade.connect(nota.frequency);
  vibrato.start(inicio);
  vibrato.stop(inicio + duracao + 0.02);
  ruidoFiltrado(audio, saida, ruido, {
    inicio,
    duracao,
    filtro: "bandpass",
    de,
    ate,
    q: 9,
    pico: 0.35,
    ataque,
  });
}

/* O crepitar: estouro leve e, logo depois, o chiado de estalinhos. */
function crepitar(
  audio: BaseAudioContext,
  saida: AudioNode,
  prontos: Recursos,
  inicio: number,
) {
  estouro(audio, saida, prontos, inicio, false, 0.6);
  ruidoFiltrado(audio, saida, prontos.crepitar, {
    inicio: inicio + 0.18 + Math.random() * 0.1,
    duracao: 1.15,
    filtro: "highpass",
    de: 1800 + Math.random() * 1500,
    pico: 0.9,
    ataque: 0.01,
    taxa: 0.9 + Math.random() * 0.25,
  });
}

/* O pop da rajada e do confete. */
function pop(
  audio: BaseAudioContext,
  saida: AudioNode,
  { ruido }: Recursos,
  inicio: number,
) {
  ruidoFiltrado(audio, saida, ruido, {
    inicio,
    duracao: 0.07,
    filtro: "bandpass",
    de: 1300,
    q: 1.2,
    pico: 0.8,
    ataque: 0.002,
  });
  tom(audio, saida, { inicio, duracao: 0.12, de: 320, ate: 110, pico: 0.5 });
}

function sintetizar(audio: BaseAudioContext, som: SomDoEstouro) {
  const prontos = recursos(audio);
  // Um pouco de atraso aleatório: a distância de cada estouro.
  const inicio = (audio.currentTime || 0) + 0.005 + Math.random() * 0.03;
  const mestre = audio.createGain();
  mestre.gain.value = 0.22 * som.volume;
  mestre.connect(audio.destination);
  if (prontos.eco !== audio.destination) mestre.connect(prontos.eco);
  if (som.tipo === "assobio")
    assobio(audio, mestre, prontos, inicio, som.duracao ?? 0.8);
  else if (som.tipo === "crepitar") crepitar(audio, mestre, prontos, inicio);
  else if (som.tipo === "pop") pop(audio, mestre, prontos, inicio);
  else estouro(audio, mestre, prontos, inicio, som.tipo === "grave");
}

/**
 * O som das comemorações: desligado por padrão, liga no botão do aviso (a
 * escolha fica neste navegador). Só toca depois de a pessoa interagir com a
 * página; o AudioContext só nasce quando vai tocar.
 */
export function criarSom(
  janela: JanelaDaComemoracao | undefined = globalThis.window,
  { ligadoPorPadrao = false }: { ligadoPorPadrao?: boolean } = {},
): SomDasComemoracoes {
  let armazenamento: Storage | null = null;
  try {
    armazenamento = janela?.localStorage || null;
  } catch {
    armazenamento = null;
  }
  // O marco configurado com som começa ligado (sem guardar a escolha).
  let ligado = ligadoPorPadrao === true || somLigado(armazenamento);
  let interagiu = janela?.navigator?.userActivation?.hasBeenActive === true;
  let audio: AudioContext | null = null;
  // Quando (no relógio do áudio) começou cada som recente.
  let vozes: number[] = [];
  const contexto = () => {
    if (audio) return audio;
    const Classe = janela?.AudioContext || janela?.webkitAudioContext;
    if (!Classe) return null;
    try {
      audio = new Classe();
    } catch {
      audio = null;
    }
    return audio;
  };
  return {
    get ligado() {
      return ligado;
    },
    /** O clique no botão: é a interação que libera o áudio. */
    alternar() {
      interagiu = true;
      ligado = !ligado;
      guardarSom(armazenamento, ligado);
      return ligado;
    },
    /** Toca um som (de somDoEstouro), se pode. Devolve se tocou. */
    tocar(som) {
      if (!podeTocarSom({ ligado, interagiu })) return false;
      const atual = contexto();
      if (!atual) return false;
      const agora = atual.currentTime || 0;
      vozes = vozes.filter((t) => agora - t < JANELA_DAS_VOZES);
      if (som.tipo !== "grave" && vozes.length >= VOZES_SIMULTANEAS)
        return false;
      try {
        void atual.resume?.();
        sintetizar(atual, som);
        vozes.push(agora);
        return true;
      } catch {
        return false;
      }
    },
    fechar() {
      try {
        void audio?.close?.();
      } catch {
        /* nada a fazer */
      }
      audio = null;
      vozes = [];
    },
  };
}
