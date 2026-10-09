import { describe, expect, it } from "vitest";
import {
  ALTURA_DA_PAGINA,
  escalaParaLargura,
  LARGURA_DA_FOLHA,
  limitarEscala,
  proximoZoom,
  rotuloDoZoom,
  tamanhoEscalado,
} from "../../src/lib/classificacao/escala-da-previa.ts";

/* A escala da folha A4 na prévia "Como fica no SEI" (documento.tsx). */
describe("escala da prévia do SEI", () => {
  it("Ajustar: a folha cabe na largura da mesa (1366 px, celular)", () => {
    // Notebook 1366: modal ~1340, painel de 400 → mesa ~940.
    expect(escalaParaLargura(940)).toBe(1.14);
    // Painel recolhido: a folha cresce (até o limite de 200%).
    expect(escalaParaLargura(1340)).toBe(1.65);
    // Celular de 375 px: a folha inteira cabe (~43%); o zoom amplia.
    expect(escalaParaLargura(375)).toBe(0.43);
    expect(escalaParaLargura(100)).toBe(0.3);
    expect(escalaParaLargura(0)).toBe(1);
  });

  it("zoom − / + anda pelos passos e para nos limites", () => {
    expect(proximoZoom(1, 1)).toBe(1.1);
    expect(proximoZoom(1, -1)).toBe(0.9);
    expect(proximoZoom(1.14, 1)).toBe(1.25);
    expect(proximoZoom(1.14, -1)).toBe(1.1);
    expect(proximoZoom(2, 1)).toBe(2);
    expect(proximoZoom(0.5, -1)).toBe(0.5);
    expect(proximoZoom(0.43, 1)).toBe(0.5);
    expect(limitarEscala(9)).toBe(2);
    expect(limitarEscala(Number.NaN)).toBe(1);
    expect(rotuloDoZoom(0.67)).toBe("67%");
  });

  it("a área escalada acompanha a folha (no mínimo uma página A4)", () => {
    expect(tamanhoEscalado(0, 1)).toEqual({
      largura: LARGURA_DA_FOLHA,
      altura: ALTURA_DA_PAGINA,
    });
    expect(tamanhoEscalado(3000, 0.5)).toEqual({ largura: 397, altura: 1500 });
  });
});
