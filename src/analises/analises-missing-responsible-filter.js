const FILTER_VALUE = "Sem responsável";
const ACTIVE_CLASS = "is-active";

const txt = (value) => String(value ?? "").trim();
const norm = (value) =>
  txt(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");

function isMissingResponsibleItem(element) {
  return norm(element?.querySelector("b")?.textContent) === "sem responsavel";
}

function filterInput() {
  return document.querySelector(
    `#ms-options-fResponsavel input[value="${CSS.escape(FILTER_VALUE)}"]`,
  );
}

function clearButton() {
  return document.getElementById("ms-clear-fResponsavel");
}

function syncCardState() {
  document
    .querySelectorAll("#attentionList .attention-item")
    .forEach((item) => {
      if (!isMissingResponsibleItem(item)) return;

      const input = filterInput();
      item.dataset.missingResponsibleFilter = "true";
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      item.setAttribute("aria-label", "Filtrar análises sem responsável");
      item.classList.toggle(ACTIVE_CLASS, Boolean(input?.checked));
    });
}

function toggleMissingResponsibleFilter() {
  const input = filterInput();
  if (!input) return false;

  if (input.checked) {
    clearButton()?.click();
  } else {
    clearButton()?.click();
    window.setTimeout(() => {
      const refreshed = filterInput();
      if (refreshed && !refreshed.checked) refreshed.click();
    }, 0);
  }

  window.setTimeout(syncCardState, 0);
  return true;
}

function installStyles() {
  if (document.getElementById("analisesMissingResponsibleFilterStyles")) return;

  const style = document.createElement("style");
  style.id = "analisesMissingResponsibleFilterStyles";
  style.textContent = `
    #attentionList .attention-item[data-missing-responsible-filter="true"]{
      cursor:pointer;
      padding-right:40px;
      position:relative
    }
    #attentionList .attention-item[data-missing-responsible-filter="true"]::after{
      content:"\\f061";
      font-family:"Font Awesome 6 Free";
      font-weight:900;
      position:absolute;
      right:14px;
      top:50%;
      transform:translateY(-50%);
      color:var(--blue)
    }
  `;
  document.head.appendChild(style);
}

function bindEvents() {
  document.addEventListener(
    "click",
    (event) => {
      const item = event.target?.closest?.(
        '#attentionList .attention-item[data-missing-responsible-filter="true"]',
      );
      if (!item) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      toggleMissingResponsibleFilter();
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const item = event.target?.closest?.(
      '#attentionList .attention-item[data-missing-responsible-filter="true"]',
    );
    if (!item) return;

    event.preventDefault();
    toggleMissingResponsibleFilter();
  });

  document.addEventListener("click", (event) => {
    if (
      event.target?.closest?.("#attentionList, #ms-fResponsavel, #clearBtn")
    ) {
      window.setTimeout(syncCardState, 0);
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target?.closest?.("#ms-options-fResponsavel")) {
      window.setTimeout(syncCardState, 0);
    }
  });

  document.addEventListener("agsus:analises-cache-cleared", syncCardState);
}

installStyles();
bindEvents();
window.setTimeout(syncCardState, 0);
