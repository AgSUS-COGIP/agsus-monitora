import type { ReactElement } from "react";
import { useState } from "react";
import {
  CHAVE_DO_MAPA_RECOLHIDO,
  lerMapaRecolhido,
  valorDoMapaRecolhido,
} from "../../lib/mapa-recolhido.ts";

/*
  "Recolher mapa"/"Mostrar mapa" no cabeçalho do mapa da Visão geral: a
  escolha fica no navegador de cada pessoa (src/lib/mapa-recolhido.ts).
  Recolhido, o corpo do mapa some (CSS .mapa-si--recolhido) e o Leaflet
  reenquadra sozinho quando ele volta (ResizeObserver, leaflet.ts). Sem
  localStorage (janela privada, bloqueio), o mapa abre e o botão funciona na
  sessão.
*/

function lerGuardado(): boolean {
  try {
    return lerMapaRecolhido(
      window.localStorage.getItem(CHAVE_DO_MAPA_RECOLHIDO),
    );
  } catch {
    return false;
  }
}

function guardar(recolhido: boolean): void {
  try {
    const valor = valorDoMapaRecolhido(recolhido);
    if (valor === null) window.localStorage.removeItem(CHAVE_DO_MAPA_RECOLHIDO);
    else window.localStorage.setItem(CHAVE_DO_MAPA_RECOLHIDO, valor);
  } catch {
    /* sem localStorage: vale só nesta visita */
  }
}

export function usarMapaRecolhido(): [boolean, ReactElement] {
  const [recolhido, definirRecolhido] = useState(lerGuardado);

  const botao = (
    <button
      type="button"
      className="btn secondary small mapa-si-recolher"
      aria-expanded={!recolhido}
      onClick={() =>
        definirRecolhido((valor) => {
          guardar(!valor);
          return !valor;
        })
      }
    >
      {recolhido ? "Mostrar mapa" : "Recolher mapa"}
    </button>
  );

  return [recolhido, botao];
}
