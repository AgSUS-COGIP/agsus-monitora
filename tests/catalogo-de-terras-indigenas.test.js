import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  CATALOGO_DE_TERRAS,
  CATALOGO_DE_TERRAS_EM_ESTUDO,
  caixaDaFeature,
  caixaDoMapa,
  caixasSeIntersectam,
  carregarCatalogo,
  terrasNoEnquadramento,
} from "../src/modules/indigenous-territories-layer.js";

/*
  O MAPA ESPERAVA A FUNAI A CADA ARRASTO

  O enquadramento virava um bbox de floats crus, dois arrastos seguidos nunca
  partilhavam URL, e nenhuma cache acertava. Medido contra o GeoServer da Funai:
  677 ms e 1,22 MB para desenhar 23 terras; o mesmo enquadramento um pixel ao
  lado, outro pedido inteiro.

  `scripts/compilar-terras-indigenas.mjs` traz as 665 de uma vez, simplificadas
  a 111 metros: 2,2 MB, 0,61 MB comprimido — menos de metade do que custava um
  enquadramento. Daí para a frente enquadrar, filtrar por distrito e limpar o
  filtro não tocam na rede.
*/
const terra = (nome, oeste, sul, leste, norte) => ({
  type: "Feature",
  properties: { terrai_nome: nome },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [oeste, sul],
        [leste, sul],
        [leste, norte],
        [oeste, norte],
        [oeste, sul],
      ],
    ],
  },
});

describe("a caixa de uma terra", () => {
  it("mede o que a geometria ocupa", () => {
    expect(caixaDaFeature(terra("X", -40, -12, -38, -10))).toEqual({
      oeste: -40,
      sul: -12,
      leste: -38,
      norte: -10,
    });
  });

  /*
    Calcular a caixa percorre todos os vértices. Com 665 terras a cada
    movimento do mapa, isso seria o gargalo seguinte depois de se ter tirado a
    rede do caminho.
  */
  it("guarda o resultado na própria feature", () => {
    const f = terra("X", -40, -12, -38, -10);
    expect(caixaDaFeature(f)).toBe(caixaDaFeature(f));
  });

  it("não quebra com feature congelada nem com lixo", () => {
    const congelada = Object.freeze(terra("X", -40, -12, -38, -10));
    expect(caixaDaFeature(congelada)).toEqual({
      oeste: -40,
      sul: -12,
      leste: -38,
      norte: -10,
    });
    expect(caixaDaFeature(null)).toBeNull();
    expect(caixaDaFeature({ geometry: { type: "Point" } })).toBeNull();
  });
});

describe("o que cabe no enquadramento", () => {
  const bahia = terra("Bahia", -41, -13, -39, -11);
  const roraima = terra("Roraima", -63, 1, -61, 3);
  const features = [bahia, roraima];

  it("deixa entrar quem toca a janela", () => {
    const vistas = terrasNoEnquadramento(features, {
      oeste: -42,
      sul: -14,
      leste: -38,
      norte: -10,
    });
    expect(vistas).toEqual([bahia]);
  });

  /*
    Uma terra maior do que o ecrã não tem nenhum canto dentro da janela e
    continua a ter de ser desenhada — é justamente o caso do Yanomami num mapa
    de Roraima.
  */
  it("deixa entrar a terra que engole a janela", () => {
    expect(
      terrasNoEnquadramento([terra("Grande", -70, -10, -50, 5)], {
        oeste: -61,
        sul: -2,
        leste: -60,
        norte: -1,
      }),
    ).toHaveLength(1);
  });

  it("toque pela borda conta", () => {
    expect(
      caixasSeIntersectam(
        { oeste: -41, sul: -13, leste: -39, norte: -11 },
        { oeste: -39, sul: -13, leste: -37, norte: -11 },
      ),
    ).toBe(true);
  });

  it("sem enquadramento, nada é recortado", () => {
    expect(terrasNoEnquadramento(features, null)).toBe(features);
    expect(terrasNoEnquadramento(null, null)).toEqual([]);
  });

  it("lê a caixa dos limites do Leaflet", () => {
    expect(
      caixaDoMapa({
        getWest: () => -42,
        getSouth: () => -14,
        getEast: () => -38,
        getNorth: () => -10,
      }),
    ).toEqual({ oeste: -42, sul: -14, leste: -38, norte: -10 });
    expect(caixaDoMapa(null)).toBeNull();
    expect(caixaDoMapa({ getWest: () => NaN })).toBeNull();
  });
});

