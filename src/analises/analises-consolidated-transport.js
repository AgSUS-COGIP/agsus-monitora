const TARGET_VIEWS = new Set([
  "vw_analises_dashboard_base",
  "vw_analises_dashboard_base_todos"
]);

const RPC_NAME = "get_analises_dashboard_payload_v2";
const CACHE_TTL_MS = 5 * 60 * 1000;
const payloadCache = new Map();

function decodeRows(payload) {
  if (!payload || !Array.isArray(payload.columns) || !Array.isArray(payload.rows)) {
    throw new Error("Payload consolidado de Análises inválido.");
  }

  const columns = payload.columns;
  return payload.rows.map((values) => {
    const row = {};
    columns.forEach((column, index) => {
      row[column] = Array.isArray(values) ? values[index] : null;
    });
    return row;
  });
}

function scopeFor(tableName, filters) {
  if (tableName === "vw_analises_dashboard_base") return "ativo";
  const editalAtivo = filters.get("edital_ativo");
  if (editalAtivo === false) return "inativo";
  if (editalAtivo === true) return "ativo";
  return "todos";
}

function clearPayloadCache(scope = "") {
  const normalized = String(scope || "").trim().toLowerCase();
  if (normalized && payloadCache.has(normalized)) {
    payloadCache.delete(normalized);
    return;
  }
  payloadCache.clear();
}

async function getPayload(client, scope) {
  const cached = payloadCache.get(scope);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.promise;
  }

  const promise = (async () => {
    const { data, error } = await client.rpc(RPC_NAME, { p_scope: scope });
    if (error) throw error;
    const payload = Array.isArray(data) ? data[0] : data;
    return {
      payload,
      rows: decodeRows(payload)
    };
  })();

  payloadCache.set(scope, { createdAt: Date.now(), promise });

  try {
    return await promise;
  } catch (error) {
    payloadCache.delete(scope);
    throw error;
  }
}

class ConsolidatedQuery {
  constructor(client, tableName) {
    this.client = client;
    this.tableName = tableName;
    this.filters = new Map();
    this.orders = [];
    this.columns = "*";
    this.from = 0;
    this.to = 999;
  }

  select(columns = "*") {
    this.columns = columns || "*";
    return this;
  }

  range(from, to) {
    this.from = Math.max(0, Number(from) || 0);
    this.to = Math.max(this.from, Number(to) || this.from);
    return this;
  }

  eq(column, value) {
    this.filters.set(column, value);
    return this;
  }

  order(column, options = {}) {
    this.orders.push({ column, options });
    return this;
  }

  async executeFallback() {
    let fallback = this.client.__agsusOriginalFrom(this.tableName)
      .select(this.columns)
      .range(this.from, this.to);

    this.filters.forEach((value, column) => {
      fallback = fallback.eq(column, value);
    });

    this.orders.forEach(({ column, options }) => {
      fallback = fallback.order(column, options);
    });

    return fallback;
  }

  async execute() {
    try {
      const scope = scopeFor(this.tableName, this.filters);
      const { rows } = await getPayload(this.client, scope);
      return {
        data: rows.slice(this.from, this.to + 1),
        error: null,
        count: rows.length,
        status: 200,
        statusText: "OK"
      };
    } catch (error) {
      console.warn("Carga consolidada indisponível; usando fallback do Supabase:", error);
      return this.executeFallback();
    }
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

function wrapClient(client) {
  if (!client || client.__agsusConsolidatedTransport) return client;

  const originalFrom = client.from.bind(client);
  Object.defineProperty(client, "__agsusOriginalFrom", {
    value: originalFrom,
    enumerable: false
  });

  client.from = (tableName) => {
    if (TARGET_VIEWS.has(tableName)) {
      return new ConsolidatedQuery(client, tableName);
    }
    return originalFrom(tableName);
  };

  Object.defineProperty(client, "__agsusConsolidatedTransport", {
    value: true,
    enumerable: false
  });

  return client;
}

function installRefreshInvalidation() {
  document.addEventListener("agsus:analises-force-refresh", event => {
    clearPayloadCache(event.detail?.scope || "");
  });

  document.addEventListener("click", event => {
    if (!event.target?.closest?.("#refreshBtn")) return;
    clearPayloadCache();
    document.dispatchEvent(new CustomEvent("agsus:analises-cache-cleared"));
  }, true);
}

function installTransport() {
  const supabaseGlobal = window.supabase;
  if (!supabaseGlobal || typeof supabaseGlobal.createClient !== "function") {
    console.warn("Supabase ainda não disponível para instalar transporte consolidado.");
    return;
  }

  if (supabaseGlobal.__agsusConsolidatedTransportInstalled) return;

  const originalCreateClient = supabaseGlobal.createClient.bind(supabaseGlobal);
  supabaseGlobal.createClient = (...args) => wrapClient(originalCreateClient(...args));
  supabaseGlobal.__agsusConsolidatedTransportInstalled = true;
}

installRefreshInvalidation();
installTransport();
