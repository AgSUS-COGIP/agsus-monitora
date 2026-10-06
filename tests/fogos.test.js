import { describe, expect, it } from "vitest";
import { DURACAO_DOS_FOGOS_MS } from "../src/lib/comemoracao.js";
import {
  alfaDoRastro,
  avancarShow,
  brilhoDaParticula,
  centelhas,
  corDaParticula,
  criarAleatorio,
  criarShow,
  estourar,
  fatorDeSaida,
  FORMATOS,
  INTENSIDADES,
  intensidadeDoShow,
  lancarFoguete,
  LIMITE_DE_PARTICULAS,
  moverFoguete,
  moverParticula,
  NOMES_DOS_FORMATOS,
  paletaDosFogos,
  planejarShow,
  showAcabou,
} from "../src/lib/fogos.js";

const tela = { largura: 1280, altura: 720 };

describe("roteiro do show", () => {
  it("as durações ficam entre 3 e 4,5 s e o padrão é DURACAO_DOS_FOGOS_MS", () => {
    for (const { duracaoMs } of Object.values(INTENSIDADES)) {
      expect(duracaoMs).toBeGreaterThanOrEqual(3000);
      expect(duracaoMs).toBeLessThanOrEqual(4500);
    }
    expect(INTENSIDADES.cheio.duracaoMs).toBe(DURACAO_DOS_FOGOS_MS);
    expect(intensidadeDoShow("inexistente")).toBe(INTENSIDADES.cheio);
  });

  it("6 a 10 estouros no padrão, escalonados, espalhados e com formatos variados", () => {
    for (let semente = 1; semente <= 20; semente += 1) {
      const planos = planejarShow({
        ...tela,
        aleatorio: criarAleatorio(semente),
      });
      expect(planos.length).toBeGreaterThanOrEqual(6);
      expect(planos.length).toBeLessThanOrEqual(10);
      const estouros = planos.map((p) => p.estouro);
      expect([...estouros].sort((a, b) => a - b)).toEqual(estouros);
      expect(estouros.at(-1) - estouros[0]).toBeGreaterThan(1.2);
      for (const p of planos) {
        expect(p.lancamento).toBeGreaterThanOrEqual(0);
        expect(p.lancamento).toBeLessThan(p.estouro);
        expect(p.yAlvo).toBeLessThan(tela.altura * 0.5);
        expect(p.yBase).toBeGreaterThan(tela.altura);
        // Termina a tempo de apagar antes do fim.
        expect(p.estouro + FORMATOS[p.formato].vida[1]).toBeLessThanOrEqual(
          DURACAO_DOS_FOGOS_MS / 1000,
        );
      }
      const xs = planos.map((p) => p.xAlvo);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(
        tela.largura * 0.5,
      );
      expect(new Set(planos.map((p) => p.formato)).size).toBeGreaterThanOrEqual(
        3,
      );
      expect(new Set(planos.map((p) => p.xBase)).size).toBe(planos.length);
    }
  });

  it("há salvas quase simultâneas", () => {
    const quase = Array.from({ length: 20 }, (_, i) => {
      const e = planejarShow({
        ...tela,
        intensidade: "festa",
        aleatorio: criarAleatorio(i + 1),
      }).map((p) => p.estouro);
      return e.some((t, j) => j > 0 && t - e[j - 1] < 0.2);
    });
    expect(quase.filter(Boolean).length).toBeGreaterThan(10);
  });

  it("o foguete sobe e chega ao alvo no instante do estouro, desacelerando", () => {
    const [plano] = planejarShow({ ...tela, aleatorio: criarAleatorio(3) });
    const foguete = lancarFoguete(plano);
    const vyInicial = foguete.vy;
    expect(vyInicial).toBeLessThan(0);
    let chegou = false;
    let passos = 0;
    while (!chegou && passos < 1000) {
      chegou = moverFoguete(foguete, 1 / 60);
      passos += 1;
    }
    expect(foguete.x).toBeCloseTo(plano.xAlvo, 3);
    expect(foguete.y).toBeCloseTo(plano.yAlvo, 3);
    expect(Math.abs(foguete.vy)).toBeLessThan(Math.abs(vyInicial));
  });
});

