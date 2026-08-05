import { getSupabaseClient } from "../lib/supabaseClient.js";
import {
  avatarColors,
  avatarDataUri,
  avatarOptions,
  defaultAvatarConfig,
  initialsFromName,
  normalizeAvatarConfig,
  randomAvatarConfig,
} from "../lib/avatar-config.js";

const SOURCE_LABELS = {
  GOOGLE: "Foto do Google",
  UPLOADED: "Foto enviada",
  GENERATED: "Personagem",
  INITIALS: "Iniciais",
};

let state = {
  profile: null,
  user: null,
  config: defaultAvatarConfig(""),
  source: "INITIALS",
  saving: false,
};

function safeText(value) {
  return String(value ?? "").trim();
}

function googleAvatar(user, profile) {
  return (
    safeText(profile?.google_avatar_url) ||
    safeText(user?.user_metadata?.avatar_url) ||
    safeText(user?.user_metadata?.picture)
  );
}

export function resolveAvatarPresentation({ profile, user }) {
  const source = safeText(profile?.avatar_source).toUpperCase() || "INITIALS";
  const name = safeText(profile?.nome) || safeText(user?.user_metadata?.full_name) || safeText(user?.email);
  const config = normalizeAvatarConfig(profile?.avatar_config, name);
  if (source === "GENERATED") {
    return { source, name, url: avatarDataUri(config, name), initials: initialsFromName(name), config };
  }
  if (source === "GOOGLE") {
    const url = safeText(profile?.avatar_url) || googleAvatar(user, profile);
    if (url) return { source, name, url, initials: initialsFromName(name), config };
  }
  if (source === "UPLOADED" && safeText(profile?.avatar_url)) {
    return { source, name, url: safeText(profile.avatar_url), initials: initialsFromName(name), config };
  }
  return { source: "INITIALS", name, url: "", initials: initialsFromName(name), config };
}

function setStatus(message, type = "info") {
  const element = document.getElementById("profileAvatarStatus");
  if (!element) return;
  element.textContent = message;
  element.dataset.type = type;
  element.hidden = !message;
}

function visualHtml(presentation, className = "") {
  if (presentation.url) {
    return `<img class="${className}" src="${presentation.url}" alt="Avatar de ${presentation.name.replaceAll('"', "&quot;")}" />`;
  }
  return `<span class="${className} profile-avatar-initials" aria-label="Iniciais de ${presentation.name.replaceAll('"', "&quot;")}">${presentation.initials}</span>`;
}

function refreshVisuals() {
  const presentation = resolveAvatarPresentation({ profile: state.profile, user: state.user });
  const sidebar = document.getElementById("profileAvatarVisual");
  const preview = document.getElementById("profileAvatarPreview");
  if (sidebar) sidebar.innerHTML = visualHtml(presentation, "profile-avatar-sidebar-image");
  if (preview) preview.innerHTML = visualHtml(presentation, "profile-avatar-preview-image");
  const source = document.getElementById("profileAvatarSourceLabel");
  if (source) source.textContent = SOURCE_LABELS[presentation.source] || SOURCE_LABELS.INITIALS;
}

function optionButtons(group, label) {
  return `<fieldset class="profile-avatar-fieldset">
    <legend>${label}</legend>
    <div class="profile-avatar-options" data-avatar-group="${group}">
      ${avatarOptions[group]
        .map(
          ([text, value]) =>
            `<button type="button" data-avatar-value="${value}" aria-pressed="false">${text}</button>`,
        )
        .join("")}
    </div>
  </fieldset>`;
}

function paletteButtons(group, label, colors) {
  return `<fieldset class="profile-avatar-fieldset">
    <legend>${label}</legend>
    <div class="profile-avatar-palette" data-avatar-color="${group}">
      ${colors
        .map(
          (color) =>
            `<button type="button" data-avatar-value="${color}" aria-label="${label} #${color}" style="--avatar-color:#${color}"></button>`,
        )
        .join("")}
    </div>
  </fieldset>`;
}

