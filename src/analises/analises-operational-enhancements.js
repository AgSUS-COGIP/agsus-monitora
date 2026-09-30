const state = {
  initialized: false,
  scheduled: 0,
  bootAttempts: 0,
  activeShortcut: "",
};

const txt = (value) => String(value ?? "").trim();
const norm = (value) =>
  txt(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");

function renameSearches() {
  const globalSearch = document.getElementById("fBusca");
  const globalLabel = document.querySelector('label[for="fBusca"]');
  if (globalSearch)
    globalSearch.placeholder =
      "Candidato, vaga, edital, responsável ou análise";
  if (globalLabel) globalLabel.textContent = "Buscar em todo o painel";

  const tableSearch = document.getElementById("tableSearch");
  if (tableSearch) {
    tableSearch.placeholder = "Buscar somente na fila operacional";
    tableSearch.setAttribute(
      "aria-label",
      "Buscar somente na fila operacional",
    );
  }
}

function removePdfSignals() {
  document.querySelector('.field:has(> label[for="fPdf"])')?.remove();
  document.querySelector(".pdf-strip")?.remove();

  document
    .querySelectorAll("#attentionList .attention-item")
    .forEach((item) => {
      const title = norm(item.querySelector("b")?.textContent);
      if (title.includes("pdf") || title.includes("espelho")) item.remove();
    });
}

function attentionAction(title) {
  const key = norm(title);
  if (key === "pendentes") return "kpi:pendente";
  if (key === "em revisao") return "kpi:revisar";
  if (key === "data de analise no futuro") return "validation:DATA_FUTURA";
  if (key === "data fora do periodo") return "validation:FORA_PERIODO";
  if (key === "etapa sem data") return "validation:SEM_DATA";
  return "";
}

function markAttentionActions() {
  const list = document.getElementById("attentionList");
  if (!list) return;

  list.querySelectorAll(".attention-item").forEach((item) => {
    const title = txt(item.querySelector("b")?.textContent);
    const action = attentionAction(title);

    item.classList.toggle(
      "is-active",
      Boolean(action && action === state.activeShortcut),
    );
    if (!action) {
      delete item.dataset.action;
      item.removeAttribute("tabindex");
      item.removeAttribute("role");
      item.removeAttribute("aria-label");
      return;
    }

    item.dataset.action = action;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Filtrar por ${title}`);
  });

  renderShortcutStatus(list);
}

function shortcutLabel(action) {
  return (
    {
      "kpi:pendente": "Pendentes",
      "kpi:revisar": "Em revisão",
      "validation:DATA_FUTURA": "Análises com data no futuro",
      "validation:FORA_PERIODO": "Análises fora do período",
      "validation:SEM_DATA": "Análises sem data",
    }[action] || ""
  );
}

function renderShortcutStatus(list) {
  document.getElementById("analisesShortcutStatus")?.remove();
  if (!state.activeShortcut) return;

  const status = document.createElement("div");
  status.id = "analisesShortcutStatus";
  status.className = "analises-shortcut-status";
  status.innerHTML = `<span><i class="fa-solid fa-filter"></i> Atalho ativo: ${shortcutLabel(state.activeShortcut)}</span><button type="button">Limpar</button>`;
  status
    .querySelector("button")
    ?.addEventListener("click", clearActiveShortcut);
  list.insertAdjacentElement("beforebegin", status);
}

function clickMultiFilter(id, value) {
  const input = document.querySelector(
    `#ms-options-${CSS.escape(id)} input[value="${CSS.escape(value)}"]`,
  );
  if (!input) return false;

  const isSame =
    input.checked && state.activeShortcut === `validation:${value}`;
  if (isSame) {
    document.getElementById(`ms-clear-${id}`)?.click();
    return true;
  }

  document.getElementById(`ms-clear-${id}`)?.click();
  window.setTimeout(() => {
    const refreshed = document.querySelector(
      `#ms-options-${CSS.escape(id)} input[value="${CSS.escape(value)}"]`,
    );
    if (refreshed && !refreshed.checked) refreshed.click();
  }, 0);
  return true;
}

function activateAttention(item) {
  const action = item?.dataset?.action;
  if (!action) return;

  if (action.startsWith("kpi:")) {
    const key = action.split(":")[1];
    document.querySelector(`[data-kpi="${CSS.escape(key)}"] button`)?.click();
    state.activeShortcut = state.activeShortcut === action ? "" : action;
  } else if (action.startsWith("validation:")) {
    const value = action.split(":")[1];
    if (clickMultiFilter("fValidacao", value)) {
      state.activeShortcut = state.activeShortcut === action ? "" : action;
    }
  }

  scheduleEnhance();
}

function clearActiveShortcut() {
  const action = state.activeShortcut;
  state.activeShortcut = "";

  if (action.startsWith("kpi:")) {
    const key = action.split(":")[1];
    document
      .querySelector(`[data-kpi="${CSS.escape(key)}"].is-active button`)
      ?.click();
  } else if (action.startsWith("validation:")) {
    document.getElementById("ms-clear-fValidacao")?.click();
  }

  scheduleEnhance();
}

function enhance() {
  renameSearches();
  removePdfSignals();
  markAttentionActions();
}

function scheduleEnhance() {
  window.clearTimeout(state.scheduled);
  state.scheduled = window.setTimeout(enhance, 0);
}

function bindEvents() {
  document.addEventListener(
    "click",
    (event) => {
      // A gaveta de detalhe é de analises-detail-runtime-fix.js.
      const attention = event.target?.closest?.(
        "#attentionList .attention-item[data-action]",
      );
      if (attention) {
        event.preventDefault();
        activateAttention(attention);
        return;
      }

      scheduleEnhance();
    },
    true,
  );

  document.addEventListener("change", scheduleEnhance, true);
  document.addEventListener("input", scheduleEnhance, true);
  document.addEventListener("keydown", (event) => {
    if (
      (event.key === "Enter" || event.key === " ") &&
      event.target?.matches?.("#attentionList .attention-item[data-action]")
    ) {
      event.preventDefault();
      activateAttention(event.target);
    }
  });
  document.addEventListener("agsus:analises-cache-cleared", scheduleEnhance);
}

function bootStep() {
  enhance();
  state.bootAttempts += 1;
  if (
    state.bootAttempts < 80 &&
    (!document.getElementById("tableBody") ||
      typeof window.toggleDetails !== "function")
  ) {
    window.setTimeout(bootStep, 100);
  }
}

function start() {
  if (state.initialized) return;
  state.initialized = true;
  bindEvents();
  bootStep();
}

document.addEventListener("DOMContentLoaded", start, { once: true });
