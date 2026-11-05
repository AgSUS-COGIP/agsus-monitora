import { describe, expect, it } from "vitest";
import { DURACAO_DOS_FOGOS_MS } from "../src/lib/comemoracao.ts";
import { trajetoDaAya, pontoDaSoltura } from "../src/lib/fogos-cena.ts";
import {
  alfaDoRastro,
  APOTEOSE,
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
  FORMATOS_DA_APOTEOSE,
  FORMATOS_DA_RAJADA,
  FORMATOS_DO_FINAL,
  fumacaDoEstouro,
  INTENSIDADES,
  intensidadeDoShow,
  lancarFoguete,
  LETREIRO,
  LIMITE_DE_PARTICULAS,
  MARCO,
  moverFoguete,
  moverParticula,
  NOMES_DOS_FORMATOS,
  paletaDosFogos,
  planejarShow,
  RAJADA,
  showAcabou,
  TOKENS_DAS_AREAS,
} from "../src/lib/fogos.ts";

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
    const { explosoes, final, duracaoMs, rajadas, tiros, apoteose } =
      INTENSIDADES.festa;
    // Comuns, rajadas, o marco, o grande final e a apoteose: todos estouram.
    expect(show.estouros).toBe(
      explosoes + rajadas * tiros + 1 + final + apoteose,
    );
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
    const estouros = eventos.filter((e) => e.tipo === "estouro");
    expect(estouros.filter((e) => e.papel === "marco")).toHaveLength(1);
    expect(estouros.filter((e) => e.papel === "final")).toHaveLength(
      INTENSIDADES.cheio.final,
    );
    expect(estouros.filter((e) => e.papel === "apoteose")).toHaveLength(
      INTENSIDADES.cheio.apoteose,
    );
    // Um por foguete, mais o segundo tempo de cada bomba dupla.
    expect(estouros).toHaveLength(
      show.estouros +
        show.planos.filter((p) => p.formato === "bombaDupla").length,
    );
    expect(eventos.every((e) => typeof e.formato === "string")).toBe(true);
    // Os foguetes que assobiam avisam o lançamento (o som), com a subida;
    // o marco sempre assobia.
    const lancamentos = eventos.filter((e) => e.tipo === "lancamento");
    expect(lancamentos.length).toBeGreaterThan(1);
    expect(lancamentos.filter((e) => e.papel === "marco")).toHaveLength(1);
    expect(lancamentos.every((e) => e.subida > 0)).toBe(true);
    expect(lancamentos.length).toBeLessThan(estouros.length / 2);
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

