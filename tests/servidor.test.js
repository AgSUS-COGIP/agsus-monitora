import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { request } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import {
  caminhoDoEstatico,
  criarServidor,
  lerCabecalhosDaVercel,
} from "../server/servidor.ts";

/*
  Contrato do servidor web, herdado do antigo MonitoraRoutesTest.php do Laravel:
  páginas idênticas ao build, callback sem cache, nada fora da lista é entregue,
  sem escrita e com rota de saúde. Soma o que o Laravel não fazia: `/data/*.json`
  (o mapa depende dele) e cabeçalhos iguais aos da Vercel.

  Usa `node:http` e não `fetch`: o `fetch` global está bloqueado nos testes
  (tests/setup/rede-bloqueada.js), e aqui a conversa é só com 127.0.0.1.
*/

const PAGINAS = {
  "index.html":
    '<!doctype html><title>MONITORA</title><script src="/assets/main-AbCd1234.js"></script>',
  "analises.html": "<!doctype html><title>Análises</title>",
  "auth/callback.html": "<!doctype html><title>Callback</title>",
};

let dist;
let servidor;
let base;

function pedir(caminho, { method = "GET", headers = {} } = {}) {
  return new Promise((ok, falha) => {
    const req = request(`${base}${caminho}`, { method, headers }, (res) => {
      const partes = [];
      res.on("data", (parte) => partes.push(parte));
      res.on("end", () =>
        ok({
          status: res.statusCode,
          headers: res.headers,
          corpo: Buffer.concat(partes),
        }),
      );
    });
    req.on("error", falha);
    req.end();
  });
}

