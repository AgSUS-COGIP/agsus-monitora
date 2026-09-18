const FUNAI_WMS = "https://geoserver.funai.gov.br/geoserver/Funai/wms";
const TERRITORY_LAYER = "Funai:tis_poligonais";

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function numberInRange(value, min, max) {
  const n = Number(first(value));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).setHeader("Allow", "GET").end();
    return;
  }

  const bbox = String(first(req.query?.bbox) || "").trim();
  const width = numberInRange(req.query?.width, 1, 2048);
  const height = numberInRange(req.query?.height, 1, 2048);
  if (!bbox || !width || !height) {
    res.status(400).end("invalid_wms_request");
    return;
  }

  const params = new URLSearchParams({
    service: "WMS",
    request: "GetMap",
    version: "1.1.1",
    layers: TERRITORY_LAYER,
    styles: "",
    format: "image/png",
    transparent: "true",
    srs: String(first(req.query?.srs) || "EPSG:3857"),
    bbox,
    width: String(Math.round(width)),
    height: String(Math.round(height)),
  });

  try {
    const upstream = await fetch(`${FUNAI_WMS}?${params.toString()}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) {
      res.status(502).end("funai_upstream_error");
      return;
    }
    const body = Buffer.from(await upstream.arrayBuffer());
    res.status(200);
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "image/png",
    );
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=86400, stale-while-revalidate=604800",
    );
    res.end(body);
  } catch {
    res.status(502).end("funai_unavailable");
  }
}
