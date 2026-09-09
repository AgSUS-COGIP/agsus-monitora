/*
  Limites do Brasil, medidos no contorno real.

  Havia dois retângulos escritos à mão, e nenhum correspondia ao país:

    map-guard  [[-34.90, -74.20], [6.40, -33.70]]  → 41.30° de latitude
    legacy-app [[-33.50, -73.00], [5.50, -34.50]]  → 38.50° de longitude
    contorno   [[-33.75, -73.99], [5.27, -32.42]]  → 39.02° x 41.57°

  O do `map-guard` é 2.28° mais alto que o país — 5.8% de latitude a mais. Como
  `fitBounds` obedece à dimensão que primeiro esbarra na moldura, num card largo
  quem manda é a latitude: essa sobra reduzia o mapa inteiro e deixava faixas
  vazias em cima e embaixo. O do `legacy-app`, ao contrário, era 3.07° estreito
  demais e cortava a ponta leste (Fernando de Noronha está em -32.42).

  Os números abaixo saem dos 1227 vértices de `BR_OUTLINE`. O teste
  `tests/brasil-bounds.test.js` recalcula a partir do contorno e falha se as duas
  coisas se separarem — é o que impede a constante de envelhecer em silêncio.
*/

export const BRASIL_BOUNDS = Object.freeze([
  Object.freeze([-33.75, -73.99]),
  Object.freeze([5.27, -32.42]),
]);

/*
  Margem de navegação em volta do país. Não é enquadramento: serve para o
  `maxBounds`, para que arrastar o mapa mostre o contexto sul-americano sem
  permitir sair para o oceano aberto nem criar cópias laterais do mundo.
*/
export const NAVEGACAO_BOUNDS = Object.freeze([
  Object.freeze([-58.5, -84.5]),
  Object.freeze([15.5, -27.0]),
]);

/* Calcula o retângulo envolvente de uma geometria GeoJSON, em [[sul, oeste], [norte, leste]]. */
export function boundsDoGeoJson(geometria) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let vertices = 0;

  const visitar = (no) => {
    if (Array.isArray(no) && typeof no[0] === "number") {
      const [lng, lat] = no;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      vertices += 1;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      return;
    }
    if (Array.isArray(no)) no.forEach(visitar);
    else if (no && typeof no === "object") Object.values(no).forEach(visitar);
  };

  visitar(geometria);
  if (!vertices) return null;
  return {
    vertices,
    bounds: [
      [minLat, minLng],
      [maxLat, maxLng],
    ],
  };
}
