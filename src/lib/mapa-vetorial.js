/*
  O MAPA VETORIAL — as contas, sem Leaflet nem MapLibre

  O fundo "Mapa" era o OpenStreetMap em imagem: azulejos PNG de 256 px, já
  desenhados, que no zoom máximo ficam ampliados e com os nomes pequenos. O
  Google parece melhor por uma razão só: desenha o mapa na hora, a partir de
  dados, em qualquer zoom — rua nítida, nome legível, sem borrão.

  Passa a ser assim também: os dados do OpenStreetMap em vetor, servidos pelo
  OpenFreeMap (sem chave, sem limite de pedidos) e desenhados pelo MapLibre
  dentro do Leaflet que já existe. Os marcadores, as terras e os controlos não
  mudam — só o fundo.

  O MapLibre não vai no bundle: ~225 KB comprimidos que só fazem sentido quando
  há um mapa na tela. Vem do cdnjs, de onde o Leaflet já vem, com verificação
  de integridade (SRI). A 5.24.0 é a mais recente que o cdnjs publica no
  formato clássico, que expõe `maplibregl` como o Leaflet expõe `L`: a série 6
  só tem lá o CSS.
*/

export const MAPLIBRE_VERSAO = "5.24.0";
const CDN = `https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/${MAPLIBRE_VERSAO}`;

export const MAPLIBRE_JS = Object.freeze({
  url: `${CDN}/maplibre-gl.js`,
  integridade:
    "sha512-rOFgoUgWaVi69JW1dzBu6PWF9xKW9rxYfY5u2SexFABHhWk0qUWkJoWNz4UuZRMvSXsNZG66+tU5B+HlwWF5kA==",
});

export const MAPLIBRE_CSS = Object.freeze({
  url: `${CDN}/maplibre-gl.css`,
  integridade:
    "sha512-KIMsMWIdnoG9OwZa+oaIafmbDonqck1UCmq+/zcUi2aaZ97N9QE6TqpTM+n36EO40HGh64hU/375zxtjx7WTyQ==",
});

/*
  O estilo "Liberty" do OpenFreeMap: ruas, nomes, relevo suave e edifícios,
  com o aspeto de um mapa de navegação. Os nomes vêm do OSM, e no Brasil estão
  em português.
*/
export const ESTILO_DO_MAPA = "https://tiles.openfreemap.org/styles/liberty";

export const ATRIBUICAO_DO_MAPA =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Dados de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

/*
  O MapLibre usa azulejos de 512 px, o Leaflet de 256: o mesmo enquadramento é
  um nível de zoom a menos do lado do MapLibre.
*/
export function zoomDoMapLibre(zoomDoLeaflet) {
  return Number(zoomDoLeaflet) - 1;
}

/*
  A FOLGA

  O fundo vetorial só se redesenha quando o arrasto acaba. Durante o arrasto ele
  anda junto com os marcadores, como uma imagem — e é isso que o mantém
  colado a eles: redesenhar a cada movimento, com o MapLibre a desenhar no
  quadro seguinte, faria o fundo "nadar" um quadro atrás dos pontos.

  Para o arrasto não revelar vazio nas bordas, o fundo é maior do que o mapa:
  `folga` de cada lado, em fração do tamanho. Com 0,3, arrastar até 30% da
  largura não mostra borda nenhuma.
*/
export const FOLGA_DO_VETORIAL = 0.3;

export function caixaDoVetorial(largura, altura, folga = FOLGA_DO_VETORIAL) {
  const w = Math.max(0, Number(largura) || 0);
  const h = Math.max(0, Number(altura) || 0);
  const mx = Math.round(w * folga);
  const my = Math.round(h * folga);
  return {
    largura: w + 2 * mx,
    altura: h + 2 * my,
    deslocX: -mx,
    deslocY: -my,
  };
}

/*
  ONDE A FOTO DE SATÉLITE ACABA

  Nos territórios indígenas a Esri só tem foto até ao zoom 17; acima disso o
  recuo de azulejo amplia a do 17 (ver `recuo-de-azulejo.js`). Ampliar 2x ainda
  se lê; 4x é o borrão que se via em Canarana no zoom 19.

  `menorRecuo` é o menor recuo entre os azulejos à vista: se até o melhor deles
  teve de subir dois níveis, não há foto mais detalhada em lugar nenhum da
  tela. O teto é um nível acima da foto — ampliação de 2x, no máximo.

  Devolve `null` quando não há o que limitar.
*/
export function tetoDoSatelite(zoomDoMapa, menorRecuo) {
  const zoom = Number(zoomDoMapa);
  const recuo = Number(menorRecuo);
  if (!Number.isFinite(zoom) || !Number.isFinite(recuo) || recuo < 2) {
    return null;
  }
  return zoom - (recuo - 1);
}

export const AVISO_DO_SATELITE =
  "Aqui não há foto de satélite mais detalhada. Para aproximar mais, use Mapa.";
