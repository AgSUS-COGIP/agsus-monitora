const ROOT_ID = "page-config";

const SECTION_DEFINITIONS = [
  { id: "all", label: "Tudo", icon: "fa-border-all" },
  { id: "access", label: "Acessos", icon: "fa-user-shield" },
  { id: "system", label: "Sistema", icon: "fa-sliders" },
  { id: "panels", label: "Painéis", icon: "fa-table-columns" },
  { id: "technical", label: "Técnico", icon: "fa-screwdriver-wrench" },
];

const state = {
  initialized: false,
  section: "all",
  query: "",
  dirty: false,
  saving: false,
};

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function configRoot() {
  return document.getElementById(ROOT_ID);
}

function configCards(root = configRoot()) {
  if (!root) return [];
  return [...root.querySelectorAll(":scope > .admin-grid > .admin-card")];
}

function categoryForCard(card) {
  if (!card) return "system";
  if (["accessRequestsAdminCard", "accessMonitorCard"].includes(card.id))
    return "access";
  if (card.classList.contains("cnes-status-card")) return "technical";
  if (card.querySelector("#panelAdmin")) return "panels";
  return "system";
}

function sectionTitle(section) {
  return (
    SECTION_DEFINITIONS.find((item) => item.id === section)?.label || "Tudo"
  );
}

function decorateCards(root) {
  configCards(root).forEach((card) => {
    const section = categoryForCard(card);
    card.dataset.configSection = section;
    const title =
      card.querySelector("h3")?.textContent?.trim() || "Configuração";
    card.setAttribute("aria-label", title);
  });
}

function toolbarHTML() {
  return `
    <section id="configWorkspaceToolbar" class="config-workspace-toolbar" aria-label="Navegação das configurações">
      <div class="config-workspace-heading">
        <div>
          <span class="config-workspace-eyebrow">Administração do sistema</span>
          <h2>Configurações</h2>
          <p>Localize ajustes, revise acessos e salve alterações com validação antes de publicar.</p>
        </div>
        <div class="config-search-wrap">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input id="configWorkspaceSearch" type="search" autocomplete="off" placeholder="Pesquisar configuração..." aria-label="Pesquisar configuração">
          <button id="configWorkspaceSearchClear" type="button" title="Limpar pesquisa" aria-label="Limpar pesquisa" hidden>
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      <div class="config-workspace-tabs" role="tablist" aria-label="Categorias de configuração">
        ${SECTION_DEFINITIONS.map(
          (item, index) => `
          <button type="button" class="config-workspace-tab${index === 0 ? " is-active" : ""}" data-config-tab="${item.id}" role="tab" aria-selected="${index === 0 ? "true" : "false"}">
            <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
            <span>${item.label}</span>
          </button>
        `,
        ).join("")}
      </div>
      <div class="config-workspace-meta">
        <span id="configWorkspaceResultCount">0 seções disponíveis</span>
        <span id="configWorkspaceDirtyTop" class="config-dirty-indicator" hidden><i class="fa-solid fa-circle" aria-hidden="true"></i> Alterações não salvas</span>
      </div>
      <div id="configValidationSummary" class="config-validation-summary" role="alert" hidden></div>
    </section>
  `;
}

function stickyActionsHTML() {
  return `
    <div id="configStickyActions" class="config-sticky-actions" aria-live="polite">
      <div class="config-sticky-status">
        <span id="configStickyStatusIcon" class="config-status-icon is-clean"><i class="fa-solid fa-check" aria-hidden="true"></i></span>
        <div>
          <strong id="configStickyStatusTitle">Nenhuma alteração pendente</strong>
          <span id="configStickyStatusText">As configurações carregadas estão preservadas.</span>
        </div>
      </div>
      <div class="config-sticky-buttons">
        <span class="config-shortcut-hint"><kbd>Ctrl</kbd> + <kbd>S</kbd></span>
        <button id="configStickySaveButton" type="button" class="btn green" disabled>
          <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
          <span>Salvar alterações</span>
        </button>
      </div>
    </div>
  `;
}

function ensureWorkspace(root) {
  if (!root.querySelector("#configWorkspaceToolbar")) {
    root.insertAdjacentHTML("afterbegin", toolbarHTML());
  }
  if (!root.querySelector("#configStickyActions")) {
    root.insertAdjacentHTML("beforeend", stickyActionsHTML());
  }

  const originalSave = root.querySelector(
    '.btn.green[onclick="saveAdminSettings()"]',
  );
  if (originalSave) {
    originalSave.classList.add("config-original-save-hidden");
    originalSave.setAttribute("aria-hidden", "true");
    originalSave.tabIndex = -1;
  }
}

