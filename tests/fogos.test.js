import { describe, expect, it } from "vitest";
import { DURACAO_DOS_FOGOS_MS } from "../src/lib/comemoracao.js";
import { trajetoDaAya, pontoDaSoltura } from "../src/lib/fogos-cena.js";
import {
  alfaDoRastro,
  avancarShow,
  brasa,
  brilhoDaParticula,
  centelhas,
  corDaParticula,
  criarAleatorio,
  criarShow,
  duracaoDoFormato,
  estourar,
  fatorDeSaida,
  FORMATOS,
  FORMATOS_DO_FINAL,
  fumacaDoEstouro,
  INTENSIDADES,
  intensidadeDoShow,
  lancarFoguete,
  LIMITE_DE_PARTICULAS,
  MARCO,
  moverFoguete,
  moverParticula,
  NOMES_DOS_FORMATOS,
  paletaDosFogos,
  planejarShow,
  showAcabou,
} from "../src/lib/fogos.js";

/*
  Tudo com sorteio fixo (criarAleatorio): nada aqui depende de Math.random.
*/
const tela = { largura: 1280, altura: 720 };
const pontosDeTeste = Array.from({ length: 40 }, (_, i) => ({
  x: 500 + i * 7,
  y: 280 + (i % 5) * 6,
}));

/* Roda o show até acabar; devolve o máximo de partículas e os quadros. */
function rodar(show, limiteDeQuadros = 1000) {
  let maximo = 0;
  let quadros = 0;
  while (!showAcabou(show) && quadros < limiteDeQuadros) {
    avancarShow(show, 1 / 60);
    maximo = Math.max(maximo, show.particulas.length);
    quadros += 1;
  }
  return { maximo, quadros };
}

