import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CHAVES_DAS_SECOES,
  linhasDasSecoes,
  normalizarValoresCarregados,
} from "../src/lib/publicacao-de-configuracoes.js";

const app = readFileSync("src/modules/legacy-app.js", "utf8");
const governance = readFileSync("src/modulos/configuracoes/estado.js", "utf8");
const sidebar = readFileSync("src/modules/sidebar-branding.js", "utf8");
const mapGuard = readFileSync("src/modules/map-guard.js", "utf8");
const lifecycle = readFileSync("src/lib/session-lifecycle.js", "utf8");
// A barra lateral é React: o <img id="sideLogo"> nasce no componente da marca.
const barraLateral = readFileSync(
  "src/componentes/barra-lateral/barra-lateral.jsx",
  "utf8",
);
const tuning = readFileSync("src/styles/post157-interface-tuning.css", "utf8");

const semComentarios = (fonte) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/*
  1 — A cor da barra lateral não persistia.

  O botão Salvar (e o Ctrl+S) publica pelo estado de Configurações
  (src/modulos/configuracoes/estado.js), que chama `revisar` direto — o `saveAdminSettings` do legado, que nesse fluxo
  nunca rodava, saiu. As chaves da barra lateral tinham sido acrescentadas só
  a ele: a coleta das linhas não as via, `buildChanges()` não achava
  diferença e mudar apenas a cor terminava em "Nada para publicar".
*/
describe("as chaves da barra lateral chegam ao caminho que realmente salva", () => {
  it("o fluxo de governança é quem publica", () => {
    const codigo = semComentarios(governance);
    expect(codigo).not.toMatch(/window.saveAdminSettingss*=/);
    expect(codigo).toContain("void revisar()");
    expect(semComentarios(app)).not.toContain("function saveAdminSettings");
  });

  it("as linhas da publicação incluem as da barra lateral", () => {
    const fn = semComentarios(governance).slice(
      semComentarios(governance).indexOf("const linhasDaPublicacao"),
      semComentarios(governance).indexOf("async function revisar"),
    );
    expect(fn).toContain("linhasDasSecoes(valoresAtuais())");
    expect(CHAVES_DAS_SECOES).toContain("ui_sidebar_logo_url");
    expect(CHAVES_DAS_SECOES).toContain("ui_sidebar_background_color");
  });

  /*
    A guarda de antes (sem os campos no DOM, nenhuma linha) existia para um
    salvamento não gravar os valores padrão por cima de uma personalização.
    Agora os valores vêm do que o banco devolveu: a personalização volta
    intacta na publicação.
  */
  it("publicar outra coisa não troca a personalização da barra pelo padrão", () => {
    const linhas = new Map(
      linhasDasSecoes(
        normalizarValoresCarregados({
          ui_sidebar_logo_url: "https://cdn.test/logo.png",
          ui_sidebar_background_color: "#123456",
        }),
      ).map((linha) => [linha.chave, linha.valor]),
    );
    expect(linhas.get("ui_sidebar_logo_url")).toBe("https://cdn.test/logo.png");
    expect(linhas.get("ui_sidebar_background_color")).toBe("#123456");
  });
});

