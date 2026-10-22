import { describe, expect, it } from "vitest";
import {
  CHAVE_DO_SOM,
  guardarSom,
  opacidadeDoVeu,
  podeTocarSom,
  pontoDaSoltura,
  posicaoDaAya,
  somDoEstouro,
  somLigado,
  trajetoDaAya,
  VOO_DA_AYA,
} from "../src/lib/fogos-cena.js";

/* A cena dos fogos: o voo da Aya, o véu e a regra do som (sem DOM). */
const tela = { largura: 1280, altura: 720 };

function armazenamentoFalso() {
  const dados = new Map();
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
  };
}

describe("o voo da Aya", () => {
  it("atravessa a tela da esquerda para a direita, entrando e saindo por fora", () => {
    const trajeto = trajetoDaAya(tela);
    const inicio = posicaoDaAya(trajeto, 0);
    const fim = posicaoDaAya(trajeto, trajeto.duracao);
    expect(inicio.x).toBeLessThan(0);
    expect(fim.x).toBeGreaterThan(tela.largura);
    expect(fim.y).toBeLessThan(inicio.y);
    // Sempre avançando para a direita.
    let antes = -Infinity;
    for (let t = 0; t <= trajeto.duracao; t += 0.05) {
      const { x } = posicaoDaAya(trajeto, t);
      expect(x).toBeGreaterThanOrEqual(antes);
      antes = x;
    }
    expect(posicaoDaAya(trajeto, -0.1)).toBeNull();
    expect(posicaoDaAya(trajeto, trajeto.duracao + 0.1)).toBeNull();
    expect(posicaoDaAya(null, 1)).toBeNull();
  });

  it("bate as asas (escala oscila) e inclina pouco", () => {
    const trajeto = trajetoDaAya(tela);
    const escalas = new Set();
    for (let t = 0.3; t < 1.8; t += 0.03) {
      const aya = posicaoDaAya(trajeto, t);
      escalas.add(aya.escalaY.toFixed(2));
      expect(Math.abs(aya.rotacao)).toBeLessThanOrEqual(0.52);
      expect(aya.escalaY).toBeGreaterThan(0.85);
      expect(aya.escalaY).toBeLessThanOrEqual(1);
    }
    expect(escalas.size).toBeGreaterThan(4);
    expect(posicaoDaAya(trajeto, 1).opacidade).toBe(1);
  });

  it("solta o foguete dentro da tela, logo abaixo dela; tamanho limitado", () => {
    const trajeto = trajetoDaAya(tela);
    const soltura = pontoDaSoltura(trajeto);
    const aya = posicaoDaAya(trajeto, VOO_DA_AYA.soltura);
    expect(soltura.x).toBeGreaterThan(0);
    expect(soltura.x).toBeLessThan(tela.largura);
    expect(soltura.y).toBeGreaterThan(aya.y);
    expect(trajeto.tamanho).toBeLessThanOrEqual(128);
    expect(trajetoDaAya({ largura: 320, altura: 400 }).tamanho).toBe(64);
  });
});

describe("véu", () => {
  it("entra, fica e sai antes do fim", () => {
    expect(opacidadeDoVeu(0, 5.5)).toBe(0);
    expect(opacidadeDoVeu(0.25, 5.5)).toBeCloseTo(0.5);
    expect(opacidadeDoVeu(2, 5.5)).toBe(1);
    expect(opacidadeDoVeu(5.5 - 0.35, 5.5)).toBeCloseTo(0.5);
    expect(opacidadeDoVeu(5.5, 5.5)).toBe(0);
  });
});

describe("som", () => {
  it("desligado por padrão; a escolha fica guardada", () => {
    const armazenamento = armazenamentoFalso();
    expect(somLigado(armazenamento)).toBe(false);
    expect(somLigado(null)).toBe(false);
    expect(guardarSom(armazenamento, true)).toBe(true);
    expect(armazenamento.getItem(CHAVE_DO_SOM)).toBe("1");
    expect(somLigado(armazenamento)).toBe(true);
    guardarSom(armazenamento, false);
    expect(somLigado(armazenamento)).toBe(false);
  });

  it("armazenamento bloqueado: mudo, sem erro", () => {
    const bloqueado = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(somLigado(bloqueado)).toBe(false);
    expect(guardarSom(bloqueado, true)).toBe(false);
  });

  it("só toca ligado E depois de a pessoa interagir", () => {
    expect(podeTocarSom({ ligado: false, interagiu: true })).toBe(false);
    expect(podeTocarSom({ ligado: true, interagiu: false })).toBe(false);
    expect(podeTocarSom({ ligado: true, interagiu: true })).toBe(true);
  });

  it("o som de cada estouro: grave no marco, crepitar no glitter, estalo no resto", () => {
    expect(somDoEstouro({ papel: "marco", formato: "marco" }).tipo).toBe(
      "grave",
    );
    expect(somDoEstouro({ papel: "comum", formato: "glitter" }).tipo).toBe(
      "crepitar",
    );
    const final = somDoEstouro({ papel: "final", formato: "peonia" });
    const comum = somDoEstouro({ papel: "comum", formato: "peonia" });
    expect(final.tipo).toBe("estalo");
    expect(final.volume).toBeLessThan(comum.volume);
    expect(somDoEstouro().tipo).toBe("estalo");
  });
});
