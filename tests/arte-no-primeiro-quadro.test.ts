import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  guardarMarca,
  lerMarcaGuardada,
  limparMarcaGuardada,
} from "../src/lib/access-branding-cache.ts";

/*
  A ARTE NO PRIMEIRO QUADRO (13/11/2026: "ainda pisca forte a tela de login")

  Medido quadro a quadro no site publicado: o fundo da tela de acesso era o
  claro da página até a arte aparecer, e a arte nítida começava na posição de
  16:9 e pulava quando a proporção real (2,34:1) era medida. A cada carga, a
  tela clareava e a arte mudava de lugar.

  Agora marca.ts guarda a proporção e a cor da borda esquerda com o endereço
  da arte, e o script do <head> as aplica antes do primeiro quadro, só se a
  medida for da arte guardada.
*/

const html = readFileSync("index.html", "utf8");

/* O script clássico do <head> que aplica a marca antes do primeiro paint. */
function rodarScriptDoHead() {
  const inicio = html.indexOf("(function aplicarMarcaAntesDoPrimeiroPaint");
  const fim = html.indexOf("</script>", inicio);
  expect(inicio).toBeGreaterThan(-1);
  new Function(html.slice(inicio, fim))();
}

const ARTE = "https://exemplo.test/arte.jpg";
const raiz = () => document.documentElement.style;

afterEach(() => {
  limparMarcaGuardada();
  raiz().removeProperty("--login-arte-proporcao");
  raiz().removeProperty("--login-arte-cor");
  raiz().removeProperty("--login-background-image");
});

describe("o cache guarda a medida da arte", () => {
  it("proporção, cor e endereço medido sobrevivem à mescla", () => {
    guardarMarca({ backgroundUrl: ARTE, panelColor: "#002f2f" });
    guardarMarca({
      arteMedidaDe: ARTE,
      arteProporcao: "2.3358",
      arteCor: "#043231",
    });
    expect(lerMarcaGuardada()).toMatchObject({
      backgroundUrl: ARTE,
      panelColor: "#002f2f",
      arteMedidaDe: ARTE,
      arteProporcao: "2.3358",
      arteCor: "#043231",
    });
  });
});

describe("o script do <head> aplica a medida no primeiro quadro", () => {
  it("medida da arte guardada: proporção e cor vão na raiz", () => {
    guardarMarca({
      backgroundUrl: ARTE,
      arteMedidaDe: ARTE,
      arteProporcao: "2.3358",
      arteCor: "#043231",
    });
    rodarScriptDoHead();
    expect(raiz().getPropertyValue("--login-arte-proporcao")).toBe("2.3358");
    expect(raiz().getPropertyValue("--login-arte-cor")).toBe("#043231");
  });

  it("medida de outra arte: não aplica (a arte mudou)", () => {
    guardarMarca({
      backgroundUrl: "https://exemplo.test/nova.jpg",
      arteMedidaDe: ARTE,
      arteProporcao: "2.3358",
      arteCor: "#043231",
    });
    rodarScriptDoHead();
    expect(raiz().getPropertyValue("--login-arte-proporcao")).toBe("");
    expect(raiz().getPropertyValue("--login-arte-cor")).toBe("");
  });

  it("valor fora do formato não entra no CSS", () => {
    guardarMarca({
      backgroundUrl: ARTE,
      arteMedidaDe: ARTE,
      arteProporcao: "2; color: red",
      arteCor: "red",
    });
    rodarScriptDoHead();
    expect(raiz().getPropertyValue("--login-arte-proporcao")).toBe("");
    expect(raiz().getPropertyValue("--login-arte-cor")).toBe("");
  });
});
