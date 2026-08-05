importScripts("/sw-policy.js");

const CACHE_VERSION = "agsus-monitora-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = "/offline.html";
const APP_SHELL = [
  "/",
  "/index.html",
  "/analises.html",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/sw-policy.js",
  "/icons/agsus-monitora.svg",
  "/icons/agsus-monitora-maskable.svg",
];

const BLOCKED_PATH_PREFIXES = [
  "/auth/",
  "/api/",
  "/rest/",
  "/storage/",
  "/functions/",
];

const { getRequestStrategy, isResponseCacheable } = self.AgSUSPwaCachePolicy;

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
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  await storeResponse(request, response);
  return response;
}

async function networkFirst(request, fallbackRequest = request) {
  try {
    const response = await fetch(request);
    await storeResponse(request, response);
    return response;
  } catch {
    return caches.match(fallbackRequest);
  }
}

async function networkFirstNavigation(request) {
  return (
    (await networkFirst(request)) ||
    (await caches.match("/index.html")) ||
    (await caches.match(OFFLINE_URL))
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("agsus-monitora-") && key !== STATIC_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!isCacheableRequest(request, url)) return;

  const strategy = getRequestStrategy(request);

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