describe("roteiro do show", () => {
  it("as durações ficam entre 5 e 6 s e o padrão é DURACAO_DOS_FOGOS_MS", () => {
    for (const { duracaoMs, final } of Object.values(INTENSIDADES)) {
      expect(duracaoMs).toBeGreaterThanOrEqual(5000);
      expect(duracaoMs).toBeLessThanOrEqual(6000);
      expect(final).toBeGreaterThanOrEqual(6);
      expect(final).toBeLessThanOrEqual(8);
    }
    expect(INTENSIDADES.cheio.duracaoMs).toBe(DURACAO_DOS_FOGOS_MS);
    expect(intensidadeDoShow("inexistente")).toBe(INTENSIDADES.cheio);
  });

  it("estouros comuns escalonados, espalhados, variados e ordenados pelo lançamento", () => {
    for (let semente = 1; semente <= 20; semente += 1) {
      const planos = planejarShow({
        ...tela,
        aleatorio: criarAleatorio(semente),
      });
      const duracao = DURACAO_DOS_FOGOS_MS / 1000;
      const lancamentos = planos.map((p) => p.lancamento);
      expect([...lancamentos].sort((a, b) => a - b)).toEqual(lancamentos);
      const comuns = planos.filter((p) => p.papel === "comum");
      expect(comuns).toHaveLength(INTENSIDADES.cheio.explosoes);
      for (const p of planos) {
        expect(p.lancamento).toBeGreaterThanOrEqual(0);
        expect(p.lancamento).toBeLessThan(p.estouro);
        expect(p.yAlvo).toBeLessThan(tela.altura * 0.62);
        expect(p.yBase).toBeGreaterThan(tela.altura);
        // As faíscas apagam antes do fim (a vida encurta se preciso).
        expect(
          p.estouro + duracaoDoFormato(p.formato) * p.vidaFator,
        ).toBeLessThanOrEqual(duracao + 1e-9);
      }
      const xs = comuns.map((p) => p.xAlvo);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(
        tela.largura * 0.5,
      );
      expect(new Set(comuns.map((p) => p.formato)).size).toBeGreaterThanOrEqual(
        5,
      );
    }
  });

  it("grande final: 6–8 estouros quase juntos nos últimos ~1,5 s, depois do marco", () => {
    for (const intensidade of Object.keys(INTENSIDADES)) {
      const planos = planejarShow({
        ...tela,
        intensidade,
        aleatorio: criarAleatorio(4),
      });
      const duracao = INTENSIDADES[intensidade].duracaoMs / 1000;
      const finais = planos.filter((p) => p.papel === "final");
      expect(finais).toHaveLength(INTENSIDADES[intensidade].final);
      const instantes = finais.map((p) => p.estouro);
      expect(Math.min(...instantes)).toBeGreaterThanOrEqual(duracao - 1.65);
      expect(Math.max(...instantes)).toBeLessThanOrEqual(duracao - 1.15);
      // Quase juntos: a salva inteira em menos de meio segundo.
      expect(Math.max(...instantes) - Math.min(...instantes)).toBeLessThan(0.5);
      expect(finais.every((p) => FORMATOS_DO_FINAL.includes(p.formato))).toBe(
        true,
      );
      const [marco] = planos.filter((p) => p.papel === "marco");
      expect(marco.estouro).toBeLessThan(Math.min(...instantes));
      const comuns = planos.filter((p) => p.papel === "comum");
      expect(Math.max(...comuns.map((p) => p.estouro))).toBeLessThan(
        marco.estouro,
      );
    }
  });

  it("com forma, o marco estoura no centro dela e o final fica dos lados", () => {
    const planos = planejarShow({
      ...tela,
      pontos: pontosDeTeste,
      aleatorio: criarAleatorio(2),
    });
    const [marco] = planos.filter((p) => p.papel === "marco");
    expect(marco.formato).toBe("marco");
    expect(marco.pontos).toBe(pontosDeTeste);
    const cx = pontosDeTeste.reduce((s, p) => s + p.x, 0) / 40;
    expect(marco.xAlvo).toBeCloseTo(cx, 6);
    expect(marco.xBase).toBeCloseTo(cx, 6);
    expect(marco.fimDaForma).toBeCloseTo(
      DURACAO_DOS_FOGOS_MS / 1000 - MARCO.desfazAntes,
    );
    for (const p of planos.filter((q) => q.papel === "final"))
      expect(Math.abs(p.xAlvo / tela.largura - 0.5)).toBeGreaterThan(0.15);
    // Sem forma: um crisântemo grande no centro.
    const [semForma] = planejarShow({
      ...tela,
      aleatorio: criarAleatorio(2),
    }).filter((p) => p.papel === "marco");
    expect(semForma.formato).toBe("crisantemo");
    expect(semForma.xAlvo).toBe(tela.largura / 2);
  });

  it("com a Aya, o primeiro foguete nasce dela e é o primeiro a estourar", () => {
    const aya = trajetoDaAya(tela);
    const planos = planejarShow({
      ...tela,
      aya,
      aleatorio: criarAleatorio(5),
    });
    const daAya = planos.filter((p) => p.papel === "aya");
    expect(daAya).toHaveLength(1);
    const [plano] = daAya;
    const soltura = pontoDaSoltura(aya);
    expect(plano.lancamento).toBeCloseTo(aya.soltura, 9);
    expect(plano.xBase).toBeCloseTo(soltura.x, 9);
    expect(plano.yBase).toBeCloseTo(soltura.y, 9);
    expect(plano.yAlvo).toBeLessThan(plano.yBase);
    expect(Math.min(...planos.map((p) => p.estouro))).toBe(plano.estouro);
    // Sem a Aya, todo foguete sai do chão.
    expect(
      planejarShow({ ...tela, aleatorio: criarAleatorio(5) }).some(
        (p) => p.papel === "aya",
      ),
    ).toBe(false);
  });

  it("o foguete chega ao alvo no instante do estouro, desacelerando", () => {
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
  const faiscas = (lista) => lista.filter((p) => p.tipo === "faisca");

  it("centenas de faíscas por estouro, com clarão, respeitando o teto", () => {
    const lista = estourar(plano, {
      x: 100,
      y: 100,
      aleatorio: criarAleatorio(1),
    });
    expect(faiscas(lista)).toHaveLength(FORMATOS.peonia.faiscas);
    expect(lista.filter((p) => p.tipo === "clarao")).toHaveLength(1);
    expect(new Set(faiscas(lista).map((p) => p.cor))).toEqual(
      new Set(["#f00", "#0f0"]),
    );
    const sorteio = criarAleatorio(2);
    expect(
      estourar(plano, { x: 0, y: 0, cabem: 30, aleatorio: sorteio }),
    ).toHaveLength(30);
    expect(
      estourar(plano, { x: 0, y: 0, cabem: 0, aleatorio: sorteio }),
    ).toHaveLength(0);
    expect(
      estourar(plano, { x: 0, y: 0, fator: 0.5, aleatorio: sorteio }).length,
    ).toBeLessThan(FORMATOS.peonia.faiscas);
  });

  it("todos os formatos estouram; o anel nunca passa do raio", () => {
    const sorteio = criarAleatorio(3);
    for (const formato of NOMES_DOS_FORMATOS) {
      const lista = estourar(
        { formato, cor: "#fff" },
        { x: 0, y: 0, aleatorio: sorteio },
      );
      expect(faiscas(lista).length).toBe(FORMATOS[formato].faiscas);
    }
    const anel = faiscas(
      estourar(
        { formato: "anel", cor: "#fff" },
        { x: 0, y: 0, aleatorio: () => 0.5 },
      ),
    );
    const forcas = anel.map((p) => Math.hypot(p.vx, p.vy));
    expect(Math.max(...forcas)).toBeLessThanOrEqual(330 * 0.95 * 1.06 + 1e-6);
    expect(Math.min(...forcas)).toBeLessThan(Math.max(...forcas) * 0.8);
  });

  it("kamuro: chuva dourada lenta e longa, que termina âmbar", () => {
    const paleta = paletaDosFogos();
    const [kamuro] = planejarShow({
      ...tela,
      intensidade: "festa",
      aleatorio: criarAleatorio(11),
    }).filter((p) => p.formato === "kamuro");
    expect(kamuro.cor).toBe(paleta.dourado);
    expect(kamuro.corFinal).toBe(paleta.ambar);
    const lista = faiscas(
      estourar(
        { formato: "kamuro", cor: "#ffd23f", corFinal: "#ffb627" },
        { x: 0, y: 0, aleatorio: criarAleatorio(1) },
      ),
    );
    const peonia = faiscas(
      estourar(plano, { x: 0, y: 0, aleatorio: criarAleatorio(1) }),
    );
    const media = (l, f) => l.reduce((s, p) => s + f(p), 0) / l.length;
    expect(media(lista, (p) => p.vida)).toBeGreaterThan(
      media(peonia, (p) => p.vida) * 1.8,
    );
    expect(media(lista, (p) => p.gravidade)).toBeLessThan(
      media(peonia, (p) => p.gravidade) * 0.5,
    );
    expect(lista.every((p) => p.rastro >= 2.5)).toBe(true);
  });

  it("glitter: faíscas que piscam num ritmo próprio, sem sorteio", () => {
    const [faisca] = faiscas(
      estourar(
        { formato: "glitter", cor: "#fff" },
        { x: 0, y: 0, aleatorio: criarAleatorio(4) },
      ),
    );
    expect(faisca.pisca).toBeGreaterThanOrEqual(FORMATOS.glitter.pisca[0]);
    expect(faisca.pisca).toBeLessThanOrEqual(FORMATOS.glitter.pisca[1]);
    const brilhos = new Set();
    const p = { ...faisca, vida: faisca.vidaMax, vidaMax: faisca.vidaMax };
    for (let i = 0; i < 30; i += 1) {
      p.vida = faisca.vidaMax * (1 - i / 60);
      // O sorteio não muda nada: a piscada vem do tempo.
      const b = brilhoDaParticula(p, () => 0);
      expect(b).toBe(brilhoDaParticula(p, () => 0.99));
      brilhos.add(b > 0.5 ? "acesa" : "apagada");
    }
    expect(brilhos).toEqual(new Set(["acesa", "apagada"]));
  });

  it("palmeira: poucos braços grossos, igualmente espaçados, que soltam brasas", () => {
    const lista = faiscas(
      estourar(
        { formato: "palmeira", cor: "#ffd23f" },
        { x: 0, y: 0, fator: 0.5, aleatorio: criarAleatorio(6) },
      ),
    );
    // Não encolhe em tela pequena: são os braços.
    expect(lista).toHaveLength(FORMATOS.palmeira.faiscas);
    expect(lista.every((p) => p.tamanho >= 3 && p.emite > 0)).toBe(true);
    const angulos = lista
      .map((p) => Math.atan2(p.vy, p.vx))
      .sort((a, b) => a - b);
    const vaos = angulos.map(
      (a, i) =>
        (angulos[(i + 1) % angulos.length] - a + Math.PI * 2) % (Math.PI * 2),
    );
    const esperado = (Math.PI * 2) / lista.length;
    for (const vao of vaos) expect(Math.abs(vao - esperado)).toBeLessThan(0.2);

    // Num show, os braços deixam brasas pelo caminho.
    const show = criarShow({ ...tela, aleatorio: criarAleatorio(1) });
    show.planos = [];
    show.particulas = lista.map((p) => ({ ...p, x: 600, y: 200 }));
    for (let i = 0; i < 30; i += 1) avancarShow(show, 1 / 60);
    expect(show.particulas.length).toBeGreaterThan(lista.length);
  });

  it("bomba dupla: estoura em dois tempos", () => {
    const lista = estourar(
      { formato: "bombaDupla", cor: "#f00", cor2: "#0ff", estouro: 1 },
      { x: 300, y: 200, aleatorio: criarAleatorio(7) },
    );
    const [semente] = lista.filter((p) => p.tipo === "semente");
    expect(semente.vida).toBeCloseTo(FORMATOS.bombaDupla.segundo.atraso);
    expect(semente.plano.formato).toBe("peonia");
    expect(semente.plano.cor).toBe("#0ff");
    expect(brilhoDaParticula(semente)).toBe(0);
    const show = criarShow({ ...tela, aleatorio: criarAleatorio(1) });
    show.planos = [];
    show.particulas = lista;
    let segundo = null;
    for (let i = 0; i < 40 && !segundo; i += 1) {
      avancarShow(show, 1 / 60);
      segundo = show.eventos.find((e) => e.formato === "peonia");
    }
    expect(segundo).toMatchObject({ x: 300, y: 200 });
    expect(show.t).toBeGreaterThanOrEqual(FORMATOS.bombaDupla.segundo.atraso);
    expect(
      show.particulas.filter((p) => p.cor === "#0ff").length,
    ).toBeGreaterThan(100);
  });

  it("o marco: as faíscas convergem para os pontos, brilham ali e depois caem", () => {
    const lista = estourar(
      {
        formato: "marco",
        cor: "#ffd23f",
        cor2: "#fff6dc",
        estouro: 3,
        fimDaForma: 4.8,
        pontos: pontosDeTeste,
      },
      { x: 640, y: 300, aleatorio: criarAleatorio(8) },
    );
    const alvos = lista.filter((p) => p.tipo === "alvo");
    expect(alvos).toHaveLength(pontosDeTeste.length);
    expect(lista.some((p) => p.tipo === "faisca")).toBe(true);
    // Ainda no centro; depois da convergência, em cima de cada ponto.
    expect(alvos[0].x).toBe(640);
    for (let i = 0; i < 60; i += 1)
      alvos.forEach((p) => moverParticula(p, 1 / 60));
    alvos.forEach((p, i) => {
      expect(p.x).toBeCloseTo(pontosDeTeste[i].x, 6);
      expect(p.y).toBeCloseTo(pontosDeTeste[i].y, 6);
      expect(brilhoDaParticula(p)).toBeGreaterThan(0.6);
    });
    // Passa do fim da forma: cai.
    for (let i = 0; i < 50; i += 1)
      alvos.forEach((p) => moverParticula(p, 1 / 60));
    expect(alvos[0].y).toBeGreaterThan(pontosDeTeste[0].y);
    // Cabe no teto.
    expect(
      estourar(
        { formato: "marco", cor: "#fff", estouro: 0, pontos: pontosDeTeste },
        { x: 0, y: 0, cabem: 11, aleatorio: criarAleatorio(1) },
      ).length,
    ).toBeLessThanOrEqual(11);
  });

  it("fumaça: nuvens tênues que crescem e sobem", () => {
    const nuvens = fumacaDoEstouro(
      { x: 0, y: 0 },
      { cor: "#9aa6bd", aleatorio: criarAleatorio(9) },
    );
    expect(nuvens.length).toBeGreaterThanOrEqual(3);
    const [n] = nuvens;
    const tamanho = n.tamanho;
    const y = n.y;
    for (let i = 0; i < 60; i += 1) moverParticula(n, 1 / 60);
    expect(n.tamanho).toBeGreaterThan(tamanho);
    expect(n.y).toBeLessThan(y + 10);
    expect(brilhoDaParticula(n)).toBeLessThan(0.1);
    expect(fumacaDoEstouro({ x: 0, y: 0 }, { cabem: 0 })).toHaveLength(0);
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

  it("brilho: apaga no fim, cintila na segunda metade; crisântemo e kamuro mudam de cor", () => {
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

  it("estalinho solta centelhas curtas; brasas caem do foguete", () => {
    const c = centelhas(
      { x: 5, y: 5 },
      { cor: "#fff", aleatorio: criarAleatorio(2) },
    );
    expect(c.length).toBeGreaterThanOrEqual(2);
    expect(c.every((p) => p.vidaMax <= 0.22 && p.tipo === "centelha")).toBe(
      true,
    );
    expect(centelhas({ x: 0, y: 0 }, { cabem: 0 })).toHaveLength(0);
    const b = brasa(
      { x: 1, y: 2 },
      { cor: "#fd0", aleatorio: criarAleatorio(3) },
    );
    expect(b.vy).toBeGreaterThan(0);
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
  it("tokens da marca + dourado e branco; luz somada nos dois temas (o véu escurece)", () => {
    const tokens = { "--brand-primary": " #70cfff ", "--series-2": "#d95f2b" };
    const escuro = paletaDosFogos((n) => tokens[n], { escuro: true });
    expect(escuro.cores).toEqual(
      expect.arrayContaining(["#70cfff", "#d95f2b", "#ffd23f", "#fff6dc"]),
    );
    expect(escuro.composicao).toBe("lighter");
    const claro = paletaDosFogos((n) => tokens[n], { escuro: false });
    expect(claro.composicao).toBe("lighter");
    // No claro, os tokens são escuros: entram cores vivas.
    expect(claro.cores.length).toBeGreaterThan(escuro.cores.length);
    expect(claro.fumaca).not.toBe(escuro.fumaca);
  });

  it("sem tokens (ou leitura que falha), a paleta reserva", () => {
    const p = paletaDosFogos(() => {
      throw new Error("x");
    });
    expect(p.cores.length).toBeGreaterThan(3);
  });
});

describe("o show inteiro", () => {
  it("estoura tudo (com o marco), nunca passa do teto e acaba sozinho na duração", () => {
    const show = criarShow({
      ...tela,
      intensidade: "festa",
      comAya: true,
      forma: "coracao",
      aleatorio: criarAleatorio(7),
    });
    const { maximo } = rodar(show);
    const { explosoes, final, duracaoMs } = INTENSIDADES.festa;
    expect(show.estouros).toBe(explosoes + final + 1);
    expect(maximo).toBeGreaterThan(300);
    expect(maximo).toBeLessThanOrEqual(LIMITE_DE_PARTICULAS);
    expect(show.t).toBeLessThanOrEqual(duracaoMs / 1000 + 1e-9);
    expect(show.pontos.length).toBeGreaterThan(30);
    expect(show.aya).not.toBeNull();
  });

  it("os eventos de estouro saem um por estouro, com formato e papel", () => {
    const show = criarShow({ ...tela, aleatorio: criarAleatorio(12) });
    const eventos = [];
    while (!showAcabou(show)) {
      avancarShow(show, 1 / 60);
      eventos.push(...show.eventos.splice(0));
    }
    expect(eventos.filter((e) => e.papel === "marco")).toHaveLength(1);
    expect(eventos.filter((e) => e.papel === "final")).toHaveLength(
      INTENSIDADES.cheio.final,
    );
    expect(eventos.every((e) => typeof e.formato === "string")).toBe(true);
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
