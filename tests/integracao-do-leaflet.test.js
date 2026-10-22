import { describe, expect, it } from "vitest";
import { criarLeafletFalso } from "./modulos/leaflet-falso.js";
import {
  adicionarFundo,
  conteudoEmElemento,
  criarMapa,
  obterLeaflet,
} from "../src/modulos/mapa-saude-indigena/leaflet.ts";
import { leafletDoMapa } from "../src/modulos/mapa-saude-indigena/tipos-do-leaflet.ts";

describe("integração compartilhada do Leaflet", () => {
  it("preserva o namespace e recusa a ausência de fábricas essenciais", () => {
    const { L } = criarLeafletFalso();
    expect(leafletDoMapa(L)).toBe(L);
    expect(leafletDoMapa({ ...L, tileLayer: undefined })).toBeNull();
    expect(leafletDoMapa({ ...L, divIcon: undefined })).toBeNull();
    const original = globalThis.L;
    try {
      globalThis.L = L;
      expect(obterLeaflet()).toBe(L);
      globalThis.L = { map() {} };
      expect(obterLeaflet()).toBeNull();
    } finally {
      if (original === undefined) delete globalThis.L;
      else globalThis.L = original;
    }
  });

  it("troca o fundo depois de quatro falhas consecutivas e encerra o aviso ao carregar", () => {
    const { L } = criarLeafletFalso();
    const elemento = document.createElement("div");
    const mapa = criarMapa(L, elemento);
    const inicial = adicionarFundo(L, mapa, elemento);
    inicial.fire("tileerror").fire("tileerror").fire("tileerror");
    expect(mapa.hasLayer(inicial)).toBe(true);
    inicial.fire("tileload");
    inicial.fire("tileerror").fire("tileerror").fire("tileerror");
    expect(mapa.hasLayer(inicial)).toBe(true);
    inicial.fire("tileerror");
    expect(mapa.hasLayer(inicial)).toBe(false);
    expect(elemento.classList.contains("map-tiles-recovering")).toBe(true);
    const [reserva] = [...mapa.camadas];
    expect(reserva.latlng).toContain("World_Imagery");
    reserva.fire("tileload");
    expect(elemento.classList.contains("map-tiles-recovering")).toBe(false);
    mapa.remove();
  });

  it("mostra caracteres HTML como texto nos balões", () => {
    const titulo = '<img src=x onerror="alert(1)">';
    const linha = "<script>texto</script>";
    const caixa = conteudoEmElemento(document, {
      titulo,
      linhas: [linha],
      nota: "<b>nota</b>",
    });
    expect(caixa.querySelector("strong").textContent).toBe(titulo);
    expect(caixa.querySelector("span").textContent).toBe(linha);
    expect(caixa.querySelector("small").textContent).toBe("<b>nota</b>");
    expect(caixa.querySelector("img, script, b")).toBeNull();
  });
});