describe("formatos novos: coração, estrela, cometa e crepitante", () => {
  const faiscas = (lista) => lista.filter((p) => p.tipo === "faisca");
  const forcas = (lista) => lista.map((p) => Math.hypot(p.vx, p.vy));

  it("coração: as faíscas desenham o coração em pé (a ponta para baixo)", () => {
    const lista = faiscas(
      estourar(
        { formato: "coracao", cor: "#f0a" },
        { x: 0, y: 0, aleatorio: () => 0.5 },
      ),
    );
    expect(lista).toHaveLength(FORMATOS.coracao.faiscas);
    // Não é uma esfera: a força varia com o contorno.
    expect(Math.min(...forcas(lista))).toBeLessThan(
      Math.max(...forcas(lista)) * 0.5,
    );
    // A ponta (a faísca mais para baixo) fica no meio; os lóbulos, dos lados.
    const ponta = lista.reduce((a, b) => (b.vy > a.vy ? b : a));
    expect(Math.abs(ponta.vx)).toBeLessThan(ponta.vy * 0.25);
    const esquerda = lista.filter((p) => p.vx < -1).length;
    const direita = lista.filter((p) => p.vx > 1).length;
    expect(Math.abs(esquerda - direita)).toBeLessThan(lista.length * 0.1);
    // Pouco peso: a forma não desaba antes de apagar.
    expect(FORMATOS.coracao.peso).toBeLessThan(0.5);
  });

  it("estrela: cinco pontas (a força alterna entre ponta e vale)", () => {
    const lista = faiscas(
      estourar(
        { formato: "estrela", cor: "#fd0" },
        { x: 0, y: 0, aleatorio: () => 0.5 },
      ),
    );
    expect(lista).toHaveLength(FORMATOS.estrela.faiscas);
    const f = forcas(lista);
    const maior = Math.max(...f);
    expect(Math.min(...f)).toBeLessThan(maior * 0.6);
    // Picos de força no contorno: as cinco pontas.
    const picos = f.filter(
      (v, i) =>
        v > f[(i - 1 + f.length) % f.length] &&
        v >= f[(i + 1) % f.length] &&
        v > maior * 0.9,
    );
    expect(picos).toHaveLength(5);
  });

  it("cometa: poucos riscos grossos que soltam brasas da própria cor", () => {
    const lista = faiscas(
      estourar(
        { formato: "cometa", cor: "#4fdcff" },
        { x: 0, y: 0, fator: 0.5, aleatorio: criarAleatorio(2) },
      ),
    );
    // Como a palmeira, não encolhe em tela pequena.
    expect(lista).toHaveLength(FORMATOS.cometa.faiscas);
    expect(lista.every((p) => p.tamanho >= 3 && p.emite > 0)).toBe(true);
    expect(lista.every((p) => p.brasa === "#4fdcff")).toBe(true);
    const show = criarShow({ ...tela, aleatorio: criarAleatorio(1) });
    show.planos = [];
    show.particulas = lista.map((p) => ({ ...p, x: 600, y: 200 }));
    for (let i = 0; i < 30; i += 1) avancarShow(show, 1 / 60);
    const brasas = show.particulas.slice(lista.length);
    expect(brasas.length).toBeGreaterThan(5);
    expect(brasas.every((p) => p.cor === "#4fdcff")).toBe(true);
  });

  it("crepitante: o crisântemo cujas pontas cintilam e estalam", () => {
    const lista = faiscas(
      estourar(
        { formato: "crepitante", cor: "#fff" },
        { x: 0, y: 0, aleatorio: criarAleatorio(3) },
      ),
    );
    expect(lista).toHaveLength(FORMATOS.crepitante.faiscas);
    expect(lista.every((p) => p.estala && p.cintila)).toBe(true);
  });

  it("brilho: no fim da vida a faísca pisca como brasa; cheia de vida, não", () => {
    const fim = { tipo: "faisca", vida: 0.1, vidaMax: 1 };
    expect(brilhoDaParticula(fim, () => 0.1)).toBeLessThan(
      brilhoDaParticula(fim, () => 0.9),
    );
    const nova = { tipo: "faisca", vida: 0.9, vidaMax: 1 };
    expect(brilhoDaParticula(nova, () => 0.1)).toBe(
      brilhoDaParticula(nova, () => 0.9),
    );
  });
});

