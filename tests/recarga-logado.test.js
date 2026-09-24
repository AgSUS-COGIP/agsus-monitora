// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { SUPABASE_AUTH_STORAGE_KEY } from "../src/lib/env.js";

/*
  Recarregar a página já logado mostrava a tela de acesso (com a arte de
  fundo) até a sessão ser confirmada: durante `body.config-loading`, app.css
  deixa o login visível. Um script no <head> marca `html.sessao-guardada`
  antes da primeira pintura, e o login fica escondido nessa espera.
*/
const html = readFileSync("index.html", "utf8");
const semComentarios = html.replace(/<!--[\s\S]*?-->/g, "");
const inicio = semComentarios.indexOf("(function marcarSessaoGuardada()");
const script = semComentarios.slice(
  inicio,
  semComentarios.indexOf("</script>", inicio),
);

function rodarScript() {
  document.documentElement.className = "";
  new Function(script)();
  return document.documentElement.classList.contains("sessao-guardada");
}

describe("recarregar já logado não mostra a tela de acesso", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("o script roda no <head>, antes do <body>", () => {
    expect(inicio).toBeGreaterThan(-1);
    expect(inicio).toBeLessThan(semComentarios.indexOf("<body"));
  });

  it("lê a mesma chave de sessão que o cliente Supabase usa", () => {
    expect(script).toContain(`"${SUPABASE_AUTH_STORAGE_KEY}"`);
  });

  it("com sessão guardada, marca a página", () => {
    localStorage.setItem(
      SUPABASE_AUTH_STORAGE_KEY,
      JSON.stringify({ access_token: "a", refresh_token: "r" }),
    );
    expect(rodarScript()).toBe(true);
  });

  it("sem sessão, com sessão sem refresh_token ou com lixo, não marca", () => {
    expect(rodarScript()).toBe(false);
    localStorage.setItem(
      SUPABASE_AUTH_STORAGE_KEY,
      JSON.stringify({ access_token: "a" }),
    );
    expect(rodarScript()).toBe(false);
    localStorage.setItem(SUPABASE_AUTH_STORAGE_KEY, "{quebrado");
    expect(rodarScript()).toBe(false);
  });

  it("a regra esconde o login só durante o carregamento", () => {
    expect(semComentarios).toMatch(
      /html\.sessao-guardada body\.config-loading #loginScreen\s*\{\s*display:\s*none;/,
    );
  });
});
