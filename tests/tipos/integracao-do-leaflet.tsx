import {
  criarMapa,
  criarLeque,
  conteudoEmElemento,
  ligarDicaEPopup,
} from "../../src/modulos/mapa-saude-indigena/leaflet.ts";
import type { ConteudoDoBalao } from "../../src/modulos/mapa-saude-indigena/leaflet.ts";
import type {
  LeafletDoMapa,
  CamadaDoMapa,
} from "../../src/modulos/mapa-saude-indigena/tipos-do-leaflet.ts";
import type { MapaDoPainel } from "../../src/modulos/mapa-saude-indigena/tipos-do-painel.ts";

export function ContratosDoLeaflet(
  L: LeafletDoMapa,
  mapa: MapaDoPainel,
  camada: CamadaDoMapa,
) {
  const criado: MapaDoPainel = criarMapa(L, document.body);
  const leque = criarLeque(L, mapa, camada);
  const marcador = L.marker([-12, -50]);
  leque.adicionar(marcador, -12, -50);
  const linhas: readonly string[] = ["Um texto"];
  const conteudo = conteudoEmElemento(document, { linhas });
  ligarDicaEPopup(marcador, document, { dica: conteudo, popup: { linhas } });
  const invalido: ConteudoDoBalao = {
    // @ts-expect-error As linhas do balão são texto.
    linhas: [42],
  };
  // @ts-expect-error O namespace precisa das fábricas usadas pelo mapa.
  criarMapa({}, document.body);
  // @ts-expect-error O leque recebe coordenadas numéricas.
  leque.adicionar(marcador, "-12", -50);
  void [criado, invalido];
}
