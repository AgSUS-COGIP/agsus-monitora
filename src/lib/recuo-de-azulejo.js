/*
  RECUO DE AZULEJO — quando a imagem de satélite não existe naquele zoom

  A Esri não tem foto em toda a parte com o mesmo detalhe. Medido em 23/09/2026:

      lugar                         foto até     acima disso
      Xingu (polo WAWI, Canarana)   zoom 17      azulejo "sem dados"
      Yanomami, Vale do Javari      zoom 17      azulejo "sem dados"
      Maceió                        zoom 19      —

  Acima do zoom disponível ela devolve HTTP 200 com um PNG pronto de 2.521 bytes
  escrito "Map data not yet available". Para o Leaflet é uma imagem boa, e o
  mapa enchia-se desse aviso a cada aproximação num território indígena — que
  é exatamente onde este painel é usado.

  Travar o zoom em 17 para todos resolveria o Xingu e roubaria o detalhe das
  cidades. O que se faz é recuar azulejo a azulejo: onde o zoom pedido não tem
  foto, usa-se o azulejo do nível de cima, ampliado, recortado no quadrante que
  corresponde. Fica menos nítido; nunca fica quebrado.

  `blankTile=false` é o que torna a falta visível: com ele, a Esri responde 404
  em vez do aviso em forma de imagem.
*/

/** Quantos níveis se sobe, no máximo, antes de desistir do azulejo. */
export const RECUO_MAXIMO = 4;

/*
  O azulejo `niveis` acima de `coords`, e onde recortá-lo. Num recuo de um nível
  cada azulejo do nível de cima cobre 2 x 2 dos de baixo; `dx`/`dy` dizem qual
  dos quatro é este, e `escala` quanto a imagem tem de crescer.
*/
export function azulejoDoRecuo(coords, niveis = 0) {
  const n = Math.max(0, Math.trunc(Number(niveis) || 0));
  const fator = 2 ** n;
  const resto = (valor) => ((valor % fator) + fator) % fator;
  return {
    x: Math.floor(coords.x / fator),
    y: Math.floor(coords.y / fator),
    z: coords.z - n,
    escala: fator,
    dx: resto(coords.x),
    dy: resto(coords.y),
  };
}

/*
  Se ainda vale subir mais um nível. Pára no máximo de recuos e no zoom mínimo
  da camada: abaixo dele não há o que pedir.
*/
export function podeRecuar(
  coords,
  niveis,
  zoomMinimo = 0,
  maximo = RECUO_MAXIMO,
) {
  return niveis < maximo && coords.z - (niveis + 1) >= zoomMinimo;
}

/** A URL com o aviso em forma de imagem desligado (ArcGIS `blankTile=false`). */
export function semAzulejoDeAviso(url) {
  const texto = String(url ?? "");
  if (/[?&]blankTile=/.test(texto)) return texto;
  return `${texto}${texto.includes("?") ? "&" : "?"}blankTile=false`;
}