describe("carregar o catálogo", () => {
  it("devolve a coleção quando o pedido corre bem", async () => {
    const buscar = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        type: "FeatureCollection",
        features: [terra("X", -1, -1, 1, 1)],
      }),
    });
    const catalogo = await carregarCatalogo(CATALOGO_DE_TERRAS, buscar);
    expect(catalogo.features).toHaveLength(1);
    expect(buscar).toHaveBeenCalledWith(CATALOGO_DE_TERRAS, expect.anything());
  });

  /*
    Falhar aqui não pode partir o mapa: há o recurso à Funai e, atrás dele, o
    raster. `null` é a forma de dizer "não tenho", e quem chama trata disso.
  */
  it("devolve null quando o ficheiro não está lá", async () => {
    const buscar = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    expect(await carregarCatalogo(CATALOGO_DE_TERRAS, buscar)).toBeNull();
  });

  it("devolve null quando a rede falha", async () => {
    const buscar = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await carregarCatalogo(CATALOGO_DE_TERRAS, buscar)).toBeNull();
  });

  it("devolve null quando o corpo não é uma coleção", async () => {
    const buscar = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ erro: "x" }) });
    expect(await carregarCatalogo(CATALOGO_DE_TERRAS, buscar)).toBeNull();
  });

  /*
    Este caso nasceu de uma falha real. O `fetch` bloqueado da suíte ATIRA em
    vez de rejeitar, e um `fetch` que atira escapava ao `catch` — a função
    lançava para fora em vez de devolver `null`, e o mapa partia-se em vez de
    cair no recurso. Num navegador isso acontece com um URL inválido.
  */
  it("devolve null mesmo quando o fetch atira em vez de rejeitar", async () => {
    const buscar = () => {
      throw new Error("atirou já");
    };
    expect(await carregarCatalogo(CATALOGO_DE_TERRAS, buscar)).toBeNull();
  });
});

/*
  O ficheiro é dado, mas é dado que decide o que o mapa desenha. Estes casos
  travam uma recompilação que saia deformada.
*/
describe("o ficheiro compilado", () => {
  const catalogo = JSON.parse(
    readFileSync("public/data/terras-indigenas.json", "utf8"),
  );

  it("traz todas as terras com limite publicado", () => {
    expect(catalogo.features.length).toBeGreaterThanOrEqual(660);
  });

  it("cabe no que se prometeu", () => {
    const mb = Buffer.byteLength(JSON.stringify(catalogo)) / 1048576;
    expect(mb, `catálogo com ${mb.toFixed(1)} MB`).toBeLessThan(3);
  });

  it("cada terra traz nome e geometria de área", () => {
    for (const f of catalogo.features) {
      expect(f.properties.terrai_nome, "terra sem nome").toBeTruthy();
      expect(["Polygon", "MultiPolygon"]).toContain(f.geometry.type);
    }
  });

  it("nenhuma terra cai fora do Brasil", () => {
    for (const f of catalogo.features) {
      const c = caixaDaFeature(f);
      expect(c.sul, f.properties.terrai_nome).toBeGreaterThan(-34);
      expect(c.norte, f.properties.terrai_nome).toBeLessThan(6);
      expect(c.oeste, f.properties.terrai_nome).toBeGreaterThan(-74);
      expect(c.leste, f.properties.terrai_nome).toBeLessThan(-34);
    }
  });

  it("declara a tolerância com que foi simplificado", () => {
    expect(catalogo.tolerancia_graus).toBe(0.001);
    expect(catalogo.fonte).toContain("Funai");
  });

  it("as terras em estudo continuam a ser pontos", () => {
    const estudo = JSON.parse(
      readFileSync("public/data/terras-indigenas-em-estudo.json", "utf8"),
    );
    expect(estudo.features.length).toBeGreaterThanOrEqual(160);
    for (const f of estudo.features) expect(f.geometry.type).toBe("Point");
    expect(CATALOGO_DE_TERRAS_EM_ESTUDO).toBe(
      "/data/terras-indigenas-em-estudo.json",
    );
  });
});