function applyWorkspaceFilter(root = configRoot()) {
  if (!root) return;
  const query = normalize(state.query);
  let visibleCount = 0;

  configCards(root).forEach((card) => {
    const categoryMatches =
      state.section === "all" || card.dataset.configSection === state.section;
    const searchMatches = !query || normalize(card.textContent).includes(query);
    const visible = categoryMatches && searchMatches;
    card.classList.toggle("config-filter-hidden", !visible);
    if (visible && !card.classList.contains("hidden")) visibleCount += 1;
  });

  const result = root.querySelector("#configWorkspaceResultCount");
  if (result) {
    const category =
      state.section === "all" ? "" : ` em ${sectionTitle(state.section)}`;
    result.textContent = `${visibleCount} ${visibleCount === 1 ? "seção disponível" : "seções disponíveis"}${category}`;
  }

  root.querySelectorAll("[data-config-tab]").forEach((button) => {
    const active = button.dataset.configTab === state.section;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });

  const clearButton = root.querySelector("#configWorkspaceSearchClear");
  if (clearButton) clearButton.hidden = !state.query;
}

function setDirty(root, dirty) {
  state.dirty = Boolean(dirty);
  const topIndicator = root.querySelector("#configWorkspaceDirtyTop");
  const saveButton = root.querySelector("#configStickySaveButton");
  const icon = root.querySelector("#configStickyStatusIcon");
  const title = root.querySelector("#configStickyStatusTitle");
  const text = root.querySelector("#configStickyStatusText");

  if (topIndicator) topIndicator.hidden = !state.dirty;
  if (saveButton) saveButton.disabled = !state.dirty || state.saving;

  if (icon) {
    icon.className = `config-status-icon ${state.dirty ? "is-dirty" : "is-clean"}`;
    icon.innerHTML = `<i class="fa-solid ${state.dirty ? "fa-pen" : "fa-check"}" aria-hidden="true"></i>`;
  }
  if (title)
    title.textContent = state.dirty
      ? "Existem alterações não salvas"
      : "Nenhuma alteração pendente";
  if (text)
    text.textContent = state.dirty
      ? "Revise os campos e salve antes de sair desta página."
      : "As configurações carregadas estão preservadas.";
}

function setSaving(root, saving) {
  state.saving = Boolean(saving);
  const button = root.querySelector("#configStickySaveButton");
  const title = root.querySelector("#configStickyStatusTitle");
  const text = root.querySelector("#configStickyStatusText");
  const icon = root.querySelector("#configStickyStatusIcon");

  if (button) {
    button.disabled = state.saving || !state.dirty;
    button.innerHTML = state.saving
      ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><span>Salvando...</span>'
      : '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i><span>Salvar alterações</span>';
  }
  if (state.saving) {
    if (title) title.textContent = "Salvando configurações";
    if (text) text.textContent = "Aguarde a confirmação do Supabase.";
    if (icon) {
      icon.className = "config-status-icon is-saving";
      icon.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>';
    }
  } else {
    setDirty(root, state.dirty);
  }
}

function clearValidation(root) {
  root.querySelectorAll(".config-field-invalid").forEach((field) => {
    field.classList.remove("config-field-invalid");
    field.removeAttribute("aria-invalid");
  });
  const summary = root.querySelector("#configValidationSummary");
  if (summary) {
    summary.hidden = true;
    summary.innerHTML = "";
  }
}

function markInvalid(field) {
  if (!field) return;
  field.classList.add("config-field-invalid");
  field.setAttribute("aria-invalid", "true");
}

function validHttpUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch (error) {
    return false;
  }
}

function validDomain(value) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  if (/[:/\s@]/.test(raw)) return false;
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(raw);
}

