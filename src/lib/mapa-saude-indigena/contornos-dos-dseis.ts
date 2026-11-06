/*
  OS CONTORNOS DOS 34 DSEIs, LOCAIS

  Até aqui o mapa nacional não desenhava contorno de DSEI nenhum: só o Brasil
  e as divisas das UFs (`contornos.js`). A abrangência oficial vinha da Funai
  (`/api/funai-geodata?dataset=dsei`, camada `Funai:areas_dsei`), que deixou
  de publicá-la — o proxy responde 502 e a camada fica vazia (ver
  `src/lib/terras-indigenas/geometria.ts`).

  O "Mapa DSEIs" usa um arquivo estático, `public/data/contornos-dos-dseis.json`,
  gerado por `scripts/compilar-contornos-dos-dseis.mjs` a partir da última
  publicação da camada `Funai:areas_dsei` (shapefile da própria Funai),
  simplificado para a escala nacional. Cada feição traz o número (1–34, de
  `dseis-oficiais.ts`), o nome oficial e o ponto do rótulo, já calculado
  dentro do polígono.

  Chega sob demanda — só quando o Mapa DSEIs é escolhido — e uma vez por
  página. Arquivo inválido ou ausente: o mapa fica sem os polígonos, e o
  resto continua.
*/
import { nomeOficialDoDsei } from "./dseis-oficiais.ts";

export const ARQUIVO_DOS_CONTORNOS_DOS_DSEIS = "/data/contornos-dos-dseis.json";

type Posicao = [number, number];
export interface GeometriaDoDsei {
  type: "Polygon" | "MultiPolygon";
  coordinates: Posicao[][] | Posicao[][][];
}
export interface ContornoDoDsei {
  type: "Feature";
  properties: {
    numero: number;
    nome: string;
    /** [latitude, longitude] do número, dentro do polígono. */
    rotulo: [number, number];
  };
  geometry: GeometriaDoDsei;
}

const ehNumero = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

function ehAnel(anel: unknown): boolean {
  return (
    Array.isArray(anel) &&
    anel.length >= 4 &&
    anel.every((p) => Array.isArray(p) && ehNumero(p[0]) && ehNumero(p[1]))
  );
}

function geometriaValida(g: unknown): g is GeometriaDoDsei {
  if (!g || typeof g !== "object") return false;
  const tipo = Reflect.get(g, "type");
  const coordenadas: unknown = Reflect.get(g, "coordinates");
  if (!Array.isArray(coordenadas) || !coordenadas.length) return false;
  if (tipo === "Polygon") return coordenadas.every(ehAnel);
  if (tipo === "MultiPolygon")
    return coordenadas.every(
      (poligono) =>
        Array.isArray(poligono) && poligono.length && poligono.every(ehAnel),
    );
  return false;
}

/*
  Só o que dá para desenhar: número de 1 a 34 (o nome é o oficial, não o do
  arquivo), geometria de polígono e ponto do rótulo. Um número repetido fica
  com a primeira feição.
*/
export function contornosValidos(dados: unknown): ContornoDoDsei[] {
  const feicoes: unknown =
    dados && typeof dados === "object" ? Reflect.get(dados, "features") : null;
  if (!Array.isArray(feicoes)) return [];
  const vistos = new Set<number>();
  const validos: ContornoDoDsei[] = [];
  for (const f of feicoes) {
    if (!f || typeof f !== "object") continue;
    const p: unknown = Reflect.get(f, "properties");
    const numero = p && typeof p === "object" ? Reflect.get(p, "numero") : null;
    const rotulo: unknown =
      p && typeof p === "object" ? Reflect.get(p, "rotulo") : null;
    const nome = ehNumero(numero) ? nomeOficialDoDsei(numero) : null;
    const geometria: unknown = Reflect.get(f, "geometry");
    if (!nome || !ehNumero(numero) || vistos.has(numero)) continue;
    if (!geometriaValida(geometria)) continue;
    if (!Array.isArray(rotulo) || !ehNumero(rotulo[0]) || !ehNumero(rotulo[1]))
      continue;
    vistos.add(numero);
    validos.push({
      type: "Feature",
      properties: { numero, nome, rotulo: [rotulo[0], rotulo[1]] },
      geometry: geometria,
    });
  }
  return validos.sort((a, b) => a.properties.numero - b.properties.numero);
}

let pedido: Promise<ContornoDoDsei[]> | null = null;

/* Uma vez por página; a falha também fica guardada (lista vazia). */
export function carregarContornosDosDseis(
  buscar: typeof fetch = globalThis.fetch,
): Promise<ContornoDoDsei[]> {
  pedido ??= Promise.resolve()
    .then(() =>
      buscar(ARQUIVO_DOS_CONTORNOS_DOS_DSEIS, {
        headers: { Accept: "application/json" },
      }),
    )
    .then((resposta) => {
      if (!resposta.ok)
        throw new Error(`Contornos dos DSEIs: HTTP ${resposta.status}`);
      return resposta.json();
    })
    .then(contornosValidos)
    .catch((erro: unknown) => {
      console.warn("Contornos dos DSEIs indisponíveis.", erro);
      return [];
    });
  return pedido;
}

/* Só para os testes: esquece o pedido guardado. */
export function esquecerContornosDosDseis() {
  pedido = null;
}
