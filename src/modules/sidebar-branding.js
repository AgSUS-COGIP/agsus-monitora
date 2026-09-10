import { needsLightForeground } from "../lib/access-branding.js";
import {
  ACCESS_BACKGROUND_BUCKET,
  ACCESS_BACKGROUND_FOLDER,
  validateAccessBackgroundFile,
} from "../lib/access-background-storage.js";
import { getSupabaseClient } from "../lib/supabaseClient.js";
import { ligarAvisoDeContraste } from "./aviso-de-contraste.js";

const KEY_LOGO = "ui_sidebar_logo_url";
const KEY_COLOR = "ui_sidebar_background_color";
const DEFAULT_LOGO = "/assets/agsus-logo.webp";
const DEFAULT_COLOR = "#ffffff";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SIDEBAR_LOGO_FOLDER = `${ACCESS_BACKGROUND_FOLDER}/sidebar`;
const SIDEBAR_LOGO_PREFIX = "logo-";
const EXTENSION_BY_MIME = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
});

let initialized = false;
let client = null;
let currentLogo = DEFAULT_LOGO;
let currentColor = DEFAULT_COLOR;
let logoUploadBusy = false;

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

/*
  A logo volta a ser o `<img id="sideLogo">`, e não um `background-image` numa
  variável CSS.

  A apresentação por variável dependia de `.side-logo-wrap { background-image }`,
  que `system-ui-fixes.css` já anulava com `background: transparent !important` —
  o atalho `background` zera `background-image`, e o `!important` ganha da regra
  normal. Com o `<img>` em `opacity: 0` por baixo, não sobrava nada para ver:
  o topo da barra lateral ficava branco.

  Aqui há um elemento só, com um dono só. Se a URL escolhida não carregar, o
  `onerror` devolve o padrão em vez de esconder a imagem — uma logo tem de
  aparecer mesmo quando a leitura do banco falha.
*/
function aplicarLogoNaBarraLateral(logo) {
  const img = document.getElementById("sideLogo");
  if (!img) return false;

  img.onerror = () => {
    img.onerror = null;
    if (img.getAttribute("src") !== DEFAULT_LOGO) {
      img.setAttribute("src", DEFAULT_LOGO);
    }
  };
  if (img.getAttribute("src") !== logo) img.setAttribute("src", logo);
  img.alt = "AgSUS";
  img.style.removeProperty("display");
  return true;
}

function errorMessage(error) {
  return String(error?.message || error || "Erro desconhecido.");
}

