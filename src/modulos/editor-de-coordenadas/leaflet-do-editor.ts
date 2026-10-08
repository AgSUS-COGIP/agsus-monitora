import { registroDoEditor } from "../../lib/respostas-do-editor-de-coordenadas.ts";
import type { LeafletDoEditor, MapaDoEditor } from "./tipos.ts";

/** A integração ainda recebe o Leaflet do carregador JavaScript. */
export function eLeafletDoEditor(valor: unknown): valor is LeafletDoEditor {
  return (
    registroDoEditor(valor) &&
    ["marker", "circleMarker", "layerGroup", "polyline", "latLngBounds"].every(
      (nome) => typeof valor[nome] === "function",
    )
  );
}
export function eMapaDoEditor(valor: unknown): valor is MapaDoEditor {
  return (
    registroDoEditor(valor) &&
    ["getCenter", "getZoom", "setView", "removeLayer", "flyToBounds"].every(
      (nome) => typeof valor[nome] === "function",
    )
  );
}
