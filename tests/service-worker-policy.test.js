import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

function loadPolicy() {
  const source = readFileSync(resolve(process.cwd(), "sw-policy.js"), "utf8");
  const context = { self: {} };
  vm.runInNewContext(source, context);
  return context.self.AgSUSPwaCachePolicy;
}

describe("service worker cache policy", () => {
  const policy = loadPolicy();

  it("prioriza rede para navegação, scripts e estilos", () => {
    expect(policy.getRequestStrategy({ mode: "navigate" })).toBe(
      "network-first",
    );
    expect(policy.getRequestStrategy({ destination: "script" })).toBe(
      "network-first",
    );
    expect(policy.getRequestStrategy({ destination: "style" })).toBe(
      "network-first",
    );
  });

  it("mantém cache-first para recursos visuais estáticos", () => {
    expect(policy.getRequestStrategy({ destination: "image" })).toBe(
      "cache-first",
    );
    expect(policy.getRequestStrategy({ destination: "font" })).toBe(
      "cache-first",
    );
  });

  it("não armazena respostas privadas ou no-store", () => {
    const response = (cacheControl) => ({
      ok: true,
      type: "basic",
      headers: { get: () => cacheControl },
    });

    expect(policy.isResponseCacheable(response("public, max-age=3600"))).toBe(
      true,
    );
    expect(policy.isResponseCacheable(response("private, max-age=0"))).toBe(
      false,
    );
    expect(policy.isResponseCacheable(response("no-store"))).toBe(false);
  });

  it("o cache tem limite: saem as entradas mais antigas, nunca as do app shell", () => {
    const urls = ["/", "/index.html", "/a.js", "/b.js", "/c.js", "/d.js"];
    expect(
      policy.entriesBeyondLimit(urls, {
        limit: 4,
        keep: ["/", "/index.html"],
      }),
    ).toEqual(["/a.js", "/b.js"]);
    expect(policy.entriesBeyondLimit(urls, { limit: 10 })).toEqual([]);
  });
});

describe("versão do cache do service worker", () => {
  it("o build troca o nome do cache pela versão publicada", async () => {
    const { swComVersao } =
      await import("../src/lib/cache-do-service-worker.js");
    const fonte = readFileSync(resolve(process.cwd(), "sw.js"), "utf8");
    const publicado = swComVersao(fonte, "abc123");
    expect(publicado).toContain(
      'const CACHE_VERSION = "agsus-monitora-abc123";',
    );
    expect(publicado).not.toContain("agsus-monitora-dev");
  });
});
