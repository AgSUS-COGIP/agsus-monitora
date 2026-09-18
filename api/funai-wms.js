import { origemDeTerceiro } from "../src/lib/origem-da-requisicao.js";

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

  if (origemDeTerceiro(req)) {
    res.status(403).end("origem_nao_permitida");
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
    /*
      O GeoServer responde erro em XML ou HTML com status 200. Repassar o tipo
      declarado por ele faria essa página ser servida como documento a partir
      da origem do MONITORA — conteúdo de terceiro executando no nosso domínio.
      Só passa o que for imagem; o resto vira falha de upstream.
    */
    const tipo = String(upstream.headers.get("content-type") || "");
    if (!tipo.startsWith("image/")) {
      res.status(502).end("funai_resposta_nao_e_imagem");
      return;
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    res.status(200);
    res.setHeader("Content-Type", tipo);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=86400, stale-while-revalidate=604800",
    );
    res.end(body);
  } catch {
    res.status(502).end("funai_unavailable");
  }
}
