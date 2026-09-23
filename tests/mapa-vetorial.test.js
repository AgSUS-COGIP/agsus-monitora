import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  ATRIBUICAO_DO_MAPA,
  ESTILO_DO_MAPA,
  MAPLIBRE_CSS,
  MAPLIBRE_JS,
  MAPLIBRE_VERSAO,
  caixaDoVetorial,
  tetoDoSatelite,
  zoomDoMapLibre,
} from "../src/lib/mapa-vetorial.js";
import {
  carregarMaplibre,
  criarCamadaVetorial,
  esquecerCarregamento,
} from "../src/modules/mapa-vetorial.js";

describe("as contas do mapa vetorial", () => {
  // Azulejos de 512 px no MapLibre, de 256 no Leaflet.
  it("o MapLibre está um nível de zoom abaixo do Leaflet", () => {
    expect(zoomDoMapLibre(10)).toBe(9);
    expect(zoomDoMapLibre(4.75)).toBe(3.75);
  });

  it("o fundo é maior que o mapa, centrado nele", () => {
    expect(caixaDoVetorial(1000, 600, 0.3)).toEqual({
      largura: 1600,
      altura: 960,
      deslocX: -300,
      deslocY: -180,
    });
    expect(caixaDoVetorial(0, 0)).toMatchObject({ largura: 0, altura: 0 });
  });

  /*
    Canarana no zoom 19: a foto é do 17, recuo 2 — o teto desce para 18,
    ampliação de 2x. Em Maceió, recuo 0, nada a limitar.
  */
  it("o teto do satélite fica um nível acima da foto", () => {
    expect(tetoDoSatelite(19, 2)).toBe(18);
    expect(tetoDoSatelite(19, 3)).toBe(17);
    expect(tetoDoSatelite(19, 1)).toBeNull();
    expect(tetoDoSatelite(19, 0)).toBeNull();
    expect(tetoDoSatelite(undefined, 2)).toBeNull();
  });
});

describe("de onde vem o MapLibre", () => {
  it("do cdnjs, de onde o Leaflet já vem, na versão com o formato clássico", () => {
    expect(MAPLIBRE_JS.url).toBe(
      `https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/${MAPLIBRE_VERSAO}/maplibre-gl.js`,
    );
    expect(MAPLIBRE_VERSAO.startsWith("5.")).toBe(true);
  });

  it("com verificação de integridade no script e na folha", () => {
    expect(MAPLIBRE_JS.integridade).toMatch(/^sha512-[A-Za-z0-9+/=]{80,}$/);
    expect(MAPLIBRE_CSS.integridade).toMatch(/^sha512-[A-Za-z0-9+/=]{80,}$/);
  });

  it("o mapa é o OpenFreeMap, e a atribuição credita o OpenStreetMap", () => {
    expect(ESTILO_DO_MAPA).toBe("https://tiles.openfreemap.org/styles/liberty");
    expect(ATRIBUICAO_DO_MAPA).toContain("OpenStreetMap");
    expect(ATRIBUICAO_DO_MAPA).toContain("OpenFreeMap");
  });

  /*
    A política de segurança do site (vercel.json) tem de deixar passar o que o
    MapLibre precisa: o script do cdnjs, os workers em blob: e os dados.
  */
  it("a política de segurança do site deixa-o funcionar", () => {
    const vercel = readFileSync("vercel.json", "utf8");
    expect(vercel).toMatch(/script-src[^;]*https:\/\/cdnjs\.cloudflare\.com/);
    expect(vercel).toMatch(/style-src[^;]*https:\/\/cdnjs\.cloudflare\.com/);
    expect(vercel).toMatch(/worker-src[^;]*blob:/);
    expect(vercel).toMatch(/connect-src[^;]*https:/);
  });
});

/*
  Um documento de mentira: o que interessa é o que se pede ao navegador — o
  script com integridade, a folha uma vez só —, não o navegador em si.
*/
function documentoDeMentira({ webgl = true } = {}) {
  const anexados = [];
  const documento = {
    anexados,
    createElement(tag) {
      if (tag === "canvas") {
        return { getContext: () => (webgl ? {} : null) };
      }
      return { tagName: tag.toUpperCase(), dataset: {} };
    },
    querySelector: (seletor) =>
      anexados.find((e) =>
        seletor.startsWith("link") ? e.tagName === "LINK" : false,
      ) || null,
    head: { append: (e) => anexados.push(e) },
  };
  return documento;
}

