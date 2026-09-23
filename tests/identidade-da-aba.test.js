import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  FAVICON_PADRAO,
  aplicarFaviconDaMarca,
  definirPaginaDaAba,
  definirSistemaDaAba,
  escreverFavicon,
} from "../src/lib/identidade-da-aba.js";

const html = readFileSync("index.html", "utf8");
const app = readFileSync("src/modules/legacy-app.js", "utf8");

const semComentarios = (fonte) =>
  fonte.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

/*
  Dois defeitos, medidos antes de mexer.

  O ÍCONE nunca mudava: `<link id="appFavicon">` tinha id, mas nenhum código
  escrevia nele. Ficava preso numa imagem em `i.postimg.cc` — host de terceiros.

  O NOME era sobrescrito: `applyConfigToUi()` fazia
  `document.title = appVersion()`, e `appVersion()` devolve a **versão
  publicada**. A cada aplicação da configuração o nome da página virava uma
  string de versão. Era isso que fazia o título "voltar".
*/
describe("a aba identifica MONITORA", () => {
  it("mantém a marca ao navegar e receber configuração antiga", () => {
    for (const section of [
      "Saúde Indígena",
      "Editais",
      "Configurações",
      "Análises",
      "",
    ]) {
      definirPaginaDaAba(section);
      expect(document.title).toBe("MONITORA");
      definirSistemaDaAba("AgSUS Monitora Web V2.9.35");
      expect(document.title).toBe("MONITORA");
    }
  });
});

describe("o ícone da aba", () => {
  const montarCabecalho = () => {
    document.head.innerHTML = `
      <link id="appFavicon" rel="icon" href="${FAVICON_PADRAO}" />
      <link rel="shortcut icon" href="${FAVICON_PADRAO}" />
      <link rel="apple-touch-icon" href="${FAVICON_PADRAO}" />`;
  };

  const hrefs = () =>
    [
      ...document.querySelectorAll(
        'link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]',
      ),
    ].map((l) => l.getAttribute("href"));

  beforeEach(montarCabecalho);

  /*
    `link[rel~="icon"]` não alcança `apple-touch-icon`: `~=` casa palavras
    separadas por espaço, e "apple-touch-icon" é uma palavra só. Com aquele
    seletor a tag do iOS ficava para trás enquanto as outras duas mudavam.
  */
  it("escreve nas três tags, inclusive apple-touch-icon", () => {
    expect(escreverFavicon("https://exemplo.org/marca.png")).toBe(true);
    expect(hrefs()).toEqual([
      "https://exemplo.org/marca.png",
      "https://exemplo.org/marca.png",
      "https://exemplo.org/marca.png",
    ]);
  });

  it("aceita caminho local e HTTPS, recusa o resto", () => {
    expect(escreverFavicon("/assets/outra.webp")).toBe(true);
    expect(escreverFavicon("http://inseguro.org/x.png")).toBe(false);
    expect(escreverFavicon("")).toBe(false);
    expect(escreverFavicon(null)).toBe(false);
  });

  /*
    Trocar antes de a imagem carregar deixaria a aba sem ícone nenhum quando a
    URL configurada estivesse errada — pior do que manter o anterior.
  */
  it("só troca depois de a imagem carregar", async () => {
    let instancia = null;
    const criarImagem = () => {
      instancia = {
        set src(v) {
          this._src = v;
        },
      };
      return instancia;
    };

    const promessa = aplicarFaviconDaMarca("https://exemplo.org/marca.png", {
      criarImagem,
    });
    // Enquanto não carregou, o ícone antigo permanece.
    expect(hrefs()[0]).toBe(FAVICON_PADRAO);

    instancia.onload();
    await promessa;
    expect(hrefs()[0]).toBe("https://exemplo.org/marca.png");
  });

  it("se a imagem falha, o ícone anterior fica", async () => {
    let instancia = null;
    const criarImagem = () => {
      instancia = {
        set src(v) {
          this._src = v;
        },
      };
      return instancia;
    };

    const promessa = aplicarFaviconDaMarca("https://exemplo.org/quebrada.png", {
      criarImagem,
    });
    instancia.onerror();
    expect(await promessa).toBe(false);
    expect(hrefs()).toEqual([FAVICON_PADRAO, FAVICON_PADRAO, FAVICON_PADRAO]);
  });

  it("uma URL inútil não chega a tentar carregar", async () => {
    let tentou = false;
    const criarImagem = () => {
      tentou = true;
      return { set src(v) {} };
    };
    expect(await aplicarFaviconDaMarca("", { criarImagem })).toBe(false);
    expect(tentou).toBe(false);
  });

  it("o padrão local é aplicado sem esperar rede", async () => {
    escreverFavicon("https://exemplo.org/marca.png");
    expect(await aplicarFaviconDaMarca(FAVICON_PADRAO)).toBe(true);
    expect(hrefs()[0]).toBe(FAVICON_PADRAO);
  });
});

describe("como o HTML e o app ficam", () => {
  /*
    O comentário deste ficheiro cita `i.postimg.cc` ao explicar o defeito
    corrigido; procurar no texto cru acusaria a própria explicação.
  */
  it("o índice não depende mais de host de terceiros para o ícone", () => {
    const cabecalho = semComentarios(html).slice(0, html.indexOf("</head>"));
    expect(cabecalho).not.toContain("postimg");
    expect(cabecalho).toContain('href="/assets/agsus-logo.webp"');
  });

  it("traz as três tags, como o SIGAV", () => {
    const cabecalho = semComentarios(html);
    for (const rel of ["icon", "shortcut icon", "apple-touch-icon"]) {
      expect(cabecalho, `falta rel="${rel}"`).toContain(`rel="${rel}"`);
    }
  });

  /*
    As posições têm de sair do MESMO texto que se corta. Cortar o texto sem
    comentários com índices do original desloca tudo — erro que já me custou um
    falso vermelho antes.
  */
  it("applyConfigToUi não escreve mais document.title", () => {
    const codigo = semComentarios(app);
    const fn = codigo.slice(
      codigo.indexOf("function applyConfigToUi"),
      codigo.indexOf("function normalizeUnitName"),
    );
    expect(fn).not.toContain("document.title");
    expect(fn).toContain("definirSistemaDaAba(");
    expect(fn).toContain("aplicarFaviconDaMarca(");
  });

  it("setPageTitle delega a metade da página", () => {
    const fn = app.slice(
      app.indexOf("function setPageTitle"),
      app.indexOf("function isSidebarLockedViewport"),
    );
    expect(fn).toContain("definirPaginaDaAba(title)");
    expect(fn).not.toContain("document.title");
  });

  /*
    `appVersion()` continua servindo a auditoria e o rodapé da barra lateral —
    o que saiu foi só o uso dela como nome de aba.
  */
  it("appVersion continua em uso onde faz sentido", () => {
    const codigo = semComentarios(app);
    expect(codigo).toContain("p_app_version: appVersion()");
    expect(codigo).toContain('setText("sidebarVersion", appVersion())');
  });
});
