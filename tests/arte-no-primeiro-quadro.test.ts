import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  document.documentElement.classList.remove(
    "arte-esperando",
    "arte-pronta",
    "arte-atrasada",
  );
  vi.useRealTimers();
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

/*
  13/11/2026, gravado em vídeo no site publicado: a cada atualização, o cartão
  e o fundo na cor da arte apareciam primeiro e a arte entrava uns 230 ms
  depois, de uma vez (a imagem, 3200×1370, só era decodificada na hora de
  pintar). O script do <head> pede e decodifica a arte antes do CSS; enquanto
  ela não está pronta, `arte-esperando` deixa as camadas transparentes, e elas
  entram com transição.
*/
describe("a arte decodificada antes do CSS", () => {
  it("com arte guardada, pede a imagem e esconde o cartão até ela ficar pronta", () => {
    vi.useFakeTimers();
    guardarMarca({ backgroundUrl: ARTE });
    rodarScriptDoHead();
    const guardada: unknown = Reflect.get(window, "__agsusArteDoAcesso");
    const imagem = guardada instanceof HTMLImageElement ? guardada : undefined;
    expect(imagem?.src).toBe(ARTE);
    const classes = document.documentElement.classList;
    expect(classes.contains("arte-esperando")).toBe(true);
    imagem?.onload?.(new Event("load"));
    expect(classes.contains("arte-esperando")).toBe(false);
    expect(classes.contains("arte-pronta")).toBe(true);
    vi.advanceTimersByTime(600);
    expect(classes.contains("arte-atrasada")).toBe(false);
  });

  it("arte que passa de 600 ms: o cartão aparece e a arte entra depois", () => {
    vi.useFakeTimers();
    guardarMarca({ backgroundUrl: ARTE });
    rodarScriptDoHead();
    const classes = document.documentElement.classList;
    vi.advanceTimersByTime(600);
    expect(classes.contains("arte-esperando")).toBe(false);
    expect(classes.contains("arte-atrasada")).toBe(true);
    expect(classes.contains("arte-pronta")).toBe(false);
    vi.advanceTimersByTime(2400);
    expect(classes.contains("arte-pronta")).toBe(true);
  });

  it("sem arte guardada, não espera nada", () => {
    rodarScriptDoHead();
    expect(document.documentElement.classList.contains("arte-esperando")).toBe(
      false,
    );
  });

  /*
    13/11/2026, terceiro vídeo: com a arte já pronta, um quadro de 33 ms
    mostrava a arte e ainda não o cartão (o HTML do cartão vem depois).
  */
  it("a arte só aparece depois de o cartão provisório ser lido", () => {
    const fimDoCartao = html.indexOf('<div class="login-stripe"></div>');
    const marca = html.indexOf(
      'document.documentElement.classList.add("cartao-lido")',
    );
    expect(fimDoCartao).toBeGreaterThan(-1);
    expect(marca).toBeGreaterThan(fimDoCartao);
    expect(marca).toBeLessThan(html.indexOf("</section>", fimDoCartao));
    const css = readFileSync("src/styles/platform-shell.css", "utf8");
    expect(css).toContain(
      "html:not(.cartao-lido) .login-screen::before,\nhtml:not(.cartao-lido) .login-screen::after,",
    );
  });

  it("o CSS esconde o cartão e a arte enquanto espera; atrasada, a arte entra com transição", () => {
    const css = readFileSync("src/styles/platform-shell.css", "utf8");
    expect(css).toContain(
      "html.arte-esperando #loginScreen > * {\n  visibility: hidden;\n}",
    );
    expect(css).toContain(
      "html.arte-atrasada:not(.arte-pronta) .login-screen::after {\n  opacity: 0;\n}",
    );
    const atrasada = css.slice(
      css.indexOf(
        "html.arte-atrasada .login-screen::before,\nhtml.arte-atrasada .login-screen::after {",
      ),
    );
    expect(atrasada.slice(0, 260)).toContain("opacity var(--duration-slow)");
  });
});
