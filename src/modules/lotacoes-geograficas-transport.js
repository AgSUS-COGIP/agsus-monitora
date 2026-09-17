const MAP_TABLE = "mapa_saude_indigena_config";
const DECORATOR_KEY = "__agsusDecorateOperationalClient";
const CLIENT_MARKER = "__agsusLotacoesGeograficas";
const SOURCE = "Lotações, Meios de Acesso/Polo Base";
const DATA_FILES = Array.from(
  { length: 8 },
  (_, index) =>
    `/data/lotacoes-geograficas-${String(index + 1).padStart(2, "0")}.json`,
);

let datasetPromise = null;

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(
      /\b(DISTRITO|SANITARIO|ESPECIAL|INDIGENA|SAUDE|DE|DO|DA|DOS|DAS|E|TIPO|I|II|III|IV)\b/g,
      " ",
    )
    .replace(/\b(PB|POLO|BASE|DSEI|UBSI|UBS|UN|UNIDADE|BASICA|POSTO)\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function compactRecord(row) {
  const [type, name, lat, lon, municipality, uf, accessibility, accessMode] =
    row;
  return { type, name, lat, lon, municipality, uf, accessibility, accessMode };
}

export async function loadLotacoesGeograficas(fetchImpl = globalThis.fetch) {
  if (fetchImpl === globalThis.fetch && datasetPromise) return datasetPromise;
  const task = Promise.all(
    DATA_FILES.map(async (file) => {
      const response = await fetchImpl(file, { cache: "force-cache" });
      if (!response.ok)
        throw new Error(`Falha ao carregar ${file}: ${response.status}`);
      return response.json();
    }),
  ).then((chunks) => Object.assign({}, ...chunks));
  if (fetchImpl === globalThis.fetch) datasetPromise = task;
  return task;
}

function mergeNetworkRecord(list, record) {
  const key = normalize(record.name);
  let existing = list.find((item) => normalize(item?.[0]) === key);
  if (!existing && record.municipality) {
    existing = list.find(
      (item) =>
        normalize(item?.[0]) === key ||
        (normalize(item?.[4]) === normalize(record.municipality) &&
          normalize(item?.[0]).includes(key)),
    );
  }
  if (existing) {
    existing[2] = record.lat;
    existing[3] = record.lon;
    if (record.municipality) existing[4] = record.municipality;
    if (record.uf) existing[5] = record.uf;
    existing[6] = record.accessibility || "";
    existing[7] = record.accessMode || "";
    existing[8] = SOURCE;
    return;
  }
  list.push([
    record.name,
    "",
    record.lat,
    record.lon,
    record.municipality || "",
    record.uf || "",
    record.accessibility || "",
    record.accessMode || "",
    SOURCE,
  ]);
}

function applyNationalCasai(redePayload, record) {
  redePayload.nac ||= [];
  const targetName = /DF|BRASIL/i.test(record.name) ? "BRASIL" : "SAO PAULO";
  let existing = redePayload.nac.find((item) =>
    normalize(item?.[0]).includes(targetName),
  );
  if (!existing) {
    existing = [
      record.name,
      "",
      record.lat,
      record.lon,
      record.municipality,
      record.uf,
    ];
    redePayload.nac.push(existing);
  }
  existing[2] = record.lat;
  existing[3] = record.lon;
  existing[4] = record.municipality || existing[4];
  existing[5] = record.uf || existing[5];
  existing[6] = record.accessibility || "";
  existing[7] = record.accessMode || "";
  existing[8] = SOURCE;
}

export function applyLotacoesGeograficas(rows, dataset) {
  const output = clone(rows || []);
  const lmapRow = output.find((row) => row?.chave === "lmap");
  const redeRow = output.find((row) => row?.chave === "rede_cnes");
  if (!lmapRow?.payload || !redeRow?.payload || !dataset) return output;

  const dseiByKey = new Map(
    (lmapRow.payload.dsei || []).map((dsei) => [dsei.k, dsei]),
  );
  redeRow.payload.rede ||= {};

  Object.entries(dataset).forEach(([dseiKey, rawRecords]) => {
    const records = (rawRecords || []).map(compactRecord);
    if (dseiKey === "CASAI DF" || dseiKey === "CASAI SÃO PAULO") {
      records
        .filter((record) => record.type === "CASAI")
        .forEach((record) => applyNationalCasai(redeRow.payload, record));
      return;
    }

    const dsei = dseiByKey.get(dseiKey);
    if (!dsei) return;
    dsei.polos ||= [];
    const network = (redeRow.payload.rede[dseiKey] ||= { u: [], c: [] });
    network.u ||= [];
    network.c ||= [];

    records.forEach((record) => {
      if (record.type === "SEDE") {
        dsei.lat = record.lat;
        dsei.lon = record.lon;
        dsei.sede_municipio = record.municipality || "";
        dsei.sede_uf = record.uf || dsei.sedeuf || "";
        dsei.sede_acessibilidade = record.accessibility || "";
        dsei.sede_meio_acesso = record.accessMode || "";
        dsei.coord_fonte = SOURCE;
        return;
      }

      if (record.type === "POLO BASE") {
        const key = normalize(record.name);
        let polo = dsei.polos.find((item) => normalize(item?.n) === key);
        if (!polo) {
          polo = { n: record.name.replace(/^PB\s+/i, ""), p: 0 };
          dsei.polos.push(polo);
        }
        polo.lat = record.lat;
        polo.lon = record.lon;
        polo.uf = record.uf || polo.uf || "";
        polo.mun_lotacao = record.municipality || "";
        polo.acessibilidade = record.accessibility || "";
        polo.meio_acesso = record.accessMode || "";
        polo.coord_oficial = true;
        polo.coord_fonte = SOURCE;
        mergeNetworkRecord(network.u, record);
        return;
      }

      if (record.type === "CASAI") {
        mergeNetworkRecord(network.c, record);
        return;
      }

      mergeNetworkRecord(network.u, record);
    });
  });

  lmapRow.payload.lotacoes_geograficas = {
    fonte: SOURCE,
    registros: 598,
    sedes: 34,
    polos: 403,
    casais: 79,
    unidades_rotas: 82,
    excluidos: 13,
  };
  return output;
}

function wrapBuilder(builder, datasetLoader) {
  return new Proxy(builder, {
    get(target, property, receiver) {
      if (property === "then") {
        return (resolve, reject) =>
          Promise.resolve(target)
            .then(async (result) => {
              if (result?.error || !Array.isArray(result?.data)) return result;
              try {
                const dataset = await datasetLoader();
                return {
                  ...result,
                  data: applyLotacoesGeograficas(result.data, dataset),
                };
              } catch (error) {
                console.warn(
                  "Lotações geográficas indisponíveis; mantendo mapa persistido.",
                  error,
                );
                return result;
              }
            })
            .then(resolve, reject);
      }
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      return (...args) => {
        const next = value.apply(target, args);
        return next && typeof next === "object"
          ? wrapBuilder(next, datasetLoader)
          : next;
      };
    },
  });
}

export function decorateLotacoesClient(
  client,
  datasetLoader = loadLotacoesGeograficas,
) {
  if (!client || client[CLIENT_MARKER]) return client;
  const originalFrom = client.from.bind(client);
  client.from = (tableName) => {
    const builder = originalFrom(tableName);
    return tableName === MAP_TABLE
      ? wrapBuilder(builder, datasetLoader)
      : builder;
  };
  Object.defineProperty(client, CLIENT_MARKER, {
    value: true,
    enumerable: false,
  });
  return client;
}

export function installLotacoesTransport(target = globalThis) {
  if (!target) return false;
  const previous = target[DECORATOR_KEY];
  Object.defineProperty(target, DECORATOR_KEY, {
    value: (client) =>
      decorateLotacoesClient(
        typeof previous === "function" ? previous(client) : client,
      ),
    configurable: true,
    enumerable: false,
  });
  return true;
}

installLotacoesTransport(globalThis);
