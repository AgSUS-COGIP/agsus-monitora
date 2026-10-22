import { describe, expect, it } from "vitest";
import {
  ajustarPontos,
  caixaDaForma,
  contornoDaEstrela,
  contornoDoCoracao,
  FONTE_DE_PONTOS,
  normalizarForma,
  passoParaCaber,
  pontosDaForma,
  pontosDaImagem,
  pontosDoTextoNaFonte,
  reduzirPontos,
  tracoDoCheck,
} from "../src/lib/fogos-formas.js";

/*
  O marco desenhado no céu: forma → pontos-alvo. Sem sorteio (as formas são
  determinísticas) e sem canvas (a imagem do texto é montada à mão).
*/
const tela = { largura: 1280, altura: 720 };
const dentro = (pontos, { cx, cy, larguraMax, alturaMax }) =>
  pontos.every(
    (p) =>
      Math.abs(p.x - cx) <= larguraMax / 2 + 1e-6 &&
      Math.abs(p.y - cy) <= alturaMax / 2 + 1e-6,
  );

/* Uma imagem RGBA com um retângulo opaco em [x0, x1) × [y0, y1). */
function imagemComRetangulo(largura, altura, [x0, y0, x1, y1]) {
  const data = new Uint8ClampedArray(largura * altura * 4);
  for (let y = y0; y < y1; y += 1)
    for (let x = x0; x < x1; x += 1) data[(y * largura + x) * 4 + 3] = 255;
  return { data, width: largura, height: altura };
}

describe("formas pedidas", () => {
  it("normaliza: coração, estrela, visto e texto curto; o resto, sem forma", () => {
    expect(normalizarForma("coracao")).toEqual({ tipo: "coracao" });
    expect(normalizarForma({ tipo: "estrela" })).toEqual({ tipo: "estrela" });
    expect(normalizarForma({ tipo: "numero", texto: " 2.500 " })).toEqual({
      tipo: "texto",
      texto: "2.500",
    });
    expect(normalizarForma({ tipo: "texto", texto: "123456789" }).texto).toBe(
      "12345678",
    );
    expect(normalizarForma("foguete")).toBeNull();
    expect(normalizarForma({ tipo: "numero", texto: "" })).toBeNull();
    expect(normalizarForma(null)).toBeNull();
    expect(pontosDaForma("foguete", tela)).toEqual([]);
  });
});

describe("contornos", () => {
  it("coração: simétrico, mais largo em cima, com a ponta embaixo", () => {
    const pontos = contornoDoCoracao(200);
    expect(pontos).toHaveLength(200);
    const xs = pontos.map((p) => p.x);
    const ys = pontos.map((p) => p.y);
    expect(Math.max(...xs)).toBeCloseTo(-Math.min(...xs), 2);
    // A ponta (y máximo, para baixo) fica no meio.
    const ponta = pontos.reduce((a, b) => (b.y > a.y ? b : a));
    expect(Math.abs(ponta.x)).toBeLessThan(0.05);
    // O "vão" entre os dois lóbulos: no meio, o ponto mais alto fica abaixo dos lóbulos.
    const noMeio = pontos.filter((p) => Math.abs(p.x) < 0.05);
    expect(Math.min(...noMeio.map((p) => p.y))).toBeGreaterThan(
      Math.min(...ys),
    );
  });

  it("estrela: cinco pontas, uma para cima, pontos igualmente espaçados", () => {
    const pontos = contornoDaEstrela(100);
    expect(pontos).toHaveLength(100);
    const topo = pontos.reduce((a, b) => (b.y < a.y ? b : a));
    expect(topo.x).toBeCloseTo(0, 6);
    expect(topo.y).toBeCloseTo(-1, 6);
    const raios = pontos.map((p) => Math.hypot(p.x, p.y));
    expect(Math.max(...raios)).toBeCloseTo(1, 6);
    expect(Math.min(...raios)).toBeGreaterThan(0.4);
    // Pontas: máximos locais do raio.
    const pontas = raios.filter(
      (r, i) =>
        r > raios[(i + 99) % 100] && r >= raios[(i + 1) % 100] && r > 0.95,
    );
    expect(pontas).toHaveLength(5);
    const distancias = pontos.map((p, i) => {
      const q = pontos[(i + 1) % 100];
      return Math.hypot(q.x - p.x, q.y - p.y);
    });
    expect(Math.max(...distancias) - Math.min(...distancias)).toBeLessThan(
      0.02,
    );
  });

  it("visto: três traços paralelos, descendo e subindo à direita", () => {
    const pontos = tracoDoCheck(90);
    expect(pontos).toHaveLength(90);
    const fundo = pontos.reduce((a, b) => (b.y > a.y ? b : a));
    const esquerda = pontos.reduce((a, b) => (b.x < a.x ? b : a));
    const direita = pontos.reduce((a, b) => (b.x > a.x ? b : a));
    expect(fundo.x).toBeGreaterThan(esquerda.x);
    expect(fundo.x).toBeLessThan(direita.x);
    // A haste direita sobe mais que a esquerda.
    expect(direita.y).toBeLessThan(esquerda.y);
  });
});

