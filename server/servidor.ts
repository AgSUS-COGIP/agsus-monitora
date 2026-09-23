/*
  SERVIDOR WEB DO MONITORA

  Entrega o build do Vite (`dist/`): as três páginas, os arquivos estáticos e uma
  rota de saúde. Não há regra de negócio aqui — os dados vão do navegador ao
  Supabase, sob RLS. Substitui o antigo servidor Laravel/PHP com o mesmo contrato:

  - páginas: `/`, `/index.html`, `/analises`, `/analises.html`, `/auth/callback`,
    `/auth/callback.html`, idênticas byte a byte ao build e sem cache;
  - `/up` responde 200 (saúde para Docker e CI);
  - estáticos só das pastas e arquivos listados abaixo; todo o resto é 404,
    inclusive `/.env`, pastas e arquivos que começam com ponto;
  - só GET e HEAD; outro método numa rota conhecida é 405.

  Os cabeçalhos de segurança vêm do `vercel.json`, para que a Vercel e este
  servidor nunca divirjam. O HSTS só sai quando a conexão é HTTPS.

  As páginas são lidas do disco a cada requisição: com `vite build --watch`
  rodando ao lado (`npm run dev`), a versão nova aparece no próximo F5.

  Roda direto com `node server/servidor.ts` (Node 24 remove os tipos); só usa
  módulos nativos, sem dependência em produção.
*/
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

type Cabecalho = readonly [nome: string, valor: string];

export type PoliticaDeCabecalhos = {
  globais: readonly Cabecalho[];
  porRota: ReadonlyMap<string, readonly Cabecalho[]>;
};

export type OpcoesDoServidor = {
  /** Pasta do build do Vite. */
  dist: string;
  cabecalhos: PoliticaDeCabecalhos;
};

const PAGINAS: ReadonlyMap<string, string> = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/analises", "analises.html"],
  ["/analises.html", "analises.html"],
  ["/auth/callback", "auth/callback.html"],
  ["/auth/callback.html", "auth/callback.html"],
]);

const SAUDE = "/up";
const PASTAS_ESTATICAS = new Set(["assets", "icons", "data"]);
const ARQUIVOS_ESTATICOS_DA_RAIZ = new Set([
  "manifest.webmanifest",
  "offline.html",
  "sw.js",
  "sw-policy.js",
]);
const METODOS_ACEITOS = "GET, HEAD";
const HSTS = "strict-transport-security";

const TIPOS: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=UTF-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// Arquivo com hash do Vite no nome (`main-QJvlLklo.js`) nunca muda de conteúdo.
const COM_HASH = /-[A-Za-z0-9_-]{8}\.(?:js|css)$/;
const COMPRIMIVEL =
  /^(?:text\/|application\/(?:json|manifest\+json)|image\/svg)/;
const MINIMO_PARA_COMPRIMIR = 1024;

/** Lê a política de cabeçalhos do `vercel.json` (fonte única para os dois ambientes). */
export function lerCabecalhosDaVercel(caminho: string): PoliticaDeCabecalhos {
  type Regra = { source?: string; headers?: { key: string; value: string }[] };
  const config = JSON.parse(readFileSync(caminho, "utf8")) as {
    headers?: Regra[];
  };
  const porRota = new Map<string, Cabecalho[]>();
  let globais: Cabecalho[] = [];
  for (const regra of config.headers ?? []) {
    const lista = (regra.headers ?? []).map(
      ({ key, value }) => [key, value] as const,
    );
    if (regra.source === "/(.*)") globais = lista;
    else if (regra.source) porRota.set(regra.source, lista);
  }
  return { globais, porRota };
}

function conexaoSegura(req: IncomingMessage): boolean {
  const encaminhado = String(req.headers["x-forwarded-proto"] ?? "")
    .split(",")[0]
    ?.trim();
  return (
    ("encrypted" in req.socket && req.socket.encrypted === true) ||
    encaminhado === "https"
  );
}

function aplicarSeguranca(
  req: IncomingMessage,
  res: ServerResponse,
  politica: PoliticaDeCabecalhos,
  rota: string,
): void {
  const segura = conexaoSegura(req);
  const especificos = politica.porRota.get(rota.replace(/\.html$/, "")) ?? [];
  for (const [nome, valor] of [...politica.globais, ...especificos]) {
    if (nome.toLowerCase() === HSTS && !segura) continue;
    res.setHeader(nome, valor);
  }
}

function texto(
  res: ServerResponse,
  status: number,
  corpo: string,
  extras: Record<string, string> = {},
): void {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    ...extras,
  });
  res.end(res.req.method === "HEAD" ? undefined : corpo);
}

