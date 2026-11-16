import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface HeaderRule {
  source: string;
  headers?: { key: string; value: string }[];
}

interface VercelConfig {
  headers?: HeaderRule[];
}

function loadConfig(): VercelConfig {
  const configPath = resolve(process.cwd(), "vercel.json");
  return JSON.parse(readFileSync(configPath, "utf8"));
}

function headersForSource(config: VercelConfig, source: string) {
  const rule = config.headers?.find((item) => item.source === source);
  return new Map(
    (rule?.headers || []).map((header) => [header.key, header.value]),
  );
}

function effectiveHeaders(config: VercelConfig, pathname: string) {
  return new Map([
    ...headersForSource(config, "/(.*)"),
    ...headersForSource(config, pathname),
  ]);
}

describe("cabeçalhos HTTP de segurança", () => {
  it("mantém a linha de base institucional", () => {
    const config = loadConfig();
    const headers = headersForSource(config, "/(.*)");

    expect(headers.get("Strict-Transport-Security")).toMatch(
      /max-age=31536000/,
    );
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("X-Permitted-Cross-Domain-Policies")).toBe("none");
    expect(headers.get("X-XSS-Protection")).toBe("0");
  });

  /*
    Proteção contra clickjacking (verificação de segurança de 21/10/2026): só
    a própria origem embute o MONITORA (o painel em iframe é da mesma origem).
    O X-Frame-Options e o frame-ancestors da CSP (aplicada desde 16/11/2026)
    dizem o mesmo; navegador antigo lê o primeiro.
  */
  it("não deixa outro site embutir o Yeendé em moldura", () => {
    const config = loadConfig();
    const headers = headersForSource(config, "/(.*)");

    expect(headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'self'",
    );
    expect(
      effectiveHeaders(config, "/auth/callback").get("X-Frame-Options"),
    ).toBe("SAMEORIGIN");
  });

  /*
    Revisão de segurança de 16/11/2026: a CSP passou de Report-Only a
    aplicada. Em um mês de relatórios (TL_EVENTO_ACESSO,
    `csp_report_only_violation`) a produção não teve violação; a única, em
    localhost, era `fetch` de `blob:` — por isso `blob:` entra em connect-src
    e em frame-src (PDF gerado no navegador mostrado em quadro).
  */
  it("aplica a CSP e não a deixa só em relatório", () => {
    const config = loadConfig();
    const headers = headersForSource(config, "/(.*)");
    const csp = headers.get("Content-Security-Policy") || "";
    const diretiva = (nome: string) =>
      csp
        .split(";")
        .map((parte) => parte.trim())
        .find((parte) => parte.startsWith(`${nome} `)) || "";

    expect(headers.has("Content-Security-Policy-Report-Only")).toBe(false);
    expect(diretiva("object-src")).toBe("object-src 'none'");
    expect(diretiva("base-uri")).toBe("base-uri 'self'");
    expect(diretiva("form-action")).toBe("form-action 'self'");
    expect(diretiva("connect-src")).toContain("blob:");
    expect(diretiva("frame-src")).toContain("blob:");
    // Script só da própria origem, do Google Analytics e do cdnjs (Leaflet com SRI).
    expect(diretiva("script-src")).toBe(
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://cdnjs.cloudflare.com",
    );
    expect(diretiva("script-src")).not.toContain("unsafe-eval");
  });

  it("desabilita recursos de navegador não utilizados", () => {
    const config = loadConfig();
    const permissions =
      headersForSource(config, "/(.*)").get("Permissions-Policy") || "";

    for (const directive of [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "browsing-topics=()",
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
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });
});