function validateConfiguration(root) {
  clearValidation(root);
  const errors = [];
  const addError = (field, message) => {
    markInvalid(field);
    errors.push({ field, message });
  };

  const pageTitle = root.querySelector("#cfgPageTitle");
  if (pageTitle && !pageTitle.value.trim()) {
    addError(pageTitle, "Informe o título da página inicial.");
  }

  const domain = root.querySelector("#cfgGoogleDomainHint");
  if (domain && !validDomain(domain.value)) {
    addError(
      domain,
      "O domínio Google deve ter formato semelhante a agenciasus.org.br, sem https://, @ ou barras.",
    );
  }

  const heartbeat = root.querySelector("#cfgAccessHeartbeatMinutos");
  if (heartbeat) {
    const value = Number(heartbeat.value);
    if (!Number.isInteger(value) || value < 1 || value > 60) {
      addError(
        heartbeat,
        "O heartbeat deve ser um número inteiro entre 1 e 60 minutos.",
      );
    }
  }

  const urlFields = [
    root.querySelector("#cfgMascot"),
    root.querySelector("#cfgCogipLogo"),
    ...root.querySelectorAll('[id^="panelUrl"]'),
  ].filter(Boolean);

  urlFields.forEach((field) => {
    if (!validHttpUrl(field.value)) {
      addError(field, "Use uma URL completa iniciada por https:// ou http://.");
    }
  });

  root.querySelectorAll('[id^="panelAtivo"]').forEach((activeField) => {
    if (activeField.value !== "true") return;
    const index = activeField.id.replace("panelAtivo", "");
    const urlField = root.querySelector(`#panelUrl${CSS.escape(index)}`);
    if (urlField && !urlField.value.trim()) {
      addError(urlField, "Painéis ativos precisam de uma URL válida.");
    }
  });

  const summary = root.querySelector("#configValidationSummary");
  if (summary && errors.length) {
    summary.hidden = false;
    summary.innerHTML = `
      <div><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><strong>Revise ${errors.length} ${errors.length === 1 ? "campo" : "campos"} antes de salvar.</strong></div>
      <ul>${errors.map((item) => `<li>${item.message}</li>`).join("")}</ul>
    `;
  }

  if (errors.length) {
    errors[0].field?.scrollIntoView({ behavior: "smooth", block: "center" });
    errors[0].field?.focus({ preventScroll: true });
  }

  return errors;
}

function saveSucceeded() {
  const toastText = document.getElementById("toastBox")?.textContent || "";
  return normalize(toastText).includes("configuracoes salvas");
}

function installSaveGuard(root) {
  const originalSave = window.saveAdminSettings;
  if (typeof originalSave !== "function" || originalSave.__configGuardWrapped)
    return;

  const guardedSave = async (...args) => {
    if (state.saving) return false;
    const errors = validateConfiguration(root);
    if (errors.length) return false;

    const googleEnabled =
      root.querySelector("#cfgGoogleEnabled")?.value !== "false";
    if (!googleEnabled) {
      const confirmed = window.confirm(
        "O login Google será desativado. Como este é o acesso institucional principal, usuários podem ficar sem conseguir entrar. Deseja salvar mesmo assim?",
      );
      if (!confirmed) return false;
    }

    setSaving(root, true);
    try {
      const result = await originalSave(...args);
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      if (saveSucceeded()) {
        setDirty(root, false);
        clearValidation(root);
      }
      return result;
    } finally {
      setSaving(root, false);
    }
  };

  guardedSave.__configGuardWrapped = true;
  guardedSave.__original = originalSave;
  window.saveAdminSettings = guardedSave;
}

function installAccessRefreshGuard(root) {
  const button = root.querySelector(
    '#accessMonitorCard button[onclick*="loadAccessDashboard"]',
  );
  if (!button || button.dataset.safeRefreshInstalled === "true") return;
  const originalLoad = window.loadAccessDashboard;
  if (typeof originalLoad !== "function") return;

  button.dataset.safeRefreshInstalled = "true";
  button.removeAttribute("onclick");
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Atualizando';
    try {
      await originalLoad(true);
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  });
}

function bindWorkspaceEvents(root) {
  root.querySelectorAll("[data-config-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.section = button.dataset.configTab || "all";
      applyWorkspaceFilter(root);
    });
  });

  const search = root.querySelector("#configWorkspaceSearch");
  const clearSearch = root.querySelector("#configWorkspaceSearchClear");
  search?.addEventListener("input", () => {
    state.query = search.value || "";
    applyWorkspaceFilter(root);
  });
  clearSearch?.addEventListener("click", () => {
    state.query = "";
    if (search) search.value = "";
    applyWorkspaceFilter(root);
    search?.focus();
  });

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ))
      return;
    if (target.closest("#configWorkspaceToolbar")) return;
    setDirty(root, true);
    if (target.classList.contains("config-field-invalid")) {
      target.classList.remove("config-field-invalid");
      target.removeAttribute("aria-invalid");
    }
  });

  root.addEventListener("change", (event) => {
    const target = event.target;
    if (!(
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ))
      return;
    if (target.closest("#configWorkspaceToolbar")) return;
    setDirty(root, true);
  });

  root
    .querySelector("#configStickySaveButton")
    ?.addEventListener("click", () => {
      window.saveAdminSettings?.();
    });

  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s")
      return;
    if (!root.classList.contains("active")) return;
    event.preventDefault();
    if (state.dirty && !state.saving) window.saveAdminSettings?.();
  });

  window.addEventListener("beforeunload", (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

export function initConfigPageEnhancements() {
  if (state.initialized) return;
  const root = configRoot();
  if (!root) return;

  state.initialized = true;
  decorateCards(root);
  ensureWorkspace(root);
  bindWorkspaceEvents(root);
  installSaveGuard(root);
  installAccessRefreshGuard(root);
  applyWorkspaceFilter(root);
  setDirty(root, false);
}
