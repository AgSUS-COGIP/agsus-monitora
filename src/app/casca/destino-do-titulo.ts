import { useSyncExternalStore } from "react";

/*
  O lugar do título da tela no cabeçalho do app. O topo (topo.tsx) guarda aqui
  o elemento onde o título entra; as telas (src/app/telas.tsx) o leem e o
  passam ao `CabecalhoDaTela` da tela aberta, que põe ali, por portal, a
  trilha e o nome da tela. Topo e telas são irmãos na casca, sem estado em
  comum: este é o estado externo entre os dois.
*/
let destino: HTMLElement | null = null;
const ouvintes = new Set<() => void>();

/** O topo entrega (ou retira, com `null`) o elemento do título. */
export function definirDestinoDoTitulo(elemento: HTMLElement | null): void {
  if (elemento === destino) return;
  destino = elemento;
  for (const ouvinte of ouvintes) ouvinte();
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

const obter = () => destino;

/** O elemento do título no cabeçalho, ou `null` antes de o topo montar. */
export function usarDestinoDoTitulo(): HTMLElement | null {
  return useSyncExternalStore(assinar, obter, obter);
}
