import { describe, expect, it } from "vitest";
import {
  DANCA_DA_AYA,
  dancaDaAya,
  posicaoNaDanca,
  somDoEstouro,
  trajetoDaAya,
} from "../src/lib/fogos-cena.ts";
import {
  caixaDaForma,
  caixaDoLetreiro,
  normalizarLetreiro,
  pontosDoLetreiro,
  TAMANHO_DO_LETREIRO,
} from "../src/lib/fogos-formas.ts";
import { criarAleatorio } from "../src/lib/fogos.ts";
import {
  avancarCena,
  cenaAcabou,
  CONFETE_DA_AYA,
  criarCena,
} from "../src/lib/motor-de-efeitos.ts";
import {
  AJUSTE_DA_QUALIDADE,
  criarMedidor,
  QUADRO_IGNORADO_MS,
  QUADROS_PARA_DECIDIR,
  registrarQuadro,
} from "../src/modulos/comemoracao/desempenho.ts";
import {
  criarSom,
  JANELA_DAS_VOZES,
  VOZES_SIMULTANEAS,
} from "../src/modulos/comemoracao/som.ts";

/*
  O que deixa os fogos mais divertidos, sem DOM: a dança da Aya no fim, o
  letreiro (o texto do marco no céu), o confete que ela solta (motor), o
  som sintetizado (com um áudio falso que registra os nós) e a queda
  automática de qualidade. Sorteio fixo.
*/
const tela = { largura: 1280, altura: 720 };

describe("a dança da Aya", () => {
  const trajeto = trajetoDaAya(tela);

  it("começa depois do voo, termina antes do fim e solta o confete no meio", () => {
    for (const duracao of [5, 5.5, 6, 15]) {
      const danca = dancaDaAya(trajeto, { ...tela, duracao });
      expect(danca.inicio).toBeGreaterThan(trajeto.inicio + trajeto.duracao);
      expect(danca.inicio + danca.duracao).toBeLessThan(duracao);
      expect(danca.duracao).toBeLessThanOrEqual(DANCA_DA_AYA.maxima + 1e-9);
      expect(danca.confete).toBeGreaterThan(danca.inicio + DANCA_DA_AYA.giro);
      expect(danca.confete).toBeLessThan(danca.inicio + danca.duracao);
      // No canto de baixo, à esquerda, sem sair da tela.
      expect(danca.x).toBeLessThan(tela.largura * 0.3);
      expect(danca.y + danca.tamanho / 2).toBeLessThanOrEqual(tela.altura);
    }
    // Show curto demais (ou sem o voo): sem dança.
    expect(dancaDaAya(trajeto, { ...tela, duracao: 4 })).toBeNull();
    expect(dancaDaAya(null, { ...tela, duracao: 6 })).toBeNull();
  });

  it("sobe do pé da tela, pula no ritmo, dá uma cambalhota inteira e desce", () => {
    const danca = dancaDaAya(trajeto, { ...tela, duracao: 6 });
    const em = (s) => posicaoNaDanca(danca, danca.inicio + s);
    expect(posicaoNaDanca(danca, danca.inicio - 0.01)).toBeNull();
    expect(posicaoNaDanca(danca, danca.inicio + danca.duracao + 0.01)).toBe(
      null,
    );
    // Entra de baixo e aparece aos poucos.
    expect(em(0).y).toBeGreaterThan(em(DANCA_DA_AYA.entrada).y);
    expect(em(0).opacidade).toBe(0);
    // Pulinhos: a altura varia no ritmo.
    const alturas = new Set();
    for (let s = 0.4; s < DANCA_DA_AYA.cambalhota; s += 0.05)
      alturas.add(Math.round(em(s).y));
    expect(alturas.size).toBeGreaterThan(4);
    // A cambalhota: uma volta inteira (para trás), no alto.
    const { cambalhota, giro } = DANCA_DA_AYA;
    expect(em(cambalhota).rotacao).toBeCloseTo(0, 6);
    expect(em(cambalhota + giro / 2).rotacao).toBeCloseTo(-Math.PI, 6);
    expect(em(cambalhota + giro).rotacao).toBeCloseTo(-2 * Math.PI, 6);
    expect(em(cambalhota + giro / 2).y).toBeLessThan(
      danca.y - danca.tamanho * 0.5,
    );
    // Sai descendo, apagando.
    const fim = danca.duracao;
    expect(em(fim).opacidade).toBe(0);
    expect(em(fim).y).toBeGreaterThan(danca.y + danca.tamanho * 0.5);
  });
});

