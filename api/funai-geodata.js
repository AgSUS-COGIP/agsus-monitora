const FUNAI_OWS = "https://geoserver.funai.gov.br/geoserver/Funai/ows";

const DATASETS = {
  territories: "Funai:tis_poligonais",
  dsei: "Funai:areas_dsei",
};

function first(value) {
  return Array.isArray(value) ? value[0] : value;
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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "method_not_allowed" });
  }

  const dataset = String(first(req.query?.dataset) || "");
  const typeName = DATASETS[dataset];
  if (!typeName) return json(res, 400, { error: "invalid_dataset" });

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

  try {
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
      detail: String(error?.message || error).slice(0, 160),
    });
  }
}
