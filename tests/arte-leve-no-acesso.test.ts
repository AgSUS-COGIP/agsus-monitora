import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { enderecosDaArteNaTela } from "../src/lib/access-branding.ts";
import {
  guardarMarca,
  limparMarcaGuardada,
} from "../src/lib/access-branding-cache.ts";

/*
  A ARTE LEVE NA TELA DE ACESSO (13/11/2026: "por que demora para carregar em
  processadores fracos?")

  A arte original (3200×1370, 689 KB) era baixada, decodificada e desenhada
  duas vezes, uma delas com blur(28px) em tela cheia. A tela passa a pedir ao
  Storage do Supabase as versões redimensionadas: a nítida com 1200 px de
  altura (~157 KB) e a miniatura de 64 px (~2 KB) para o fundo desfocado. A
  configuração continua com o endereço original.
*/

const ORIGINAL =
  "https://exemplo.supabase.co/storage/v1/object/public/platform-assets/branding/acesso-1.jpg";
const BASE =
  "https://exemplo.supabase.co/storage/v1/render/image/public/platform-assets/branding/acesso-1.jpg";

describe("enderecosDaArteNaTela", () => {
  it("arte do Storage: a nítida com 1200 px de altura e a miniatura de 64 px", () => {
    expect(enderecosDaArteNaTela(` ${ORIGINAL} `)).toEqual({
      nitida: `${BASE}?height=1200&quality=75`,
      desfocada: `${BASE}?width=64&quality=50`,
    });
  });

  it("outro endereço (arte padrão, https qualquer, já com parâmetros) fica como está", () => {
    for (const url of [
      "/assets/access-background-default.svg",
      "https://outro.exemplo.org/arte.jpg",
      `${ORIGINAL}?v=2`,
    ])
      expect(enderecosDaArteNaTela(url)).toEqual({
        nitida: url,
        desfocada: url,
      });
  });
});

describe("o primeiro quadro usa as mesmas versões leves", () => {
  const html = readFileSync("index.html", "utf8");
  const raiz = () => document.documentElement.style;

  afterEach(() => {
    limparMarcaGuardada();
    for (const nome of [
      "--login-background-image",
      "--login-background-image-desfocada",
      "--login-arte-proporcao",
    ])
      raiz().removeProperty(nome);
    document.documentElement.classList.remove(
      "arte-esperando",
      "arte-pronta",
      "arte-atrasada",
    );
  });

  function rodarScriptDoHead() {
    const inicio = html.indexOf("(function aplicarMarcaAntesDoPrimeiroPaint");
    new Function(html.slice(inicio, html.indexOf("</script>", inicio)))();
  }

  it("o script do <head> põe as duas versões e acha a medida pela nítida", () => {
    const { nitida, desfocada } = enderecosDaArteNaTela(ORIGINAL);
    guardarMarca({
      backgroundUrl: ORIGINAL,
      arteMedidaDe: nitida,
      arteProporcao: "2.3358",
    });
    rodarScriptDoHead();
    expect(raiz().getPropertyValue("--login-background-image")).toBe(
      `url("${nitida}")`,
    );
    expect(raiz().getPropertyValue("--login-background-image-desfocada")).toBe(
      `url("${desfocada}")`,
    );
    expect(raiz().getPropertyValue("--login-arte-proporcao")).toBe("2.3358");
    const guardada: unknown = Reflect.get(window, "__agsusArteDoAcesso");
    expect(guardada instanceof HTMLImageElement ? guardada.src : "").toBe(
      nitida,
    );
  });

  it("o fundo desfocado usa a miniatura, sem o blur(28px) em tela cheia", () => {
    const css = readFileSync("src/styles/platform-shell.css", "utf8");
    const antes = css.slice(css.indexOf(".login-screen::before {"));
    const regra = antes.slice(0, antes.indexOf("}"));
    expect(regra).toContain("--login-background-image-desfocada");
    expect(regra).not.toContain("blur(28px)");
  });
});
