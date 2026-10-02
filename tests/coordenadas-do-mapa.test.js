import { describe, expect, it } from "vitest";
import {
  lerCoordenada,
  pontosEditaveisDoMapa,
  validarCorrecaoDoMapa,
} from "../src/lib/coordenadas-do-mapa.js";

describe("coordenadas do mapa", () => {
  it("separa pontos de mesmo nome pelo endereço exato da fonte e preserva posição sem coordenada", () => {
    const pontos = pontosEditaveisDoMapa(
      {
        dsei: [
          {
            k: "A",
            n: "Distrito A",
            lat: -10,
            lon: -50,
            polos: [
              { n: "Igual", lat: null, lon: null },
              { n: "Igual", cod: 44, lat: -11, lon: -51 },
            ],
          },
          { k: "B", n: "Outro", polos: [] },
        ],
      },
      { rede: { A: { u: [["Igual", "0012", -10, -50]] } } },
      "A",
    );
    expect(pontos).toHaveLength(4);
    expect(new Set(pontos.map((p) => p.id)).size).toBe(4);
    expect(pontos[1].latitude).toBeNull();
    expect(pontos[2].alvo).toMatchObject({
      fonte: "lmap",
      tipo: "polo",
      indice: 1,
      codigo: "44",
    });
    expect(pontos[3].alvo).toMatchObject({
      fonte: "rede_cnes",
      tipo: "u",
      codigo: "0012",
    });
  });
  it("inclui CASAIs nacionais apenas no catálogo nacional", () => {
    const lmap = { casai: [{ n: "CASAI A", lat: -15, lon: -47 }] };
    const rede = { nac: [["CASAI A", "001", -15, -47]] };
    expect(pontosEditaveisDoMapa(lmap, rede).map((p) => p.alvo.tipo)).toEqual([
      "casai",
      "nac",
    ]);
    expect(pontosEditaveisDoMapa(lmap, rede, "A")).toEqual([]);
  });
  it("aceita decimal com vírgula, recusa branco, símbolos e fora do Brasil", () => {
    expect(lerCoordenada(" -12,34 ")).toBe(-12.34);
    for (const valor of ["", " ", "abc", "Infinity", "-12.3.4"])
      expect(lerCoordenada(valor)).toBeNaN();
    expect(validarCorrecaoDoMapa(-10, -50, "Fonte oficial consultada")).toBe(
      "",
    );
    expect(
      validarCorrecaoDoMapa(45, -50, "Fonte oficial consultada"),
    ).toContain("Brasil");
    expect(validarCorrecaoDoMapa(-10, -50, "curto")).toContain("motivo");
  });
});
