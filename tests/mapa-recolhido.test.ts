import { describe, expect, it } from "vitest";
import {
  CHAVE_DO_MAPA_RECOLHIDO,
  lerMapaRecolhido,
  valorDoMapaRecolhido,
} from "../src/lib/mapa-recolhido.ts";

/* O mapa da Visão geral recolhido ou aberto (src/lib/mapa-recolhido.ts). */

describe("mapa recolhido", () => {
  it("aberto é o padrão: sem nada guardado ou com valor estranho", () => {
    expect(lerMapaRecolhido(null)).toBe(false);
    expect(lerMapaRecolhido(undefined)).toBe(false);
    expect(lerMapaRecolhido("")).toBe(false);
    expect(lerMapaRecolhido("true")).toBe(false);
  });

  it("guarda e lê de volta a escolha", () => {
    expect(lerMapaRecolhido(valorDoMapaRecolhido(true))).toBe(true);
    expect(valorDoMapaRecolhido(false)).toBeNull();
  });

  it("a chave é própria do Yeendé", () => {
    expect(CHAVE_DO_MAPA_RECOLHIDO).toMatch(/^agsus_yeende_/);
  });
});
