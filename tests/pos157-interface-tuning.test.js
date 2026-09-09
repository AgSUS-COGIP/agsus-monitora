import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles/post157-interface-tuning.css", "utf8");
const main = readFileSync("src/main.js", "utf8");
const mapGuard = readFileSync("src/modules/map-guard.js", "utf8");
const sidebar = readFileSync("src/modules/sidebar-branding.js", "utf8");
const app = readFileSync("src/modules/legacy-app.js", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260909114500_platform_assets_6mb.sql",
  "utf8",
);

describe("primeiro paint da tela de login", () => {
  it("não usa mais os fallbacks roxos do legado", () => {
    expect(css).toContain("background-color: #eef4f8");
    expect(css).toContain("var(--login-panel-color, #ffffff)");
    expect(css).not.toContain("#4d2270");
    expect(css).not.toContain("#c296eb");
  });
});

describe("densidade do dashboard Saúde Indígena", () => {
  it("reduz KPI sem usar zoom ou scale", () => {
    expect(css).toContain("#page-dashboard .kpi");
    expect(css).toContain("font-size: 26px");
    expect(css).not.toMatch(/\bzoom\s*:/);
    expect(css).not.toMatch(/transform:\s*scale\(/);
  });
});

describe("overview inicial dos mapas", () => {
  it("limita a visão Brasil a zoom 3", () => {
    expect(mapGuard).toContain("map.__agsusOverviewMode = true");
    expect(mapGuard).toContain("maxZoom: 3");
    expect(mapGuard).toContain("isBrazilOverviewBounds");
  });

  it("recalcula o enquadramento quando o card muda de tamanho", () => {
    expect(mapGuard).toContain('map.on("resize"');
    expect(mapGuard).toContain("originalFitBounds(viewBounds");
  });
});

describe("branding independente da sidebar", () => {
  it("usa chaves próprias", () => {
    expect(sidebar).toContain('"ui_sidebar_logo_url"');
    expect(sidebar).toContain('"ui_sidebar_background_color"');
  });

  it("deriva contraste da cor escolhida", () => {
    expect(sidebar).toContain("needsLightForeground(currentColor)");
    expect(sidebar).toContain("sidebar-theme-dark");
  });

  /*
    As duas chaves viajam no mesmo `p_config_rows` do botão Salvar. Uma chamada,
    uma transação.

    A primeira versão embrulhava `window.saveAdminSettings`, deduzia sucesso lendo
    o texto do `toastBox` e disparava uma segunda chamada à mesma RPC. Os toasts
    empilham e só somem por temporizador, de modo que a mensagem de um salvamento
    anterior fazia a segunda gravação acontecer mesmo depois de uma falha — e duas
    chamadas separadas permitem salvamento parcial.
  */
  it("não embrulha window.saveAdminSettings", () => {
    expect(sidebar).not.toMatch(/window\.saveAdminSettings\s*=/);
  });

  it("não deduz sucesso pelo texto do toast", () => {
    // O comentário do módulo cita `toastBox` ao explicar o defeito corrigido.
    const codigo = sidebar
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(codigo).not.toContain("toastBox");
    expect(codigo).not.toMatch(/configura[cç][oõ]es salvas/i);
  });

  it("não faz uma segunda chamada à RPC de configuração", () => {
    const codigo = sidebar
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(codigo).not.toContain("salvar_configuracoes_e_paineis");
  });

  it("as chaves entram no mesmo p_config_rows do salvamento principal", () => {
    expect(sidebar).toContain("export function linhasDeConfiguracaoDaSidebar");
    expect(app).toContain("linhasDeConfiguracaoDaSidebar()");
    const chamada = app.slice(
      app.indexOf("const linhasDeConfiguracao = ["),
      app.indexOf("p_paineis: panelRows"),
    );
    expect(chamada).toContain("...configRows");
    expect(chamada).toContain("...linhasDeConfiguracaoDaSidebar()");
  });

  /*
    `getSupabaseClient()` devolve `null` sem configuração de ambiente — o caso do
    CI. Sem guarda, o arranque quebrava com
    `Cannot read properties of null (reading 'auth')` e derrubava o smoke.
  */
  it("não desreferencia o cliente quando não há ambiente", () => {
    const init = sidebar.slice(
      sidebar.indexOf("export function initSidebarBranding"),
    );
    const guarda = init.indexOf("if (!client) return;");
    const uso = init.indexOf("client.auth.onAuthStateChange");
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(uso);
  });

  it("é inicializado antes do guard de Configurações", () => {
    expect(main.indexOf("initSidebarBranding();")).toBeGreaterThan(-1);
    expect(main.indexOf("initSidebarBranding();")).toBeLessThan(
      main.indexOf("initConfigPageEnhancements();"),
    );
  });
});

/*
  O zoom por pinça não passa por `setView` nem `flyTo`, então a bandeira de visão
  geral continuaria ligada depois de a pessoa aproximar. Um `resize` seguinte
  devolveria o mapa ao Brasil, descartando o enquadramento dela.
*/
describe("o reenquadramento não descarta o zoom da pessoa", () => {
  it("confere o zoom corrente, não só a bandeira", () => {
    const handler = mapGuard.slice(
      mapGuard.indexOf('map.on("resize"'),
      mapGuard.indexOf('map.on("drag move zoomend'),
    );
    expect(handler).toContain("getZoom");
    expect(handler).toMatch(/<=\s*3/);
  });
});

describe("limite real do Storage", () => {
  it("versiona o bucket platform-assets em 6 MB", () => {
    expect(migration).toContain("file_size_limit = 6 * 1024 * 1024");
    expect(migration).toContain("id = 'platform-assets'");
  });
});
