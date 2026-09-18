const FUNAI_OWS = "https://geoserver.funai.gov.br/geoserver/Funai/ows";

const STATIC_DATASETS = {
  territories: "Funai:tis_poligonais",
};

let resolvedDseiTypeName = "";

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
  const blocks = source.match(/<FeatureType\b[\s\S]*?<\/FeatureType>/gi) || [];

  return blocks
    .map((block) => {
      const name =
        block.match(/<Name\b[^>]*>([\s\S]*?)<\/Name>/i)?.[1]?.trim() || "";
      const title =
        block.match(/<Title\b[^>]*>([\s\S]*?)<\/Title>/i)?.[1]?.trim() || "";
      return { name, title };
    })
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

async function resolveDseiTypeName() {
  if (resolvedDseiTypeName) return resolvedDseiTypeName;

  const params = new URLSearchParams({
    service: "WFS",
    version: "1.0.0",
    request: "GetCapabilities",
  });
  const response = await fetch(`${FUNAI_OWS}?${params.toString()}`, {
    headers: { Accept: "application/xml,text/xml,*/*" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    throw new Error(`FUNAI capabilities HTTP ${response.status}`);
  }

  const xml = await response.text();
  const typeName = chooseDseiFeatureType(featureTypesFromCapabilities(xml));
  if (!typeName) {
    throw new Error("Camada poligonal de DSEI não encontrada no catálogo da Funai");
  }

  resolvedDseiTypeName = typeName;
  return typeName;
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

function isGeoJsonBody(body) {
  const source = String(body || "").trim();
  if (!source.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(source);
    return parsed?.type === "FeatureCollection" && Array.isArray(parsed.features);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "method_not_allowed" });
  }

  const dataset = String(first(req.query?.dataset) || "");
  if (dataset !== "territories" && dataset !== "dsei") {
    return json(res, 400, { error: "invalid_dataset" });
  }

  try {
    const typeName =
      dataset === "dsei"
        ? await resolveDseiTypeName()
        : STATIC_DATASETS.territories;

    const params = new URLSearchParams({
      service: "WFS",
      version: "1.0.0",
      request: "GetFeature",
      typeName,
      outputFormat: "application/json",
      srsName: "EPSG:4326",
    });

    if (dataset === "territories") {
      const bbox = safeBbox(req.query?.bbox);
      if (!bbox) return json(res, 400, { error: "invalid_bbox" });
      const requested = Number(first(req.query?.maxFeatures));
      const maxFeatures = Number.isFinite(requested)
        ? Math.max(1, Math.min(500, Math.round(requested)))
        : 250;
      params.set("maxFeatures", String(maxFeatures));
      params.set("bbox", `${bbox},EPSG:4326`);
    } else {
      params.set("maxFeatures", "100");
    }

    const upstream = await fetch(`${FUNAI_OWS}?${params.toString()}`, {
      headers: { Accept: "application/geo+json,application/json" },
      signal: AbortSignal.timeout(12000),
    });

    if (!upstream.ok) {
      return json(res, 502, {
        error: "funai_upstream_error",
        status: upstream.status,
      });
    }

    const body = await upstream.text();
    if (!isGeoJsonBody(body)) {
      if (dataset === "dsei") resolvedDseiTypeName = "";
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
    return json(res, 502, {
      error: "funai_unavailable",
      detail: String(error?.message || error).slice(0, 180),
    });
  }
}
