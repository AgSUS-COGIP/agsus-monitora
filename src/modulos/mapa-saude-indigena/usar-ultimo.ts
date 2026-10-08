import { useLayoutEffect, useRef } from "react";

/*
  O valor mais recente num ref, para os ouvintes do Leaflet: o marcador é
  criado uma vez e chama a função da renderização atual, sem redesenhar o mapa
  a cada nova função que o pai passa.
*/

export function usarUltimo<T>(valor: T) {
  const ref = useRef(valor);
  useLayoutEffect(() => {
    ref.current = valor;
  });
  return ref;
}