function dialogHtml() {
  return `<div id="profileAvatarBackdrop" class="profile-avatar-backdrop" hidden>
    <section id="profileAvatarDialog" class="profile-avatar-dialog" role="dialog" aria-modal="true" aria-labelledby="profileAvatarTitle">
      <header class="profile-avatar-heading">
        <div>
          <span class="profile-avatar-eyebrow">Identidade institucional</span>
          <h2 id="profileAvatarTitle">Seu perfil no AgSUS Monitora</h2>
          <p>Personalize como você aparece no sistema. Seus dados de acesso continuam protegidos e somente leitura.</p>
        </div>
        <button id="profileAvatarClose" type="button" class="profile-avatar-close" aria-label="Fechar perfil">×</button>
      </header>

      <div class="profile-avatar-studio">
        <aside class="profile-avatar-preview-panel">
          <span class="profile-avatar-eyebrow light">Estúdio de avatar</span>
          <div id="profileAvatarPreview" class="profile-avatar-preview"></div>
          <h3 id="profileAvatarName">Sua identidade visual</h3>
          <p>Monte seu personagem escolhendo cada detalhe. A prévia muda na hora.</p>
          <div class="profile-avatar-preview-actions">
            <button id="profileAvatarRandom" type="button">Surpreenda-me</button>
            <button id="profileAvatarReset" type="button">Restaurar</button>
          </div>
        </aside>

        <div class="profile-avatar-editor">
          <div class="profile-avatar-editor-title">
            <div><span class="profile-avatar-eyebrow">Personalização completa</span><h3>Crie seu personagem institucional</h3></div>
            <span id="profileAvatarSourceLabel" class="profile-avatar-badge"></span>
          </div>

          <div class="profile-avatar-tabs" role="tablist" aria-label="Etapas de personalização">
            <button type="button" role="tab" aria-selected="true" data-avatar-tab="face">Rosto e cabelo</button>
            <button type="button" role="tab" aria-selected="false" data-avatar-tab="expression">Olhos e expressão</button>
            <button type="button" role="tab" aria-selected="false" data-avatar-tab="details">Detalhes</button>
            <button type="button" role="tab" aria-selected="false" data-avatar-tab="colors">Cores</button>
          </div>

          <div class="profile-avatar-tab-panel" data-avatar-panel="face">
            ${optionButtons("face", "Formato do rosto")}
            ${optionButtons("nose", "Formato do nariz")}
            ${optionButtons("hair", "Cabelo")}
          </div>
          <div class="profile-avatar-tab-panel" data-avatar-panel="expression" hidden>
            ${optionButtons("eyes", "Olhos")}
            ${optionButtons("mouth", "Boca e expressão")}
          </div>
          <div class="profile-avatar-tab-panel" data-avatar-panel="details" hidden>
            <div class="profile-avatar-toggles">
              <label><input type="checkbox" data-avatar-toggle="glasses" /> Óculos</label>
              <label><input type="checkbox" data-avatar-toggle="beard" /> Barba</label>
              <label><input type="checkbox" data-avatar-toggle="freckles" /> Sardas</label>
              <label><input type="checkbox" data-avatar-toggle="earrings" /> Brincos</label>
            </div>
          </div>
          <div class="profile-avatar-tab-panel" data-avatar-panel="colors" hidden>
            ${paletteButtons("skinColor", "Tom de pele", avatarColors.skin)}
            ${paletteButtons("hairColor", "Cor do cabelo", avatarColors.hair)}
            ${paletteButtons("backgroundColor", "Cor de fundo", avatarColors.background)}
          </div>

          <div class="profile-avatar-save-row">
            <p>A composição é gerada no navegador e salva com segurança no seu perfil.</p>
            <button id="profileAvatarSaveGenerated" type="button" class="profile-avatar-primary">Salvar personagem</button>
          </div>
        </div>
      </div>

      <section class="profile-avatar-other-options">
        <div><span class="profile-avatar-eyebrow">Outras opções</span><h3>Prefere usar uma foto?</h3><p>Use a conta Google, envie uma imagem ou exiba suas iniciais.</p></div>
        <div class="profile-avatar-choice-grid">
          <button id="profileAvatarGoogle" type="button"><strong>Foto do Google</strong><small>Conta institucional</small></button>
          <button id="profileAvatarUploadButton" type="button"><strong>Enviar foto</strong><small>JPG, PNG ou WEBP até 5 MB</small></button>
          <button id="profileAvatarInitials" type="button"><strong>Usar iniciais</strong><small>Opção simples e neutra</small></button>
          <input id="profileAvatarUpload" type="file" accept="image/jpeg,image/png,image/webp" hidden />
        </div>
      </section>

      <section class="profile-avatar-data">
        <span class="profile-avatar-eyebrow">Dados institucionais</span>
        <div class="profile-avatar-data-grid">
          <div><small>Nome</small><strong id="profileAvatarDataName">—</strong></div>
          <div><small>E-mail</small><strong id="profileAvatarDataEmail">—</strong></div>
          <div><small>Perfil</small><strong id="profileAvatarDataRole">—</strong></div>
          <div><small>Status</small><strong>Cadastro validado</strong></div>
        </div>
      </section>
      <p id="profileAvatarStatus" class="profile-avatar-status" role="status" aria-live="polite" hidden></p>
    </section>
  </div>`;
}

