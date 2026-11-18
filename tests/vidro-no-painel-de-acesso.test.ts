// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ESTILO_SOLIDO,
  ESTILO_VIDRO,
  avaliarCor,
  normalizarEstilo,
} from "../src/lib/base/contraste.ts";
import { mapearBrandingPublico } from "../src/lib/entrada/access-branding-publico.ts";
import { aplicarEstiloDoPainel } from "../src/app/entrada/marca.ts";

/*
  O PAINEL DE VIDRO DA TELA DE ACESSO (pedido de 12/11/2026)

  Configurações › Tela de acesso › Estilo do painel: sólido (padrão) ou vidro.
  A chave `auth_access_painel_estilo` chega antes do login pela função pública
  (migration 20261112180000), vai para o cache da marca e vira a classe
  `login-panel-vidro` no #loginScreen. Desde 13/11/2026 o vidro não tem cor:
  o texto vai direto sobre a arte, que o sistema não mede.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const ler = (relativo: string) =>
  fs.readFileSync(path.join(RAIZ, relativo), "utf8").replace(/\r\n/g, "\n");

describe("o estilo do painel", () => {
  it("normaliza: só 'vidro' é vidro", () => {
    expect(normalizarEstilo("vidro")).toBe(ESTILO_VIDRO);
    expect(normalizarEstilo(" VIDRO ")).toBe(ESTILO_VIDRO);
    for (const valor of ["", "solido", "outro", null, undefined]) {
      expect(normalizarEstilo(valor)).toBe(ESTILO_SOLIDO);
    }
  });

  it("chega antes do login pela leitura pública", () => {
    expect(
      mapearBrandingPublico({
        auth_access_panel_color: "#12403f",
        auth_access_painel_estilo: "vidro",
      }),
    ).toEqual({ panelColor: "#12403f", painelEstilo: "vidro" });
  });

  it("vira a classe login-panel-vidro e sai dela", () => {
    const tela = document.createElement("section");
    aplicarEstiloDoPainel(tela, "vidro");
    expect(tela.classList.contains("login-panel-vidro")).toBe(true);
    aplicarEstiloDoPainel(tela, "solido");
    expect(tela.classList.contains("login-panel-vidro")).toBe(false);
  });

  it("o primeiro quadro aplica a classe guardada, sem esperar o JavaScript", () => {
    const html = ler("index.html");
    expect(html).toContain(
      'window.__agsusPainelVidro = marca.painelEstilo === "vidro";',
    );
    expect(html).toContain('.classList.add("login-panel-vidro");');
  });

  it("sem ajuste, o vidro não tem cor; e recua para o painel sólido", () => {
    const css = ler("src/styles/platform-shell.css");
    const bloco = css.slice(
      css.indexOf(".login-screen.login-panel-vidro .login-outer {"),
      css.indexOf(".login-screen.login-panel-vidro .login-card {"),
    );
    // A cor só entra na proporção escolhida (13/11/2026); sem escolha, 0%.
    expect(bloco).toContain("var(--vidro-cor, 0%)");
    expect(css).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(css).toContain(
      "background: var(--login-panel-color, var(--color-bg-subtle));",
    );
  });
});

describe("contraste do vidro", () => {
  /*
    13/11/2026: "vidro mesmo, sem cor". Nem tinta, nem brilho branco, nem
    realce de saturação: o vidro se vê pela borda clara e pelo realce de luz.
  */
  it("vidro de verdade: sem brilho nem saturação; cor e desfoque só os escolhidos", () => {
    const css = ler("src/styles/platform-shell.css");
    const bloco = css.slice(
      css.indexOf(".login-screen.login-panel-vidro .login-outer {"),
      css.indexOf(".login-screen.login-panel-vidro .login-card {"),
    );
    expect(bloco).not.toContain("linear-gradient");
    expect(bloco).not.toContain("saturate");
    expect(bloco).toContain(
      "backdrop-filter: blur(var(--vidro-desfoque, 0px));",
    );
    expect(bloco).toContain(
      "border-color: color-mix(in srgb, var(--brilho-do-vidro)",
    );
    expect(bloco).toContain(
      "inset 0 1px 0 color-mix(in srgb, var(--brilho-do-vidro)",
    );
  });

  it("no vidro o contraste não é garantido, e o aviso diz que arte combina", () => {
    const escuro = avaliarCor("#002f2f", "auto", "vidro");
    expect(escuro?.passa).toBe(false);
    expect(escuro?.mensagem).toContain("texto claro");
    expect(escuro?.mensagem).toContain("precisa ser escura");
    expect(escuro?.mensagem).toContain("painel sólido");
    const claro = avaliarCor("#f2f2f2", "auto", "vidro");
    expect(claro?.mensagem).toContain("precisa ser clara");
  });

  it("no sólido a cor continua medida como antes", () => {
    const solido = avaliarCor("#002f2f", "auto", "solido");
    expect(solido?.passa).toBe(true);
    expect(solido?.mensagem).toContain("Acima do mínimo");
    expect(avaliarCor("#8fb3d9", "claro", "solido")?.passa).toBe(false);
  });
});
