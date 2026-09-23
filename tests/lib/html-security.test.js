import { describe, expect, it } from "vitest";
import {
  createHtmlSecurityPlugin,
  sanitizeAnalyticsPageLocation,
  secureHtmlDocument,
  stripSupabaseCdnScripts,
} from "../../src/lib/html-security.js";

describe("html security", () => {
  it("remove o script CDN do Supabase e preserva os demais scripts", () => {
    const html = `<!doctype html><html><head>
      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    </head></html>`;

    const result = stripSupabaseCdnScripts(html);

    expect(result).not.toContain("@supabase/supabase-js");
    expect(result).toContain("chart.js@4.4.1");
  });

  it("remove variantes com aspas simples e versão específica", () => {
    const html =
      "<script defer src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1'></script>";

    expect(stripSupabaseCdnScripts(html)).not.toContain("supabase-js");
  });

  it("remove query string e hash da localização enviada ao GA4", () => {
    const html = `gtag('config', 'G-TESTE', {
      page_title: document.title,
      page_location: window.location.href
    });`;

    const result = sanitizeAnalyticsPageLocation(html);

    expect(result).toContain(
      "page_location: window.location.origin + window.location.pathname",
    );
    expect(result).not.toContain("window.location.href");
  });

  it("aplica todas as proteções na transformação final", () => {
    const html = `
      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
      <script>gtag('config', 'G-TESTE', { page_location: window.location.href });</script>`;

    const result = secureHtmlDocument(html);

    expect(result).not.toContain("@supabase/supabase-js");
    expect(result).not.toContain("window.location.href");
    expect(result).toContain(
      "window.location.origin + window.location.pathname",
    );
  });

  it("expõe a transformação como plugin do Vite", () => {
    const plugin = createHtmlSecurityPlugin();
    const html =
      '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';

    expect(plugin.name).toBe("agsus-html-security");
    expect(plugin.enforce).toBe("pre");
    expect(plugin.transformIndexHtml(html)).not.toContain("supabase-js");
  });
});
