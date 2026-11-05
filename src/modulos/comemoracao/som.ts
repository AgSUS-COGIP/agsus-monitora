import { guardarSom, podeTocarSom, somLigado } from "../../lib/fogos-cena.ts";
import type { SomDoEstouro } from "../../lib/fogos-cena.ts";
import type { JanelaDaComemoracao } from "./desenho.ts";

/*
  O som das comemorações, sintetizado (sem arquivo): baque + chiado, ou
  crepitar. Desligado por padrão; liga no botão do aviso.
*/

export interface SomDasComemoracoes {
  readonly ligado: boolean;
  alternar(): boolean;
  tocar(som: SomDoEstouro): boolean;
  fechar(): void;
}

/* Ruído branco que decai: a matéria-prima do estalo. */
function ruido(audio: BaseAudioContext, duracao: number): AudioBuffer {
  const tamanho = Math.max(1, Math.ceil(audio.sampleRate * duracao));
  const buffer = audio.createBuffer(1, tamanho, audio.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < tamanho; i += 1)
    dados[i] = (Math.random() * 2 - 1) * (1 - i / tamanho) ** 2;
  return buffer;
}

function rajada(
  audio: BaseAudioContext,
  saida: AudioNode,
  {
    inicio,
    duracao,
    corte,
    filtro = "lowpass",
  }: {
    inicio: number;
    duracao: number;
    corte: number;
    filtro?: BiquadFilterType;
  },
) {
  const fonte = audio.createBufferSource();
  fonte.buffer = ruido(audio, duracao);
  const passa = audio.createBiquadFilter();
  passa.type = filtro;
  passa.frequency.value = corte;
  const volume = audio.createGain();
  volume.gain.setValueAtTime(1, inicio);
  volume.gain.exponentialRampToValueAtTime(0.001, inicio + duracao);
  fonte.connect(passa);
  passa.connect(volume);
  volume.connect(saida);
  fonte.start(inicio);
  fonte.stop(inicio + duracao);
}

function baque(
  audio: BaseAudioContext,
  saida: AudioNode,
  {
    inicio,
    frequencia,
    duracao,
  }: { inicio: number; frequencia: number; duracao: number },
) {
  const oscilador = audio.createOscillator();
  oscilador.type = "sine";
  oscilador.frequency.setValueAtTime(frequencia * 1.6, inicio);
  oscilador.frequency.exponentialRampToValueAtTime(
    frequencia,
    inicio + duracao * 0.5,
  );
  const volume = audio.createGain();
  volume.gain.setValueAtTime(0.8, inicio);
  volume.gain.exponentialRampToValueAtTime(0.001, inicio + duracao);
  oscilador.connect(volume);
  volume.connect(saida);
  oscilador.start(inicio);
  oscilador.stop(inicio + duracao);
}

/* Estalos suaves sintetizados (sem arquivo): baque + chiado, ou crepitar. */
function sintetizar(audio: BaseAudioContext, { tipo, volume }: SomDoEstouro) {
  const agora = audio.currentTime || 0;
  const mestre = audio.createGain();
  mestre.gain.value = 0.2 * volume;
  mestre.connect(audio.destination);
  if (tipo === "crepitar") {
    for (let i = 0; i < 8; i += 1)
      rajada(audio, mestre, {
        inicio: agora + 0.12 + i * 0.05 + Math.random() * 0.04,
        duracao: 0.025,
        corte: 2500,
        filtro: "highpass",
      });
    return;
  }
  const grave = tipo === "grave";
  rajada(audio, mestre, {
    inicio: agora,
    duracao: grave ? 0.5 : 0.28,
    corte: grave ? 900 : 1600,
  });
  baque(audio, mestre, {
    inicio: agora,
    frequencia: grave ? 55 : 85,
    duracao: grave ? 0.6 : 0.3,
  });
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
      try {
        void atual.resume?.();
        sintetizar(atual, som);
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
    },
  };
}