function syncEditor() {
  document.querySelectorAll("[data-avatar-group]").forEach((container) => {
    const key = container.dataset.avatarGroup;
    container.querySelectorAll("button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.avatarValue === state.config[key]));
    });
  });
  document.querySelectorAll("[data-avatar-color]").forEach((container) => {
    const key = container.dataset.avatarColor;
    container.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("active", button.dataset.avatarValue === state.config[key]);
    });
  });
  document.querySelectorAll("[data-avatar-toggle]").forEach((input) => {
    input.checked = Boolean(state.config[input.dataset.avatarToggle]);
  });

  const preview = document.getElementById("profileAvatarPreview");
  const name = safeText(state.profile?.nome) || safeText(state.user?.user_metadata?.full_name) || safeText(state.user?.email);
  if (preview) {
    preview.innerHTML = `<img class="profile-avatar-preview-image" src="${avatarDataUri(state.config, name)}" alt="Prévia do avatar de ${name.replaceAll('"', "&quot;")}" />`;
  }
}

async function loadProfile() {
  const client = getSupabaseClient();
  if (!client) return;
  const { data: sessionData } = await client.auth.getSession();
  state.user = sessionData.session?.user || null;
  if (!state.user) return;
  const { data, error } = await client.rpc("meu_usuario");
  if (error) {
    console.warn("Não foi possível carregar preferências de avatar:", error);
    return;
  }
  state.profile = Array.isArray(data) ? data[0] || null : data || null;
  const name = safeText(state.profile?.nome) || safeText(state.user?.user_metadata?.full_name) || safeText(state.user?.email);
  state.source = safeText(state.profile?.avatar_source).toUpperCase() || "INITIALS";
  state.config = normalizeAvatarConfig(state.profile?.avatar_config, name);
  refreshVisuals();
  syncEditor();
  const fields = {
    profileAvatarName: name || "Sua identidade visual",
    profileAvatarDataName: name || "Não informado",
    profileAvatarDataEmail: safeText(state.profile?.email) || safeText(state.user?.email) || "Não informado",
    profileAvatarDataRole: safeText(state.profile?.perfil) || "Não informado",
  };
  Object.entries(fields).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });
  const googleButton = document.getElementById("profileAvatarGoogle");
  if (googleButton) googleButton.disabled = !googleAvatar(state.user, state.profile);
}