describe("o carregamento sob demanda", () => {
  it("sem WebGL, falha — e o mapa fica no OpenStreetMap em imagem", async () => {
    esquecerCarregamento();
    await expect(
      carregarMaplibre({
        documento: documentoDeMentira({ webgl: false }),
        janela: {},
      }),
    ).rejects.toThrow(/WebGL/);
  });

  it("pede o script com integridade e a folha uma vez", async () => {
    esquecerCarregamento();
    const documento = documentoDeMentira();
    const janela = {};
    const promessa = carregarMaplibre({ documento, janela, esperaMs: 1000 });
    const script = documento.anexados.find((e) => e.tagName === "SCRIPT");
    const folha = documento.anexados.find((e) => e.tagName === "LINK");
    expect(script.src).toBe(MAPLIBRE_JS.url);
    expect(script.integrity).toBe(MAPLIBRE_JS.integridade);
    expect(script.crossOrigin).toBe("anonymous");
    expect(folha.integrity).toBe(MAPLIBRE_CSS.integridade);

    janela.maplibregl = { marca: 1 };
    script.onload();
    await expect(promessa).resolves.toEqual({ marca: 1 });
  });

  it("os dois mapas partilham o mesmo carregamento", () => {
    esquecerCarregamento();
    const documento = documentoDeMentira();
    const a = carregarMaplibre({ documento, janela: {} });
    const b = carregarMaplibre({ documento, janela: {} });
    expect(a).toBe(b);
    a.catch(() => {});
  });

  it("se já está na página, não pede nada", async () => {
    esquecerCarregamento();
    const documento = documentoDeMentira();
    await carregarMaplibre({ documento, janela: { maplibregl: "já" } });
    expect(documento.anexados).toHaveLength(0);
  });
});

/*
  Um Leaflet e um MapLibre de mentira, com o mínimo que a camada usa. Cada
  chamada fica registada, para medir a ORDEM — é ela que impede o fundo de
  saltar um quadro no fim de cada arrasto.
*/
function montar() {
  const registo = [];
  const ponto = (x, y) => ({
    x,
    y,
    round: () => ponto(Math.round(x), Math.round(y)),
  });
  const L = {
    Layer: {
      extend(proto) {
        function Camada(opcoes) {
          this.initialize(opcoes);
        }
        Camada.prototype = { ...proto };
        return Camada;
      },
    },
    setOptions(obj, opcoes) {
      obj.options = { ...obj.options, ...opcoes };
    },
    Browser: { any3d: true },
    DomUtil: {
      create: () => {
        const el = document.createElement("div");
        return el;
      },
      addClass: (el, c) => el.classList.add(c),
      setPosition: (el, p) => registo.push(["setPosition", p.x, p.y]),
      setTransform: (el, p, escala) => registo.push(["setTransform", escala]),
    },
    latLngBounds: (a, b) => ({ a, b }),
  };
  const painel = document.createElement("div");
  document.body.append(painel);
  const map = {
    options: { zoomAnimation: true },
    getSize: () => ({ x: 1000, y: 600 }),
    getCenter: () => ({ lat: -13.55, lng: -52.27 }),
    getZoom: () => 12,
    getPane: () => painel,
    containerPointToLayerPoint: ([x, y]) => ponto(x + 5, y + 5),
    containerPointToLatLng: ([x, y]) => ({ lat: y, lng: x }),
    getZoomScale: () => 2,
    _latLngBoundsToNewLayerBounds: () => ({ min: ponto(1, 1) }),
  };
  const eventos = {};
  const gl = {
    once: (e, fn) => (eventos[`once:${e}`] = fn),
    on: (e, fn) => (eventos[e] = fn),
    jumpTo: (o) => registo.push(["jumpTo", o.center, o.zoom]),
    redraw: () => registo.push(["redraw"]),
    resize: () => registo.push(["resize"]),
  };
  const maplibregl = {
    Map: vi.fn(function (opcoes) {
      registo.push(["new Map", opcoes.zoom, opcoes.interactive]);
      return gl;
    }),
  };
  const aoFicarPronto = vi.fn();
  const aoFalhar = vi.fn();
  const camada = criarCamadaVetorial(L, maplibregl, {
    aoFicarPronto,
    aoFalhar,
  });
  camada.onAdd(map);
  return { camada, registo, eventos, maplibregl, aoFicarPronto, aoFalhar };
}