describe("estouros e física", () => {
  const plano = { formato: "peonia", cor: "#f00", cor2: "#0f0" };

  it("centenas de faíscas por estouro, com clarão, respeitando o teto", () => {
    const faiscas = estourar(plano, {
      x: 100,
      y: 100,
      aleatorio: criarAleatorio(1),
    });
    expect(faiscas.filter((p) => p.tipo === "faisca")).toHaveLength(
      FORMATOS.peonia.faiscas,
    );
    expect(faiscas.filter((p) => p.tipo === "clarao")).toHaveLength(1);
    expect(new Set(faiscas.map((p) => p.cor))).toEqual(
      new Set(["#f00", "#0f0"]),
    );
    expect(estourar(plano, { x: 0, y: 0, cabem: 30 })).toHaveLength(30);
    expect(estourar(plano, { x: 0, y: 0, cabem: 0 })).toHaveLength(0);
    expect(estourar(plano, { x: 0, y: 0, fator: 0.5 }).length).toBeLessThan(
      FORMATOS.peonia.faiscas,
    );
  });

  it("todos os formatos estouram; o anel nunca passa do raio", () => {
    for (const formato of NOMES_DOS_FORMATOS) {
      const f = estourar({ formato, cor: "#fff" }, { x: 0, y: 0 });
      expect(f.length).toBeGreaterThan(80);
    }
    const anel = estourar(
      { formato: "anel", cor: "#fff" },
      { x: 0, y: 0, aleatorio: () => 0.5 },
    ).filter((p) => p.tipo === "faisca");
    const forcas = anel.map((p) => Math.hypot(p.vx, p.vy));
    expect(Math.max(...forcas)).toBeLessThanOrEqual(330 * 0.95 * 1.06 + 1e-6);
    expect(Math.min(...forcas)).toBeLessThan(Math.max(...forcas) * 0.8);
  });

  it("gravidade puxa para baixo, atrito freia e a vida acaba", () => {
    const p = {
      x: 0,
      y: 0,
      vx: 100,
      vy: 0,
      atrito: 2,
      gravidade: 240,
      vida: 0.1,
      vidaMax: 1,
    };
    expect(moverParticula(p, 0.05)).toBe(true);
    expect(p.vx).toBeLessThan(100);
    expect(p.vy).toBeGreaterThan(0);
    expect(p.y).toBeGreaterThan(0);
    expect(moverParticula(p, 0.06)).toBe(false);
  });

  it("brilho: apaga no fim, cintila na segunda metade; o crisântemo vira dourado", () => {
    expect(brilhoDaParticula({ vida: 1, vidaMax: 1 })).toBe(1);
    expect(brilhoDaParticula({ vida: 0, vidaMax: 1 })).toBe(0);
    const cintila = { vida: 0.3, vidaMax: 1, cintila: true };
    expect(brilhoDaParticula(cintila, () => 0.1)).toBeLessThan(
      brilhoDaParticula(cintila, () => 0.9),
    );
    const c = { cor: "#f00", corFinal: "#fd0", vida: 0.9, vidaMax: 1 };
    expect(corDaParticula(c)).toBe("#f00");
    c.vida = 0.2;
    expect(corDaParticula(c)).toBe("#fd0");
  });

  it("estalinho solta centelhas curtas ao apagar", () => {
    const c = centelhas(
      { x: 5, y: 5 },
      { cor: "#fff", aleatorio: criarAleatorio(2) },
    );
    expect(c.length).toBeGreaterThanOrEqual(2);
    expect(c.every((p) => p.vidaMax <= 0.22 && p.tipo === "centelha")).toBe(
      true,
    );
    expect(centelhas({ x: 0, y: 0 }, { cabem: 0 })).toHaveLength(0);
  });

  it("rastro e saída dependem do tempo, não da taxa de quadros", () => {
    expect(alfaDoRastro(0)).toBe(0);
    const doisQuadros = 1 - (1 - alfaDoRastro(1 / 120)) ** 2;
    expect(doisQuadros).toBeCloseTo(alfaDoRastro(1 / 60), 6);
    expect(fatorDeSaida(0, 4)).toBe(1);
    expect(fatorDeSaida(3.8, 4)).toBeCloseTo(0.5);
    expect(fatorDeSaida(4, 4)).toBe(0);
  });
});

describe("paleta", () => {
  it("tokens da marca + dourado; branco e luz somada só no escuro", () => {
    const tokens = { "--brand-primary": " #70cfff ", "--series-2": "#d95f2b" };
    const escuro = paletaDosFogos((n) => tokens[n], { escuro: true });
    expect(escuro.cores).toEqual(
      expect.arrayContaining(["#70cfff", "#d95f2b", "#ffd23f", "#fff6dc"]),
    );
    expect(escuro.composicao).toBe("lighter");
    const claro = paletaDosFogos((n) => tokens[n], { escuro: false });
    expect(claro.cores).not.toContain("#fff6dc");
    expect(claro.composicao).toBe("source-over");
  });

  it("sem tokens (ou leitura que falha), a paleta reserva", () => {
    const p = paletaDosFogos(() => {
      throw new Error("x");
    });
    expect(p.cores.length).toBeGreaterThan(3);
  });
});

describe("o show inteiro", () => {
  it("estoura tudo, nunca passa do teto e acaba sozinho dentro da duração", () => {
    const show = criarShow({
      ...tela,
      intensidade: "festa",
      aleatorio: criarAleatorio(7),
    });
    let maximo = 0;
    let quadros = 0;
    while (!showAcabou(show) && quadros < 1000) {
      avancarShow(show, 1 / 60);
      maximo = Math.max(maximo, show.particulas.length);
      quadros += 1;
    }
    expect(show.estouros).toBe(INTENSIDADES.festa.explosoes);
    expect(maximo).toBeGreaterThan(300);
    expect(maximo).toBeLessThanOrEqual(LIMITE_DE_PARTICULAS);
    expect(show.t).toBeLessThanOrEqual(
      INTENSIDADES.festa.duracaoMs / 1000 + 1e-9,
    );
  });

  it("o teto baixo corta faíscas, e passo enorme (aba voltando) é limitado", () => {
    const show = criarShow({
      ...tela,
      limite: 200,
      aleatorio: criarAleatorio(1),
    });
    for (let i = 0; i < 300; i += 1) {
      avancarShow(show, 1 / 60);
      expect(show.particulas.length).toBeLessThanOrEqual(200);
    }
    const t = show.t;
    avancarShow(show, 30);
    expect(show.t - t).toBeCloseTo(1 / 20);
    avancarShow(show, 0);
    expect(show.t - t).toBeCloseTo(1 / 20);
  });
});
