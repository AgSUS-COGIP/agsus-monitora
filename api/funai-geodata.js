import { origemDeTerceiro } from "../src/lib/origem-da-requisicao.js";

const FUNAI_OWS_ENDPOINTS = [
  "https://geoserver.funai.gov.br/geoserver/Funai/ows",
  "https://geoserver.funai.gov.br/geoserver/ows",
];

const STATIC_DATASETS = {
  territories: {
    endpoint: FUNAI_OWS_ENDPOINTS[0],
    typeName: "Funai:tis_poligonais",
  },
};

/*
  A camada Funai:areas_dsei é a identificação histórica publicada para a área
  dos DSEIs. O catálogo atual pode omitir a camada no workspace específico,
  então ela é testada primeiro e o GetCapabilities fica como descoberta de
  contingência. Nenhum nome é aceito sem devolver GeoJSON poligonal válido.
*/
const DSEI_KNOWN_TYPE_NAMES = ["Funai:areas_dsei"];

let resolvedDseiSource = null;
/*
  Sem esta trava, várias requisições simultâneas em instância fria refaziam a
  descoberta inteira cada uma — até seis chamadas ao GeoServer por requisição.
  Sob carga isso martela a Funai, que é justamente quem não podemos irritar.
  Guardar a promessa em andamento faz as concorrentes esperarem a primeira.
*/
let descobertaEmCurso = null;

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function featureTypesFromCapabilities(xml) {
  const source = String(xml || "");
  const blocks =
    source.match(
      /<(?:[A-Za-z0-9_-]+:)?FeatureType\b[\s\S]*?<\/(?:[A-Za-z0-9_-]+:)?FeatureType>/gi,
    ) || [];

  const tagValue = (block, tag) =>
    block
      .match(
        new RegExp(
          `<(?:[A-Za-z0-9_-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${tag}>`,
          "i",
        ),
      )?.[1]
      ?.trim() || "";

  return blocks
    .map((block) => ({
      name: tagValue(block, "Name"),
      title: tagValue(block, "Title"),
    }))
    .filter((item) => item.name);
}

