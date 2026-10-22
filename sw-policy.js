(function exposeServiceWorkerPolicy(scope) {
  const NETWORK_FIRST_DESTINATIONS = new Set(["script", "style", "worker"]);
  const CACHE_FIRST_DESTINATIONS = new Set(["image", "font", "manifest"]);

  function getRequestStrategy({ mode = "", destination = "" } = {}) {
    if (mode === "navigate") return "network-first";
    if (NETWORK_FIRST_DESTINATIONS.has(destination)) return "network-first";
    if (CACHE_FIRST_DESTINATIONS.has(destination)) return "cache-first";
    return "network-only";
  }

  function isResponseCacheable(response) {
    if (!response?.ok || response.type !== "basic") return false;

    const cacheControl = response.headers?.get?.("cache-control") || "";
    return !/(?:^|,)\s*(?:no-store|private)\b/i.test(cacheControl);
  }

  /*
    O cache guarda cada script e estilo com hash que passa pela rede: sem
    limite, crescia a cada versão publicada enquanto o mesmo service worker
    vivesse. Devolve as URLs mais antigas (a ordem é a de entrada no cache)
    que passam do limite; as do app shell nunca saem.
  */
  function entriesBeyondLimit(urls = [], { limit = 150, keep = [] } = {}) {
    const fixed = new Set(keep);
    const removable = urls.filter((url) => !fixed.has(url));
    const excess = urls.length - limit;
    return excess > 0 ? removable.slice(0, excess) : [];
  }

  scope.AgSUSPwaCachePolicy = {
    getRequestStrategy,
    isResponseCacheable,
    entriesBeyondLimit,
  };
})(self);
