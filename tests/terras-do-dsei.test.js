import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DISTANCIA_MINIMA_ENTRE_ROTULOS_PX,
  RAIO_DE_ATENDIMENTO_KM,
  caixaDeCoordenadas,
  poligonosDaFeature,
  pontoEmPoligonos,
  rotulosSemColisao,
  terraPertenceAoDsei,
} from "../src/modules/indigenous-territories-layer.js";

/*
  Um quadrado de um grau em volta de um ponto, para não escrever polígonos à
  mão em cada caso.
*/
const terraEm = (lat, lon, lado = 0.2) => ({
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [lon - lado, lat - lado],
        [lon + lado, lat - lado],
        [lon + lado, lat + lado],
        [lon - lado, lat + lado],
        [lon - lado, lat - lado],
      ],
    ],
  },
});

/*
  O botão "Terras Indígenas" mostrava um quadrado vermelho sobre satélite e o
  mapa desenhava verde. A cor vermelha só existia no desenho vetorial, e na
  visão nacional quem desenha é o raster da Funai, com a simbologia dela.

  O WMS da Funai publica dois estilos para `tis_poligonais` — `terras_indigenas`
  e `polygon` — e nenhum é vermelho. Não há como alinhar pelo vermelho, só pelo
  verde. Estes casos impedem a segunda cor de voltar.
*/
describe("uma cor só para a Terra Indígena", () => {
  const modulo = readFileSync(
    "src/modules/indigenous-territories-layer.js",
    "utf8",
  );
  const css = readFileSync(
    "src/styles/indigenous-territories-layer.css",
    "utf8",
  );
  const cssLegenda = readFileSync(
    "src/styles/health-map-workspace.css",
    "utf8",
  );

  it("o vermelho não volta ao estilo da camada", () => {
    expect(modulo).not.toContain("#ff4d3d");
    expect(modulo).not.toContain("#ef4444");
  });

  it("o quadrado do botão não muda com o mapa base", () => {
    expect(css).not.toContain(
      ".map-satellite-mode .agsus-indigenous-territories-control__swatch {",
    );
  });

  it("o quadrado da legenda não muda com o mapa base", () => {
    expect(cssLegenda).not.toContain(
      ".map-satellite-mode .health-map-legenda-terra {",
    );
  });
});

describe("geometria de apoio", () => {
  it("lê Polygon e MultiPolygon", () => {
    expect(poligonosDaFeature(terraEm(-12, -38))).toHaveLength(1);
    expect(
      poligonosDaFeature({
        geometry: { type: "MultiPolygon", coordinates: [[], []] },
      }),
    ).toHaveLength(2);
    expect(poligonosDaFeature({ geometry: { type: "Point" } })).toEqual([]);
    expect(poligonosDaFeature(null)).toEqual([]);
  });

  it("mede a caixa do polígono", () => {
    const caixa = caixaDeCoordenadas(poligonosDaFeature(terraEm(-12, -38)));
    expect(caixa.sul).toBeCloseTo(-12.2, 5);
    expect(caixa.norte).toBeCloseTo(-11.8, 5);
  });

  it("sabe o que está dentro do polígono", () => {
    const polys = poligonosDaFeature(terraEm(-12, -38));
    expect(pontoEmPoligonos([-38, -12], polys)).toBe(true);
    expect(pontoEmPoligonos([-30, -12], polys)).toBe(false);
  });
});

/*
  A Funai deixou de publicar a abrangência dos DSEIs — `Funai:areas_dsei`
  responde "Feature type unknown". A relação passa a sair das unidades do
  próprio distrito, e estes casos fixam o que essa regra promete.
*/
describe("que terras são deste DSEI", () => {
  const terra = terraEm(-12, -38);

  it("entra quando o DSEI tem unidade dentro dela", () => {
    expect(terraPertenceAoDsei(terra, [{ lat: -12, lon: -38 }])).toBe(true);
  });

  it("entra quando o DSEI tem unidade perto, ainda que fora", () => {
    // ~33 km a norte do centro, fora do polígono, dentro do raio.
    expect(terraPertenceAoDsei(terra, [{ lat: -11.7, lon: -38 }])).toBe(true);
  });

  /*
    Xerente está a mais de 500 km de qualquer unidade do DSEI Bahia, e era uma
    das que apareciam no mapa da Bahia.
  */
  it("fica de fora quando a unidade mais próxima está longe demais", () => {
    expect(terraPertenceAoDsei(terra, [{ lat: -10, lon: -48 }])).toBe(false);
  });

  it("o raio é 50 km, e é ele que decide", () => {
    expect(RAIO_DE_ATENDIMENTO_KM).toBe(50);
    // 1 grau de latitude ≈ 111 km: 0,6 grau são ~67 km, fora; 0,4 são ~44, dentro.
    expect(terraPertenceAoDsei(terra, [{ lat: -12.6, lon: -38 }])).toBe(false);
    expect(terraPertenceAoDsei(terra, [{ lat: -12.4, lon: -38 }])).toBe(true);
  });

  it("sem unidades não filtra nada — é a visão nacional", () => {
    expect(terraPertenceAoDsei(terra, [])).toBe(true);
    expect(terraPertenceAoDsei(terra)).toBe(true);
  });

  it("ignora unidade sem coordenada utilizável", () => {
    expect(
      terraPertenceAoDsei(terra, [
        { lat: null, lon: null },
        { lat: -10, lon: -48 },
      ]),
    ).toBe(false);
  });

  it("uma terra sem geometria não entra", () => {
    expect(terraPertenceAoDsei({}, [{ lat: -12, lon: -38 }])).toBe(false);
  });
});

/*
  No DSEI Bahia os nomes saíam uns por cima dos outros — "Tuxá", "Pankarú" e
  "Kiriri" no mesmo punhado de pixels, ilegíveis os três.
*/
describe("rótulos que não se pisam", () => {
  it("descarta o rótulo que cai em cima de outro", () => {
    const aceites = rotulosSemColisao([
      { x: 100, y: 100, texto: "Kiriri", peso: 40 },
      { x: 110, y: 105, texto: "Tuxá", peso: 10 },
    ]);
    expect(aceites).toHaveLength(1);
    expect(aceites[0].texto).toBe("Kiriri");
  });

  it("a terra maior fica com o rótulo", () => {
    const aceites = rotulosSemColisao([
      { x: 100, y: 100, texto: "pequena", peso: 5 },
      { x: 108, y: 100, texto: "grande", peso: 90 },
    ]);
    expect(aceites[0].texto).toBe("grande");
  });

  it("mantém os que estão suficientemente afastados", () => {
    const aceites = rotulosSemColisao([
      { x: 0, y: 0, texto: "a", peso: 1 },
      { x: 400, y: 400, texto: "b", peso: 1 },
      { x: 800, y: 0, texto: "c", peso: 1 },
    ]);
    expect(aceites).toHaveLength(3);
  });

  it("descarta candidato sem posição projetável", () => {
    const aceites = rotulosSemColisao([
      { x: Number.NaN, y: 10, texto: "a", peso: 1 },
      { x: undefined, y: undefined, texto: "b", peso: 1 },
    ]);
    expect(aceites).toEqual([]);
  });

  it("aguenta lista vazia", () => {
    expect(rotulosSemColisao([])).toEqual([]);
    expect(rotulosSemColisao()).toEqual([]);
  });

  it("a distância mínima é a de um rótulo legível", () => {
    expect(DISTANCIA_MINIMA_ENTRE_ROTULOS_PX).toBe(64);
  });
});
