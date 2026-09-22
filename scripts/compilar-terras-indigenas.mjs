import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/*
  COMPILA AS TERRAS INDÍGENAS NUM FICHEIRO QUE O MAPA CARREGA UMA VEZ SÓ

  POR QUE

  O mapa pedia a geometria à Funai a cada movimento. O enquadramento vira um
  bbox de floats crus, dois panes seguidos nunca partilham URL, e por isso
  nenhuma cache acertava. Medido contra o GeoServer da Funai:

      um enquadramento (250 polígonos no máximo)     677 ms   23 terras   1,22 MB
      o mesmo enquadramento, um pixel ao lado        507 ms   23 terras   1,22 MB

  Meio segundo de espera por cada arrasto do rato, e 1,2 MB para desenhar 23
  terras. Abrir um DSEI era pior: pedia-se o enquadramento inteiro, com um teto
  de 250 polígonos, e só depois se descartava o que não era daquele distrito —
  gastando o teto com terras que iam ser deitadas fora.

  A GEOMETRIA É DETALHADA DEMAIS PARA O QUE SE DESENHA

  O país inteiro são 665 terras e 1.835.560 vértices, 47 MB. São 2760 vértices
  por terra. Num monitor a mostrar o Brasil, uma terra ocupa dezenas de pixels:
  desses 2760 vértices o ecrã distingue talvez vinte.

  Simplificando com Douglas-Peucker a 0,001° — 111 metros — ficam 113.864
  vértices, 2,17 MB, 0,61 MB comprimido. Menos de metade do que custava UM
  enquadramento, e traz as 665 terras em vez de 23.

  Medido numa terra grande, a Yanomami: 61.562 vértices passam a 4.147, e os
  dois contornos desenhados lado a lado são indistinguíveis.

  O QUE ISTO CUSTA, DITO CLARAMENTE

  111 metros de tolerância. Um pixel vale 111 metros por volta do zoom 10; daí
  para cima o contorno simplificado começa a afastar-se do publicado, e perto
  do zoom 14 o desvio chega a uns dois pixels. Para saber que terras um DSEI
  atende, isso não muda nada. Para medir um limite, este mapa nunca serviu e
  continua a não servir — a fonte é a Funai.

  QUANDO CORRER

  Quando a Funai publicar alteração. Não corre no `npm run build` de propósito:
  o build não deve depender de um serviço externo estar de pé. O resultado é
  versionado, como os ficheiros de lotações.

      node scripts/compilar-terras-indigenas.mjs
*/
const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const OWS = "https://geoserver.funai.gov.br/geoserver/Funai/ows";
const TOLERANCIA_GRAUS = 0.001;
const CASAS_DECIMAIS = 4; // 11 metros; abaixo da tolerância, não perde nada
const TEMPO_LIMITE_MS = 180000;

