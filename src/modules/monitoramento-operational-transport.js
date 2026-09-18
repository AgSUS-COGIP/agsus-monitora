const SOURCE_TABLE = "monitoramento_indigena";
const OPERATIONAL_VIEW = "VW_MONITORAMENTO_INDIGENA_OPERACIONAL";
const CLIENT_MARKER = "__agsusOperationalTransport";
const GLOBAL_MARKER = "__agsusOperationalTransportInstalled";
const DECORATOR_KEY = "__agsusDecorateOperationalClient";

export function decorateOperationalClient(client) {
  if (!client || client[CLIENT_MARKER]) return client;

  const originalFrom = client.from.bind(client);
  client.from = (tableName) => {
    const originalBuilder = originalFrom(tableName);
    if (tableName !== SOURCE_TABLE) return originalBuilder;

    return new Proxy(originalBuilder, {
      get(target, property, receiver) {
        if (property === "select") {
          return (...selectArgs) =>
            originalFrom(OPERATIONAL_VIEW).select(...selectArgs);
        }

        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  };

  Object.defineProperty(client, CLIENT_MARKER, {
    value: true,
    enumerable: false,
  });

  return client;
}

export function installOperationalTransport(target = globalThis) {
  const supabaseGlobal = target?.supabase;
  if (
    !target ||
    !supabaseGlobal ||
    typeof supabaseGlobal.createClient !== "function"
  ) {
    return false;
  }
  if (supabaseGlobal[GLOBAL_MARKER]) return true;

  const originalCreateClient = supabaseGlobal.createClient.bind(supabaseGlobal);
  supabaseGlobal.createClient = (...args) =>
    decorateOperationalClient(originalCreateClient(...args));

  Object.defineProperty(supabaseGlobal, GLOBAL_MARKER, {
    value: true,
    enumerable: false,
  });
  Object.defineProperty(target, DECORATOR_KEY, {
    value: decorateOperationalClient,
    configurable: true,
    enumerable: false,
  });

  return true;
}

if (typeof window !== "undefined") {
  installOperationalTransport(window);
}