export function chooseDseiFeatureType(featureTypes = []) {
  const scored = featureTypes
    .map((item) => {
      const text = normalizeLabel(`${item?.name || ""} ${item?.title || ""}`);
      const hasDsei =
        /\bDSEI\b/.test(text) ||
        text.includes("DISTRITO SANITARIO ESPECIAL INDIGENA");
      if (!hasDsei) return null;

      const looksLikeSeat =
        text.includes("SEDE") ||
        text.includes("LOCALIZACAO") ||
        text.includes("PONTO");
      const looksLikeArea =
        text.includes("AREA") ||
        text.includes("ATUACAO") ||
        text.includes("ABRANGENCIA") ||
        text.includes("POLIGONO");

      return {
        name: String(item.name || "").trim(),
        score: (looksLikeArea ? 10 : 0) - (looksLikeSeat ? 20 : 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  return best && best.score >= 0 ? best.name : "";
}

function safeBbox(value) {
  const raw = String(first(value) || "").trim();
  if (!raw) return "";
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return "";
  const [west, south, east, north] = parts;
  if (
    west < -180 ||
    east > 180 ||
    south < -90 ||
    north > 90 ||
    west >= east ||
    south >= north
  ) {
    return "";
  }
  return parts.join(",");
}

function json(res, status, payload) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=1800, stale-while-revalidate=86400",
  );
  res.end(JSON.stringify(payload));
}

function parseGeoJson(body) {
  const source = String(body || "").trim();
  if (!source.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(source);
    return parsed?.type === "FeatureCollection" &&
      Array.isArray(parsed.features)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function isPolygonGeoJsonBody(body) {
  const parsed = parseGeoJson(body);
  if (!parsed || !parsed.features.length) return false;
  return parsed.features.some((feature) =>
    ["Polygon", "MultiPolygon"].includes(String(feature?.geometry?.type || "")),
  );
}

function featureParams(typeName, extra = {}) {
  return new URLSearchParams({
    service: "WFS",
    version: "1.0.0",
    request: "GetFeature",
    typeName,
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    ...extra,
  });
}

async function requestFeatureCollection(endpoint, typeName, extra = {}) {
  const params = featureParams(typeName, extra);
  const response = await fetch(`${endpoint}?${params.toString()}`, {
    headers: { Accept: "application/geo+json,application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return null;
  const body = await response.text();
  return parseGeoJson(body) ? body : null;
}

async function resolveDseiSource() {
  if (resolvedDseiSource) return resolvedDseiSource;
  if (descobertaEmCurso) return descobertaEmCurso;
  descobertaEmCurso = descobrirFonteDsei().finally(() => {
    descobertaEmCurso = null;
  });
  return descobertaEmCurso;
}

async function descobrirFonteDsei() {
  for (const endpoint of FUNAI_OWS_ENDPOINTS) {
    for (const typeName of DSEI_KNOWN_TYPE_NAMES) {
      const body = await requestFeatureCollection(endpoint, typeName, {
        maxFeatures: "100",
      }).catch(() => null);
      if (isPolygonGeoJsonBody(body)) {
        resolvedDseiSource = { endpoint, typeName };
        return resolvedDseiSource;
      }
    }
  }

  for (const endpoint of FUNAI_OWS_ENDPOINTS) {
    const params = new URLSearchParams({
      service: "WFS",
      version: "1.0.0",
      request: "GetCapabilities",
    });
    const response = await fetch(`${endpoint}?${params.toString()}`, {
      headers: { Accept: "application/xml,text/xml,*/*" },
      signal: AbortSignal.timeout(12000),
    }).catch(() => null);
    if (!response?.ok) continue;

    const xml = await response.text();
    const typeName = chooseDseiFeatureType(featureTypesFromCapabilities(xml));
    if (!typeName) continue;

    const body = await requestFeatureCollection(endpoint, typeName, {
      maxFeatures: "100",
    }).catch(() => null);
    if (!isPolygonGeoJsonBody(body)) continue;

    resolvedDseiSource = { endpoint, typeName };
    return resolvedDseiSource;
  }

  throw new Error(
    "Camada poligonal de DSEI não encontrada ou indisponível na Funai",
  );
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "method_not_allowed" });
  }

  if (origemDeTerceiro(req)) {
    return json(res, 403, { error: "origem_nao_permitida" });
  }

  const dataset = String(first(req.query?.dataset) || "");
  if (dataset !== "territories" && dataset !== "dsei") {
    return json(res, 400, { error: "invalid_dataset" });
  }

  try {
    const source =
      dataset === "dsei"
        ? await resolveDseiSource()
        : STATIC_DATASETS.territories;

    const extra = {};
    if (dataset === "territories") {
      const bbox = safeBbox(req.query?.bbox);
      if (!bbox) return json(res, 400, { error: "invalid_bbox" });
      const requested = Number(first(req.query?.maxFeatures));
      const maxFeatures = Number.isFinite(requested)
        ? Math.max(1, Math.min(500, Math.round(requested)))
        : 250;
      extra.maxFeatures = String(maxFeatures);
      extra.bbox = `${bbox},EPSG:4326`;
    } else {
      extra.maxFeatures = "100";
    }

    const body = await requestFeatureCollection(
      source.endpoint,
      source.typeName,
      extra,
    );
    const valid =
      dataset === "dsei"
        ? isPolygonGeoJsonBody(body)
        : Boolean(parseGeoJson(body));

    if (!valid) {
      if (dataset === "dsei") resolvedDseiSource = null;
      return json(res, 502, {
        error: "funai_invalid_geojson",
        dataset,
      });
    }

    res.status(200);
    res.setHeader("Content-Type", "application/geo+json; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      dataset === "dsei"
        ? "public, s-maxage=86400, stale-while-revalidate=604800"
        : "public, s-maxage=1800, stale-while-revalidate=86400",
    );
    res.end(body);
  } catch (error) {
    // A mensagem do erro fica no log do servidor, não na resposta pública:
    // ela pode carregar endereço interno ou detalhe de infraestrutura.
    console.error("funai-geodata:", error);
    return json(res, 502, { error: "funai_unavailable", dataset });
  }
}
