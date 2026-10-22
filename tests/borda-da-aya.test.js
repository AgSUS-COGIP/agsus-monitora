import { describe, expect, it } from "vitest";
import {
  bordaEncostada,
  ehBordaDaAya,
  ENCOSTO_PX,
  lerPosicaoDaAya,
  passoDaSeta,
  PASSO_DO_TECLADO_PX,
} from "../src/lib/borda-da-aya.ts";

/*
  A Aya escondida na borda (src/lib/borda-da-aya.ts): qual borda vale ao
  soltar, as setas como alternativa ao arraste e a posição guardada.
*/

const janela = {
  largura: 56,
  altura: 56,
  larguraDaJanela: 1000,
  alturaDaJanela: 700,
  margem: 8,
};

describe("bordaEncostada", () => {
  it("longe das bordas: não se esconde", () => {
    expect(bordaEncostada({ ...janela, left: 400, top: 300 })).toBeNull();
  });

  it("encostada (até ENCOSTO_PX do limite) ou empurrada além dele", () => {
    expect(bordaEncostada({ ...janela, left: 8 + ENCOSTO_PX, top: 300 })).toBe(
      "esquerda",
    );
    expect(
      bordaEncostada({ ...janela, left: 8 + ENCOSTO_PX + 1, top: 300 }),
    ).toBeNull();
    expect(bordaEncostada({ ...janela, left: -40, top: 300 })).toBe("esquerda");
    expect(bordaEncostada({ ...janela, left: 1000 - 8 - 56, top: 300 })).toBe(
      "direita",
    );
    expect(bordaEncostada({ ...janela, left: 400, top: 2 })).toBe("topo");
    expect(bordaEncostada({ ...janela, left: 400, top: 700 })).toBe("baixo");
  });

  it("no canto, vale a mais empurrada; no empate, a lateral", () => {
    expect(bordaEncostada({ ...janela, left: 8, top: -30 })).toBe("topo");
    expect(bordaEncostada({ ...janela, left: -30, top: 8 })).toBe("esquerda");
    expect(bordaEncostada({ ...janela, left: 8, top: 8 })).toBe("esquerda");
  });
});

describe("passoDaSeta", () => {
  it("as quatro setas; Shift anda quatro vezes mais; outras teclas, nada", () => {
    expect(passoDaSeta("ArrowLeft")).toEqual({
      dx: -PASSO_DO_TECLADO_PX,
      dy: 0,
    });
    expect(passoDaSeta("ArrowDown", true)).toEqual({
      dx: 0,
      dy: PASSO_DO_TECLADO_PX * 4,
    });
    expect(passoDaSeta("Enter")).toBeNull();
  });
});

describe("lerPosicaoDaAya", () => {
  it("lê posição e borda; ignora borda desconhecida e texto torto", () => {
    expect(lerPosicaoDaAya('{"left":10,"top":20}')).toEqual({
      left: 10,
      top: 20,
    });
    expect(lerPosicaoDaAya('{"left":10,"top":20,"borda":"direita"}')).toEqual({
      left: 10,
      top: 20,
      borda: "direita",
    });
    expect(lerPosicaoDaAya('{"left":10,"top":20,"borda":"meio"}')).toEqual({
      left: 10,
      top: 20,
    });
    expect(lerPosicaoDaAya('{"left":"x","top":20}')).toBeNull();
    expect(lerPosicaoDaAya("{")).toBeNull();
    expect(lerPosicaoDaAya(null)).toBeNull();
    expect(ehBordaDaAya("topo")).toBe(true);
    expect(ehBordaDaAya(3)).toBe(false);
  });
});