describe("o som de cada evento", () => {
  it("assobio no lançamento (com a subida), pop na rajada e no confete, grave no letreiro", () => {
    const assobio = somDoEstouro({
      tipo: "lancamento",
      papel: "comum",
      subida: 0.9,
    });
    expect(assobio).toEqual({ tipo: "assobio", volume: 0.35, duracao: 0.9 });
    // Subida absurda é limitada.
    expect(somDoEstouro({ tipo: "lancamento", subida: 9 }).duracao).toBe(1.6);
    expect(somDoEstouro({ tipo: "confete", papel: "aya" }).tipo).toBe("pop");
    expect(somDoEstouro({ tipo: "estouro", papel: "rajada" }).tipo).toBe("pop");
    expect(somDoEstouro({ tipo: "estouro", papel: "letreiro" }).tipo).toBe(
      "grave",
    );
    expect(
      somDoEstouro({ tipo: "estouro", papel: "comum", formato: "crepitante" })
        .tipo,
    ).toBe("crepitar");
    // A apoteose, muitos juntos: mais baixo que o grande final.
    const apoteose = somDoEstouro({ papel: "apoteose", formato: "peonia" });
    const final = somDoEstouro({ papel: "final", formato: "peonia" });
    expect(apoteose.tipo).toBe("estalo");
    expect(apoteose.volume).toBeLessThan(final.volume);
  });
});

describe("o letreiro (texto do marco no céu)", () => {
  /* O "canvas": o texto vira um retângulo cheio de pixels. */
  const amostrarTexto = () => {
    const width = 320;
    const height = 80;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 20; y < 60; y += 1)
      for (let x = 10; x < 310; x += 1) data[(y * width + x) * 4 + 3] = 255;
    return { data, width, height };
  };

  it("texto limpo e curto; vazio vira null", () => {
    expect(normalizarLetreiro("  Fila   zerada!  ")).toBe("Fila zerada!");
    expect(normalizarLetreiro("x".repeat(40))).toHaveLength(
      TAMANHO_DO_LETREIRO,
    );
    expect(normalizarLetreiro("   ")).toBeNull();
    expect(normalizarLetreiro(null)).toBeNull();
  });

  it("os pontos cabem na faixa do letreiro, abaixo da forma, até a quantidade", () => {
    const pontos = pontosDoLetreiro("Parabéns!", {
      ...tela,
      quantidade: 300,
      amostrarTexto,
    });
    expect(pontos.length).toBeGreaterThan(100);
    expect(pontos.length).toBeLessThanOrEqual(300);
    const caixa = caixaDoLetreiro(tela);
    const forma = caixaDaForma(tela);
    for (const p of pontos) {
      expect(Math.abs(p.x - caixa.cx)).toBeLessThanOrEqual(
        caixa.larguraMax / 2 + 1e-6,
      );
      expect(Math.abs(p.y - caixa.cy)).toBeLessThanOrEqual(
        caixa.alturaMax / 2 + 1e-6,
      );
    }
    // A faixa do letreiro começa abaixo da caixa da forma.
    expect(caixa.cy - caixa.alturaMax / 2).toBeGreaterThan(
      forma.cy + forma.alturaMax / 2,
    );
    // Canvas que falha: a fonte de pontos (algarismos), sem erro.
    const quebrado = () => {
      throw new Error("sem canvas");
    };
    expect(
      pontosDoLetreiro("1.000", { ...tela, amostrarTexto: quebrado }).length,
    ).toBeGreaterThan(30);
    expect(pontosDoLetreiro("", { ...tela, amostrarTexto })).toEqual([]);
  });
});

describe("o confete da Aya (motor)", () => {
  it("a cena dos fogos com a Aya dançando usa o motor e o confete sai dela", () => {
    const cena = criarCena({
      ...tela,
      efeito: "fogos",
      intensidade: "festa",
      aleatorio: criarAleatorio(4),
    });
    expect(cena.lotes).toHaveLength(0);
    expect(cena.usaMotor).toBe(true);
    const { danca } = cena.show;
    let primeiroConfete = null;
    while (!cenaAcabou(cena)) {
      avancarCena(cena, 1 / 60);
      if (!primeiroConfete && cena.particulas.length)
        primeiroConfete = {
          t: cena.t,
          // Cópias: as partículas continuam andando depois.
          particulas: cena.particulas.map((p) => ({ ...p })),
        };
    }
    expect(primeiroConfete.t).toBeGreaterThanOrEqual(danca.confete);
    expect(primeiroConfete.t).toBeLessThan(danca.confete + 0.05);
    expect(primeiroConfete.particulas.every((p) => p.tipo === "confete")).toBe(
      true,
    );
    expect(primeiroConfete.particulas.length).toBeGreaterThan(
      CONFETE_DA_AYA * 0.8,
    );
    // Saem perto dela e para cima.
    for (const p of primeiroConfete.particulas) {
      expect(Math.abs(p.x - danca.x)).toBeLessThan(40);
      expect(p.vy).toBeLessThan(0);
    }
    // Sem a Aya (o "combinado" chama a mascote) e no Suave: sem dança.
    expect(
      criarCena({ ...tela, efeito: "fogos", intensidade: "suave" }).usaMotor,
    ).toBe(false);
    expect(
      criarCena({ ...tela, efeito: "fogos", comAya: false }).usaMotor,
    ).toBe(false);
    // O confete respeita o teto do motor.
    const apertada = criarCena({
      ...tela,
      efeito: "fogos",
      intensidade: "festa",
      limite: 10,
      aleatorio: criarAleatorio(4),
    });
    let maximo = 0;
    while (!cenaAcabou(apertada)) {
      avancarCena(apertada, 1 / 60);
      maximo = Math.max(maximo, apertada.particulas.length);
    }
    expect(maximo).toBe(10);
  });
});

