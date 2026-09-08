import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  guardarMarca,
  lerMarcaGuardada,
  limparMarcaGuardada,
} from "../src/lib/access-branding-cache.js";

const CHAVE = "agsus_monitora_access_branding_v1";

describe("cache da marca da tela de acesso", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("devolve null quando nunca houve visita anterior", () => {
    expect(lerMarcaGuardada()).toBeNull();
  });

  it("guarda e devolve a arte e a cor aplicadas", () => {
    guardarMarca({
      backgroundUrl: "https://exemplo/arte.jpg",
      panelColor: "#ffffff",
    });
    expect(lerMarcaGuardada()).toEqual({
      backgroundUrl: "https://exemplo/arte.jpg",
      panelColor: "#ffffff",
    });
  });

  it("ignora campos fora da lista, para não guardar dado de sessão", () => {
    guardarMarca({
      backgroundUrl: "https://exemplo/arte.jpg",
      accessToken: "nao-deve-ser-guardado",
      email: "pessoa@agenciasus.org.br",
    });
    const guardado = JSON.parse(localStorage.getItem(CHAVE));
    expect(guardado).toEqual({ backgroundUrl: "https://exemplo/arte.jpg" });
  });

  it("descarta valores vazios em vez de guardar cadeia em branco", () => {
    guardarMarca({ backgroundUrl: "   ", panelColor: "#012345" });
    expect(lerMarcaGuardada()).toEqual({ panelColor: "#012345" });
  });

  it("não guarda nada quando não sobra nenhum campo útil", () => {
    guardarMarca({ backgroundUrl: "", panelColor: "  " });
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  /*
    O conteúdo corrompido é o caso que mais importa: se `lerMarcaGuardada`
    lançasse aqui, o erro subiria durante o arranque e derrubaria a tela de
    acesso inteira — trocando um problema estético por um que impede entrar.
  */
  it("devolve null quando o conteúdo guardado não é JSON válido", () => {
    localStorage.setItem(CHAVE, "{isto não é json");
    expect(lerMarcaGuardada()).toBeNull();
  });

  it("devolve null quando o JSON guardado não é um objeto", () => {
    localStorage.setItem(CHAVE, '"apenas um texto"');
    expect(lerMarcaGuardada()).toBeNull();
  });

  it("limpa o que estava guardado", () => {
    guardarMarca({ panelColor: "#012345" });
    limparMarcaGuardada();
    expect(lerMarcaGuardada()).toBeNull();
  });

  it("não lança quando o armazenamento é inacessível", () => {
    const original = Object.getOwnPropertyDescriptor(
      globalThis,
      "localStorage",
    );
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("acesso negado ao armazenamento");
      },
    });

    expect(() => guardarMarca({ panelColor: "#012345" })).not.toThrow();
    expect(lerMarcaGuardada()).toBeNull();

    if (original) Object.defineProperty(globalThis, "localStorage", original);
  });
});