beforeAll(async () => {
  dist = mkdtempSync(join(tmpdir(), "monitora-dist-"));
  for (const [arquivo, conteudo] of Object.entries(PAGINAS)) {
    mkdirSync(join(dist, arquivo, ".."), { recursive: true });
    writeFileSync(join(dist, arquivo), conteudo);
  }
  mkdirSync(join(dist, "assets"));
  mkdirSync(join(dist, "data"));
  mkdirSync(join(dist, "icons"));
  writeFileSync(join(dist, "assets", "main-AbCd1234.js"), "console.log('ok');");
  writeFileSync(join(dist, "assets", "agsus-logo.webp"), "webp");
  writeFileSync(
    join(dist, "data", "terras-indigenas.json"),
    JSON.stringify({ terras: "x".repeat(4000) }),
  );
  writeFileSync(
    join(dist, "sw.js"),
    "self.addEventListener('fetch', () => {});",
  );
  writeFileSync(join(dist, ".env"), "SEGREDO=1");
  writeFileSync(join(dist, "CLAUDE.md"), "interno");
  writeFileSync(join(dist, "assets", ".escondido"), "x");

  const cabecalhos = lerCabecalhosDaVercel(
    resolve(process.cwd(), "vercel.json"),
  );
  servidor = criarServidor({ dist, cabecalhos });
  await new Promise((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

afterAll(async () => {
  await new Promise((fim) => servidor.close(fim));
  rmSync(dist, { recursive: true, force: true });
});

describe("servidor web do MONITORA", () => {
  it.each([
    ["/", "index.html"],
    ["/index.html", "index.html"],
    ["/analises", "analises.html"],
    ["/analises.html", "analises.html"],
    ["/auth/callback", "auth/callback.html"],
    ["/auth/callback.html", "auth/callback.html"],
  ])("entrega %s idêntica ao build (%s)", async (url, arquivo) => {
    const res = await pedir(url);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("text/html; charset=UTF-8");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(res.corpo.toString()).toBe(PAGINAS[arquivo]);
  });

  it("não deixa o callback ir para cache", async () => {
    const res = await pedir("/auth/callback");
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.headers.pragma).toBe("no-cache");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("usa os mesmos cabeçalhos de segurança da Vercel", async () => {
    const res = await pedir("/");
    const { globais } = lerCabecalhosDaVercel(
      resolve(process.cwd(), "vercel.json"),
    );
    for (const [nome, valor] of globais) {
      if (nome.toLowerCase() === "strict-transport-security") continue;
      expect(res.headers[nome.toLowerCase()]).toBe(valor);
    }
  });

  it("só manda HSTS quando a conexão chegou por HTTPS", async () => {
    expect(
      (await pedir("/")).headers["strict-transport-security"],
    ).toBeUndefined();
    const viaProxy = await pedir("/", {
      headers: { "X-Forwarded-Proto": "https" },
    });
    expect(viaProxy.headers["strict-transport-security"]).toMatch(
      /max-age=31536000/,
    );
  });

  it.each([
    "/.env",
    "/CLAUDE.md",
    "/assets/.escondido",
    "/package.json",
    "/server/servidor.ts",
    "/unknown",
    "/assets/",
    "/icons/",
    "/assets/../.env",
    "/assets/%2e%2e/.env",
    "/data/%2e%2e%2f.env",
    "/assets/..%5c.env",
  ])("não entrega %s", async (caminho) => {
    expect((await pedir(caminho)).status).toBe(404);
  });

  it("recusa escrita nas páginas", async () => {
    const res = await pedir("/analises", { method: "POST" });
    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe("GET, HEAD");
  });

  it("responde à rota de saúde", async () => {
    const res = await pedir("/up");
    expect(res.status).toBe(200);
    expect(res.corpo.toString()).toBe("ok");
  });

  it("entrega /data, que o mapa carrega, comprimido quando o navegador aceita", async () => {
    const res = await pedir("/data/terras-indigenas.json", {
      headers: { "Accept-Encoding": "gzip" },
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(res.headers["content-encoding"]).toBe("gzip");
    expect(JSON.parse(gunzipSync(res.corpo).toString()).terras).toHaveLength(
      4000,
    );
  });

  it("guarda para sempre só o que tem hash no nome", async () => {
    expect(
      (await pedir("/assets/main-AbCd1234.js")).headers["cache-control"],
    ).toContain("immutable");
    expect(
      (await pedir("/assets/agsus-logo.webp")).headers["cache-control"],
    ).toBe("no-cache");
    expect((await pedir("/sw.js")).headers["cache-control"]).toBe("no-cache");
  });

  it("responde 304 quando o navegador já tem a versão atual", async () => {
    const primeira = await pedir("/sw.js");
    const segunda = await pedir("/sw.js", {
      headers: { "If-None-Match": primeira.headers.etag },
    });
    expect(segunda.status).toBe(304);
  });

  it("devolve 503, e não 404, quando o build ainda não existe", async () => {
    const vazio = mkdtempSync(join(tmpdir(), "monitora-vazio-"));
    const semBuild = criarServidor({
      dist: vazio,
      cabecalhos: { globais: [], porRota: new Map() },
    });
    await new Promise((pronto) => semBuild.listen(0, "127.0.0.1", pronto));
    const anterior = base;
    base = `http://127.0.0.1:${semBuild.address().port}`;
    try {
      expect((await pedir("/")).status).toBe(503);
    } finally {
      base = anterior;
      await new Promise((fim) => semBuild.close(fim));
      rmSync(vazio, { recursive: true, force: true });
    }
  });
});

describe("caminhoDoEstatico", () => {
  it("aceita só pastas e arquivos da lista, sem sair do dist", () => {
    const d = resolve("dist-falso");
    expect(caminhoDoEstatico(d, "/assets/a.js")).toBe(
      resolve(d, "assets", "a.js"),
    );
    expect(caminhoDoEstatico(d, "/manifest.webmanifest")).toBe(
      resolve(d, "manifest.webmanifest"),
    );
    for (const ruim of [
      "/",
      "/index.html",
      "/auth/callback.html",
      "/assets",
      "/x/a.js",
      "/%zz",
      "/assets/a%00.js",
    ]) {
      expect(caminhoDoEstatico(d, ruim)).toBeNull();
    }
  });
});