describe("desempenho: a qualidade cai sozinha", () => {
  it("a 60 fps fica tudo; abaixo de ~45 fps por um tempo, cai um nível de cada vez e não volta", () => {
    const rapido = criarMedidor();
    for (let i = 0; i < 300; i += 1) registrarQuadro(rapido, 16.7);
    expect(rapido.qualidade).toBe(2);

    const lento = criarMedidor();
    const quedas = [];
    for (let i = 0; i < 200; i += 1)
      if (registrarQuadro(lento, 40)) quedas.push(i);
    expect(quedas).toHaveLength(2);
    expect(quedas[0]).toBeGreaterThanOrEqual(QUADROS_PARA_DECIDIR - 1);
    expect(lento.qualidade).toBe(0);
    // Fica no nível mais baixo, mesmo se melhorar.
    for (let i = 0; i < 300; i += 1) registrarQuadro(lento, 10);
    expect(lento.qualidade).toBe(0);
    expect(AJUSTE_DA_QUALIDADE[0].particulas).toBeLessThan(
      AJUSTE_DA_QUALIDADE[1].particulas,
    );
  });

  it("pausa (aba voltando, depurador) e quadro zerado não contam como lentidão", () => {
    const medidor = criarMedidor();
    for (let i = 0; i < 100; i += 1) {
      registrarQuadro(medidor, QUADRO_IGNORADO_MS + 1);
      registrarQuadro(medidor, 0);
    }
    expect(medidor.qualidade).toBe(2);
    expect(medidor.quadros).toBe(0);
  });
});

describe("o som sintetizado", () => {
  /* Áudio falso: registra cada nó criado e o relógio anda à mão. */
  function audioFalso() {
    const nos = [];
    const parametro = () => ({
      value: 0,
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
    });
    const no = (tipo) => {
      const n = {
        tipo,
        gain: parametro(),
        frequency: parametro(),
        Q: parametro(),
        delayTime: parametro(),
        playbackRate: parametro(),
        connect() {},
        start() {},
        stop() {},
      };
      nos.push(n);
      return n;
    };
    class Audio {
      constructor() {
        this.sampleRate = 8000;
        this.currentTime = 0;
        this.destination = no("destino");
      }
      createGain = () => no("ganho");
      createOscillator = () => no("oscilador");
      createBufferSource = () => no("fonte");
      createBiquadFilter = () => no("filtro");
      createDelay = () => no("atraso");
      createBuffer = (_, tamanho) => {
        const dados = new Float32Array(tamanho);
        return { getChannelData: () => dados };
      };
      resume() {}
      close() {}
    }
    let audio = null;
    const janela = {
      AudioContext: class extends Audio {
        constructor() {
          super();
          audio = this;
        }
      },
      localStorage: { getItem: () => "1", setItem() {}, removeItem() {} },
      navigator: { userActivation: { hasBeenActive: true } },
    };
    return { janela, nos, audio: () => audio };
  }

  it("estouro, assobio, crepitar e pop com ruído filtrado e envelopes; o eco nasce uma vez", () => {
    const { janela, nos } = audioFalso();
    const som = criarSom(janela);
    for (const tipo of ["estalo", "grave", "assobio", "crepitar", "pop"])
      expect(som.tocar({ tipo, volume: 0.5, duracao: 0.8 })).toBe(true);
    const contar = (tipo) => nos.filter((n) => n.tipo === tipo).length;
    expect(contar("filtro")).toBeGreaterThan(8);
    expect(contar("oscilador")).toBeGreaterThan(5);
    expect(contar("fonte")).toBeGreaterThan(5);
    // O eco (atraso com realimentação): um só para o áudio inteiro.
    expect(contar("atraso")).toBe(1);
  });

  it("muitos estouros juntos não empilham vozes (o grave passa)", () => {
    const { janela, audio } = audioFalso();
    const som = criarSom(janela);
    const tocados = Array.from({ length: 20 }, () =>
      som.tocar({ tipo: "estalo", volume: 0.5 }),
    );
    expect(tocados.filter(Boolean)).toHaveLength(VOZES_SIMULTANEAS);
    expect(som.tocar({ tipo: "grave", volume: 0.9 })).toBe(true);
    // Passada a janela, volta a tocar.
    audio().currentTime = JANELA_DAS_VOZES + 0.01;
    expect(som.tocar({ tipo: "estalo", volume: 0.5 })).toBe(true);
  });
});