describe("a camada vetorial no Leaflet", () => {
  it("cria o MapLibre sem interação própria, um zoom abaixo", () => {
    const { registo, maplibregl } = montar();
    expect(maplibregl.Map).toHaveBeenCalledTimes(1);
    expect(registo.find((r) => r[0] === "new Map")).toEqual([
      "new Map",
      11,
      false,
    ]);
  });

  /*
    O fundo salta um quadro se a caixa se mexer antes de o MapLibre desenhar o
    enquadramento novo. A ordem é: jumpTo, redraw, e só então setPosition.
  */
  it("no fim do arrasto: enquadra, desenha, e só então move a caixa", () => {
    const { camada, registo } = montar();
    registo.length = 0;
    camada._atualizar();
    const ordem = registo.map((r) => r[0]);
    expect(ordem.indexOf("jumpTo")).toBeGreaterThan(-1);
    expect(ordem.indexOf("redraw")).toBeGreaterThan(ordem.indexOf("jumpTo"));
    expect(ordem.lastIndexOf("setPosition")).toBeGreaterThan(
      ordem.indexOf("redraw"),
    );
  });

  it("só redimensiona o MapLibre quando o tamanho muda", () => {
    const { camada, registo } = montar();
    registo.length = 0;
    camada._atualizar();
    expect(registo.some((r) => r[0] === "resize")).toBe(false);
  });

  it("durante a animação de zoom, escala por CSS", () => {
    const { camada, registo } = montar();
    registo.length = 0;
    camada._animarZoom({ zoom: 13, center: {} });
    expect(registo).toEqual([["setTransform", 2]]);
  });

  it("avisa quando desenhou", () => {
    const { camada, eventos, aoFicarPronto } = montar();
    expect(camada.estaPronta()).toBe(false);
    eventos["once:load"]();
    expect(aoFicarPronto).toHaveBeenCalledTimes(1);
    expect(camada.estaPronta()).toBe(true);
  });

  // Antes de desenhar, um erro é o estilo que não veio: volta-se ao raster.
  it("um erro antes de desenhar é falha; depois, é um azulejo passageiro", () => {
    const antes = montar();
    antes.eventos.error({ error: new Error("estilo") });
    expect(antes.aoFalhar).toHaveBeenCalledTimes(1);

    const depois = montar();
    depois.eventos["once:load"]();
    depois.eventos.error({ error: new Error("azulejo") });
    expect(depois.aoFalhar).not.toHaveBeenCalled();
  });

  it("não fica no mapa com eventos de ponteiro", () => {
    const css = readFileSync("src/styles/map-base-layer-switcher.css", "utf8");
    const regra = css.slice(css.indexOf(".agsus-mapa-vetorial,"));
    expect(regra.slice(0, 300)).toContain("pointer-events: none");
    expect(regra.slice(0, 300)).toContain("position: absolute");
  });
});

describe("o seletor Mapa / Satélite", () => {
  const seletor = readFileSync(
    "src/modules/map-base-layer-switcher.js",
    "utf8",
  );

  /*
    O vetorial não se etiqueta como "map": o raster do OSM continua a ser o
    fundo "map" guardado, para onde se volta se o vetorial falhar.
  */
  it("o OpenStreetMap em imagem fica guardado como reserva", () => {
    expect(seletor).toContain("camada.__agsusBaseMapKind = KIND_VETORIAL");
    expect(seletor).toContain('const KIND_VETORIAL = "vetorial"');
  });

  it("o vetorial só nos mapas da Saúde Indígena", () => {
    expect(seletor).toContain(
      "if (isHealthMapElement(map.getContainer?.())) iniciarMapaVetorial(L, map);",
    );
  });

  it("ir para o satélite tira o vetorial e põe os nomes", () => {
    const ramo = seletor.slice(
      seletor.indexOf("if (mode === MODE_SATELLITE) {\n      findLayers"),
      seletor.indexOf(
        "} else {",
        seletor.indexOf("if (mode === MODE_SATELLITE) {\n      findLayers"),
      ),
    );
    expect(ramo).toContain("map.removeLayer(map.__agsusVectorLayer)");
    expect(ramo).toContain("getRotulosDoSatelite(L, map)");
  });

  it("voltar ao mapa solta o teto do satélite", () => {
    expect(seletor).toContain(
      "soltarTetoDoSatelite(map);\n      aplicarFundoDoMapa(map);",
    );
  });
});
