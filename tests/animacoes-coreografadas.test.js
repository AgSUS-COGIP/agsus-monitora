import { describe, expect, it } from "vitest";
import { criarAleatorio, paletaDosFogos } from "../src/lib/fogos.ts";
import {
  arrastoDoConfete,
  batidaDoCoracao,
  brilhoDoMotor,
  desenharParticulas,
  envelopeDaChuva,
  lotesDaPeca,
  moverParticulaDoMotor,
  nascerLote,
  PICO_DA_CHUVA,
  suavizar,
  tamanhoNaProfundidade,
} from "../src/lib/particulas-do-motor.ts";
import { avancarCena, criarCena } from "../src/lib/motor-de-efeitos.ts";

/*
  As animações do motor (src/lib/particulas-do-motor.ts): roteiro em três
  atos (abertura, clímax, dispersão), níveis com diferença clara, confete em
  3D (o ar segura a folhinha de chapa), profundidade e desenho das de longe
  primeiro. Sorteio sempre com criarAleatorio(n).
*/

const tela = { largura: 1280, altura: 720, escala: 1 };
const cenaParaNascer = (semente = 1) => ({
  ...tela,
  aleatorio: criarAleatorio(semente),
  paleta: paletaDosFogos(),
});
const total = (lotes) => lotes.reduce((s, l) => s + l.quantos, 0);

