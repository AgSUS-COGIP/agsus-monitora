import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ler = (caminho) => readFileSync(caminho, "utf8");
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, "");
const app = semComentarios(ler("src/styles/app.css"));

const valorDoToken = (nome) =>
  Number(app.match(new RegExp(`${nome}:\\s*(\\d+)`))?.[1]);

/*
  A barra lateral subiu para cima do cabeçalho (`--z-sidebar`): a alça de
  recolher sai meio para fora da borda e o painel flutuante do menu passa por
  cima do cabeçalho e do mapa. Quem precisa ficar acima da barra — o modal de
  busca, o link de pular, a faixa offline, o aviso de conectividade e o aviso
  de sessão — foi para os tokens de overlay. Antes, com a barra em 20, ficavam
  abaixo do cabeçalho sem ninguém notar.
*/
describe("camadas acima da barra lateral", () => {
  it("cabeçalho < barra < popovers < overlays", () => {
    const cabecalho = valorDoToken("--z-header");
    const barra = valorDoToken("--z-sidebar");
    const popover = valorDoToken("--z-popover");
    const overlay = valorDoToken("--z-overlay");
    expect(cabecalho).toBe(10010);
    expect(barra).toBeGreaterThan(cabecalho);
    expect(popover).toBeGreaterThan(barra);
    expect(overlay).toBeGreaterThan(popover);
  });

  it("a barra fixa usa o token e não recorta a alça", () => {
    const i = app.indexOf("@media (min-width: 901px)");
    const bloco = app.slice(i, app.indexOf("}", i));
    expect(bloco).toContain("z-index: var(--z-sidebar)");
    expect(bloco).toContain("overflow: visible");
  });

  it("o que precisa ficar acima da barra usa os tokens de overlay", () => {
    expect(app).toMatch(
      /\.search-modal\s*\{[^}]*z-index:\s*var\(--z-overlay\)/,
    );
    expect(app).toMatch(/\.skip-link\s*\{[^}]*z-index:\s*var\(--z-toast\)/);
    expect(ler("src/styles/connectivity-status.css")).toMatch(
      /\.connectivity-status\s*\{[^}]*z-index:\s*var\(--z-toast\)/,
    );
    expect(ler("src/lib/session-lifecycle.js")).toMatch(
      /#agsusSessionNotice\s*\{[^}]*z-index:\s*var\(--z-toast, 20050\)/,
    );
    expect(ler("index.html")).toMatch(
      /id="offlineBar"[\s\S]*?z-index:\s*var\(--z-toast, 20050\)/,
    );
  });

  it("a barra travada não sobrescreve a camada com um número solto", () => {
    expect(app).not.toMatch(/body\.sidebar-locked \.sidebar\s*\{/);
  });
});
