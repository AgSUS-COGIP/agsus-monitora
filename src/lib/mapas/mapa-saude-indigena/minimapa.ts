/*
  O MINIMAPA DE LOCALIZAÇÃO DO DSEI

  Como no Mapa dos DSEIs do SIGEPSI: no canto do mapa do DSEI, um Brasil
  pequeno com a área do distrito em destaque, para quem não sabe de cabeça
  onde fica o DSEI. É um SVG (sem Leaflet): o contorno do Brasil
  (`BR_OUTLINE`) e o do DSEI (`contornos-dos-dseis.json`) projetados num
  retângulo; sem o contorno do DSEI, um ponto na sede.

  Projeção equirretangular nos limites do Brasil (`BRASIL_BOUNDS`), com a
  longitude encolhida pelo cosseno da latitude média para o país não sair
  achatado. Pontos a menos de meio pixel do anterior saem do caminho (o
  contorno do DSEI tem milhares de vértices; o minimapa tem 120 px).
*/
import { BRASIL_BOUNDS } from "../brasil-bounds.ts";
import { chaveDoDsei, texto } from "./chaves.ts";
import type { ContornoDoDsei } from "./contornos-dos-dseis.ts";

type Posicao = readonly [number, number];
type Anel = readonly Posicao[];

export interface GeometriaDoMinimapa {
  type: string;
  coordinates: unknown;
}

export interface ProjecaoDoMinimapa {
  largura: number;
  altura: number;
  /** [longitude, latitude] → [x, y] em pixels. */
  ponto(lon: number, lat: number): [number, number];
}

const [[SUL, OESTE], [NORTE, LESTE]] = BRASIL_BOUNDS;

/** A projeção do Brasil numa caixa de `largura` px, com margem de `margem` px. */
export function projecaoDoBrasil(
  largura = 120,
  margem = 4,
): ProjecaoDoMinimapa {
  const cosseno = Math.cos((((SUL + NORTE) / 2) * Math.PI) / 180);
  const larguraGeo = (LESTE - OESTE) * cosseno;
  const alturaGeo = NORTE - SUL;
  const escala = (largura - 2 * margem) / larguraGeo;
  const altura = Math.round(alturaGeo * escala + 2 * margem);
  return {
    largura,
    altura,
    ponto: (lon, lat) => [
      margem + (lon - OESTE) * cosseno * escala,
      margem + (NORTE - lat) * escala,
    ],
  };
}

/* Os anéis de um Polygon ou MultiPolygon (GeoJSON: [longitude, latitude]). */
function aneis(geometria: GeometriaDoMinimapa | null | undefined): Anel[] {
  const c = geometria?.coordinates;
  if (!Array.isArray(c)) return [];
  if (geometria?.type === "Polygon") return c as Anel[];
  if (geometria?.type === "MultiPolygon") return (c as Anel[][]).flat();
  return [];
}

const fmt = (n: number) => n.toFixed(1);

/** O `d` de um `<path>` SVG para a geometria, sem os pontos que não se veem. */
export function caminhoDaGeometria(
  geometria: GeometriaDoMinimapa | null | undefined,
  projecao: ProjecaoDoMinimapa,
): string {
  const partes: string[] = [];
  for (const anel of aneis(geometria)) {
    let anterior: [number, number] | null = null;
    const pontos: string[] = [];
    for (const posicao of anel) {
      if (!Array.isArray(posicao)) continue;
      const [lon, lat] = posicao;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      const atual = projecao.ponto(lon, lat);
      if (
        anterior &&
        Math.abs(atual[0] - anterior[0]) < 0.5 &&
        Math.abs(atual[1] - anterior[1]) < 0.5
      )
        continue;
      pontos.push(`${fmt(atual[0])} ${fmt(atual[1])}`);
      anterior = atual;
    }
    if (pontos.length >= 3) partes.push(`M${pontos.join("L")}Z`);
  }
  return partes.join("");
}

/** O contorno do DSEI pela chave do mapa (nome oficial do arquivo ↔ `k`). */
export function contornoDoDsei(
  contornos: readonly ContornoDoDsei[],
  dsei: { k?: unknown; n?: unknown } | null | undefined,
): ContornoDoDsei | null {
  const chaves = new Set(
    [chaveDoDsei(dsei?.k), chaveDoDsei(dsei?.n)].filter(Boolean),
  );
  if (!chaves.size) return null;
  return (
    (contornos || []).find((c) =>
      chaves.has(chaveDoDsei(texto(c.properties?.nome))),
    ) || null
  );
}
