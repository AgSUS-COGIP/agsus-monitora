import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles/post157-interface-tuning.css", "utf8");
const main = readFileSync("src/main.js", "utf8");
const mapGuard = readFileSync("src/modules/map-guard.js", "utf8");
const sidebar = readFileSync("src/modules/sidebar-branding.js", "utf8");
// A escolha da logo e da cor é de Configurações › Aparência (React).
const marcaDaBarra = readFileSync("src/lib/marca-da-barra-lateral.js", "utf8");
const imagens = readFileSync("src/modulos/configuracoes/imagens.js", "utf8");
const aparencia = readFileSync(
  "src/modulos/configuracoes/aparencia.jsx",
  "utf8",
);
const publicacao = readFileSync(
  "src/lib/publicacao-de-configuracoes.js",
  "utf8",
);
const governance = readFileSync("src/modulos/configuracoes/estado.js", "utf8");
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

/*
  A densidade do KPI saiu daqui. Este arquivo sobrepunha os KPIs da Visão geral
  com !important e chegou a deixar o rótulo com 9px. Hoje a Visão geral é React
  (src/modulos/visao-geral/) e o KPI é o card compacto de src/ui/ (`Kpi`,
  ui.css), com valores de tokens.css: rótulo em `caption` e valor em `metric`.
*/
describe("densidade do dashboard Saúde Indígena", () => {
  const kpis = readFileSync("src/ui/ui.css", "utf8");

  it("não é mais sobrescrita aqui", () => {
    expect(css).not.toContain("#page-dashboard .kpi");
  });

  it("vem de tokens, com rótulo legível e sem zoom ou scale", () => {
    expect(kpis).toContain("font-size: var(--text-metric-sm);");
    // 12px (caption, o mínimo do Design System): em 13px o rótulo mais longo quebrava e esticava a fileira.
    expect(kpis).toContain("font-size: var(--text-caption);");
    expect(kpis).toContain("font-variant-numeric: tabular-nums;");
    expect(kpis).not.toMatch(/font-size:\s*(8|9|10)(\.\d)?px/);
    expect(kpis).not.toMatch(/font-weight:\s*(7|8|9)\d\d/);
    expect(kpis).not.toMatch(/\bzoom\s*:/);
    expect(kpis).not.toMatch(/transform:\s*scale\(/);
  });

  it("tokens.css entra antes de qualquer outro CSS", () => {
    const primeiroCss = main.match(/import "(\.\/styles\/[^"]+\.css)"/)[1];
    expect(primeiroCss).toBe("./styles/tokens.css");
  });
});

describe("overview inicial dos mapas", () => {
  it("usa o tamanho real do card e respeita o limite nacional de 500 km", () => {
    expect(mapGuard).toContain("map.__agsusOverviewMode = true");
    expect(mapGuard).toContain("HEALTH_MAP_OVERVIEW_MAX_ZOOM = 4.5");
    expect(mapGuard).toContain("maxZoom: HEALTH_MAP_OVERVIEW_MAX_ZOOM");
    // A folga cobre a maior bolha (src/lib/enquadramento-do-brasil.js).
    expect(mapGuard).toContain("padding: folgaDoBrasil");
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
    expect(marcaDaBarra).toContain('"ui_sidebar_logo_url"');
    expect(marcaDaBarra).toContain('"ui_sidebar_background_color"');
    expect(sidebar).toContain("CHAVE_DO_LOGO_DA_BARRA");
    expect(sidebar).toContain("CHAVE_DA_COR_DA_BARRA");
  });

  it("deriva contraste da cor escolhida", () => {
    expect(sidebar).toContain("needsLightForeground(currentColor)");
    expect(sidebar).toContain("sidebar-theme-dark");
  });

  it("oferece upload de logo como o gestor de fundo do login", () => {
    expect(aparencia).toContain('type="file"');
    expect(aparencia).toContain("Escolher imagem");
    expect(imagens).toContain("validateAccessBackgroundFile");
    expect(imagens).toContain(".storage?.from(ACCESS_BACKGROUND_BUCKET)");
    expect(imagens).toContain("PASTA_DOS_LOGOS_DA_BARRA");
    expect(imagens).toContain("carregarLogos");
  });

  it("mantém upload da logo dentro da pasta branding já autorizada", () => {
    expect(marcaDaBarra).toContain(
      "export const PASTA_DOS_LOGOS_DA_BARRA = `${ACCESS_BACKGROUND_FOLDER}/sidebar`",
    );
    expect(imagens).toContain("ACCESS_BACKGROUND_BUCKET");
  });

  it("permite restaurar padrão e apagar logos não selecionadas", () => {
    expect(imagens).toContain("restaurarLogo");
    expect(imagens).toContain("apagarLogo");
    expect(aparencia).toContain("Restaurar padrão");
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

  it("as chaves entram no mesmo p_config_rows da publicação", () => {
    expect(publicacao).toContain('"ui_sidebar_logo_url"');
    expect(publicacao).toContain('"ui_sidebar_background_color"');
    expect(governance).toContain(
      "const linhasDaPublicacao = () => linhasDasSecoes(valoresAtuais());",
    );
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

  it("é inicializado antes da moldura de Configurações", () => {
    expect(main.indexOf("initSidebarBranding();")).toBeGreaterThan(-1);
    expect(main.indexOf("initSidebarBranding();")).toBeLessThan(
      main.indexOf("montarConfiguracoes();"),
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
    expect(derivado).toContain("HEALTH_MAP_OVERVIEW_MAX_ZOOM");
  });

  it("o handler de resize consulta esse estado derivado", () => {
    const handler = mapGuard.slice(
      mapGuard.indexOf('map.on("resize"'),
      mapGuard.indexOf('map.on("drag move zoomend'),
    );
    expect(handler).toContain(
      "if (enquadramentoProprio || !emOverview(map)) return;",
    );
  });
});

describe("limite real do Storage", () => {
  it("versiona o bucket platform-assets em 6 MB", () => {
    expect(migration).toContain("file_size_limit = 6 * 1024 * 1024");
    expect(migration).toContain("id = 'platform-assets'");
  });
});
