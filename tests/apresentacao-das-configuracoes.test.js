import { describe, expect, it } from "vitest";
import {
  tomDoAviso,
  urlDeImagem,
} from "../src/lib/apresentacao-das-configuracoes.js";

/*
  Regras sem DOM das prévias de Configurações (os grupos e as prévias são
  React: src/modulos/configuracoes/; o comportamento na tela está em
  tests/modulos/configuracoes-inicio-acesso-aparencia.test.js).
*/
describe("regras da apresentação", () => {
  it("aviso: cada tipo tem tom, ícone e rótulo; desconhecido vira informação", () => {
    expect(tomDoAviso("danger")).toMatchObject({
      tom: "danger",
      rotulo: "Crítico",
    });
    expect(tomDoAviso("warning").tom).toBe("warning");
    expect(tomDoAviso("xyz").tom).toBe("info");
  });

  it("imagem só de caminho do site ou http(s)", () => {
    expect(urlDeImagem("/assets/logo.png")).toBe("/assets/logo.png");
    expect(urlDeImagem("https://x.org/l.png")).toBe("https://x.org/l.png");
    expect(urlDeImagem("javascript:alert(1)")).toBe("");
    expect(urlDeImagem("data:image/png;base64,AAA")).toBe("");
    expect(urlDeImagem("//outro.site/l.png")).toBe("");
  });
});
