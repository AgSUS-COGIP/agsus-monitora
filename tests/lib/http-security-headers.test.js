import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function loadConfig() {
  const configPath = resolve(process.cwd(), "vercel.json");
  return JSON.parse(readFileSync(configPath, "utf8"));
}

function headersForSource(config, source) {
  const rule = config.headers?.find(item => item.source === source);
  return new Map((rule?.headers || []).map(header => [header.key, header.value]));
}

function effectiveHeaders(config, pathname) {
  return new Map([
    ...headersForSource(config, "/(.*)"),
    ...headersForSource(config, pathname)
  ]);
}

describe("cabeçalhos HTTP de segurança", () => {
  it("mantém a linha de base institucional", () => {
    const config = loadConfig();
    const headers = headersForSource(config, "/(.*)");

    expect(headers.get("Strict-Transport-Security")).toMatch(/max-age=31536000/);
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("X-Permitted-Cross-Domain-Policies")).toBe("none");
    expect(headers.get("X-XSS-Protection")).toBe("0");
  });

  it("desabilita recursos de navegador não utilizados", () => {
    const config = loadConfig();
    const permissions = headersForSource(config, "/(.*)").get("Permissions-Policy") || "";

    for (const directive of [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "browsing-topics=()"
    ]) {
      expect(permissions).toContain(directive);
    }
  });

  it("impede cache do callback OAuth sem perder os cabeçalhos globais", () => {
    const config = loadConfig();
    const headers = effectiveHeaders(config, "/auth/callback");

    expect(headers.get("Cache-Control")).toContain("no-store");
    expect(headers.get("Pragma")).toBe("no-cache");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
});