describe("rajadas, letreiro e apoteose", () => {
  const letreiroDeTeste = Array.from({ length: 60 }, (_, i) => ({
    x: 300 + i * 11,
    y: 470 + (i % 6) * 5,
  }));

  it("rajadas: tiros pequenos em leque, do mesmo ponto, um atrás do outro, antes do marco", () => {
    for (const intensidade of Object.keys(INTENSIDADES)) {
      const { rajadas, tiros } = INTENSIDADES[intensidade];
      const planos = planejarShow({
        ...tela,
        intensidade,
        aleatorio: criarAleatorio(3),
      });
      const daRajada = planos.filter((p) => p.papel === "rajada");
      expect(daRajada).toHaveLength(rajadas * tiros);
      const [marco] = planos.filter((p) => p.papel === "marco");
      const porBase = new Map();
      for (const p of daRajada)
        porBase.set(p.xBase, [...(porBase.get(p.xBase) || []), p]);
      expect(porBase.size).toBe(rajadas);
      for (const grupo of porBase.values()) {
        expect(grupo).toHaveLength(tiros);
        const instantes = grupo.map((p) => p.estouro).sort((a, b) => a - b);
        for (let k = 1; k < instantes.length; k += 1)
          expect(instantes[k] - instantes[k - 1]).toBeCloseTo(
            RAJADA.intervalo,
            9,
          );
        // Em leque: cada tiro num lugar; o mesmo formato na rajada inteira.
        expect(new Set(grupo.map((p) => p.xAlvo)).size).toBe(tiros);
        expect(new Set(grupo.map((p) => p.formato)).size).toBe(1);
        expect(FORMATOS_DA_RAJADA).toContain(grupo[0].formato);
        expect(grupo.every((p) => p.porte === RAJADA.porte)).toBe(true);
        expect(Math.max(...instantes)).toBeLessThan(marco.estouro);
      }
    }
    // A rajada estoura menor.
    const cheio = estourar(
      { formato: "peonia", cor: "#fff" },
      { x: 0, y: 0, aleatorio: criarAleatorio(1) },
    );
    const pequeno = estourar(
      { formato: "peonia", cor: "#fff", porte: RAJADA.porte },
      { x: 0, y: 0, aleatorio: criarAleatorio(1) },
    );
    expect(pequeno.length).toBeLessThan(cheio.length * 0.6);
  });

  it("apoteose: depois do grande final, estouros quase juntos no alto, de ponta a ponta", () => {
    for (const intensidade of Object.keys(INTENSIDADES)) {
      const duracao = INTENSIDADES[intensidade].duracaoMs / 1000;
      const planos = planejarShow({
        ...tela,
        intensidade,
        aleatorio: criarAleatorio(8),
      });
      const apoteose = planos.filter((p) => p.papel === "apoteose");
      expect(apoteose).toHaveLength(INTENSIDADES[intensidade].apoteose);
      if (!apoteose.length) continue;
      const finais = planos.filter((p) => p.papel === "final");
      const instantes = apoteose.map((p) => p.estouro);
      expect(Math.min(...instantes)).toBeGreaterThan(
        Math.max(...finais.map((p) => p.estouro)),
      );
      expect(Math.max(...instantes)).toBeLessThanOrEqual(
        duracao - APOTEOSE.estouraAntes + APOTEOSE.janela,
      );
      expect(apoteose.every((p) => p.yAlvo <= tela.altura * 0.3)).toBe(true);
      expect(
        apoteose.every((p) => FORMATOS_DA_APOTEOSE.includes(p.formato)),
      ).toBe(true);
      const xs = apoteose.map((p) => p.xAlvo);
      // De ponta a ponta: com três, ao menos 0,84 × 1,6 / 3 da largura.
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(
        tela.largura * 0.44,
      );
    }
  });

  it("letreiro: estoura pouco antes do marco, escreve o texto e fica legível até perto do fim", () => {
    const duracao = INTENSIDADES.festa.duracaoMs / 1000;
    const planos = planejarShow({
      ...tela,
      intensidade: "festa",
      pontos: pontosDeTeste,
      letreiro: letreiroDeTeste,
      aleatorio: criarAleatorio(2),
    });
    const [marco] = planos.filter((p) => p.papel === "marco");
    const letreiros = planos.filter((p) => p.papel === "letreiro");
    expect(letreiros).toHaveLength(1);
    const [letreiro] = letreiros;
    expect(letreiro.formato).toBe("marco");
    expect(letreiro.pontos).toBe(letreiroDeTeste);
    expect(letreiro.assobia).toBe(true);
    expect(letreiro.estouro).toBeCloseTo(duracao - LETREIRO.estouraAntes, 9);
    // Chega antes da forma e fica junto com ela até o fim: mais de 1 s legível.
    expect(letreiro.estouro).toBeLessThan(marco.estouro);
    expect(letreiro.fimDaForma).toBeGreaterThan(marco.fimDaForma);
    expect(
      letreiro.fimDaForma - (letreiro.estouro + MARCO.convergencia),
    ).toBeGreaterThan(1);
    expect(letreiro.fimDaForma).toBeCloseTo(duracao - LETREIRO.desfazAntes, 9);
    // O grande final estoura acima do texto.
    for (const p of planos.filter((q) => q.papel === "final"))
      expect(p.yAlvo).toBeLessThanOrEqual(tela.altura * 0.5);
    // As faíscas do letreiro vão, cada uma, para um ponto do texto.
    const alvos = estourar(letreiro, {
      x: letreiro.xAlvo,
      y: letreiro.yAlvo,
      aleatorio: criarAleatorio(1),
    }).filter((p) => p.tipo === "alvo");
    expect(alvos.map((p) => [p.xa, p.ya])).toEqual(
      letreiroDeTeste.map((p) => [p.x, p.y]),
    );
  });

  it("o show escreve o letreiro (do canvas) no Normal e no Festa; no Suave, não", () => {
    // Um "canvas" que devolve o texto como um bloco cheio de pixels.
    const amostrarTexto = () => {
      const width = 200;
      const height = 60;
      const data = new Uint8ClampedArray(width * height * 4);
      for (let y = 10; y < 50; y += 1)
        for (let x = 10; x < 190; x += 1) data[(y * width + x) * 4 + 3] = 255;
      return { data, width, height };
    };
    for (const [intensidade, escreve] of [
      ["pequeno", false],
      ["cheio", true],
      ["festa", true],
    ]) {
      const show = criarShow({
        ...tela,
        intensidade,
        letreiro: "Parabéns!",
        amostrarTexto,
        aleatorio: criarAleatorio(4),
      });
      expect(show.letreiro.length > 30).toBe(escreve);
      expect(show.planos.some((p) => p.papel === "letreiro")).toBe(escreve);
      // O texto fica abaixo da forma do marco.
      if (escreve)
        expect(Math.min(...show.letreiro.map((p) => p.y))).toBeGreaterThan(
          tela.altura * 0.55,
        );
    }
    // Sem texto, ou sem canvas e com letras (a fonte de pontos só tem
    // algarismos e sinais), nada no céu: o show segue sem letreiro.
    expect(
      criarShow({ ...tela, letreiro: "", amostrarTexto }).letreiro,
    ).toHaveLength(0);
    expect(criarShow({ ...tela, letreiro: "Oba" }).letreiro).toHaveLength(0);
    expect(
      criarShow({ ...tela, letreiro: "100%" }).letreiro.length,
    ).toBeGreaterThan(30);
  });
});

