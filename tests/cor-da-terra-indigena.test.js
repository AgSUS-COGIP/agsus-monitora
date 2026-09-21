import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  O VERDE DA FUNAI DESAPARECIA DENTRO DA FLORESTA

  A camada tinha sido alinhada pelo verde que a própria Funai publica. Medido
  no raster dela, esse verde é #4daf4a — hsl(118, 41%, 49%), verde de folha.
  Sobre imagem de satélite ele some na vegetação, que é onde quase toda a terra
  indígena está: a cor certa da fonte era a cor errada do mapa.

  Duas coisas desenham a mesma camada. Abaixo do zoom 7 é o raster WMS da
  Funai, que vem pronto e só muda com um filtro CSS; a partir dali é o vetorial,
  que muda numa constante. Se as duas não derem exatamente a mesma cor, a
  camada troca de cor ao cruzar o zoom 7.

  Estes casos guardam essa igualdade — e ela não se verifica por leitura, porque
  `hue-rotate` do CSS não roda a matiz de HSL. É uma aproximação linear em RGB,
  definida na especificação de filtros, e o resultado tem de ser calculado.
*/
const modulo = readFileSync(
  "src/modules/indigenous-territories-layer.js",
  "utf8",
);
const css = readFileSync("src/styles/indigenous-territories-layer.css", "utf8");
const cssLegenda = readFileSync("src/styles/health-map-workspace.css", "utf8");

const VERDE_DA_FUNAI = [0x4d, 0xaf, 0x4a];
const VEGETACAO = "#add19e";

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const aplicar = (m, [r, g, b]) =>
  m.map((l) => clamp(l[0] * r + l[1] * g + l[2] * b));

function hueRotate(cor, graus) {
  const a = (graus * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return aplicar(
    [
      [
        0.213 + c * 0.787 - s * 0.213,
        0.715 - c * 0.715 - s * 0.715,
        0.072 - c * 0.072 + s * 0.928,
      ],
      [
        0.213 - c * 0.213 + s * 0.143,
        0.715 + c * 0.285 + s * 0.14,
        0.072 - c * 0.072 - s * 0.283,
      ],
      [
        0.213 - c * 0.213 - s * 0.787,
        0.715 - c * 0.715 + s * 0.715,
        0.072 + c * 0.928 + s * 0.072,
      ],
    ],
    cor,
  );
}

const saturate = (cor, k) =>
  aplicar(
    [
      [0.213 + 0.787 * k, 0.715 - 0.715 * k, 0.072 - 0.072 * k],
      [0.213 - 0.213 * k, 0.715 + 0.285 * k, 0.072 - 0.072 * k],
      [0.213 - 0.213 * k, 0.715 - 0.715 * k, 0.072 + 0.928 * k],
    ],
    cor,
  );

const brightness = (cor, k) => cor.map((v) => clamp(v * k));
const hex = (cor) =>
  "#" + cor.map((v) => v.toString(16).padStart(2, "0")).join("");

const canal = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const matiz = (h) => {
  const [r, g, b] = canal(h).map((v) => v / 255);
  const mx = Math.max(r, g, b);
  const d = mx - Math.min(r, g, b);
  if (!d) return 0;
  const t =
    mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (t * 60 + 360) % 360;
};
const distanciaDeMatiz = (a, b) => {
  const d = Math.abs(matiz(a) - matiz(b));
  return Math.min(d, 360 - d);
};

const corDeclarada = (nome) =>
  modulo.match(new RegExp(`const ${nome} = "(#[0-9a-f]{6})"`))?.[1] || "";
const filtroDeclarado = () =>
  modulo.match(/const FILTRO_DO_RASTER = "([^"]+)"/)?.[1] || "";

describe("o raster e o vetorial desenham a mesma cor", () => {
  it("o filtro leva o verde da Funai exatamente à cor do vetorial", () => {
    const filtro = filtroDeclarado();
    const graus = Number(filtro.match(/hue-rotate\(([-\d.]+)deg\)/)?.[1]);
    const sat = Number(filtro.match(/saturate\(([\d.]+)\)/)?.[1]);
    const bri = Number(filtro.match(/brightness\(([\d.]+)\)/)?.[1]);

    expect(Number.isFinite(graus), `filtro ilegível: ${filtro}`).toBe(true);
    expect(Number.isFinite(sat)).toBe(true);
    expect(Number.isFinite(bri)).toBe(true);

    const resultado = brightness(
      saturate(hueRotate(VERDE_DA_FUNAI, graus), sat),
      bri,
    );
    expect(hex(resultado)).toBe(corDeclarada("COR_DA_TERRA"));
  });

  it("o filtro é aplicado ao painel do raster", () => {
    expect(modulo).toContain("rasterPane.style.filter = FILTRO_DO_RASTER");
  });
});

describe("a cor sai de cima da vegetação", () => {
  it("o traço fica longe do matiz do verde do mapa", () => {
    expect(
      distanciaDeMatiz(corDeclarada("COR_DA_TERRA"), VEGETACAO),
      "o traço voltou para perto do verde",
    ).toBeGreaterThan(90);
  });

  it("o preenchimento também", () => {
    expect(
      distanciaDeMatiz(corDeclarada("PREENCHIMENTO_DA_TERRA"), VEGETACAO),
    ).toBeGreaterThan(90);
  });

  /*
    O azul é da camada de DSEI, que se desenha por baixo desta. Duas camadas
    com matiz vizinho no mesmo mapa leem-se como uma só.
  */
  it("e não colide com o azul do DSEI", () => {
    expect(
      distanciaDeMatiz(corDeclarada("COR_DA_TERRA"), "#2563eb"),
    ).toBeGreaterThan(60);
  });

  it("o verde da Funai não volta como cor do vetorial", () => {
    expect(modulo).not.toContain('"#4daf4a"');
    expect(modulo).not.toContain('"#0b6b5f"');
    expect(modulo).not.toContain('"#14b8a6"');
  });
});

/*
  Legenda que não descreve o desenho é pior do que legenda nenhuma: ensina a
  procurar a coisa errada. Foi assim que o quadrado ficou vermelho enquanto o
  mapa desenhava verde.
*/
describe("os quadrados da legenda acompanham", () => {
  it("o botão da camada usa o traço do polígono", () => {
    expect(css).toContain("rgba(224, 48, 166, 0.95)");
    expect(css).not.toContain("rgba(13, 148, 136, 0.92)");
  });

  it("a legenda do mapa detalhado usa o traço do polígono", () => {
    expect(cssLegenda).toContain(
      `border: 2px solid ${corDeclarada("COR_DA_TERRA")}`,
    );
    expect(cssLegenda).not.toContain("#0b6b5f");
  });
});
