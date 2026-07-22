const SOURCE_TABLE = "monitoramento_indigena";
const OPERATIONAL_VIEW = "vw_monitoramento_indigena_operacional";

function installOperationalTransport() {
  const supabaseGlobal = window.supabase;
  if (!supabaseGlobal || typeof supabaseGlobal.createClient !== "function") return;
  if (supabaseGlobal.__agsusOperationalTransportInstalled) return;

  const originalCreateClient = supabaseGlobal.createClient.bind(supabaseGlobal);
  supabaseGlobal.createClient = (...args) => {
    const client = originalCreateClient(...args);
    if (!client || client.__agsusOperationalTransport) return client;

    const originalFrom = client.from.bind(client);
    client.from = (tableName) => {
      const originalBuilder = originalFrom(tableName);
      if (tableName !== SOURCE_TABLE) return originalBuilder;

      return new Proxy(originalBuilder, {
        get(target, property, receiver) {
          if (property === "select") {
            return (...selectArgs) => originalFrom(OPERATIONAL_VIEW).select(...selectArgs);
          }
          const value = Reflect.get(target, property, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        }
      });
    };

    Object.defineProperty(client, "__agsusOperationalTransport", {
      value: true,
      enumerable: false
    });
    return client;
  };

  supabaseGlobal.__agsusOperationalTransportInstalled = true;
}

installOperationalTransport();
