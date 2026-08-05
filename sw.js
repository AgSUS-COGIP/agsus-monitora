const CACHE_VERSION = "agsus-monitora-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = "/offline.html";
const APP_SHELL = [
  "/",
  "/index.html",
  "/analises.html",
  OFFLINE_URL,
  "/manifest.webmanifest",
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

function isCacheableRequest(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;

  const isBlockedPath = BLOCKED_PATH_PREFIXES.some((prefix) =>
    url.pathname.startsWith(prefix),
  );
  if (isBlockedPath) return false;

  return !request.headers.has("authorization");
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }

  return response;
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(request)) || (await caches.match(OFFLINE_URL));
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
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

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!isCacheableRequest(request, url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  const { destination } = request;
  const isStaticAsset = [
    "style",
    "script",
    "image",
    "font",
    "manifest",
  ].includes(destination);

  if (isStaticAsset) event.respondWith(cacheFirst(request));
});
