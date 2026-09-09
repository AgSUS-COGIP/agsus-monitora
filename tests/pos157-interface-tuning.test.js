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
  it("vence as regras antigas com important e reduz o KPI sem zoom ou scale", () => {
    expect(css).toContain("#page-dashboard .kpi > b");
    expect(css).toContain("clamp(22px, 1.7vw, 28px) !important");
    expect(css).toContain("min-height: 78px !important");
    expect(css).toContain("width: 26px !important");
    expect(css).not.toMatch(/\bzoom\s*:/);
    expect(css).not.toMatch(/transform:\s*scale\(/);
  });
});

describe("overview inicial dos mapas", () => {
  it("usa o tamanho real do card e pode chegar a zoom 4", () => {
    expect(mapGuard).toContain("map.__agsusOverviewMode = true");
    expect(mapGuard).toContain("maxZoom: 4");
    expect(mapGuard).toContain("padding: [10, 10]");
    expect(mapGuard).toContain("isBrazilOverviewBounds");
  });

  it("invalida o tamanho antes de reenquadrar o Brasil", () => {
    const fit = mapGuard.slice(
      mapGuard.indexOf("const fitBrazilOverview"),
      mapGuard.indexOf('map.on("resize"'),
    );
    expect(fit).toContain("invalidateSize");
    expect(fit).toContain("originalFitBounds(viewBounds");
  });

  it("recalcula o enquadramento quando o card muda de tamanho", () => {
    expect(mapGuard).toContain('map.on("resize"');
    expect(mapGuard).toContain("requestAnimationFrame(fitBrazilOverview)");
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

  it("oferece upload de logo como o gestor de fundo do login", () => {
    expect(sidebar).toContain('type="file"');
    expect(sidebar).toContain("Escolher imagem");
    expect(sidebar).toContain("validateAccessBackgroundFile");
    expect(sidebar).toContain("client.storage");
    expect(sidebar).toContain("SIDEBAR_LOGO_FOLDER");
    expect(sidebar).toContain("loadSidebarLogoGallery");
  });

  it("mantém upload da logo dentro da pasta branding já autorizada", () => {
    expect(sidebar).toContain(
      "const SIDEBAR_LOGO_FOLDER = `${ACCESS_BACKGROUND_FOLDER}/sidebar`",
    );
    expect(sidebar).toContain("ACCESS_BACKGROUND_BUCKET");
  });

  it("permite restaurar padrão e apagar logos não selecionadas", () => {
    expect(sidebar).toContain("cfgSidebarLogoRestore");
    expect(sidebar).toContain("deleteStoredSidebarLogo");
    expect(sidebar).toContain("Restaurar padrão");
  });

  it("não embrulha window.saveAdminSettings", () => {
    expect(sidebar).not.toMatch(/window\.saveAdminSettings\s*=/);
  });

  it("não deduz sucesso pelo texto do toast", () => {
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

describe("o reenquadramento não descarta o zoom da pessoa", () => {
  /*
    A verificação continua existindo, mas mudou de lugar: saiu de dentro do
    handler de `resize` e virou `emOverview()`, porque o `ResizeObserver` que
    passou a decidir o enquadramento inicial precisa fazer a mesma pergunta.
    Uma função, dois chamadores.
  */
  it("confere o zoom corrente, não só a bandeira", () => {
    const derivado = mapGuard.slice(
      mapGuard.indexOf("function emOverview"),
      mapGuard.indexOf("function observarTamanhoDoCard"),
    );
    expect(derivado).toContain("map.__agsusOverviewMode");
    expect(derivado).toContain("getZoom");
    expect(derivado).toMatch(/<=\s*4/);
  });

  it("o handler de resize consulta esse estado derivado", () => {
    const handler = mapGuard.slice(
      mapGuard.indexOf('map.on("resize"'),
      mapGuard.indexOf('map.on("drag move zoomend'),
    );
    expect(handler).toContain("if (!emOverview(map)) return;");
  });
});

describe("limite real do Storage", () => {
  it("versiona o bucket platform-assets em 6 MB", () => {
    expect(migration).toContain("file_size_limit = 6 * 1024 * 1024");
    expect(migration).toContain("id = 'platform-assets'");
  });
});
