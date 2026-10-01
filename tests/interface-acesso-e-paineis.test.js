import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { criarImagensDaAparencia } from "../src/componentes/configuracoes/imagens.js";
import {
  ACCESS_BACKGROUND_MAX_BYTES,
  validateAccessBackgroundFile,
} from "../src/lib/access-background-storage.js";

const app = readFileSync("src/modules/legacy-app.js", "utf8");
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

/*
  Apagar a arte ativa deixaria `auth_access_background_url` a apontar para um
  objeto inexistente, e o cache guardado no navegador de cada pessoa
  continuaria a pedir essa imagem. A galeria (Configurações › Aparência, em
  React) não oferece Apagar para a arte em uso, e o estado das imagens recusa
  por garantia, caso a interface e o estado divirjam por um instante.
*/
describe("exclusão de artes guardadas", () => {
  function montar({ confirmar = () => true } = {}) {
    const armazenamento = {
      list: vi.fn(async () => ({ data: [], error: null })),
      remove: vi.fn(async () => ({ error: null })),
      getPublicUrl: (c) => ({ data: { publicUrl: `https://cdn.test/${c}` } }),
    };
    const avisar = vi.fn();
    const imagens = criarImagensDaAparencia({
      supabase: () => ({ storage: { from: () => armazenamento } }),
      configuracoes: {
        obter: () => ({
          valores: new Map([
            ["auth_access_background_path", "branding/acesso-ativa.png"],
          ]),
        }),
      },
      documento: document,
      avisar,
      confirmar,
    });
    return { imagens, armazenamento, avisar };
  }

  it("a exclusão recusa a arte ativa mesmo se a interface divergir", async () => {
    const { imagens, armazenamento, avisar } = montar();
    expect(
      await imagens.apagarFundo({
        caminho: "branding/acesso-ativa.png",
        nome: "acesso-ativa.png",
      }),
    ).toBe(false);
    expect(armazenamento.remove).not.toHaveBeenCalled();
    expect(avisar).toHaveBeenCalledWith(
      expect.stringContaining("Esta arte está em uso"),
      "warn",
    );
  });

  it("pede confirmação antes de apagar e recarrega a galeria", async () => {
    let resposta = false;
    const { imagens, armazenamento } = montar({ confirmar: () => resposta });
    const outra = { caminho: "branding/acesso-velha.png", nome: "velha" };
    expect(await imagens.apagarFundo(outra)).toBe(false);
    expect(armazenamento.remove).not.toHaveBeenCalled();
    resposta = true;
    expect(await imagens.apagarFundo(outra)).toBe(true);
    expect(armazenamento.remove).toHaveBeenCalledWith([outra.caminho]);
    expect(armazenamento.list).toHaveBeenCalled();
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
  it("nenhum módulo redefine window.logout", () => {
    const codigo = semComentarios(app);
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