describe("texto", () => {
  it("pontos de uma imagem: só onde é opaco, a cada `passo`", () => {
    const imagem = imagemComRetangulo(40, 20, [10, 4, 30, 16]);
    const pontos = pontosDaImagem(imagem, { passo: 4 });
    expect(pontos.length).toBeGreaterThan(0);
    expect(
      pontos.every((p) => p.x >= 10 && p.x < 30 && p.y >= 4 && p.y < 16),
    ).toBe(true);
    expect(pontosDaImagem(null)).toEqual([]);
    // O passo da grade dá no máximo a quantidade pedida.
    const grande = imagemComRetangulo(400, 200, [0, 0, 400, 200]);
    const passo = passoParaCaber(grande, 300);
    expect(pontosDaImagem(grande, { passo }).length).toBeLessThanOrEqual(300);
    expect(pontosDaImagem(grande, { passo }).length).toBeGreaterThan(150);
  });

  it("número: da imagem do canvas quando há, da fonte de pontos quando não há", () => {
    const largura = 300;
    const imagem = imagemComRetangulo(largura, 100, [20, 20, 280, 80]);
    const daImagem = pontosDaForma(
      { tipo: "numero", texto: "1.000" },
      { ...tela, quantidade: 120, amostrarTexto: () => imagem },
    );
    expect(daImagem.length).toBeGreaterThan(40);
    expect(daImagem.length).toBeLessThanOrEqual(120);
    expect(dentro(daImagem, caixaDaForma(tela))).toBe(true);

    // Sem canvas (ou se ele falhar): a fonte 5×7 dá conta do número.
    const daFonte = pontosDaForma(
      { tipo: "numero", texto: "2.500" },
      {
        ...tela,
        quantidade: 400,
        amostrarTexto: () => {
          throw new Error("sem canvas");
        },
      },
    );
    expect(daFonte).toHaveLength(pontosDoTextoNaFonte("2.500").length);
    expect(dentro(daFonte, caixaDaForma(tela))).toBe(true);
  });

  it("a fonte de pontos tem os dígitos e separadores, e o texto cresce para a direita", () => {
    for (const c of "0123456789.,%+")
      expect(FONTE_DE_PONTOS[c]).toHaveLength(7);
    const um = pontosDoTextoNaFonte("1");
    const mil = pontosDoTextoNaFonte("1.000");
    expect(um).toHaveLength(
      FONTE_DE_PONTOS[1].join("").replace(/0/g, "").length * 4,
    );
    expect(Math.max(...mil.map((p) => p.x))).toBeGreaterThan(
      Math.max(...um.map((p) => p.x)) * 3,
    );
  });
});

describe("ajuste à tela", () => {
  it("cabe na caixa sem distorcer e fica centrado", () => {
    const quadrado = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
    ];
    const ajustado = ajustarPontos(quadrado, {
      cx: 100,
      cy: 50,
      larguraMax: 200,
      alturaMax: 40,
    });
    const xs = ajustado.map((p) => p.x);
    const ys = ajustado.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(40);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(40);
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(100);
    expect(
      ajustarPontos([], { cx: 0, cy: 0, larguraMax: 1, alturaMax: 1 }),
    ).toEqual([]);
  });

  it("reduz sem sorteio, espaçado", () => {
    const lista = Array.from({ length: 100 }, (_, i) => ({ x: i, y: 0 }));
    expect(reduzirPontos(lista, 10).map((p) => p.x)).toEqual([
      0, 10, 20, 30, 40, 50, 60, 70, 80, 90,
    ]);
    expect(reduzirPontos(lista, 500)).toBe(lista);
  });

  it("coração, estrela e visto na tela: dentro da caixa, abaixo do aviso do topo", () => {
    const caixa = caixaDaForma(tela);
    expect(caixa.cy - caixa.alturaMax / 2).toBeGreaterThan(140);
    for (const forma of ["coracao", "estrela", "check"]) {
      const pontos = pontosDaForma(forma, { ...tela, quantidade: 300 });
      expect(pontos.length).toBeGreaterThan(40);
      expect(pontos.length).toBeLessThanOrEqual(300 * 1.4);
      expect(dentro(pontos, { ...caixa, larguraMax: caixa.larguraMax })).toBe(
        true,
      );
    }
    // Tela de celular: continua dentro da largura.
    const celular = { largura: 375, altura: 700 };
    const pontos = pontosDaForma("coracao", celular);
    expect(pontos.every((p) => p.x > 0 && p.x < celular.largura)).toBe(true);
  });
});
