import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import {
  DSEIS_OFICIAIS,
  numeroDoDsei,
} from "../src/lib/mapa-saude-indigena/dseis-oficiais.ts";

/*
  COMPILA OS CONTORNOS DOS 34 DSEIs PARA O "MAPA SIMPLES"

  POR QUE

  A abrangência dos DSEIs vinha da Funai, camada `Funai:areas_dsei`, pelo
  proxy `/api/funai-geodata?dataset=dsei`. A Funai tirou a camada do
  GeoServer (o proxy responde 502), e o mapa ficou sem contorno de DSEI
  nenhum. O Mapa simples precisa dos 34 polígonos sem depender de rede de
  terceiros: este script os grava em `public/data/contornos-dos-dseis.json`,
  um arquivo estático que o mapa baixa uma vez.

  DE ONDE

  O shapefile da última publicação da própria camada (WFS
  `GetFeature&typeName=Funai:areas_dsei&outputFormat=SHAPE-ZIP`), guardado
  pelo Internet Archive quando a Funai ainda o publicava:

      https://web.archive.org/web/20220420020041id_/http://geoserver.funai.gov.br/geoserver/Funai/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Funai:areas_dsei&outputFormat=SHAPE-ZIP

  USO

      node scripts/compilar-contornos-dos-dseis.mjs <areas_dsei.zip>

  O QUE FAZ

  - lê o .shp/.dbf do zip (polígonos em graus, SIRGAS 2000 ≈ WGS 84);
  - casa o nome de cada polígono com os 34 de
    `src/lib/mapa-saude-indigena/dseis-oficiais.ts` (o número 1–34 vem de
    lá) e falha se faltar algum ou sobrar algum;
  - simplifica para a escala nacional (Douglas-Peucker, ~1 km) e descarta
    ilhotas menores que um pixel a zoom 5;
  - calcula o ponto do número dentro do maior polígono (o ponto mais longe
    das bordas, numa grade), para o rótulo não cair fora num distrito em "C".
*/

const RAIZ = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SAIDA = join(RAIZ, "public/data/contornos-dos-dseis.json");
const FONTE =
  "Funai, camada Funai:areas_dsei (shapefile da última publicação, 2022)";

const TOLERANCIA = 0.01; // graus (~1 km)
const AREA_MINIMA = 0.002; // graus² (~20 km²)
const CASAS = 3; // ~100 m

/* ---------- leitura do shapefile ---------- */

function lerDbf(bytes, codificacao) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const registros = dv.getUint32(4, true);
  const cabecalho = dv.getUint16(8, true);
  const tamanho = dv.getUint16(10, true);
  const campos = [];
  for (let p = 32; p < cabecalho - 1 && bytes[p] !== 0x0d; p += 32) {
    const nome = strFromU8(bytes.subarray(p, p + 11), true)
      .replace(/\0.*$/, "")
      .trim();
    campos.push({ nome, tamanho: bytes[p + 16] });
  }
  const decodificador = new TextDecoder(codificacao);
  const linhas = [];
  for (let r = 0; r < registros; r += 1) {
    let p = cabecalho + r * tamanho + 1;
    const linha = {};
    for (const campo of campos) {
      linha[campo.nome] = decodificador
        .decode(bytes.subarray(p, p + campo.tamanho))
        .trim();
      p += campo.tamanho;
    }
    linhas.push(linha);
  }
  return linhas;
}

function lerShp(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const formas = [];
  let p = 100;
  while (p + 8 <= bytes.byteLength) {
    const conteudo = dv.getInt32(p + 4, false) * 2;
    const inicio = p + 8;
    const tipo = dv.getInt32(inicio, true);
    if (tipo === 5 || tipo === 15 || tipo === 25) {
      const partes = dv.getInt32(inicio + 36, true);
      const pontos = dv.getInt32(inicio + 40, true);
      const indices = [];
      for (let i = 0; i < partes; i += 1)
        indices.push(dv.getInt32(inicio + 44 + i * 4, true));
      const base = inicio + 44 + partes * 4;
      const aneis = indices.map((de, i) => {
        const ate = i + 1 < partes ? indices[i + 1] : pontos;
        const anel = [];
        for (let k = de; k < ate; k += 1)
          anel.push([
            dv.getFloat64(base + k * 16, true),
            dv.getFloat64(base + k * 16 + 8, true),
          ]);
        return anel;
      });
      formas.push(aneis);
    } else formas.push([]);
    p = inicio + conteudo;
  }
  return formas;
}

