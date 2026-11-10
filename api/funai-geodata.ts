import { origemDeTerceiro } from "../src/lib/origem-da-requisicao.js";
import type { PedidoDaVercel, RespostaDaVercel } from "./_tipos-da-vercel.js";

/** Onde e com que nome de camada o GeoServer serve um conjunto. */
type FonteGeo = { endpoint: string; typeName: string };

/*
  `dsei` saiu em 10/11/2026: a Funai deixou de publicar `Funai:areas_dsei` e o
  pedido dava 502 a cada página. O contorno dos DSEIs vem do arquivo local
  public/data/contornos-dos-dseis.json (scripts/compilar-contornos-dos-dseis.mjs).
*/
const DATASETS = ["territories", "estudo"] as const;
type Dataset = (typeof DATASETS)[number];

function ehDataset(valor: string): valor is Dataset {
  return (DATASETS as readonly string[]).includes(valor);
}

const FUNAI_OWS = "https://geoserver.funai.gov.br/geoserver/Funai/ows";

const DATASET_SOURCES: Record<Dataset, FonteGeo> = {
  territories: {
    endpoint: FUNAI_OWS,
    typeName: "Funai:tis_poligonais",
  },
  /*
    AS TERRAS QUE AINDA NÃO TÊM LIMITE DESENHADO

    `tis_poligonais` traz seis fases — Regularizada, Declarada, Delimitada,
    Encaminhada RI, Homologada e Em Estudo —, mas só quem já tem polígono. As
    163 terras em estudo sem limite definido vivem noutra camada, e existem
    apenas como ponto.

    Sem elas o mapa mostrava polos base aparentemente fora de qualquer terra
    indígena. Medido: dos 146 polos fora de polígono, nove estão a menos de
    5 km de uma terra em estudo, e o de João Câmara está a 60 metros da TI
    Mendonça do Amarelão. Eles atendem terra indígena — é a terra que ainda
    não tem limite publicado.
  */
  estudo: {
    endpoint: FUNAI_OWS,
    typeName: "Funai:tis_pontos",
  },
};

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function safeBbox(value: unknown): string {
  const raw = String(first(value) || "").trim();
  if (!raw) return "";
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return "";
  // Os padrões nunca valem: o tamanho 4 já foi conferido acima.
  const [west = NaN, south = NaN, east = NaN, north = NaN] = parts;
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

function json(res: RespostaDaVercel, status: number, payload: unknown): void {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  // Só resposta boa vai para o cache compartilhado: um 403 de origem de
  // terceiro ou um 502 passageiro não pode ser servido a quem usa o MONITORA.
  res.setHeader(
    "Cache-Control",
    status < 400
      ? "public, s-maxage=1800, stale-while-revalidate=86400"
      : "no-store",
  );
  res.end(JSON.stringify(payload));
}

function parseGeoJson(body: unknown): { features: unknown[] } | null {
  const source = String(body || "").trim();
  if (!source.startsWith("{")) return null;
  try {
    const parsed: unknown = JSON.parse(source);
    return typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      parsed.type === "FeatureCollection" &&
      "features" in parsed &&
      Array.isArray(parsed.features)
      ? { features: parsed.features }
      : null;
  } catch {
    return null;
  }
}

function featureParams(
  typeName: string,
  extra: Record<string, string> = {},
): URLSearchParams {
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

async function requestFeatureCollection(
  endpoint: string,
  typeName: string,
  extra: Record<string, string> = {},
): Promise<string | null> {
  const params = featureParams(typeName, extra);
  const response = await fetch(`${endpoint}?${params.toString()}`, {
    headers: { Accept: "application/geo+json,application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return null;
  const body = await response.text();
  return parseGeoJson(body) ? body : null;
}

export default async function handler(
  req: PedidoDaVercel,
  res: RespostaDaVercel,
): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "method_not_allowed" });
  }

  if (origemDeTerceiro(req)) {
    return json(res, 403, { error: "origem_nao_permitida" });
  }

  const dataset = String(first(req.query?.dataset) || "");
  if (!ehDataset(dataset)) {
    return json(res, 400, { error: "invalid_dataset" });
  }

  try {
    const source = DATASET_SOURCES[dataset];

    const extra: Record<string, string> = {};
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
      /*
        estudo: são 163 pontos no país inteiro, sem geometria de área — cabem
        num pedido só, e não vale a pena recortar por enquadramento.
      */
      extra.maxFeatures = "500";
    }

    const body = await requestFeatureCollection(
      source.endpoint,
      source.typeName,
      extra,
    );
    if (!parseGeoJson(body)) {
      return json(res, 502, {
        error: "funai_invalid_geojson",
        dataset,
      });
    }

    res.status(200);
    res.setHeader("Content-Type", "application/geo+json; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=1800, stale-while-revalidate=86400",
    );
    res.end(body);
  } catch (error) {
    // A mensagem do erro fica no log do servidor, não na resposta pública:
    // ela pode carregar endereço interno ou detalhe de infraestrutura.
    console.error("funai-geodata:", error);
    return json(res, 502, { error: "funai_unavailable", dataset });
  }
}
