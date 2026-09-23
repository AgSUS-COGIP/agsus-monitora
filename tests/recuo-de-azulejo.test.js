import { describe, expect, it, vi } from "vitest";
import {
  RECUO_MAXIMO,
  azulejoDoRecuo,
  podeRecuar,
  semAzulejoDeAviso,
} from "../src/lib/recuo-de-azulejo.js";
import { criarCamadaComRecuo } from "../src/modules/map-base-layer-switcher.js";

/*
  "QUANDO DOU MUITO ZOOM A IMAGEM QUEBRA"

  No satélite, acima do zoom 17 nos territórios indígenas, a Esri devolvia um
  azulejo pronto escrito "Map data not yet available" (HTTP 200, 2.521 bytes).
  Medido no Xingu, no Yanomami e no Vale do Javari; em Maceió há foto até 19.
*/
describe("a conta do recuo", () => {
  it("sem recuo, é o próprio azulejo", () => {
    expect(azulejoDoRecuo({ x: 10, y: 20, z: 18 }, 0)).toEqual({
      x: 10,
      y: 20,
      z: 18,
      escala: 1,
      dx: 0,
      dy: 0,
    });
  });

  it("um nível acima, cada azulejo é um quarto do de cima", () => {
    // (11, 21) no zoom 18 é o quadrante inferior direito de (5, 10) no 17.
    expect(azulejoDoRecuo({ x: 11, y: 21, z: 18 }, 1)).toEqual({
      x: 5,
      y: 10,
      z: 17,
      escala: 2,
      dx: 1,
      dy: 1,
    });
    expect(azulejoDoRecuo({ x: 10, y: 20, z: 18 }, 1)).toMatchObject({
      dx: 0,
      dy: 0,
    });
  });

  it("dois níveis acima, um dezasseis avos", () => {
    expect(azulejoDoRecuo({ x: 23, y: 6, z: 19 }, 2)).toEqual({
      x: 5,
      y: 1,
      z: 17,
      escala: 4,
      dx: 3,
      dy: 2,
    });
  });

  it("pára no máximo de recuos e no zoom mínimo", () => {
    const c = { x: 0, y: 0, z: 18 };
    expect(podeRecuar(c, 0)).toBe(true);
    expect(podeRecuar(c, RECUO_MAXIMO)).toBe(false);
    expect(podeRecuar({ x: 0, y: 0, z: 1 }, 0, 1)).toBe(false);
  });

  it("desliga o aviso em forma de imagem, sem duplicar", () => {
    expect(semAzulejoDeAviso("https://x/tile/1/2/3")).toBe(
      "https://x/tile/1/2/3?blankTile=false",
    );
    expect(semAzulejoDeAviso("https://x/tile?a=1")).toBe(
      "https://x/tile?a=1&blankTile=false",
    );
    expect(semAzulejoDeAviso("https://x/t?blankTile=false")).toBe(
      "https://x/t?blankTile=false",
    );
  });
});

/*
  Um Leaflet de mentira, só com o que a camada usa: `TileLayer.extend`, o
  molde de URL e o tamanho do azulejo. O jsdom não carrega imagem nenhuma; os
  eventos de carga e de erro disparam-se à mão, que é o que interessa medir.
*/
function leafletDeMentira() {
  const removidos = [];
  const TileLayer = {
    prototype: {
      _removeTile(key) {
        removidos.push(key);
      },
    },
    extend(proto) {
      function Camada(url, options) {
        this._url = url;
        this.options = options;
        this._tiles = {};
      }
      Camada.prototype = Object.assign(Object.create(TileLayer.prototype), {
        getTileSize: () => ({ x: 256, y: 256 }),
        ...proto,
      });
      return Camada;
    },
  };
  return {
    removidos,
    TileLayer,
    Util: {
      template: (molde, dados) =>
        molde.replace(/\{(\w+)\}/g, (_, chave) => dados[chave]),
      extend: Object.assign,
      emptyImageUrl: "data:,",
    },
  };
}

const URL_ESRI = "https://esri/tile/{z}/{y}/{x}";

describe("a camada de satélite com recuo", () => {
  it("pede o azulejo com o aviso desligado", () => {
    const L = leafletDeMentira();
    const camada = criarCamadaComRecuo(L, URL_ESRI, { minZoom: 0 });
    const caixa = camada.createTile({ x: 11, y: 21, z: 18 }, vi.fn());
    expect(caixa.firstChild.src).toBe(
      "https://esri/tile/18/21/11?blankTile=false",
    );
  });

  /*
    O caso do print: zoom 18 no Xingu, sem foto. Sobe para o 17, amplia 2x e
    desloca até o quadrante certo — e o Leaflet não fica a saber de erro
    nenhum, senão ao quarto trocava o satélite pelo mapa comum.
  */
  it("sem foto no nível pedido, usa a do nível de cima, recortada", () => {
    const L = leafletDeMentira();
    const done = vi.fn();
    const camada = criarCamadaComRecuo(L, URL_ESRI, { minZoom: 0 });
    const caixa = camada.createTile({ x: 11, y: 21, z: 18 }, done);
    const img = caixa.firstChild;

    img.onerror();

    expect(img.src).toBe("https://esri/tile/17/10/5?blankTile=false");
    expect(img.style.width).toBe("512px");
    expect(img.style.height).toBe("512px");
    expect(img.style.transform).toBe("translate(-256px, -256px)");
    expect(caixa.style.overflow).toBe("hidden");
    expect(done).not.toHaveBeenCalled();

    img.onload();
    expect(done).toHaveBeenCalledWith(null, caixa);
    expect(caixa.complete).toBe(true);
  });

  it("só avisa erro depois de esgotar o recuo", () => {
    const L = leafletDeMentira();
    const done = vi.fn();
    const camada = criarCamadaComRecuo(L, URL_ESRI, { minZoom: 0 });
    const img = camada.createTile({ x: 100, y: 100, z: 18 }, done).firstChild;

    for (let i = 0; i < RECUO_MAXIMO; i += 1) {
      img.onerror();
      expect(done).not.toHaveBeenCalled();
    }
    img.onerror();
    expect(done).toHaveBeenCalledTimes(1);
    expect(done.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it("a imagem não é encolhida pelo CSS global de imagens", () => {
    const L = leafletDeMentira();
    const img = criarCamadaComRecuo(L, URL_ESRI, {}).createTile(
      { x: 0, y: 0, z: 18 },
      vi.fn(),
    ).firstChild;
    expect(img.style.maxWidth).toBe("none");
  });

  it("ao remover o azulejo, o pedido em curso é cancelado", () => {
    const L = leafletDeMentira();
    const camada = criarCamadaComRecuo(L, URL_ESRI, {});
    const caixa = camada.createTile({ x: 0, y: 0, z: 18 }, vi.fn());
    camada._tiles["0:0:18"] = { el: caixa };
    camada._removeTile("0:0:18");
    expect(caixa.firstChild.getAttribute("src")).toBe("data:,");
    expect(caixa.firstChild.onload).toBeNull();
    expect(L.removidos).toEqual(["0:0:18"]);
  });
});
