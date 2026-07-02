import { describe, expect, it } from "vitest";
import { formatDateBR, formatNumberBR } from "../../src/lib/formatters.js";

describe("formatters", () => {
  it("formata datas ISO para pt-BR", () => {
    expect(formatDateBR("2026-07-01")).toBe("01/07/2026");
  });

  it("formata numeros em pt-BR", () => {
    expect(formatNumberBR(1234567)).toBe("1.234.567");
  });
});