describe("a Aya dança no fim e solta confete", () => {
  it("no Normal e no Festa (com a Aya), um evento de confete, uma vez, de onde ela dança", () => {
    for (const intensidade of ["cheio", "festa"]) {
      const show = criarShow({
        ...tela,
        intensidade,
        comAya: true,
        aleatorio: criarAleatorio(3),
      });
      expect(show.danca).not.toBeNull();
      const confetes = [];
      while (!showAcabou(show)) {
        avancarShow(show, 1 / 60);
        for (const e of show.eventos.splice(0))
          if (e.tipo === "confete") confetes.push(e);
      }
      expect(confetes).toHaveLength(1);
      expect(confetes[0].x).toBe(show.danca.x);
      expect(confetes[0].y).toBeLessThan(show.danca.y);
    }
    // No Suave, e sem a Aya, sem dança.
    expect(
      criarShow({ ...tela, intensidade: "pequeno", comAya: true }).danca,
    ).toBeNull();
    expect(criarShow({ ...tela, intensidade: "festa" }).danca).toBeNull();
  });
});

describe("paleta da área", () => {
  it("a cor da área (token do tema) entra primeiro na paleta e fica à mão", () => {
    const tokens = {
      "--brand-primary": "#0f5db7",
      "--state-info": "#2b7de9",
      "--state-success": "#1f9d55",
    };
    const ler = (nome) => tokens[nome] || "";
    const sede = paletaDosFogos(ler, { area: "sede" });
    expect(TOKENS_DAS_AREAS.sede).toBe("--state-info");
    expect(sede.area).toBe("#2b7de9");
    expect(sede.cores[0]).toBe("#2b7de9");
    expect(paletaDosFogos(ler, { area: "saude-indigena" }).area).toBe(
      "#1f9d55",
    );
    // Área sem token ou desconhecida: a paleta de sempre.
    expect(paletaDosFogos(ler, { area: "projetos" }).area).toBeNull();
    expect(paletaDosFogos(ler, { area: "outra" }).area).toBeNull();
    expect(paletaDosFogos(ler).cores).toEqual(
      paletaDosFogos(ler, { area: "outra" }).cores,
    );
    // Coração e estrela saem na cor da área.
    const planos = planejarShow({
      ...tela,
      intensidade: "festa",
      paleta: sede,
      aleatorio: criarAleatorio(9),
    }).filter((p) => p.formato === "coracao" || p.formato === "estrela");
    expect(planos.length).toBeGreaterThan(0);
    expect(planos.every((p) => p.cor === "#2b7de9")).toBe(true);
  });
});
