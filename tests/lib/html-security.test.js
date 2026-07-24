import { describe, expect, it } from "vitest";
import { createHtmlSecurityPlugin, stripSupabaseCdnScripts } from "../../src/lib/html-security.js";

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
    const html = "<script defer src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1'></script>";

    expect(stripSupabaseCdnScripts(html)).not.toContain("supabase-js");
  });

  it("expõe a transformação como plugin do Vite", () => {
    const plugin = createHtmlSecurityPlugin();
    const html = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';

    expect(plugin.name).toBe("agsus-html-security");
    expect(plugin.enforce).toBe("pre");
    expect(plugin.transformIndexHtml(html)).not.toContain("supabase-js");
  });
});
