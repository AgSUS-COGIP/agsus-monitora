import { describe, expect, it } from "vitest";
import {
  escapeAttr,
  escapeHtml,
  safeHttpUrl,
  sanitizeHtml,
} from "../../src/lib/sanitize.js";

describe("sanitize", () => {
  it("escapa HTML e atributos", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
    expect(escapeAttr("`x`")).toBe("&#096;x&#096;");
  });

  it("remove scripts ao sanitizar HTML", () => {
    expect(sanitizeHtml("<img src=x onerror=alert(1)>")).not.toContain(
      "onerror",
    );
  });

  it("bloqueia URLs perigosas", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBe("");
    expect(safeHttpUrl("https://agsus.example/app")).toBe(
      "https://agsus.example/app",
    );
  });
});
