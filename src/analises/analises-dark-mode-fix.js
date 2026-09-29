import { CHAVE_DO_TEMA_DO_PAINEL as THEME_STORAGE_KEY } from "../lib/tema-do-painel.js";

function updateThemeButton() {
  const button = document.getElementById("themeBtn");
  if (!button) return;

  const dark = document.documentElement.dataset.theme === "dark";
  button.title = dark ? "Usar tema claro" : "Usar tema escuro";
  button.setAttribute("aria-label", button.title);
  button.innerHTML = dark
    ? '<i class="fa-solid fa-sun"></i>'
    : '<i class="fa-solid fa-moon"></i>';
}

function normalizeStoredTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark") document.documentElement.dataset.theme = "dark";
    else if (document.documentElement.dataset.theme !== "dark")
      delete document.documentElement.dataset.theme;
  } catch (error) {
    console.warn("Não foi possível restaurar o tema de Análises:", error);
  }
}

function init() {
  normalizeStoredTheme();
  updateThemeButton();

  const observer = new MutationObserver((mutations) => {
    if (
      mutations.some(
        (item) =>
          item.type === "attributes" && item.attributeName === "data-theme",
      )
    ) {
      updateThemeButton();
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  document.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.("#themeBtn"))
        window.setTimeout(updateThemeButton, 0);
    },
    true,
  );
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
