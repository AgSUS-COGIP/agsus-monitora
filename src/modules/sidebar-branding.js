import { needsLightForeground } from "../lib/access-branding.js";
import { getSupabaseClient } from "../lib/supabaseClient.js";

const KEY_LOGO = "ui_sidebar_logo_url";
const KEY_COLOR = "ui_sidebar_background_color";
const DEFAULT_LOGO = "/assets/agsus-logo.webp";
const DEFAULT_COLOR = "#ffffff";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

let initialized = false;
let client = null;
let currentLogo = DEFAULT_LOGO;
let currentColor = DEFAULT_COLOR;

function safeLogo(value) {
  const raw = String(value || "").trim();
  if (!raw) return DEFAULT_LOGO;
  if (raw.startsWith("/")) return raw;
  if (/^https:\/\//i.test(raw)) return raw;
  return DEFAULT_LOGO;
}

function safeColor(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  return HEX_COLOR.test(raw) ? raw : DEFAULT_COLOR;
}

function cssUrl(value) {
  return `url("${String(value).replace(/["\\]/g, "")}")`;
}

function applySidebarBranding({
  logo = currentLogo,
  color = currentColor,
} = {}) {
  currentLogo = safeLogo(logo);
  currentColor = safeColor(color);

  document.documentElement.style.setProperty(
    "--sidebar-custom-bg",
    currentColor,
  );
  document.documentElement.style.setProperty(
    "--sidebar-logo-image",
    cssUrl(currentLogo),
  );
  document.body?.classList.toggle(
    "sidebar-theme-dark",
    needsLightForeground(currentColor),
  );

  const logoInput = document.getElementById("cfgSidebarLogoUrl");
  const colorInput = document.getElementById("cfgSidebarBackgroundColor");
  const preview = document.getElementById("cfgSidebarLogoPreview");
  if (logoInput && logoInput.value !== currentLogo)
    logoInput.value = currentLogo;
  if (colorInput && colorInput.value !== currentColor) {
    colorInput.value = currentColor;
  }
  if (preview && preview.getAttribute("src") !== currentLogo) {
    preview.setAttribute("src", currentLogo);
  }
}

function ensureConfigFields() {
  const root = document.getElementById("page-config");
  if (!root || root.querySelector("[data-sidebar-branding-config]")) return;
  const formGrid = root.querySelector(".admin-grid .admin-card .form-grid");
  if (!formGrid) return;

  const fragment = document.createDocumentFragment();
  const title = document.createElement("div");
  title.className = "config-section-title";
  title.dataset.sidebarBrandingConfig = "true";
  title.textContent = "Barra lateral";

  const logoRow = document.createElement("div");
  logoRow.className = "form-row full";
  logoRow.dataset.sidebarBrandingConfig = "true";
  logoRow.innerHTML = `
    <label for="cfgSidebarLogoUrl">Logo da barra lateral</label>
    <input id="cfgSidebarLogoUrl" placeholder="/assets/agsus-logo.webp" />
    <small>Use um caminho local ou uma URL HTTPS. Esta logo é independente da tela de login.</small>
    <div class="sidebar-branding-preview"><img id="cfgSidebarLogoPreview" alt="Prévia da logo da barra lateral" /></div>
  `;

  const colorRow = document.createElement("div");
  colorRow.className = "form-row";
  colorRow.dataset.sidebarBrandingConfig = "true";
  colorRow.innerHTML = `
    <label for="cfgSidebarBackgroundColor">Cor da barra lateral</label>
    <input id="cfgSidebarBackgroundColor" type="color" value="#ffffff" />
    <small>Textos e ícones mudam automaticamente para preservar contraste.</small>
  `;

  fragment.append(title, logoRow, colorRow);
  formGrid.appendChild(fragment);

  const logoInput = document.getElementById("cfgSidebarLogoUrl");
  const colorInput = document.getElementById("cfgSidebarBackgroundColor");
  logoInput?.addEventListener("input", () => {
    currentLogo = safeLogo(logoInput.value);
    applySidebarBranding();
  });
  colorInput?.addEventListener("input", () => {
    currentColor = safeColor(colorInput.value);
    applySidebarBranding();
  });
  applySidebarBranding();
}

async function readSidebarBranding() {
  if (!client) return false;
  const { data: sessionData } = await client.auth.getSession();
  if (!sessionData?.session) return false;
  const { data, error } = await client
    .from("configuracoes")
    .select("chave,valor")
    .in("chave", [KEY_LOGO, KEY_COLOR]);
  if (error) return false;
  const values = Object.fromEntries(
    (data || []).map((row) => [row.chave, row.valor]),
  );
  currentLogo = safeLogo(values[KEY_LOGO]);
  currentColor = safeColor(values[KEY_COLOR]);
  applySidebarBranding();
  return true;
}

/*
  As duas chaves da barra lateral entram no **mesmo** `p_config_rows` que o botão
  Salvar já envia. Uma chamada, uma transação, um resultado.

  A primeira versão embrulhava `window.saveAdminSettings`, esperava o salvamento
  principal terminar e disparava uma segunda chamada à mesma RPC. Três problemas
  vinham juntos:

  - **Terceiro embrulho do mesmo global.** `config-governance` e
    `config-page-enhancements` já embrulham `window.saveAdminSettings`. Foi
    exatamente essa cadeia que produziu os dois modais de saída corrigidos no
    #157, agora repetida no botão Salvar.
  - **Sucesso deduzido do toast.** Lia `toastBox.textContent` à procura de
    "configurações salvas". Os toasts empilham e só somem por temporizador, de
    modo que a mensagem de um salvamento anterior fazia a segunda gravação
    acontecer mesmo depois de uma falha.
  - **Salvamento parcial.** Duas chamadas separadas: a primeira podia gravar e a
    segunda falhar, deixando metade da configuração aplicada.

  Nada disso existe quando as linhas viajam juntas.
*/
export function linhasDeConfiguracaoDaSidebar() {
  const logoInput = document.getElementById("cfgSidebarLogoUrl");
  const colorInput = document.getElementById("cfgSidebarBackgroundColor");
  if (!logoInput && !colorInput) return [];

  currentLogo = safeLogo(logoInput?.value ?? currentLogo);
  currentColor = safeColor(colorInput?.value ?? currentColor);

  return [
    {
      chave: KEY_LOGO,
      valor: currentLogo,
      descricao: "Logo independente da barra lateral do AgSUS Monitora",
    },
    {
      chave: KEY_COLOR,
      valor: currentColor,
      descricao: "Cor de fundo da barra lateral do AgSUS Monitora",
    },
  ];
}

/** Reaplica a aparência depois de o salvamento principal ter tido sucesso. */
export function reaplicarSidebarAposSalvar() {
  applySidebarBranding();
}
export function initSidebarBranding() {
  if (initialized || typeof document === "undefined") return;
  initialized = true;
  client = getSupabaseClient();

  const boot = async () => {
    ensureConfigFields();
    await readSidebarBranding();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void boot(), {
      once: true,
    });
  } else {
    void boot();
  }

  /*
    `getSupabaseClient()` devolve `null` quando não há configuração do Supabase
    no ambiente — é o caso de qualquer build sem `.env`, incluindo o do CI. Sem
    esta guarda, o arranque quebrava com
    `Cannot read properties of null (reading 'auth')`, derrubando o smoke e
    interrompendo os módulos carregados depois deste.

    As outras funções do ficheiro já se protegiam; só esta não.
  */
  if (!client) return;

  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      void readSidebarBranding();
    }
  });
}
