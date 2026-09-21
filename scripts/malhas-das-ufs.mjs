import { readFileSync } from "node:fs";

/*
  Ponto dentro de polígono, por lançamento de raio. Serve para saber se uma
  coordenada cai dentro da UF que o registro declara. As malhas são as do IBGE,
  na qualidade mínima — o suficiente para separar "está no estado" de "está a
  mil quilómetros dali", que é a pergunta aqui.
*/
function dentroDoAnel(ponto, anel) {
  const [x, y] = ponto;
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    const cruza =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

function dentroDoPoligono(ponto, coordenadas) {
  if (!dentroDoAnel(ponto, coordenadas[0])) return false;
  for (let i = 1; i < coordenadas.length; i += 1) {
    if (dentroDoAnel(ponto, coordenadas[i])) return false; // buraco
  }
  return true;
}

export function carregarUf(cache, sigla) {
  const g = JSON.parse(readFileSync(`${cache}/uf-${sigla}.json`, "utf8"));
  const poligonos = [];
  for (const f of g.features || []) {
    const t = f.geometry?.type;
    if (t === "Polygon") poligonos.push(f.geometry.coordinates);
    else if (t === "MultiPolygon") poligonos.push(...f.geometry.coordinates);
  }
  let oeste = 180,
    leste = -180,
    sul = 90,
    norte = -90;
  for (const p of poligonos)
    for (const [x, y] of p[0]) {
      if (x < oeste) oeste = x;
      if (x > leste) leste = x;
      if (y < sul) sul = y;
      if (y > norte) norte = y;
    }
  return { sigla, poligonos, caixa: { oeste, leste, sul, norte } };
}

export function dentroDaUf(uf, lat, lon) {
  const { caixa } = uf;
  // A caixa é uma peneira barata; a malha decide.
  if (lon < caixa.oeste - 0.05 || lon > caixa.leste + 0.05) return false;
  if (lat < caixa.sul - 0.05 || lat > caixa.norte + 0.05) return false;
  return uf.poligonos.some((p) => dentroDoPoligono([lon, lat], p));
}
