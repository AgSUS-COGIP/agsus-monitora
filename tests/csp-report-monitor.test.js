import { describe, expect, it } from "vitest";
import {
  buildCspViolationDetails,
  sanitizeBlockedUri,
} from "../src/lib/csp-report-monitor.js";

describe("csp report monitor", () => {
  it("remove caminho e query de URLs bloqueadas", () => {
    expect(
      sanitizeBlockedUri("https://cdn.example.org/script.js?token=secret"),
    ).toBe("https://cdn.example.org");
  });

  it("preserva marcadores especiais do navegador", () => {
    expect(sanitizeBlockedUri("inline")).toBe("inline");
    expect(sanitizeBlockedUri("eval")).toBe("eval");
  });

  it("monta detalhes técnicos sem URL completa", () => {
    const details = buildCspViolationDetails({
      effectiveDirective: "script-src-elem",
      violatedDirective: "script-src",
      blockedURI: "https://cdn.example.org/app.js?token=secret",
      sourceFile: "https://app.example.org/index.html?code=private",
      disposition: "report",
      lineNumber: 20,
      columnNumber: 8,
    });

    expect(details.effective_directive).toBe("script-src-elem");
    expect(details.blocked_uri).toBe("https://cdn.example.org");
    expect(details.source_file_origin).toBe("https://app.example.org");
    expect(details.line_number).toBe(20);
    expect(JSON.stringify(details)).not.toContain("secret");
    expect(JSON.stringify(details)).not.toContain("private");
  });
});
