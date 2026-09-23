import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  EVENTO_DAS_TERRAS,
  FASES_DAS_TERRAS,
  resumoDasTerras,
} from "../src/modules/indigenous-territories-layer.js";
import {
  TITULO_DA_LEGENDA,
  montarLegendaDasTerras,
} from "../src/modules/legenda-das-terras.js";

/*
  Um mapa de mentira com o contrato que a camada instala: um interruptor por
  fase e o evento que avisa quando algo muda. Chega para exercitar a legenda
  sem Leaflet.
*/
function mapaDeMentira() {
  const ouvintes = new Map();
  const ocultas = new Set();
  const mapa = {
    on(evento, fn) {
      if (!ouvintes.has(evento)) ouvintes.set(evento, []);
      ouvintes.get(evento).push(fn);
    },
    fire(evento) {
      for (const fn of ouvintes.get(evento) || []) fn();
    },
    ouvintes: (evento) => (ouvintes.get(evento) || []).length,
    __agsusFaseDaTerraVisivel: (fase) => !ocultas.has(fase),
    __agsusAlternarFaseDaTerra: vi.fn((fase) => {
      if (ocultas.has(fase)) ocultas.delete(fase);
      else ocultas.add(fase);
      mapa.fire(EVENTO_DAS_TERRAS);
    }),
  };
  return mapa;
}

function montar(mapa) {
  const alvo = document.createElement("div");
  document.body.append(alvo);
  montarLegendaDasTerras(alvo, mapa);
  return alvo;
}

const botoes = (alvo) => [...alvo.querySelectorAll("button[data-fase]")];

describe("a legenda das terras", () => {
  it("tem um título e um botão por fase", () => {
    const alvo = montar(mapaDeMentira());
    expect(alvo.textContent).toContain(TITULO_DA_LEGENDA);
    expect(botoes(alvo).map((b) => b.dataset.fase)).toEqual(
      FASES_DAS_TERRAS.map((f) => f.fase),
    );
    for (const f of FASES_DAS_TERRAS)
      expect(alvo.textContent).toContain(f.rotulo);
  });

  it("começa com tudo ligado", () => {
    const alvo = montar(mapaDeMentira());
    for (const b of botoes(alvo))
      expect(b.getAttribute("aria-pressed")).toBe("true");
  });

  /*
    O pedido que motivou isto: esconder as regularizadas e continuar a ver as
    que estão em delimitação.
  */
  it("clicar numa fase esconde só essa fase", () => {
    const mapa = mapaDeMentira();
    const alvo = montar(mapa);
    const [definitiva, processo, estudo] = botoes(alvo);

    definitiva.click();

    expect(mapa.__agsusAlternarFaseDaTerra).toHaveBeenCalledWith("definitiva");
    expect(definitiva.getAttribute("aria-pressed")).toBe("false");
    expect(processo.getAttribute("aria-pressed")).toBe("true");
    expect(estudo.getAttribute("aria-pressed")).toBe("true");
  });

  it("clicar de novo devolve a fase", () => {
    const mapa = mapaDeMentira();
    const alvo = montar(mapa);
    const [definitiva] = botoes(alvo);
    definitiva.click();
    definitiva.click();
    expect(definitiva.getAttribute("aria-pressed")).toBe("true");
  });

  /*
    A legenda nacional é reescrita a cada troca de nível do mapa. Cada
    reescrita pendurava um ouvinte novo no mapa — é o tipo de fuga que só
    aparece depois de uma tarde de uso.
  */
  it("remontar não acumula ouvintes no mapa", () => {
    const mapa = mapaDeMentira();
    for (let i = 0; i < 5; i += 1) montar(mapa);
    expect(mapa.ouvintes(EVENTO_DAS_TERRAS)).toBe(1);
  });

  it("uma legenda que saiu do documento deixa de ser atualizada", () => {
    const mapa = mapaDeMentira();
    const velha = montar(mapa);
    velha.remove();
    const nova = montar(mapa);
    botoes(nova)[1].click();
    expect(botoes(velha)[1].getAttribute("aria-pressed")).toBe("true");
    expect(botoes(nova)[1].getAttribute("aria-pressed")).toBe("false");
  });

  it("duas legendas do mesmo mapa andam juntas", () => {
    const mapa = mapaDeMentira();
    const a = montar(mapa);
    const b = montar(mapa);
    botoes(a)[0].click();
    expect(botoes(b)[0].getAttribute("aria-pressed")).toBe("false");
  });

  // Sem a camada instalada não há o que desligar: vira legenda simples.
  it("sem a camada, os itens ficam como legenda e não fingem ser botão", () => {
    const alvo = montar({});
    for (const b of botoes(alvo)) {
      expect(b.disabled).toBe(true);
      expect(b.getAttribute("aria-pressed")).toBe("true");
    }
  });

  it("sem alvo, não faz nada", () => {
    expect(montarLegendaDasTerras(null, mapaDeMentira())).toBe(false);
  });

  it("é montada com a API do DOM, sem innerHTML", () => {
    const fonte = readFileSync("src/modules/legenda-das-terras.js", "utf8");
    expect(fonte).not.toMatch(/\.innerHTML\s*=/);
  });
});

