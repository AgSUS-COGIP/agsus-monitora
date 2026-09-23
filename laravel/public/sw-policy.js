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

  scope.AgSUSPwaCachePolicy = {
    getRequestStrategy,
    isResponseCacheable,
  };
})(self);