/* ---------- geometria ---------- */

const areaComSinal = (anel) => {
  let soma = 0;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1)
    soma += (anel[j][0] - anel[i][0]) * (anel[j][1] + anel[i][1]);
  return soma / 2; // > 0: horário (externo no shapefile)
};

function dentro([x, y], anel) {
  let d = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      d = !d;
  }
  return d;
}

/*
  Anéis do shapefile → polígonos. A orientação não é confiável (o GeoServer
  nem sempre grava o externo no sentido horário): do maior para o menor, um
  anel dentro de um polígono já visto é buraco dele; senão, é um polígono novo.
*/
function poligonosDe(aneis) {
  const ordenados = aneis
    .filter((anel) => anel.length >= 4)
    .sort((a, b) => Math.abs(areaComSinal(b)) - Math.abs(areaComSinal(a)));
  const poligonos = [];
  for (const anel of ordenados) {
    const dono = poligonos.find(
      (pol) =>
        dentro(anel[0], pol[0]) &&
        !pol.slice(1).some((b) => dentro(anel[0], b)),
    );
    if (dono) dono.push(anel);
    else poligonos.push([anel]);
  }
  return poligonos;
}

function distanciaAoSegmento([x, y], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t =
    dx || dy
      ? Math.max(
          0,
          Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)),
        )
      : 0;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function douglasPeucker(pontos, tolerancia) {
  if (pontos.length < 3) return pontos;
  const manter = new Uint8Array(pontos.length);
  manter[0] = manter[pontos.length - 1] = 1;
  const pilha = [[0, pontos.length - 1]];
  while (pilha.length) {
    const [a, b] = pilha.pop();
    let maior = 0;
    let indice = -1;
    for (let i = a + 1; i < b; i += 1) {
      const d = distanciaAoSegmento(pontos[i], pontos[a], pontos[b]);
      if (d > maior) {
        maior = d;
        indice = i;
      }
    }
    if (maior > tolerancia && indice > 0) {
      manter[indice] = 1;
      pilha.push([a, indice], [indice, b]);
    }
  }
  return pontos.filter((_, i) => manter[i]);
}

const arredondar = (v) => Number(v.toFixed(CASAS));

function simplificarAnel(anel) {
  const aberto = anel.slice(0, -1);
  // Divide em duas metades para o anel fechado não colapsar no primeiro ponto.
  const meio = Math.floor(aberto.length / 2);
  const simples = [
    ...douglasPeucker(aberto.slice(0, meio + 1), TOLERANCIA).slice(0, -1),
    ...douglasPeucker([...aberto.slice(meio), aberto[0]], TOLERANCIA),
  ].map(([x, y]) => [arredondar(x), arredondar(y)]);
  const unicos = simples.filter(
    (p, i) =>
      i === 0 || p[0] !== simples[i - 1][0] || p[1] !== simples[i - 1][1],
  );
  if (unicos.length < 4) return null;
  const [x0, y0] = unicos[0];
  const [xn, yn] = unicos[unicos.length - 1];
  if (x0 !== xn || y0 !== yn) unicos.push([x0, y0]);
  return unicos;
}

/* O ponto mais longe das bordas (grade 48×48, refinada em volta do melhor). */
function pontoDoRotulo(poligono) {
  const [externo] = poligono;
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of externo) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const distanciaDaBorda = (p) => {
    if (!dentro(p, externo) || poligono.slice(1).some((b) => dentro(p, b)))
      return -1;
    let menor = Infinity;
    for (const anel of poligono)
      for (let i = 1; i < anel.length; i += 1)
        menor = Math.min(menor, distanciaAoSegmento(p, anel[i - 1], anel[i]));
    return menor;
  };
  let melhor = null;
  let melhorDistancia = -1;
  let caixa = [minX, minY, maxX, maxY];
  for (let rodada = 0; rodada < 3; rodada += 1) {
    const [ax, ay, bx, by] = caixa;
    const passoX = (bx - ax) / 48;
    const passoY = (by - ay) / 48;
    for (let i = 0; i <= 48; i += 1)
      for (let j = 0; j <= 48; j += 1) {
        const p = [ax + i * passoX, ay + j * passoY];
        const d = distanciaDaBorda(p);
        if (d > melhorDistancia) {
          melhorDistancia = d;
          melhor = p;
        }
      }
    if (!melhor) break;
    caixa = [
      melhor[0] - passoX * 2,
      melhor[1] - passoY * 2,
      melhor[0] + passoX * 2,
      melhor[1] + passoY * 2,
    ];
  }
  return melhor || externo[0];
}

