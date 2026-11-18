(function exposeServiceWorkerPolicy(scope) {
  const NETWORK_FIRST_DESTINATIONS = new Set(["script", "style", "worker"]);
  const CACHE_FIRST_DESTINATIONS = new Set(["image", "font", "manifest"]);

  /*
    O arquivo com o hash no nome nunca muda (`isHashedAsset`): vem do cache
    primeiro. Era rede primeiro, e depois de uma publicação a Vercel responde
    404 ao pedaço da versão anterior, que a aba ainda aberta pede ao abrir uma
    tela; o 404 chegava à página mesmo com a cópia guardada.
  */
  function getRequestStrategy({ mode = "", destination = "", url = "" } = {}) {
    if (mode === "navigate") return "network-first";
    if (isHashedAsset(url) && destination !== "") return "cache-first";
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
    que passam do limite. As de `keep` (a casca e os arquivos que o build
    manda guardar na instalação) nunca saem nem contam no limite: o limite é
    do que entrou pelo uso.
  */
  function entriesBeyondLimit(urls = [], { limit = 150, keep = [] } = {}) {
    const fixed = new Set(keep);
    const removable = urls.filter((url) => !fixed.has(url));
    const excess = removable.length - limit;
    return excess > 0 ? removable.slice(0, excess) : [];
  }

  /*
    Arquivo com o hash do Vite no nome (`/assets/telas-Ab3_x9Zq.js`): o
    conteúdo é o do nome, então a cópia guardada por uma versão anterior serve
    para a nova e não precisa vir da rede de novo.
  */
  function isHashedAsset(url = "") {
    const { pathname } = new URL(url, "https://exemplo.invalid");
    return /^\/assets\/.+-[\w-]{8}\.[a-z0-9]+$/i.test(pathname);
  }

  /*
    Rede primeiro: a resposta da rede vale, salvo erro (404, 500) havendo
    cópia guardada. O redirecionamento de uma navegação (`opaqueredirect`)
    vale como veio.
  */
  function prefersCachedCopy(response) {
    if (!response) return true;
    return !response.ok && response.type !== "opaqueredirect";
  }

  /*
    Na troca de versão, os arquivos com hash da versão anterior que a nova não
    tem passam para o cache novo: a aba que ficou aberta ainda roda o código
    anterior e pede os pedaços dele, que a Vercel já não tem. Entram no fim
    da fila do limite (`entriesBeyondLimit`) na ordem inversa da do cache
    anterior: os da versão anterior por último, os herdados de versões mais
    velhas antes, e estes saem primeiro.
  */
  function entriesToCarry(previousUrls = [], keep = []) {
    const fixed = new Set(keep);
    const carry = [];
    for (const url of [...previousUrls].reverse()) {
      if (!isHashedAsset(url) || fixed.has(url)) continue;
      fixed.add(url);
      carry.push(url);
    }
    return carry;
  }

  scope.AgSUSPwaCachePolicy = {
    getRequestStrategy,
    isResponseCacheable,
    entriesBeyondLimit,
    isHashedAsset,
    prefersCachedCopy,
    entriesToCarry,
  };
})(self);
