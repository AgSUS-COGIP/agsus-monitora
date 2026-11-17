import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

function loadPolicy() {
  const source = readFileSync(resolve(process.cwd(), "sw-policy.js"), "utf8");
  const context = { self: {}, URL };
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

  it("o cache tem limite: saem as entradas mais antigas que entraram pelo uso", () => {
    const urls = ["/", "/index.html", "/a.js", "/b.js", "/c.js", "/d.js"];
    expect(
      policy.entriesBeyondLimit(urls, {
        limit: 2,
        keep: ["/", "/index.html"],
      }),
    ).toEqual(["/a.js", "/b.js"]);
    expect(policy.entriesBeyondLimit(urls, { limit: 10 })).toEqual([]);
  });

  it("os arquivos guardados na instalação não saem nem ocupam o limite", () => {
    const guardados = Array.from({ length: 200 }, (_, i) => `/assets/t${i}.js`);
    const urls = ["/", ...guardados, "/img/a.png", "/img/b.png", "/img/c.png"];
    const keep = ["/", ...guardados];

    expect(policy.entriesBeyondLimit(urls, { limit: 150, keep })).toEqual([]);
    expect(policy.entriesBeyondLimit(urls, { limit: 2, keep })).toEqual([
      "/img/a.png",
    ]);
  });

  it("reconhece o arquivo com o hash do Vite no nome", () => {
    expect(policy.isHashedAsset("/assets/estado-DDQIcVp4.js")).toBe(true);
    expect(
      policy.isHashedAsset("https://yeende.app/assets/main-CQ0xKEuX.css"),
    ).toBe(true);
    expect(policy.isHashedAsset("/assets/usar-filtros-Bz6En5IR.js")).toBe(true);
    expect(policy.isHashedAsset("/assets/agsus-logo.webp")).toBe(false);
    expect(policy.isHashedAsset("/assets/access-background-default.svg")).toBe(
      false,
    );
    expect(policy.isHashedAsset("/fonts/geist-latin.woff2")).toBe(false);
    expect(policy.isHashedAsset("/sw-policy.js")).toBe(false);
  });
});

describe("versão do cache do service worker", () => {
  it("o build troca o nome do cache pela versão publicada", async () => {
    const { swComVersao } = await import("../src/lib/cache-do-service-worker");
    const fonte = readFileSync(resolve(process.cwd(), "sw.js"), "utf8");
    const publicado = swComVersao(fonte, "abc123");
    expect(publicado).toContain(
      'const CACHE_VERSION = "agsus-monitora-abc123";',
    );
    expect(publicado).not.toContain("agsus-monitora-dev");
  });

  it("o build grava no sw.js a lista dos arquivos guardados na instalação", async () => {
    const { swComVersao } = await import("../src/lib/cache-do-service-worker");
    const fonte = readFileSync(resolve(process.cwd(), "sw.js"), "utf8");
    expect(fonte).toContain("const PRECACHE = [];");
    const publicado = swComVersao(fonte, "abc123", ["/assets/a-12345678.js"]);
    expect(publicado).toContain('const PRECACHE = ["/assets/a-12345678.js"];');
  });

  it("guarda código, estilo, fonte e imagem; deixa de fora os JSON dos mapas", async () => {
    const { arquivosParaGuardar } =
      await import("../src/lib/cache-do-service-worker");
    expect(
      arquivosParaGuardar([
        "assets/main-CQ0xKEuX.css",
        "assets/telas-DDQIcVp4.js",
        "assets\\agsus-logo.webp",
        "fonts/geist-latin.woff2",
        "/icons/agsus-monitora.svg",
        "data/terras-indigenas.json",
        "assets/modelo-importacao-lista-aprovados.xlsx",
        "assets/main-DwO2Aiew.js.map",
        "index.html",
        "versao.json",
        "assets/telas-DDQIcVp4.js",
      ]),
    ).toEqual([
      "/assets/agsus-logo.webp",
      "/assets/main-CQ0xKEuX.css",
      "/assets/telas-DDQIcVp4.js",
      "/fonts/geist-latin.woff2",
      "/icons/agsus-monitora.svg",
    ]);
  });
});
