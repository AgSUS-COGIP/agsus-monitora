/*
  ENVOLVER UMA FÁBRICA DO LEAFLET SEM A MUTILAR

  As fábricas do Leaflet não são só funções: `L.tileLayer` carrega
  `L.tileLayer.wms` pendurado nela. Trocar a função por um invólucro sem copiar
  o que estava pendurado apaga essas propriedades do namespace, e apaga-as em
  silêncio — nada estoira, porque quem envolve não usa o que apagou.

  Foi o que aconteceu. Três módulos envolvem `L.tileLayer` no arranque:

      map-guard.js              noWrap, updateWhenIdle, keepBuffer
      map-base-layer-switcher.js  etiqueta a camada com o tipo de base
      map-zoom-range.js         impõe o maxZoom

  Nenhum copiava `.wms`. A camada de Terras Indígenas verifica
  `L.tileLayer?.wms` antes de se instalar e desistia a cada arranque: sem
  polígono, sem rótulo, sem botão, sem um pedido à Funai. Ficou assim durante
  todo o tempo em que se publicaram correções de aparência para essa camada.

  Corrigir os três sítios um a um deixaria o quarto por escrever. Esta função
  existe para que envolver uma fábrica seja, por omissão, não destrutivo.

  As propriedades são copiadas TAL E QUAL, sem invólucro próprio: a camada WMS
  da Funai declara `updateWhenIdle: false` e `keepBuffer: 3` de propósito, e
  envolver o `.wms` sobreporia ambos.
*/
export function envolverFabricaDoLeaflet(original, involucro) {
  if (typeof original !== "function" || typeof involucro !== "function") {
    return involucro;
  }

  for (const chave of Object.keys(original)) {
    involucro[chave] = original[chave];
  }

  return involucro;
}