/*
  2 — A logo sumia no shell.

  A apresentação dependia de `.side-logo-wrap { background-image: var(...) }`,
  que o antigo `system-ui-fixes.css` anulava com `background: transparent !important` — o
  atalho `background` zera `background-image` e o `!important` vence a regra
  normal. Com o `<img>` em `opacity: 0`, não sobrava nada visível.
*/
describe("a logo da barra lateral é o <img> real", () => {
  it("o <img> não é mais escondido por opacidade", () => {
    expect(tuning).not.toMatch(
      /\.side-logo-wrap\s+\.side-logo\s*\{[^}]*opacity:\s*0/,
    );
  });

  it("a apresentação por background-image saiu", () => {
    expect(tuning).not.toContain("--sidebar-logo-image");
    expect(semComentarios(sidebar)).not.toContain("--sidebar-logo-image");
  });

  it("sidebar-branding define o src diretamente", () => {
    const fn = sidebar.slice(
      sidebar.indexOf("function aplicarLogoNaBarraLateral"),
      sidebar.indexOf("export function aplicarMarcaDaBarraLateral"),
    );
    expect(fn).toContain('document.getElementById("sideLogo")');
    expect(fn).toContain('img.setAttribute("src", logo)');
  });

  it("o onerror devolve o padrão em vez de esconder", () => {
    const fn = sidebar.slice(
      sidebar.indexOf("function aplicarLogoNaBarraLateral"),
      sidebar.indexOf("export function aplicarMarcaDaBarraLateral"),
    );
    expect(fn).toContain("img.onerror");
    expect(fn).toContain('img.setAttribute("src", LOGO_PADRAO_DA_BARRA)');
    expect(fn).not.toMatch(/display\s*=\s*["']none["']/);
  });

  /*
    O `src` de fábrica apontava para i.postimg.cc, um host externo, e o `onerror`
    inline escondia a imagem. Uma logo padrão precisa aparecer mesmo sem rede
    para terceiros e mesmo se a leitura do banco falhar.
  */
  it("o <img> da barra lateral nasce com a logo local, sem host externo", () => {
    const marca = barraLateral.indexOf('id="sideLogo"');
    expect(marca).toBeGreaterThan(-1);
    const tag = barraLateral.slice(
      marca,
      barraLateral.indexOf(">", barraLateral.indexOf("/>", marca)),
    );
    expect(tag).toContain('src="/assets/agsus-logo.webp"');
    expect(tag).not.toContain("postimg.cc");
    expect(tag).not.toMatch(/onerror/i);
  });

  it("a configuração do app não sobrescreve mais a logo da barra lateral", () => {
    const fn = readFileSync("src/app/configuracao.js", "utf8");
    expect(fn).not.toContain('"sideLogo"');
  });
});

/*
  3 — Área desperdiçada nos mapas.
*/
describe("enquadramento do Brasil medido no contorno real", () => {
  /*
    A constante contra os vértices do contorno (a cópia única, em
    src/lib/mapa-saude-indigena/contornos.js) é conferida em
    tests/mapa-saude-indigena.test.js.
  */
  it("o map-guard usa a medição, não um retângulo à mão", () => {
    expect(mapGuard).toContain(
      'import { BRASIL_BOUNDS, NAVEGACAO_BOUNDS } from "../lib/brasil-bounds.js"',
    );
    expect(semComentarios(mapGuard)).not.toContain("-34.9");
    expect(semComentarios(mapGuard)).not.toContain("-74.2");
  });
});

describe("um dono só para o enquadramento inicial", () => {
  /*
    Os disparos em 120 ms e 420 ms eram prazos chutados: se o card demorasse mais
    que isso para assentar, o mapa ficava enquadrado para uma medida vencida.
  */
  it("os reenquadramentos por temporizador saíram", () => {
    const ready = mapGuard.slice(
      mapGuard.indexOf("map.whenReady(() => {"),
      mapGuard.indexOf('map.on("resize"'),
    );
    expect(ready).not.toMatch(/setTimeout\(fitBrazilOverview/);
    expect(ready).toContain("observarTamanhoDoCard(map, fitBrazilOverview)");
  });

  it("quem avisa é o tamanho do container", () => {
    const fn = mapGuard.slice(
      mapGuard.indexOf("function observarTamanhoDoCard"),
    );
    expect(fn).toContain("new ResizeObserver");
    expect(fn).toContain("map.getContainer");
    expect(fn).toContain("observador.disconnect()");
  });

  it("o overview é derivado do zoom, não só da bandeira", () => {
    const fn = mapGuard.slice(
      mapGuard.indexOf("function emOverview"),
      mapGuard.indexOf("function observarTamanhoDoCard"),
    );
    expect(fn).toContain("map.__agsusOverviewMode");
    expect(fn).toContain("getZoom");
  });
});

/*
  Um mapa principal de cada vez (o nacional ou o do DSEI) é do componente
  React: tests/modulos/mapa-saude-indigena.test.js.
*/

/*
  5 — "Sessão: 01:00:00" anunciava um encerramento desligado desde 08/09/2026.
*/
describe("nada de contagem regressiva para uma ação que não acontece", () => {
  it("o encerramento por inatividade continua desligado", () => {
    expect(lifecycle).toContain("let encerrarPorInatividadeAtivo = false;");
  });

  it("o relógio fica oculto enquanto o encerramento estiver desligado", () => {
    const fn = lifecycle.slice(
      lifecycle.indexOf("function updateTimerUi"),
      lifecycle.indexOf("function showNotice"),
    );
    expect(fn).toContain(
      "timer.hidden = !activeUserId || !encerrarPorInatividadeAtivo;",
    );
    expect(fn).toContain("if (timer.hidden) return;");
  });

  it("os avisos de 10 minutos e de 1 minuto não disparam", () => {
    const fn = lifecycle.slice(
      lifecycle.indexOf("function warnWhenNeeded"),
      lifecycle.indexOf("function tickSession"),
    );
    const codigo = semComentarios(fn);
    expect(
      codigo.indexOf("if (!encerrarPorInatividadeAtivo) return;"),
    ).toBeGreaterThan(-1);
    expect(
      codigo.indexOf("if (!encerrarPorInatividadeAtivo) return;"),
    ).toBeLessThan(codigo.indexOf("warnedOneMinute"));
  });

  it("a auditoria e a sincronização entre abas continuam", () => {
    expect(lifecycle).toContain("function auditExpiration");
    expect(lifecycle).toContain("function readSharedActivity");
    expect(lifecycle).toContain("registerActivity");
  });
});