async function persist(source, url = null, config = state.config) {
  if (state.saving) return;
  state.saving = true;
  setStatus("Salvando sua escolha…");
  try {
    const client = getSupabaseClient();
    if (!client) throw new Error("Configuração do sistema indisponível.");
    const { data, error } = await client.rpc("set_my_avatar_choice", {
      p_source: source,
      p_avatar_url: url,
      p_avatar_config: config,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] || {} : data || {};
    state.profile = { ...state.profile, ...result };
    state.source = source;
    if (source === "GENERATED") state.config = normalizeAvatarConfig(config, state.profile?.nome);
    refreshVisuals();
    setStatus("Imagem de perfil atualizada em todo o AgSUS Monitora.", "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Não foi possível atualizar a imagem.", "error");
  } finally {
    state.saving = false;
  }
}

async function uploadFile(file) {
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    setStatus("Use uma imagem JPG, PNG ou WEBP.", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    setStatus("A imagem deve ter no máximo 5 MB.", "error");
    return;
  }
  try {
    const client = getSupabaseClient();
    const userId = state.user?.id;
    if (!client || !userId) throw new Error("Sessão não localizada.");
    setStatus("Enviando sua foto…");
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/profile.${extension}`;
    const { error } = await client.storage.from("monitora-avatars").upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });
    if (error) throw error;
    const { data } = client.storage.from("monitora-avatars").getPublicUrl(path);
    await persist("UPLOADED", `${data.publicUrl}?v=${Date.now()}`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Não foi possível enviar a foto.", "error");
  }
}

function openDialog() {
  const backdrop = document.getElementById("profileAvatarBackdrop");
  if (!backdrop) return;
  backdrop.hidden = false;
  document.body.classList.add("profile-avatar-open");
  document.getElementById("profileAvatarClose")?.focus();
  void loadProfile();
}

function closeDialog() {
  const backdrop = document.getElementById("profileAvatarBackdrop");
  if (!backdrop) return;
  backdrop.hidden = true;
  document.body.classList.remove("profile-avatar-open");
  document.getElementById("profileAvatarButton")?.focus();
}

function bindEvents() {
  document.getElementById("profileAvatarButton")?.addEventListener("click", openDialog);
  document.getElementById("profileAvatarClose")?.addEventListener("click", closeDialog);
  document.getElementById("profileAvatarBackdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "profileAvatarBackdrop") closeDialog();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.getElementById("profileAvatarBackdrop")?.hidden) closeDialog();
  });

  document.querySelectorAll("[data-avatar-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.avatarTab;
      document.querySelectorAll("[data-avatar-tab]").forEach((item) => item.setAttribute("aria-selected", String(item === button)));
      document.querySelectorAll("[data-avatar-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.avatarPanel !== tab;
      });
    });
  });
  document.querySelectorAll("[data-avatar-group] button").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.closest("[data-avatar-group]").dataset.avatarGroup;
      state.config = { ...state.config, [key]: button.dataset.avatarValue };
      syncEditor();
    });
  });
  document.querySelectorAll("[data-avatar-color] button").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.closest("[data-avatar-color]").dataset.avatarColor;
      state.config = { ...state.config, [key]: button.dataset.avatarValue };
      syncEditor();
    });
  });
  document.querySelectorAll("[data-avatar-toggle]").forEach((input) => {
    input.addEventListener("change", () => {
      state.config = { ...state.config, [input.dataset.avatarToggle]: input.checked };
      syncEditor();
    });
  });

  document.getElementById("profileAvatarRandom")?.addEventListener("click", () => {
    state.config = randomAvatarConfig(state.profile?.nome || state.user?.email || "");
    syncEditor();
  });
  document.getElementById("profileAvatarReset")?.addEventListener("click", () => {
    state.config = defaultAvatarConfig(state.profile?.nome || state.user?.email || "");
    syncEditor();
  });
  document.getElementById("profileAvatarSaveGenerated")?.addEventListener("click", () => void persist("GENERATED", null, state.config));
  document.getElementById("profileAvatarGoogle")?.addEventListener("click", () => {
    const url = googleAvatar(state.user, state.profile);
    if (url) void persist("GOOGLE", url);
  });
  document.getElementById("profileAvatarInitials")?.addEventListener("click", () => void persist("INITIALS"));
  document.getElementById("profileAvatarUploadButton")?.addEventListener("click", () => document.getElementById("profileAvatarUpload")?.click());
  document.getElementById("profileAvatarUpload")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    void uploadFile(file);
  });
}

function installSidebarButton() {
  const container = document.querySelector(".side-user");
  if (!container || document.getElementById("profileAvatarButton")) return;
  const button = document.createElement("button");
  button.id = "profileAvatarButton";
  button.type = "button";
  button.className = "profile-avatar-sidebar-button";
  button.setAttribute("aria-label", "Abrir meu perfil");
  button.innerHTML = '<span id="profileAvatarVisual" class="profile-avatar-sidebar-visual"><span class="profile-avatar-initials">?</span></span><span>Meu perfil</span>';
  container.prepend(button);
}

export function initProfileAvatar() {
  if (document.getElementById("profileAvatarBackdrop")) return;
  installSidebarButton();
  document.body.insertAdjacentHTML("beforeend", dialogHtml());
  bindEvents();
  const client = getSupabaseClient();
  if (!client) return;
  void loadProfile();
  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") void loadProfile();
    if (event === "SIGNED_OUT") {
      state = { profile: null, user: null, config: defaultAvatarConfig(""), source: "INITIALS", saving: false };
      refreshVisuals();
      closeDialog();
    }
  });
}
