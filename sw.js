importScripts("/sw-policy.js");

// Trocada a cada build pela versão publicada (vite.config.js): versão nova, cache novo.
const CACHE_VERSION = "agsus-monitora-dev";
const CACHE_LIMIT = 150;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = "/offline.html";
/*
  A casca. Sem "/index.html": a Vercel responde 308 a ele (e a "/offline.html",
  por `cleanUrls`), e uma resposta redirecionada não serve para responder a
  uma navegação (o navegador mostra a página de erro). A navegação sem rede
  cai em "/", que é o index.html sem redirecionar (guardarCasca).
*/
const APP_SHELL = [
  "/",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/sw-policy.js",
  "/icons/yeende.svg",
  "/icons/yeende-192.png",
  "/icons/yeende-512.png",
  "/icons/yeende-maskable-512.png",
  "/icons/yeende-apple-180.png",
];
/*
  Trocada a cada build pela lista dos arquivos publicados (vite.config.js,
  src/lib/carga/cache-do-service-worker.ts): código, estilos, fontes e imagens de
  todas as telas, guardados na instalação para que qualquer tela abra sem rede,
  também a que nunca foi aberta.
*/
const PRECACHE = [];

/*
  O Vary (o `vite preview` manda `Vary: Origin`) não muda o arquivo estático:
  sem ignorá-lo, o pedido de um módulo com Origin não achava a cópia guardada
  na instalação, que foi buscada sem Origin.
*/
const MATCH_OPTIONS = { ignoreVary: true };

const BLOCKED_PATH_PREFIXES = [
  "/auth/",
  "/api/",
  "/rest/",
  "/storage/",
  "/functions/",
];

const {
  getRequestStrategy,
  isResponseCacheable,
  entriesBeyondLimit,
  isHashedAsset,
  prefersCachedCopy,
  entriesToCarry,
} = self.AgSUSPwaCachePolicy;

const FIXED_URLS = [...APP_SHELL, ...PRECACHE].map(
  (path) => new URL(path, self.location.origin).href,
);

function isCacheableRequest(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;

  const isBlockedPath = BLOCKED_PATH_PREFIXES.some((prefix) =>
    url.pathname.startsWith(prefix),
  );
  if (isBlockedPath) return false;

  return !request.headers.has("authorization");
}

async function storeResponse(request, response) {
  if (!isResponseCacheable(response)) return;

  const cache = await caches.open(STATIC_CACHE);
  await cache.put(request, response.clone());
  await trimCache(cache);
}

async function trimCache(cache) {
  const keys = await cache.keys();
  const excess = entriesBeyondLimit(
    keys.map((key) => key.url),
    { limit: CACHE_LIMIT, keep: FIXED_URLS },
  );
  await Promise.all(excess.map((url) => cache.delete(url)));
}

async function cacheFirst(request) {
  const cached = await caches.match(request, MATCH_OPTIONS);
  if (cached) return cached;

  const response = await fetch(request);
  await storeResponse(request, response);
  return response;
}

/* Sem rede, ou com erro da rede (404, 500) e cópia guardada: a cópia. */
async function networkFirst(request) {
  let response;
  try {
    response = await fetch(request);
  } catch {
    return caches.match(request, MATCH_OPTIONS);
  }
  if (!prefersCachedCopy(response)) {
    await storeResponse(request, response);
    return response;
  }
  return (await caches.match(request, MATCH_OPTIONS)) || response;
}

async function networkFirstNavigation(request) {
  return (
    (await networkFirst(request)) ||
    (await caches.match("/", MATCH_OPTIONS)) ||
    (await caches.match(OFFLINE_URL, MATCH_OPTIONS))
  );
}

/*
  A casca entra no cache sem o redirecionamento: se o servidor redirecionou
  (a Vercel em "/offline.html"), guarda o corpo como resposta direta, que
  serve para responder a uma navegação.
*/
async function guardarCasca(cache) {
  await Promise.all(
    APP_SHELL.map(async (path) => {
      const response = await fetch(path, { cache: "no-cache" });
      if (!response.ok) throw new Error(`${response.status} em ${path}`);
      await cache.put(
        path,
        response.redirected
          ? new Response(await response.blob(), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            })
          : response,
      );
    }),
  );
}

/*
  Os pedaços da versão anterior que a nova não tem vêm para o cache novo
  antes de o anterior sair (entriesToCarry): a aba que atravessou a
  publicação continua achando o código dela. O limite do cache leva primeiro
  os mais velhos.
*/
async function herdarDaVersaoAnterior(anteriores) {
  const cache = await caches.open(STATIC_CACHE);
  for (const nome of anteriores) {
    const anterior = await caches.open(nome);
    const pedidos = await anterior.keys();
    const presentes = (await cache.keys()).map((pedido) => pedido.url);
    const herdar = entriesToCarry(
      pedidos.map((pedido) => pedido.url),
      presentes,
    );
    for (const url of herdar) {
      const response = await anterior.match(url, MATCH_OPTIONS);
      if (response) await cache.put(url, response);
    }
  }
  await trimCache(cache);
}

/*
  Um arquivo com hash que a versão anterior já guardou vem dessa cópia, sem
  gastar a rede de novo (o nome muda quando o conteúdo muda). Os demais vêm da
  rede. Um arquivo que falhar não impede a instalação: a casca já está
  guardada, e o que faltar entra no cache quando a tela for aberta com rede.
*/
async function precacheFile(cache, path) {
  const url = new URL(path, self.location.origin).href;
  const hashed = isHashedAsset(url);
  const previous = hashed && (await caches.match(url, MATCH_OPTIONS));
  if (previous) {
    await cache.put(url, previous);
    return;
  }
  const response = await fetch(url, { cache: hashed ? "default" : "no-cache" });
  if (!response.ok) throw new Error(`${response.status} em ${path}`);
  await cache.put(url, response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      await guardarCasca(cache);
      await Promise.allSettled(
        PRECACHE.map((path) => precacheFile(cache, path)),
      );
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const anteriores = (await caches.keys()).filter(
        (key) => key.startsWith("agsus-monitora-") && key !== STATIC_CACHE,
      );
      try {
        await herdarDaVersaoAnterior(anteriores);
      } catch {
        // Sem a herança a versão nova funciona; a aba antiga recarrega se faltar pedaço.
      }
      await Promise.all(anteriores.map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!isCacheableRequest(request, url)) return;

  const strategy = getRequestStrategy({
    mode: request.mode,
    destination: request.destination,
    url: request.url,
  });

  if (strategy === "network-first") {
    event.respondWith(
      request.mode === "navigate"
        ? networkFirstNavigation(request)
        : networkFirst(request),
    );
    return;
  }

  if (strategy === "cache-first") {
    event.respondWith(cacheFirst(request));
  }
});