function createSidebarLogoPath(file) {
  const extension = EXTENSION_BY_MIME[file?.type] || "png";
  const id =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${SIDEBAR_LOGO_FOLDER}/${SIDEBAR_LOGO_PREFIX}${id}.${extension}`;
}

function setSidebarLogoStatus(message, tone = "neutral") {
  const status = document.getElementById("cfgSidebarLogoStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function setSidebarLogoBusy(busy) {
  logoUploadBusy = Boolean(busy);
  const fileInput = document.getElementById("cfgSidebarLogoFile");
  const restoreButton = document.getElementById("cfgSidebarLogoRestore");
  if (fileInput) fileInput.disabled = logoUploadBusy;
  if (restoreButton) restoreButton.disabled = logoUploadBusy;
}

function signalSidebarLogoChanged() {
  const logoInput = document.getElementById("cfgSidebarLogoUrl");
  if (!logoInput) return;
  logoInput.dispatchEvent(new Event("input", { bubbles: true }));
  logoInput.dispatchEvent(new Event("change", { bubbles: true }));
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
  aplicarLogoNaBarraLateral(currentLogo);
  document.body?.classList.toggle(
    "sidebar-theme-dark",
    needsLightForeground(currentColor),
  );

  const logoInput = document.getElementById("cfgSidebarLogoUrl");
  const colorInput = document.getElementById("cfgSidebarBackgroundColor");
  const preview = document.getElementById("cfgSidebarLogoPreview");
  if (logoInput && logoInput.value !== currentLogo) {
    logoInput.value = currentLogo;
  }
  if (colorInput && colorInput.value !== currentColor) {
    colorInput.value = currentColor;
  }
  if (preview && preview.getAttribute("src") !== currentLogo) {
    preview.setAttribute("src", currentLogo);
  }
}

function chooseSidebarLogo(url, { dirty = true } = {}) {
  currentLogo = safeLogo(url);
  applySidebarBranding();
  if (dirty) signalSidebarLogoChanged();
}

async function uploadSidebarLogo(file) {
  if (logoUploadBusy) return false;
  const validationError = validateAccessBackgroundFile(file);
  if (validationError) {
    setSidebarLogoStatus(validationError, "error");
    return false;
  }
  if (!client) {
    setSidebarLogoStatus(
      "Não foi possível conectar ao armazenamento para enviar a logo.",
      "error",
    );
    return false;
  }

  setSidebarLogoBusy(true);
  setSidebarLogoStatus("Enviando logo...", "busy");
  const path = createSidebarLogoPath(file);

  try {
    const { error: uploadError } = await client.storage
      .from(ACCESS_BACKGROUND_BUCKET)
      .upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data } = client.storage
      .from(ACCESS_BACKGROUND_BUCKET)
      .getPublicUrl(path);
    chooseSidebarLogo(data.publicUrl);
    await loadSidebarLogoGallery();
    setSidebarLogoStatus(
      "Logo enviada. Clique em Salvar alterações para publicar a escolha.",
      "success",
    );
    return true;
  } catch (error) {
    setSidebarLogoStatus(
      `Não foi possível enviar a logo: ${errorMessage(error)}`,
      "error",
    );
    return false;
  } finally {
    setSidebarLogoBusy(false);
  }
}

async function deleteStoredSidebarLogo(path, name) {
  if (!client || logoUploadBusy) return false;
  const url = client.storage.from(ACCESS_BACKGROUND_BUCKET).getPublicUrl(path)
    .data.publicUrl;
  if (safeLogo(url) === currentLogo) {
    setSidebarLogoStatus(
      "Esta logo está selecionada. Escolha outra ou restaure o padrão antes de apagar.",
      "error",
    );
    return false;
  }
  if (!window.confirm(`Apagar definitivamente a logo "${name}"?`)) return false;

  setSidebarLogoBusy(true);
  setSidebarLogoStatus("Apagando logo...", "busy");
  try {
    const { error } = await client.storage
      .from(ACCESS_BACKGROUND_BUCKET)
      .remove([path]);
    if (error) throw error;
    await loadSidebarLogoGallery();
    setSidebarLogoStatus("Logo apagada do armazenamento.", "success");
    return true;
  } catch (error) {
    setSidebarLogoStatus(
      `Não foi possível apagar a logo: ${errorMessage(error)}`,
      "error",
    );
    return false;
  } finally {
    setSidebarLogoBusy(false);
  }
}

async function loadSidebarLogoGallery() {
  const gallery = document.getElementById("cfgSidebarLogoGallery");
  if (!gallery || !client) return false;

  const { data, error } = await client.storage
    .from(ACCESS_BACKGROUND_BUCKET)
    .list(SIDEBAR_LOGO_FOLDER, {
      limit: 60,
      sortBy: { column: "created_at", order: "desc" },
    });

  gallery.replaceChildren();
  if (error) return false;

  const items = (data || []).filter(
    (item) =>
      item.name?.startsWith(SIDEBAR_LOGO_PREFIX) &&
      /\.(?:jpe?g|png|webp)$/i.test(item.name),
  );
  if (!items.length) return true;

  const heading = document.createElement("p");
  heading.className = "sidebar-logo-gallery-title";
  heading.textContent = "Logos enviadas";
  gallery.appendChild(heading);

  const list = document.createElement("div");
  list.className = "sidebar-logo-gallery-grid";

  items.forEach((item) => {
    const path = `${SIDEBAR_LOGO_FOLDER}/${item.name}`;
    const url = client.storage.from(ACCESS_BACKGROUND_BUCKET).getPublicUrl(path)
      .data.publicUrl;
    const active = safeLogo(url) === currentLogo;

    const card = document.createElement("div");
    card.className = `sidebar-logo-gallery-card${active ? " is-active" : ""}`;

    const chooseButton = document.createElement("button");
    chooseButton.type = "button";
    chooseButton.className = "sidebar-logo-gallery-item";
    chooseButton.disabled = active;
    chooseButton.setAttribute(
      "aria-label",
      active
        ? "Logo atualmente selecionada"
        : "Usar esta logo na barra lateral",
    );

    const image = document.createElement("img");
    image.src = url;
    image.alt = "";
    const label = document.createElement("small");
    label.textContent = active ? "Selecionada" : "Usar";
    chooseButton.append(image, label);
    if (!active) {
      chooseButton.addEventListener("click", () => {
        chooseSidebarLogo(url);
        void loadSidebarLogoGallery();
        setSidebarLogoStatus(
          "Logo selecionada. Clique em Salvar alterações para publicar.",
          "success",
        );
      });
    }
    card.appendChild(chooseButton);

    if (!active) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "sidebar-logo-gallery-delete";
      deleteButton.textContent = "Apagar";
      deleteButton.addEventListener(
        "click",
        () => void deleteStoredSidebarLogo(path, item.name),
      );
      card.appendChild(deleteButton);
    }

    list.appendChild(card);
  });

  gallery.appendChild(list);
  return true;
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
    <label>Logo da barra lateral</label>
    <div class="sidebar-logo-manager">
      <div class="sidebar-branding-preview">
        <img id="cfgSidebarLogoPreview" alt="Prévia da logo da barra lateral" />
      </div>
      <div class="sidebar-logo-actions">
        <label class="btn sidebar-logo-upload">
          <i class="fa-solid fa-image" aria-hidden="true"></i>
          <span>Escolher imagem</span>
          <input id="cfgSidebarLogoFile" type="file" accept="image/jpeg,image/png,image/webp" />
        </label>
        <button id="cfgSidebarLogoRestore" type="button" class="btn secondary">Restaurar padrão</button>
        <small id="cfgSidebarLogoStatus" data-tone="neutral">JPG, PNG ou WEBP, até 6 MB. A escolha fica pendente até Salvar alterações.</small>
      </div>
    </div>
    <input id="cfgSidebarLogoUrl" type="hidden" />
    <div id="cfgSidebarLogoGallery" class="sidebar-logo-gallery"></div>
  `;

  const colorRow = document.createElement("div");
  colorRow.className = "form-row";
  colorRow.dataset.sidebarBrandingConfig = "true";
  colorRow.innerHTML = `
    <label for="cfgSidebarBackgroundColor">Cor da barra lateral</label>
    <div class="sidebar-color-control">
      <input id="cfgSidebarBackgroundColor" type="color" value="#ffffff" />
      <span>Escolha a cor de fundo</span>
    </div>
    <small>Textos e ícones mudam automaticamente para preservar contraste.</small>
    <div id="cfgSidebarColorAviso" class="contraste-bloco"></div>
  `;

  fragment.append(title, logoRow, colorRow);
  formGrid.appendChild(fragment);

  const fileInput = document.getElementById("cfgSidebarLogoFile");
  const restoreButton = document.getElementById("cfgSidebarLogoRestore");
  const colorInput = document.getElementById("cfgSidebarBackgroundColor");

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    void uploadSidebarLogo(file);
  });
  restoreButton?.addEventListener("click", () => {
    chooseSidebarLogo(DEFAULT_LOGO);
    void loadSidebarLogoGallery();
    setSidebarLogoStatus(
      "Logo padrão selecionada. Clique em Salvar alterações para publicar.",
      "success",
    );
  });
  /*
    A barra lateral nao tem botao de acesso; a previa mostra so a superficie e o
    texto, que e o que ela de facto pinta.
  */
  ligarAvisoDeContraste(
    colorInput,
    document.getElementById("cfgSidebarColorAviso"),
    { comBotao: false },
  );

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
    const loaded = await readSidebarBranding();
    if (loaded) await loadSidebarLogoGallery();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void boot(), {
      once: true,
    });
  } else {
    void boot();
  }

  if (!client) return;

  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      void readSidebarBranding().then((loaded) => {
        if (loaded) void loadSidebarLogoGallery();
      });
    }
  });
}
