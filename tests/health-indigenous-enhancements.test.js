import { describe, expect, it } from "vitest";
import { normalizeHealthFilterValue } from "../src/modules/health-indigenous-enhancements.js";

describe("normalizeHealthFilterValue", () => {
  it("ignora acentos e diferencas entre maiusculas e minusculas", () => {
    expect(normalizeHealthFilterValue("  DSEI MÉDIO RIO PURUS  ")).toBe("dsei medio rio purus");
  });

  it("consolida espacos duplicados", () => {
    expect(normalizeHealthFilterValue("CASAI   São    Paulo")).toBe("casai sao paulo");
  });

  it("trata valores nulos sem falhar", () => {
    expect(normalizeHealthFilterValue(null)).toBe("");
    expect(normalizeHealthFilterValue(undefined)).toBe("");
  });
});