/* ---------- principal ---------- */

function nomeDoRegistro(registro) {
  const campos = Object.keys(registro);
  const preferidos = campos.filter((c) => /nome|name|dsei|no_/i.test(c));
  for (const campo of [...preferidos, ...campos]) {
    const numero = numeroDoDsei(registro[campo]);
    if (numero) return { numero, campo, valor: registro[campo] };
  }
  return null;
}

function principal() {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error(
      "Uso: node scripts/compilar-contornos-dos-dseis.mjs <areas_dsei.zip>",
    );
    process.exit(2);
  }
  const zip = unzipSync(readFileSync(arquivo));
  const achar = (ext) =>
    Object.keys(zip).find((nome) => nome.toLowerCase().endsWith(ext));
  const shp = achar(".shp");
  const dbf = achar(".dbf");
  if (!shp || !dbf) throw new Error("zip sem .shp/.dbf");
  const cpg = achar(".cpg");
  const prj = achar(".prj");
  const codificacao = cpg
    ? strFromU8(zip[cpg])
        .trim()
        .toLowerCase()
        .replace(/^utf-?8$/, "utf-8")
    : // Sem .cpg o dBase é Latin-1 (o da Funai: "CEARÁ" em um byte).
      "latin1";
  if (prj) console.log("Projeção:", strFromU8(zip[prj]).slice(0, 120));

  const registros = lerDbf(
    zip[dbf],
    codificacao === "utf-8" ? "utf-8" : "latin1",
  );
  const formas = lerShp(zip[shp]);
  if (registros.length !== formas.length)
    throw new Error(`dbf ${registros.length} × shp ${formas.length}`);

  const porNumero = new Map();
  const semPar = [];
  registros.forEach((registro, i) => {
    const achado = nomeDoRegistro(registro);
    if (!achado) {
      semPar.push(registro);
      return;
    }
    const lista = porNumero.get(achado.numero) || [];
    lista.push(...poligonosDe(formas[i]));
    porNumero.set(achado.numero, lista);
  });
  if (semPar.length) {
    console.error("Registros sem DSEI reconhecido:", semPar);
    process.exit(1);
  }
  const faltam = DSEIS_OFICIAIS.filter((_, i) => !porNumero.has(i + 1));
  if (faltam.length) {
    console.error("DSEIs sem contorno:", faltam);
    process.exit(1);
  }

  let vertices = 0;
  const features = [...porNumero.entries()]
    .sort(([a], [b]) => a - b)
    .map(([numero, poligonos]) => {
      const simples = poligonos
        .map((pol) => pol.map(simplificarAnel).filter(Boolean))
        .filter(
          (pol) => pol.length && Math.abs(areaComSinal(pol[0])) >= AREA_MINIMA,
        );
      // Um distrito nunca some: sem polígono acima do mínimo, fica o maior.
      if (!simples.length) {
        const maior = [...poligonos].sort(
          (a, b) => Math.abs(areaComSinal(b[0])) - Math.abs(areaComSinal(a[0])),
        )[0];
        simples.push(maior.map(simplificarAnel).filter(Boolean));
      }
      const maior = [...simples].sort(
        (a, b) => Math.abs(areaComSinal(b[0])) - Math.abs(areaComSinal(a[0])),
      )[0];
      const [x, y] = pontoDoRotulo(maior);
      for (const pol of simples)
        for (const anel of pol) vertices += anel.length;
      return {
        type: "Feature",
        properties: {
          numero,
          nome: DSEIS_OFICIAIS[numero - 1],
          rotulo: [arredondar(y), arredondar(x)],
        },
        geometry:
          simples.length === 1
            ? { type: "Polygon", coordinates: simples[0] }
            : { type: "MultiPolygon", coordinates: simples },
      };
    });

  const saida = {
    type: "FeatureCollection",
    fonte: FONTE,
    gerado: "scripts/compilar-contornos-dos-dseis.mjs",
    features,
  };
  const texto = JSON.stringify(saida);
  writeFileSync(SAIDA, `${texto}\n`);
  console.log(
    `${features.length} DSEIs, ${vertices} vértices, ${(texto.length / 1024).toFixed(0)} KB → ${SAIDA}`,
  );
}

principal();
