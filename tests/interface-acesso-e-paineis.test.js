import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACCESS_BACKGROUND_MAX_BYTES,
  validateAccessBackgroundFile,
} from "../src/lib/access-background-storage.js";

const app = readFileSync("src/modules/legacy-app.js", "utf8");
const healthUx = readFileSync("src/modules/health-details-ux.js", "utf8");
const shellCss = readFileSync("src/styles/platform-shell.css", "utf8");

const semComentarios = (fonte) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const arquivoDe = (bytes, type = "image/png") => ({ size: bytes, type });

describe("imagens da tela de acesso até 6 MB", () => {
  const SEIS_MB = 6 * 1024 * 1024;

  it("o limite é seis megabytes", () => {
    expect(ACCESS_BACKGROUND_MAX_BYTES).toBe(SEIS_MB);
  });

  it("aceita 5,9 MB", () => {
    expect(validateAccessBackgroundFile(arquivoDe(5.9 * 1024 * 1024))).toBe("");
  });

  it("aceita exatamente 6 MB", () => {
    expect(validateAccessBackgroundFile(arquivoDe(SEIS_MB))).toBe("");
  });

  it("rejeita 6 MB mais um byte", () => {
    expect(validateAccessBackgroundFile(arquivoDe(SEIS_MB + 1))).toContain(
      "6 MB",
    );
  });

  it("continua aceitando JPG, PNG e WEBP", () => {
    for (const tipo of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validateAccessBackgroundFile(arquivoDe(1024, tipo))).toBe("");
    }
  });

  it("continua rejeitando outros tipos", () => {
    for (const tipo of [
      "image/gif",
      "image/svg+xml",
      "application/pdf",
      "text/html",
    ]) {
      expect(validateAccessBackgroundFile(arquivoDe(1024, tipo))).toContain(
        "JPG",
      );
    }
  });
});

describe("exclusão de artes guardadas", () => {
  it("a galeria oferece apagar", () => {
    expect(app).toContain("deleteStoredAccessBackground");
    expect(app).toContain("access-background-gallery-delete");
  });

  /*
    Apagar a arte ativa deixaria `auth_access_background_url` a apontar para um
    objeto inexistente, e o cache guardado no navegador de cada pessoa
    continuaria a pedir essa imagem.
  */
  it("a arte em uso não recebe botão de apagar", () => {
    const codigo = semComentarios(app);
    const galeria = codigo.slice(
      codigo.indexOf("items.forEach((item)"),
      codigo.indexOf("gallery.appendChild(list)"),
    );
    expect(galeria).toContain("if (emUso)");
    expect(galeria).toContain("access-background-gallery-hint");
  });

  it("a exclusão recusa a arte ativa mesmo se a interface divergir", () => {
    const fn = app.slice(
      app.indexOf("async function deleteStoredAccessBackground"),
      app.indexOf("async function loadAccessBackgroundGallery"),
    );
    expect(fn).toContain("auth_access_background_path");
    expect(fn).toContain("Esta arte está em uso");
  });

  it("pede confirmação antes de apagar", () => {
    const fn = app.slice(
      app.indexOf("async function deleteStoredAccessBackground"),
      app.indexOf("async function loadAccessBackgroundGallery"),
    );
    expect(fn).toContain("window.confirm");
    expect(fn).toContain("loadAccessBackgroundGallery()");
  });
});

describe("painel externo com um cabeçalho só", () => {
  it("entra em external-panel-mode ao abrir o painel", () => {
    const fn = app.slice(
      app.indexOf("function openPanel(code)"),
      app.indexOf("function openPanel(code)") + 1600,
    );
    expect(fn).toContain('classList.add("external-panel-mode")');
  });

  /*
    O antigo `external-clean` escondia também a navegação lateral. O estado novo
    esconde apenas o cabeçalho superior — a sidebar fica, é por ela que se volta.
  */
  it("o estado novo esconde o cabeçalho e preserva a sidebar", () => {
    expect(shellCss).toContain("body.external-panel-mode .main > header.top");
    expect(shellCss).not.toMatch(
      /body\.external-panel-mode[^{]*(aside|\.side)[^{]*\{[^}]*display:\s*none/,
    );
  });

  it("devolve ao conteúdo a altura do cabeçalho removido", () => {
    const bloco = shellCss.slice(
      shellCss.indexOf("body.external-panel-mode .content"),
    );
    expect(bloco).toContain("padding-top: 0");
  });

  it("o modo é removido ao sair do painel", () => {
    const remocoes = (
      app.match(/classList\.remove\("external-panel-mode"\)/g) || []
    ).length;
    expect(remocoes).toBeGreaterThanOrEqual(2);
  });
});

describe("uma única confirmação de saída", () => {
  /*
    `health-details-ux` embrulhava `window.logout` com um modal próprio, e
    `nielsen-shell-ux` — carregado depois — capturava a versão já embrulhada e
    somava o seu. Quem clicava em Sair via dois diálogos seguidos.
  */
  it("o embrulho antigo de window.logout não existe mais", () => {
    expect(healthUx).not.toContain("installConfirmedLogout");
    expect(semComentarios(healthUx)).not.toContain("__agsusConfirmedLogout");
  });

  it("nenhum módulo redefine window.logout", () => {
    const codigo = semComentarios(app) + semComentarios(healthUx);
    expect(codigo).not.toMatch(/windowRef\.logout\s*=/);
    expect(codigo).not.toMatch(/window\.logout\s*=\s*(?!null)/);
  });
});

describe("botão de acesso no retorno do navegador", () => {
  /*
    Abaixo de 768 px o login é redirecionamento de página inteira. Ao voltar do
    Google pelo botão Voltar, o navegador restaura a página do bfcache com o
    botão ainda `disabled` e o texto "Entrando no sistema…".
  */
  it("existe um listener de pageshow", () => {
    expect(semComentarios(app)).toContain('addEventListener("pageshow"');
  });

  it("trata tanto bfcache como navegação de histórico", () => {
    const fn = app.slice(app.indexOf('addEventListener("pageshow"'));
    expect(fn).toContain("event.persisted");
    expect(fn).toContain("back_forward");
  });

  it("só restaura o botão quando não há sessão ativa", () => {
    const fn = app.slice(
      app.indexOf('addEventListener("pageshow"'),
      app.indexOf('addEventListener("pageshow"') + 900,
    );
    expect(fn).toContain("estadoDaSessao");
    expect(fn).toContain("SESSAO_ATIVA");
    expect(fn).toContain("resetGoogleLoginButton()");
  });

  /*
    Registado uma única vez, no carregamento do módulo: se fosse registado a cada
    tentativa de login, os listeners acumulariam e o botão seria restaurado
    tantas vezes quantas a pessoa tentasse entrar.
  */
  it("é registado uma única vez", () => {
    const registos = (
      semComentarios(app).match(/addEventListener\("pageshow"/g) || []
    ).length;
    expect(registos).toBe(1);
  });
});