/*
  O BOTÃO DESLIGAVA METADE DAS TERRAS

  Tirava do mapa o raster e o vetorial e deixava os círculos das terras em
  estudo, que são exatamente as que o print mostrava sobrando no mapa com as
  terras "desligadas".
*/
describe("desligar as terras desliga todas", () => {
  const camada = readFileSync(
    "src/modules/indigenous-territories-layer.js",
    "utf8",
  );
  const corpo = (inicio) => {
    const i = camada.indexOf(inicio);
    return camada.slice(i, camada.indexOf("\n  };", i));
  };

  it("uma função só decide a visibilidade, e ela tira as cinco camadas", () => {
    const fn = corpo("const definirVisibilidade = (proxima) =>");
    expect(fn).toContain("removeLayer(rasterLayer)");
    // clearVector leva o vetorial, os símbolos e os rótulos.
    expect(fn).toContain("clearVector()");
    expect(fn).toContain("estudoLayer.clearLayers()");
    expect(fn).toContain("removeLayer(estudoLayer)");
  });

  it("o botão não liga camada nenhuma por conta própria", () => {
    const fn = camada.slice(
      camada.indexOf("function addControl("),
      camada.indexOf("function readStoredVisibility("),
    );
    expect(fn).toContain("definirVisibilidade(");
    expect(fn).not.toContain("removeLayer(");
  });

  it("as terras em estudo respeitam o interruptor e a fase", () => {
    const fn = corpo("const desenharEstudo = () =>");
    expect(fn).toContain("!visible()");
    expect(fn).toContain('fasesOcultas.has("em_estudo")');
  });

  it("o desenho passa pelo recorte das fases", () => {
    expect(camada).toContain(
      "terrasDasFasesVisiveis(doDistrito, fasesOcultas)",
    );
  });
});

/*
  A LISTA DE TERRAS LEVA O MAPA ATÉ A TERRA

  Os itens eram `div` sem ação, ao lado de uma lista de unidades em que cada
  item já levava ao ponto. Agora são botões, e a terra pedida engrossa o traço.
*/
describe("a lista de terras é navegável", () => {
  const app = readFileSync("src/modules/legacy-app.js", "utf8");
  const poligono = (oeste, sul, leste, norte) => ({
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
  });

  it("cada terra leva a caixa inteira, somando os seus polígonos", () => {
    const [terra] = resumoDasTerras([
      {
        properties: { terrai_nome: "X" },
        geometry: poligono(-60, -10, -59, -9),
      },
      {
        properties: { terrai_nome: "X" },
        geometry: poligono(-58, -12, -57, -11),
      },
    ]);
    expect(terra.caixa).toEqual({
      oeste: -60,
      sul: -12,
      leste: -57,
      norte: -9,
    });
  });

  it("terra sem geometria não inventa caixa", () => {
    const [terra] = resumoDasTerras([{ properties: { terrai_nome: "Y" } }]);
    expect(terra.caixa).toBeNull();
  });

  it("os itens são botões com a caixa e o nome", () => {
    const fn = app.slice(app.indexOf("function renderDetailTerraList"));
    expect(fn).toContain(
      '<button type="button" class="health-map-terra" data-map-terra',
    );
    expect(fn).toContain('data-caixa="${attr(caixa)}"');
    expect(fn).toContain('data-nome="${attr(t.nome)}"');
  });

  it("o clique chama a camada para enquadrar", () => {
    expect(app).toContain('closest("[data-map-terra]")');
    expect(app).toContain("__agsusEnquadrarTerra?.(botao.dataset.nome");
  });
});

/*
  A SEDE MORRIA NO PRIMEIRO ZOOM

  Era posta na mesma camada que `desenharCamadaDeUnidades` esvazia com
  `clearLayers()` a cada `zoomend` — e o enquadramento inicial dispara um.
*/
describe("a sede do DSEI fica no mapa", () => {
  const app = readFileSync("src/modules/legacy-app.js", "utf8");
  const fn = app.slice(
    app.indexOf("const desenharCamadaDeUnidades = () => {"),
    app.indexOf("desenharCamadaDeUnidades();"),
  );

  it("volta a cada redesenho, logo depois de a camada ser esvaziada", () => {
    const limpa = fn.indexOf("_detailUnitLayer.clearLayers();");
    const repoe = fn.indexOf("_detailUnitLayer.addLayer(marcadorDaSede)");
    expect(limpa).toBeGreaterThan(-1);
    expect(repoe).toBeGreaterThan(limpa);
  });

  it("é criada antes da primeira chamada", () => {
    expect(app.indexOf("const marcadorDaSede =")).toBeLessThan(
      app.indexOf("desenharCamadaDeUnidades();"),
    );
  });

  it("não é mais posta na camada por fora do redesenho", () => {
    expect(app).not.toMatch(/\)\s*\.addTo\(_detailUnitLayer\);/);
  });
});

/*
  O BRASIL ENCHE O MAPA

  Com o zoom inteiro do Leaflet, o país cabia no nível 4 ocupando uns 60% da
  altura do mapa, e no 5 já não cabia. Quartos de nível deixam-no encaixar.
*/
describe("o mapa do Brasil", () => {
  const app = readFileSync("src/modules/legacy-app.js", "utf8");

  it("o mapa nacional aceita zoom fracionado", () => {
    const criacao = app.slice(
      app.indexOf("_leaflet = L.map(el, {"),
      app.indexOf("_leaflet.fitBounds(BRASIL_BOUNDS)"),
    );
    expect(criacao).toContain("zoomSnap: 0.25");
  });

  it("e o do DSEI também", () => {
    const criacao = app.slice(app.indexOf("_detailLeaflet = L.map(el, {"));
    expect(criacao.slice(0, 400)).toContain("zoomSnap: 0.25");
  });

  /*
    A Funai deixou de publicar a abrangência dos DSEIs, e a legenda continuava
    a prometer a linha azul que o mapa não desenhava.
  */
  it("a legenda só promete a abrangência quando ela está desenhada", () => {
    expect(app).toContain("__agsusDseiCoverageLayer?.getLayers?.().length");
    expect(app).not.toContain(
      "${limiteDsei}abrangência oficial do DSEI<br>${terras}",
    );
  });
});