async function pedir(typeName, maxFeatures) {
  const params = new URLSearchParams({
    service: "WFS",
    version: "1.0.0",
    request: "GetFeature",
    typeName,
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    maxFeatures: String(maxFeatures),
  });
  const resposta = await fetch(`${OWS}?${params}`, {
    headers: { Accept: "application/geo+json,application/json" },
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  if (!resposta.ok) throw new Error(`${typeName}: HTTP ${resposta.status}`);
  const dados = await resposta.json();
  if (!Array.isArray(dados?.features))
    throw new Error(`${typeName}: GeoJSON inválido`);
  return dados.features;
}

function distanciaPerpendicular(p, a, b) {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/*
  Douglas-Peucker com pilha explícita. A versão recursiva estoura a pilha do
  Node num anel de 40 mil pontos, e há anéis assim.
*/
function simplificarAnel(pontos, tolerancia) {
  if (pontos.length <= 4) return pontos;
  const manter = new Uint8Array(pontos.length);
  manter[0] = 1;
  manter[pontos.length - 1] = 1;
  const pilha = [[0, pontos.length - 1]];
  while (pilha.length) {
    const [inicio, fim] = pilha.pop();
    let maior = 0;
    let indice = -1;
    for (let i = inicio + 1; i < fim; i += 1) {
      const d = distanciaPerpendicular(pontos[i], pontos[inicio], pontos[fim]);
      if (d > maior) {
        maior = d;
        indice = i;
      }
    }
    if (maior > tolerancia && indice > 0) {
      manter[indice] = 1;
      pilha.push([inicio, indice], [indice, fim]);
    }
  }
  const saida = pontos.filter((_, i) => manter[i]);
  // Um anel precisa de quatro pontos para continuar a fechar um polígono.
  if (saida.length < 4) return pontos.slice(0, 4);
  const primeiro = saida[0];
  const ultimo = saida[saida.length - 1];
  if (primeiro[0] !== ultimo[0] || primeiro[1] !== ultimo[1])
    saida.push(primeiro);
  return saida;
}

const arredondar = (v) => Number(v.toFixed(CASAS_DECIMAIS));

function simplificarGeometria(geometria) {
  const trata = (poligono) =>
    poligono
      .map((anel) =>
        simplificarAnel(anel, TOLERANCIA_GRAUS).map(([x, y]) => [
          arredondar(x),
          arredondar(y),
        ]),
      )
      .filter((anel) => anel.length >= 4);

  if (geometria?.type === "Polygon") {
    const p = trata(geometria.coordinates);
    return p.length ? { type: "Polygon", coordinates: p } : null;
  }
  if (geometria?.type === "MultiPolygon") {
    const ps = geometria.coordinates.map(trata).filter((p) => p.length);
    return ps.length ? { type: "MultiPolygon", coordinates: ps } : null;
  }
  return null;
}

/*
  Só os campos que o mapa lê. A Funai devolve dezenas, e cada um multiplica-se
  por 665 no ficheiro que o navegador descarrega.
*/
function propriedadesUteis(p = {}) {
  return {
    terrai_nome: p.terrai_nome ?? p.no_ti ?? "",
    etnia_nome: p.etnia_nome ?? "",
    uf_sigla: p.uf_sigla ?? "",
    fase_ti: p.fase_ti ?? "",
    municipio_: p.municipio_ ?? "",
    superficie: p.superficie ?? null,
  };
}

function contarVertices(features) {
  let n = 0;
  for (const f of features) {
    const g = f.geometry;
    const pol =
      g?.type === "Polygon"
        ? [g.coordinates]
        : g?.type === "MultiPolygon"
          ? g.coordinates
          : [];
    for (const p of pol) for (const anel of p) n += anel.length;
  }
  return n;
}

const mb = (texto) => (Buffer.byteLength(texto) / 1048576).toFixed(2);

console.log("Pedindo as terras com limite desenhado...");
const poligonais = await pedir("Funai:tis_poligonais", 2000);
const verticesAntes = contarVertices(poligonais);
console.log(
  `  ${poligonais.length} terras, ${verticesAntes.toLocaleString("pt-BR")} vértices`,
);

const simplificadas = [];
for (const f of poligonais) {
  const geometry = simplificarGeometria(f.geometry);
  if (!geometry) continue;
  simplificadas.push({
    type: "Feature",
    geometry,
    properties: propriedadesUteis(f.properties),
  });
}
const verticesDepois = contarVertices(simplificadas);

console.log("Pedindo as terras em estudo, que só existem como ponto...");
const pontos = await pedir("Funai:tis_pontos", 500);
console.log(`  ${pontos.length} terras em estudo`);

const colecaoPoligonos = {
  type: "FeatureCollection",
  gerado_em: new Date().toISOString().slice(0, 10),
  fonte: "Funai — Funai:tis_poligonais",
  tolerancia_graus: TOLERANCIA_GRAUS,
  features: simplificadas,
};
const colecaoEstudo = {
  type: "FeatureCollection",
  gerado_em: new Date().toISOString().slice(0, 10),
  fonte: "Funai — Funai:tis_pontos",
  features: pontos
    .filter((f) => f.geometry?.type === "Point")
    .map((f) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: f.geometry.coordinates.slice(0, 2).map(arredondar),
      },
      properties: propriedadesUteis(f.properties),
    })),
};

const destinoPoligonos = join(RAIZ, "public/data/terras-indigenas.json");
const destinoEstudo = join(RAIZ, "public/data/terras-indigenas-em-estudo.json");
const textoPoligonos = JSON.stringify(colecaoPoligonos);
const textoEstudo = JSON.stringify(colecaoEstudo);
writeFileSync(destinoPoligonos, textoPoligonos);
writeFileSync(destinoEstudo, textoEstudo);

const queda = ((1 - verticesDepois / verticesAntes) * 100).toFixed(1);
console.log("");
console.log(
  `terras-indigenas.json           ${String(simplificadas.length).padStart(4)} terras  ${mb(textoPoligonos).padStart(6)} MB  ${verticesDepois.toLocaleString("pt-BR")} vértices (-${queda}%)`,
);
console.log(
  `terras-indigenas-em-estudo.json ${String(colecaoEstudo.features.length).padStart(4)} pontos  ${mb(textoEstudo).padStart(6)} MB`,
);
