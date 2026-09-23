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
const cssLegenda = readFileSync("src/styles/legenda-das-terras.css", "utf8");

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

/*
  DIFERENÇA PERCEPTUAL, E NÃO SÓ MATIZ

  O critério antigo media a distância apenas pelo matiz, e exigia 90° do verde
  e 60° do azul. Feita a conta, as únicas cores que passavam eram rosa, magenta
  e vermelho — o teste escolhia a cor antes de alguém a escolher, e o Brasil
  ficou rosa. Matiz sozinho não diz se duas cores se confundem: o marrom tem
  matiz de laranja e ninguém o toma por verde-claro.

  ΔE (CIE76, em CIELAB) conta matiz, claridade e saturação juntos. ΔE 2,3 é o
  limiar em que a diferença começa a ser percebida; acima de 20 são cores com
  nomes diferentes.
*/
function lab(h) {
  const [r, g, b] = canal(h).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const deltaE = (a, b) => {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

// Razão de contraste da WCAG, para o traço contra o fundo do mapa.
const luminancia = (h) => {
  const [r, g, b] = canal(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (claro + 0.05) / (escuro + 0.05);
};

const FUNDO_DO_MAPA = "#f2efe9";
const ROSA_QUE_SAIU = "#e030a6";
const AZUL_DO_DSEI = "#2563eb";
const MARCADORES = {
  "polo base": "#e49a1b",
  CASAI: "#d92d3a",
  UBSI: "#6d28d9",
  "unidade de saúde": "#0d8192",
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
  it("o traço não se confunde com o verde do mapa", () => {
    expect(
      deltaE(corDeclarada("COR_DA_TERRA"), VEGETACAO),
      "o traço voltou para perto do verde",
    ).toBeGreaterThan(40);
  });

  it("nem o traço da terra em processo", () => {
    expect(deltaE(corDeclarada("COR_EM_PROCESSO"), VEGETACAO)).toBeGreaterThan(
      40,
    );
  });

  // O fundo é desenhado com pouca opacidade; basta ser outra cor.
  it("o preenchimento também é outra cor", () => {
    expect(
      deltaE(corDeclarada("PREENCHIMENTO_DA_TERRA"), VEGETACAO),
    ).toBeGreaterThan(20);
  });

  /*
    O azul é da camada de DSEI, que se desenha por baixo desta. Duas camadas
    com cor vizinha no mesmo mapa leem-se como uma só.
  */
  it("e não colide com o azul do DSEI", () => {
    expect(deltaE(corDeclarada("COR_DA_TERRA"), AZUL_DO_DSEI)).toBeGreaterThan(
      40,
    );
    expect(
      deltaE(corDeclarada("COR_EM_PROCESSO"), AZUL_DO_DSEI),
    ).toBeGreaterThan(40);
  });

  it("o verde da Funai não volta como cor do vetorial", () => {
    expect(modulo).not.toContain('"#4daf4a"');
    expect(modulo).not.toContain('"#0b6b5f"');
    expect(modulo).not.toContain('"#14b8a6"');
  });
});

/*
  "ESTÁ TUDO ROSA"

  Com 665 terras cheias de magenta, o Brasil inteiro ficava rosa. O pedido foi
  mudar a cor; estes casos impedem que ela volte por outro caminho.
*/
describe("o rosa saiu", () => {
  it("nenhuma das cores da terra é rosa", () => {
    for (const nome of [
      "COR_DA_TERRA",
      "PREENCHIMENTO_DA_TERRA",
      "COR_EM_PROCESSO",
    ]) {
      expect(
        deltaE(corDeclarada(nome), ROSA_QUE_SAIU),
        `${nome} voltou para perto do rosa`,
      ).toBeGreaterThan(40);
    }
  });

  it("nem sobra rosa no CSS da camada e das legendas", () => {
    for (const texto of [css, cssLegenda]) {
      expect(texto).not.toContain("224, 48, 166");
      expect(texto).not.toContain("244, 114, 208");
      expect(texto).not.toContain("#a3116f");
    }
  });
});

/*
  A terra é contexto; os marcadores são o dado. A cor da terra não pode ser
  confundida com a de nenhum tipo de unidade — senão um polo base dentro de
  uma terra some dentro dela.
*/
describe("a terra não disputa com os marcadores", () => {
  for (const [nome, cor] of Object.entries(MARCADORES)) {
    it(`fica longe da cor de ${nome}`, () => {
      expect(deltaE(corDeclarada("COR_DA_TERRA"), cor)).toBeGreaterThan(25);
      expect(deltaE(corDeclarada("COR_EM_PROCESSO"), cor)).toBeGreaterThan(25);
    });
  }
});

// WCAG 1.4.11: componente gráfico que carrega informação pede 3:1.
describe("o traço lê-se contra o mapa", () => {
  it("as duas fases passam de 3:1 contra o fundo do mapa", () => {
    expect(
      contraste(corDeclarada("COR_DA_TERRA"), FUNDO_DO_MAPA),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contraste(corDeclarada("COR_EM_PROCESSO"), FUNDO_DO_MAPA),
    ).toBeGreaterThanOrEqual(3);
  });
});

/*
  Legenda que não descreve o desenho é pior do que legenda nenhuma: ensina a
  procurar a coisa errada. Foi assim que o quadrado ficou vermelho enquanto o
  mapa desenhava verde, e depois magenta enquanto o mapa mudava.

  As amostras leem de três tokens; os tokens têm de ser as constantes da camada.
*/
describe("os quadrados da legenda acompanham", () => {
  const token = (nome) =>
    cssLegenda.match(new RegExp(`--${nome}:\\s*(#[0-9a-f]{6})`))?.[1] || "";

  it("os tokens são as constantes da camada", () => {
    expect(token("terra-definitiva")).toBe(corDeclarada("COR_DA_TERRA"));
    expect(token("terra-fundo")).toBe(corDeclarada("PREENCHIMENTO_DA_TERRA"));
    expect(token("terra-em-processo")).toBe(corDeclarada("COR_EM_PROCESSO"));
  });

  it("o botão da camada usa os tokens", () => {
    expect(css).toContain("border: 2px solid var(--terra-definitiva)");
    expect(css).not.toContain("rgba(13, 148, 136, 0.92)");
  });

  it("cada fase tem a sua amostra, com o traço da sua fase", () => {
    expect(cssLegenda).toContain("border: 2px solid var(--terra-definitiva)");
    expect(cssLegenda).toContain("border: 2px dashed var(--terra-em-processo)");
    expect(cssLegenda).toContain(".legenda-terra__amostra--em_estudo");
  });
});
