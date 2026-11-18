/*
  ENVOLVER UMA FÁBRICA DO LEAFLET SEM A MUTILAR

  As fábricas do Leaflet não são só funções: `L.tileLayer` carrega
  `L.tileLayer.wms` pendurado nela. Trocar a função por um invólucro sem copiar
  o que estava pendurado apaga essas propriedades do namespace, e apaga-as em
  silêncio — nada estoira, porque quem envolve não usa o que apagou.

  Foi o que aconteceu. Três módulos envolviam `L.tileLayer` quando o Leaflet
  chegava (src/modulos/mapa-saude-indigena/carregar-leaflet.ts): o antigo
  `map-guard.ts` (noWrap, updateWhenIdle, keepBuffer), o
  `map-base-layer-switcher.ts` (etiqueta a camada com o tipo de base) e o
  antigo `map-zoom-range.ts` (impunha o maxZoom). Hoje só o seletor envolve;
  a guarda do mapa passa as opções a quem cria a camada (`guarda-do-mapa.ts`).

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
export function envolverFabricaDoLeaflet<T>(
  original: unknown,
  involucro: T,
): T {
  if (typeof original !== "function" || typeof involucro !== "function") {
    return involucro;
  }

  for (const chave of Object.keys(original)) {
    (involucro as Record<string, unknown>)[chave] = (
      original as unknown as Record<string, unknown>
    )[chave];
  }

  return involucro;
}
