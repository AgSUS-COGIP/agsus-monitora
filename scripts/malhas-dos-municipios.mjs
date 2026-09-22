import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/*
  MALHAS MUNICIPAIS DO IBGE

  A malha da UF responde "está no estado?", e para a maioria dos pontos isso é
  quase sempre sim: medido sobre 745 unidades de fonte única, ela acusou UMA.
  A malha municipal responde "está no município que o próprio cadastro declara?"
  — e nas mesmas 745 acusou CINQUENTA E DUAS.

  Qualidade máxima, e não mínima. Já houve um falso erro por causa disso: com a
  malha grosseira, a TI Teles Pires caía fora do município, e com a detalhada
  caía dentro. Para dizer a alguém que o cadastro dele está errado, a fronteira
  tem de ser a real.

  São ~54 MB de cache, em `.cache/`, que não é versionado. Baixa-se uma vez.
*/
const UFS = [
  11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33,
  35, 41, 42, 43, 50, 51, 52, 53,
];

export async function garantirMalhasMunicipais(cache) {
  mkdirSync(cache, { recursive: true });
  const faltam = UFS.filter((uf) => !existsSync(join(cache, `mun-${uf}.json`)));
  if (!faltam.length) return;

  console.log(`baixando malhas municipais de ${faltam.length} UFs...`);
  for (const uf of faltam) {
    const url =
      `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${uf}` +
      "?formato=application/vnd.geo+json&qualidade=maxima&intrarregiao=municipio";
    let ultimo = null;
    for (let tentativa = 0; tentativa < 3; tentativa += 1) {
      try {
        const resposta = await fetch(url, {
          signal: AbortSignal.timeout(180000),
        });
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        writeFileSync(join(cache, `mun-${uf}.json`), await resposta.text());
        ultimo = null;
        break;
      } catch (erro) {
        ultimo = erro;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    if (ultimo)
      throw new Error(`malha municipal da UF ${uf}: ${ultimo.message}`);
    console.log(`  UF ${uf} ok`);
  }
}

export function carregarMunicipios(cache) {
  const porCodigo = new Map();
  for (const uf of UFS) {
    const caminho = join(cache, `mun-${uf}.json`);
    if (!existsSync(caminho)) continue;
    const malha = JSON.parse(readFileSync(caminho, "utf8"));
    for (const f of malha.features || []) {
      porCodigo.set(String(f.properties?.codarea), f.geometry);
    }
  }
  return porCodigo;
}

const aneisDe = (geometria) => {
  if (geometria?.type === "Polygon") return [geometria.coordinates];
  if (geometria?.type === "MultiPolygon") return geometria.coordinates;
  return [];
};

function dentroDoAnel(lon, lat, anel) {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    const cruza =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/*
  Devolve `null` quando não há malha para o código: ausência de malha não é
  "está fora", e tratá-la como tal acusaria o cadastro por falha nossa.
*/
export function dentroDoMunicipio(porCodigo, codigo, lat, lon) {
  const geometria = porCodigo.get(String(codigo));
  if (!geometria) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  for (const poligono of aneisDe(geometria)) {
    if (!poligono.length || !dentroDoAnel(lon, lat, poligono[0])) continue;
    let emBuraco = false;
    for (let k = 1; k < poligono.length; k += 1) {
      if (dentroDoAnel(lon, lat, poligono[k])) emBuraco = true;
    }
    if (!emBuraco) return true;
  }
  return false;
}
