const BOOTSTRAP_MARKER = "__agsusAnalisesSharedClientBootstrap";

export function bootstrapAnalisesSharedClient(target = globalThis) {
  const facade = target?.supabase;
  if (!facade || typeof facade.createClient !== "function") return null;

  const existing = target[BOOTSTRAP_MARKER];
  if (existing) return existing;

  const client = facade.createClient();
  if (!client) return null;

  try {
    Object.defineProperty(target, BOOTSTRAP_MARKER, {
      value: client,
      enumerable: false,
      configurable: true,
      writable: false,
    });
  } catch (_) {
    target[BOOTSTRAP_MARKER] = client;
  }

  return client;
}

if (typeof window !== "undefined") {
  try {
    bootstrapAnalisesSharedClient(window);
  } catch (error) {
    console.error(
      "Falha ao inicializar os adaptadores do cliente Supabase do painel de Análises:",
      error,
    );
  }
}
