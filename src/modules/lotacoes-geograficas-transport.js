import {
  canonicoUtilizavel,
  classificarDivergencia,
  distanciaKm,
  nomeCanonico,
  tipoDeclarado,
} from "../lib/reconciliacao-unidades.js";

const MAP_TABLE = "mapa_saude_indigena_config";
const DECORATOR_KEY = "__agsusDecorateOperationalClient";
const CLIENT_MARKER = "__agsusLotacoesGeograficas";
const SOURCE = "Lotações, Meios de Acesso/Polo Base";
const RECONCILED_SOURCE = `CNES + ${SOURCE}`;
const DATA_FILES = Array.from(
  { length: 8 },
  (_, index) =>
    `/data/lotacoes-geograficas-${String(index + 1).padStart(2, "0")}.json`,
);

let datasetPromise = null;

function normalizePlace(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
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

function recordExpectedType(record) {
  if (record.type === "POLO BASE") return "polo";
  if (record.type === "CASAI") return "casai";
  if (record.type === "ROTA") return "rota";
  return "unidade";
}

function rowType(row, listKind) {
  if (listKind === "c") return "casai";
  return tipoDeclarado(row?.[0]);
}

function compatibleRow(record, row, listKind) {
  const expected = recordExpectedType(record);
  const candidate = rowType(row, listKind);
  if (expected === "polo") return candidate === "polo";
  if (expected === "casai") return candidate === "casai";
  if (expected === "rota") return false;
  return candidate !== "polo" && candidate !== "casai";
}

function nearestUniqueCandidate(candidates, record, maxDistanceKm = 5) {
  const byDistance = candidates
    .map((row) => ({
      row,
      km: distanciaKm(
        Number(record.lat),
        Number(record.lon),
        Number(row?.[2]),
        Number(row?.[3]),
      ),
    }))
    .filter((item) => Number.isFinite(item.km))
    .sort((a, b) => a.km - b.km);

  if (!byDistance.length || byDistance[0].km > maxDistanceKm) return null;
  if (byDistance.length > 1 && byDistance[1].km - byDistance[0].km < 1)
    return null;
  return byDistance[0].row;
}

function findNetworkMatch(list, record, listKind = "u") {
  const canonical = nomeCanonico(record.name);
  if (!canonicoUtilizavel(canonical)) return null;

  const compatible = list.filter((row) => compatibleRow(record, row, listKind));
  let candidates = compatible.filter(
    (row) => nomeCanonico(row?.[0]) === canonical,
  );
  const municipality = normalizePlace(record.municipality);

  if (!candidates.length && municipality) {
    const sameMunicipality = compatible.filter(
      (row) => normalizePlace(row?.[4]) === municipality,
    );
    const spatial = nearestUniqueCandidate(sameMunicipality, record);
    if (spatial) return spatial;
  }

  if (!candidates.length) return null;

  const withCnes = candidates.filter((row) => String(row?.[1] || "").trim());
  if (withCnes.length === 1) return withCnes[0];
  if (withCnes.length > 1) candidates = withCnes;

  if (municipality) {
    const sameMunicipality = candidates.filter(
      (row) => normalizePlace(row?.[4]) === municipality,
    );
    if (sameMunicipality.length === 1) return sameMunicipality[0];
    if (sameMunicipality.length > 1) candidates = sameMunicipality;
  }

  if (candidates.length === 1) return candidates[0];
  return nearestUniqueCandidate(candidates, record);
}

function annotateNetworkRecord(existing, record) {
  const hasCnes = Boolean(String(existing?.[1] || "").trim());
  const cnesLat = Number(existing?.[2]);
  const cnesLon = Number(existing?.[3]);
  const hasCnesCoord = Number.isFinite(cnesLat) && Number.isFinite(cnesLon);
  const km = hasCnesCoord
    ? distanciaKm(cnesLat, cnesLon, record.lat, record.lon)
    : null;

  if (!hasCnesCoord) {
    existing[2] = record.lat;
    existing[3] = record.lon;
  }
  if (!existing[4] && record.municipality) existing[4] = record.municipality;
  if (!existing[5] && record.uf) existing[5] = record.uf;
  existing[6] = record.accessibility || existing[6] || "";
  existing[7] = record.accessMode || existing[7] || "";
  existing[8] = hasCnes ? RECONCILED_SOURCE : SOURCE;
  existing[9] = {
    ...(existing[9] && typeof existing[9] === "object" ? existing[9] : {}),
    fonte_lotacoes: SOURCE,
    coordenada_exibida: hasCnesCoord ? "CNES" : SOURCE,
    coordenadas: {
      cnes: hasCnesCoord ? { lat: cnesLat, lon: cnesLon } : null,
      lotacoes: { lat: record.lat, lon: record.lon },
    },
    distancia_entre_fontes_km:
      km == null ? null : Number(Number(km).toFixed(1)),
    divergencia: classificarDivergencia(km),
  };
  return existing;
}

function planilhaNetworkRow(record) {
  return [
    record.name,
    "",
    record.lat,
    record.lon,
    record.municipality || "",
    record.uf || "",
    record.accessibility || "",
    record.accessMode || "",
    SOURCE,
    {
      fonte_lotacoes: SOURCE,
      coordenada_exibida: SOURCE,
      coordenadas: {
        cnes: null,
        lotacoes: { lat: record.lat, lon: record.lon },
      },
      distancia_entre_fontes_km: null,
      divergencia: "sem_cnes",
    },
  ];
}

function mergeNetworkRecord(list, record, listKind = "u") {
  const existing = findNetworkMatch(list, record, listKind);
  if (existing) {
    annotateNetworkRecord(existing, record);
    return { row: existing, created: false };
  }
  if (record.type === "ROTA" || record.type === "POLO BASE") {
    return { row: null, created: false };
  }
  const created = planilhaNetworkRow(record);
  list.push(created);
  return { row: created, created: true };
}

function mergeNationalCasai(redePayload, record) {
  redePayload.nac ||= [];
  const municipality = normalizePlace(record.municipality);
  let existing = redePayload.nac.find(
    (row) =>
      rowType(row, "c") === "casai" &&
      municipality &&
      normalizePlace(row?.[4]) === municipality,
  );

  if (!existing) {
    const targetName = /DF|BRASIL/i.test(record.name) ? "BRASIL" : "SAO PAULO";
    existing = redePayload.nac.find((row) =>
      normalizePlace(row?.[0]).includes(targetName),
    );
  }

  if (existing) {
    annotateNetworkRecord(existing, record);
    return existing;
  }

  const created = planilhaNetworkRow(record);
  redePayload.nac.push(created);
  return created;
}

function dedupeNetworkList(list, listKind = "u") {
  const seenCnes = new Set();
  const seenPlanilha = new Set();
  return list.filter((row) => {
    const cnes = String(row?.[1] || "").trim();
    if (cnes) {
      if (seenCnes.has(cnes)) return false;
      seenCnes.add(cnes);
      return true;
    }

    if (row?.[8] !== SOURCE) return true;
    const key = [
      rowType(row, listKind),
      nomeCanonico(row?.[0]),
      normalizePlace(row?.[4]),
    ].join("|");
    if (seenPlanilha.has(key)) return false;
    seenPlanilha.add(key);
    return true;
  });
}

function annotatePoloFromCnes(polo, networkRow, record) {
  if (!networkRow) return;
  polo.cnes = String(networkRow?.[1] || polo.cnes || "");
  polo.coord_cnes = {
    lat: Number(networkRow?.[2]),
    lon: Number(networkRow?.[3]),
  };
  const km = distanciaKm(
    Number(networkRow?.[2]),
    Number(networkRow?.[3]),
    record.lat,
    record.lon,
  );
  polo.coord_diferenca_km = km == null ? null : Number(km.toFixed(1));
  polo.coord_divergencia = classificarDivergencia(km);
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
        .forEach((record) => mergeNationalCasai(redeRow.payload, record));
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
        const canonical = nomeCanonico(record.name);
        let polo = dsei.polos.find(
          (item) => nomeCanonico(item?.n) === canonical,
        );
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

        const networkRow = findNetworkMatch(network.u, record, "u");
        if (networkRow) {
          annotateNetworkRecord(networkRow, record);
          annotatePoloFromCnes(polo, networkRow, record);
        }
        return;
      }

      if (record.type === "CASAI") {
        mergeNetworkRecord(network.c, record, "c");
        return;
      }

      mergeNetworkRecord(network.u, record, "u");
    });

    network.u = dedupeNetworkList(network.u, "u");
    network.c = dedupeNetworkList(network.c, "c");
  });

  redeRow.payload.nac = dedupeNetworkList(redeRow.payload.nac || [], "c");
  lmapRow.payload.lotacoes_geograficas = {
    fonte: SOURCE,
    reconciliada_com: "CNES",
    criterio_identidade:
      "CNES > tipo > nome canônico > município > proximidade conservadora",
    coordenada_preferida: "CNES quando identificada; lotações como comparação",
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