describe("animações coreografadas", () => {
  it("as curvas: suave nas pontas e a chuva abre, chega ao clímax e rareia", () => {
    expect(suavizar(0)).toBe(0);
    expect(suavizar(1)).toBe(1);
    expect(suavizar(0.5)).toBeCloseTo(0.5);
    expect(envelopeDaChuva(PICO_DA_CHUVA)).toBeCloseTo(1);
    expect(envelopeDaChuva(0)).toBeLessThan(envelopeDaChuva(0.3));
    expect(envelopeDaChuva(0.7)).toBeLessThan(envelopeDaChuva(PICO_DA_CHUVA));
    expect(envelopeDaChuva(1)).toBeLessThan(envelopeDaChuva(0.7));
    expect(envelopeDaChuva(1)).toBeGreaterThan(0);
    for (let u = 0; u <= 1; u += 0.05) {
      expect(envelopeDaChuva(u)).toBeGreaterThan(0);
      expect(envelopeDaChuva(u)).toBeLessThanOrEqual(1);
    }
  });

  it("confete: abertura nos canhões, clímax no chafariz e a chuva que rareia", () => {
    const lotes = lotesDaPeca("confete", { duracao: 6, quantidade: 1 });
    expect(lotes.filter((l) => l.t < 0.1).map((l) => l.origem)).toEqual([
      "canhao-esquerdo",
      "canhao-direito",
    ]);
    const chafariz = lotes.find((l) => l.origem === "chafariz");
    expect(chafariz.t).toBeCloseTo(6 * PICO_DA_CHUVA);
    const chuva = lotes.filter((l) => l.origem === "topo");
    const perto = (t) =>
      chuva
        .filter((l) => Math.abs(l.t - t) < 0.5)
        .reduce((s, l) => s + l.quantos, 0);
    expect(perto(6 * PICO_DA_CHUVA)).toBeGreaterThan(perto(4.2));
    expect(Math.max(...chuva.map((l) => l.t))).toBeLessThanOrEqual(6 - 1.6);
  });

  it("Suave, Normal e Festa: o roteiro muda, não só a quantidade", () => {
    const de = (nivel, quantidade) =>
      lotesDaPeca("confete", { duracao: 6, quantidade, nivel });
    const suave = de("suave", 0.55);
    const normal = de("normal", 1);
    const festa = de("festa", 1.7);
    // Suave: sem clímax; Festa: mais ondas de canhão que o Normal.
    expect(suave.some((l) => l.origem === "chafariz")).toBe(false);
    expect(normal.some((l) => l.origem === "chafariz")).toBe(true);
    const canhoes = (lotes) =>
      lotes.filter((l) => l.origem.startsWith("canhao")).length;
    expect(canhoes(festa)).toBeGreaterThan(canhoes(normal));
    expect(total(normal)).toBeGreaterThan(total(suave) * 1.6);
    expect(total(festa)).toBeGreaterThan(total(normal) * 1.6);
    // Estrelas: o Normal tem chuva de meteoros no clímax; o Festa, duas.
    const meteoros = (nivel) =>
      lotesDaPeca("estrelas", { duracao: 6, quantidade: 1, nivel }).filter(
        (l) => l.peca === "cometa" && l.quantos >= 5,
      ).length;
    expect(meteoros("suave")).toBe(0);
    expect(meteoros("normal")).toBe(1);
    expect(meteoros("festa")).toBe(2);
    // Corações e balões: o clímax é uma onda própria (fora do Suave).
    for (const [peca, origem] of [
      ["coracoes", "chafariz"],
      ["baloes", "onda"],
    ]) {
      expect(
        lotesDaPeca(peca, { duracao: 6, quantidade: 1, nivel: "suave" }).some(
          (l) => l.origem === origem,
        ),
      ).toBe(false);
      expect(
        lotesDaPeca(peca, { duracao: 6, quantidade: 1 }).some(
          (l) => l.origem === origem,
        ),
      ).toBe(true);
    }
  });

  it("confete em 3D: de chapa, o ar segura e ele cai mais devagar que de lado", () => {
    expect(arrastoDoConfete(0, 0)).toBeCloseTo(1.55);
    expect(arrastoDoConfete(Math.PI / 2, 0)).toBeCloseTo(0.45);
    const [modelo] = nascerLote(cenaParaNascer(3), {
      t: 0,
      peca: "confete",
      quantos: 1,
      origem: "topo",
    });
    const cair = (fase) => {
      const p = {
        ...modelo,
        fase,
        giroY: 0,
        vfase: 0,
        vgiroY: 0,
        vrot: 0,
        balanco: 0,
        vx: 0,
        vy: 50,
        y: 0,
        vida: 10,
        vidaMax: 10,
      };
      for (let i = 0; i < 120; i += 1) moverParticulaDoMotor(p, 1 / 60, tela);
      return p.y;
    };
    expect(cair(Math.PI / 2)).toBeGreaterThan(cair(0) * 1.3);
    // Duas viradas (fase e giroY) e o metálico existem no confete.
    expect(typeof modelo.giroY).toBe("number");
    expect(typeof modelo.metalico).toBe("boolean");
  });

  it("profundidade: as de longe são menores e mais apagadas e são desenhadas primeiro", () => {
    expect(tamanhoNaProfundidade(0)).toBeLessThan(tamanhoNaProfundidade(1));
    const base = { idade: 1, vida: 3, vidaMax: 4, tipo: "confete" };
    expect(brilhoDoMotor({ ...base, z: 0 })).toBeLessThan(
      brilhoDoMotor({ ...base, z: 1 }),
    );
    const particulas = nascerLote(cenaParaNascer(5), {
      t: 0,
      peca: "estrela",
      quantos: 40,
      origem: "topo",
    }).map((p) => ({ ...p, idade: 0.5, y: 100 }));
    const ordem = [];
    const contexto = new Proxy(
      {},
      {
        get: (_, chave) =>
          chave === "translate"
            ? (x) => ordem.push(particulas.find((p) => p.x === x).z)
            : () => {},
        set: () => true,
      },
    );
    desenharParticulas(contexto, particulas);
    const virada = ordem.findIndex((z) => z >= 0.5);
    expect(virada).toBeGreaterThan(0);
    expect(ordem.slice(0, virada).every((z) => z < 0.5)).toBe(true);
    expect(ordem.slice(virada).every((z) => z >= 0.5)).toBe(true);
  });

  it("o coração bate tum-tum e a qualidade baixa corta brilhos e sombras", () => {
    expect(batidaDoCoracao(0.08)).toBeCloseTo(1, 1);
    expect(batidaDoCoracao(0.3)).toBeGreaterThan(0.5);
    expect(batidaDoCoracao(0.7)).toBeLessThan(0.05);
    expect(batidaDoCoracao(1.1 + 0.08)).toBeCloseTo(batidaDoCoracao(0.08));
    const contar = (qualidade) => {
      const cena = criarCena({
        ...tela,
        efeito: "baloes",
        aleatorio: criarAleatorio(4),
      });
      for (let i = 0; i < 120; i += 1) avancarCena(cena, 1 / 60);
      let ellipses = 0;
      const contexto = new Proxy(
        {},
        {
          get: (_, chave) =>
            chave === "ellipse" ? () => (ellipses += 1) : () => {},
          set: () => true,
        },
      );
      desenharParticulas(contexto, cena.particulas, { qualidade });
      return ellipses;
    };
    expect(contar(2)).toBeGreaterThan(contar(0));
  });
});