/** Caminho seguro de um estático dentro do `dist`, ou null se não for servível. */
export function caminhoDoEstatico(
  dist: string,
  pathname: string,
): string | null {
  let decodificado: string;
  try {
    decodificado = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decodificado.includes("\0") || decodificado.includes("\\")) return null;
  const partes = decodificado.split("/").filter(Boolean);
  if (partes.length === 0) return null;
  if (partes.some((parte) => parte.startsWith(".") || parte === ".."))
    return null;
  const primeira = partes[0] ?? "";
  const permitido =
    partes.length === 1
      ? ARQUIVOS_ESTATICOS_DA_RAIZ.has(primeira)
      : PASTAS_ESTATICAS.has(primeira);
  if (!permitido) return null;
  const raiz = resolve(dist);
  const alvo = resolve(raiz, ...partes);
  return alvo.startsWith(raiz + sep) ? alvo : null;
}

const cacheDeGzip = new Map<string, { chave: string; corpo: Buffer }>();

function gzipEmCache(caminho: string, mtimeMs: number, corpo: Buffer): Buffer {
  const chave = `${mtimeMs}:${corpo.length}`;
  const guardado = cacheDeGzip.get(caminho);
  if (guardado?.chave === chave) return guardado.corpo;
  const comprimido = gzipSync(corpo);
  cacheDeGzip.set(caminho, { chave, corpo: comprimido });
  return comprimido;
}

async function servirPagina(
  res: ServerResponse,
  dist: string,
  arquivo: string,
): Promise<void> {
  let corpo: Buffer;
  try {
    corpo = await readFile(resolve(dist, arquivo));
  } catch {
    texto(res, 503, "MONITORA indisponível.");
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/html; charset=UTF-8",
    "Content-Length": String(corpo.length),
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
  });
  res.end(res.req.method === "HEAD" ? undefined : corpo);
}

async function servirEstatico(
  req: IncomingMessage,
  res: ServerResponse,
  caminho: string,
): Promise<boolean> {
  const info = await stat(caminho).catch(() => null);
  if (!info?.isFile()) return false;

  const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
  const tipo =
    TIPOS[extname(caminho).toLowerCase()] ?? "application/octet-stream";
  const cabecalhos: Record<string, string> = {
    "Content-Type": tipo,
    ETag: etag,
    "Last-Modified": info.mtime.toUTCString(),
    "Cache-Control": COM_HASH.test(caminho)
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  };

  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, cabecalhos);
    res.end();
    return true;
  }

  let corpo: Buffer = await readFile(caminho);
  const aceitaGzip = /\bgzip\b/.test(
    String(req.headers["accept-encoding"] ?? ""),
  );
  if (COMPRIMIVEL.test(tipo) && corpo.length >= MINIMO_PARA_COMPRIMIR) {
    cabecalhos.Vary = "Accept-Encoding";
    if (aceitaGzip) {
      corpo = gzipEmCache(caminho, info.mtimeMs, corpo);
      cabecalhos["Content-Encoding"] = "gzip";
    }
  }
  cabecalhos["Content-Length"] = String(corpo.length);
  res.writeHead(200, cabecalhos);
  res.end(req.method === "HEAD" ? undefined : corpo);
  return true;
}

export function criarServidor({ dist, cabecalhos }: OpcoesDoServidor): Server {
  return createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", "http://monitora.local").pathname;
    aplicarSeguranca(req, res, cabecalhos, pathname);

    const pagina = PAGINAS.get(pathname);
    const metodoAceito = req.method === "GET" || req.method === "HEAD";
    const estatico = pagina ? null : caminhoDoEstatico(dist, pathname);
    const rotaConhecida =
      Boolean(pagina) || pathname === SAUDE || estatico !== null;

    if (!metodoAceito) {
      if (rotaConhecida)
        texto(res, 405, "Método não permitido.", { Allow: METODOS_ACEITOS });
      else texto(res, 404, "Não encontrado.");
      return;
    }
    if (pathname === SAUDE) return texto(res, 200, "ok");

    const tarefa = pagina
      ? servirPagina(res, dist, pagina)
      : estatico
        ? servirEstatico(req, res, estatico).then((servido) => {
            if (!servido) texto(res, 404, "Não encontrado.");
          })
        : Promise.resolve(texto(res, 404, "Não encontrado."));

    tarefa.catch((erro: unknown) => {
      console.error("[servidor]", pathname, erro);
      if (!res.headersSent) texto(res, 500, "Erro interno.");
      else res.destroy();
    });
  });
}

function iniciar(): void {
  const raiz = fileURLToPath(new URL("..", import.meta.url));
  const host = process.env.HOST || "127.0.0.1";
  const porta = Number(process.env.PORT || 8000);
  const dist = resolve(raiz, process.env.DIST || "dist");
  const cabecalhos = lerCabecalhosDaVercel(resolve(raiz, "vercel.json"));

  const servidor = criarServidor({ dist, cabecalhos });
  servidor.listen(porta, host, () => {
    console.log(
      `MONITORA em http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${porta} (servindo ${dist})`,
    );
  });
  for (const sinal of ["SIGINT", "SIGTERM"] as const) {
    process.once(sinal, () => servidor.close(() => process.exit(0)));
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  iniciar();
}
