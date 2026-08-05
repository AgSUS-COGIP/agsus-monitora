const MOBILE_BREAKPOINT = 900;
const MAX_PRIMARY_ITEMS = 4;
const SIDEBAR_ITEM_SELECTOR =
  "#sidebar a, #sidebar button, .sidebar a, .sidebar button";
const DEFAULT_ICON_CLASS = "fa-solid fa-circle";
const MORE_BUTTON_HTML =
  '<i class="fa-solid fa-bars" aria-hidden="true"></i><span>Mais</span>';

function getLabel(element) {
  const explicit = element.getAttribute("aria-label") || element.title;
  const text = element.textContent?.replace(/\s+/g, " ").trim();
  return explicit || text || "Acessar";
}

function getIconClass(element) {
  const icon = element.querySelector("i");
  return icon?.className || DEFAULT_ICON_CLASS;
}

function isUsableSidebarItem(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hidden || element.closest("[hidden], .hidden")) return false;

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;

  const label = getLabel(element).toLowerCase();
  return !label.includes("sair") && !label.includes("logout");
}

function collectPrimaryItems() {
  const seen = new Set();

  return Array.from(document.querySelectorAll(SIDEBAR_ITEM_SELECTOR))
    .filter(isUsableSidebarItem)
    .filter((element) => {
      const key =
        element.getAttribute("href") ||
        element.getAttribute("onclick") ||
        element.id ||
        getLabel(element);

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_PRIMARY_ITEMS);
}

function setActiveItem(source, navigation) {
  navigation.querySelectorAll(".mobile-bottom-nav__item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.sourceId === source.id);
  });
}

function createNavigationItem(source, navigation, index) {
  if (!source.id) source.id = `mobileNavSource${index}`;

  const label = getLabel(source);
  const iconClass = getIconClass(source);
  const button = document.createElement("button");

  button.type = "button";
  button.className = "mobile-bottom-nav__item";
  button.dataset.sourceId = source.id;
  button.setAttribute("aria-label", label);
  button.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i><span>${label}</span>`;
  button.addEventListener("click", () => {
    source.click();
    setActiveItem(source, navigation);
  });

  return button;
}

function createMoreButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mobile-bottom-nav__item";
  button.setAttribute("aria-label", "Abrir menu completo");
  button.innerHTML = MORE_BUTTON_HTML;
  button.addEventListener("click", () => {
    document.body.classList.remove("sidebar-collapsed");
    document.body.classList.add("sidebar-open");
    document.getElementById("sidebarOverlay")?.classList.remove("hidden");
  });

  return button;
}

function buildBottomNavigation() {
  if (window.innerWidth > MOBILE_BREAKPOINT) return false;
  if (document.getElementById("mobileBottomNav")) return true;

  const sources = collectPrimaryItems();
  if (!sources.length) return false;

  const navigation = document.createElement("nav");
  navigation.id = "mobileBottomNav";
  navigation.className = "mobile-bottom-nav";
  navigation.setAttribute("aria-label", "Navegação principal no celular");

  sources.forEach((source, index) => {
    const item = createNavigationItem(source, navigation, index);
    navigation.appendChild(item);
  });

  navigation.appendChild(createMoreButton());
  document.body.appendChild(navigation);
  return true;
}

function scheduleBuild(attempt = 0) {
  if (buildBottomNavigation() || attempt >= 5) return;

  const delay = 250 * (attempt + 1);
  window.setTimeout(() => scheduleBuild(attempt + 1), delay);
}

function syncVisibility() {
  const navigation = document.getElementById("mobileBottomNav");
  if (!navigation) {
    scheduleBuild();
    return;
  }

  const isDesktop = window.innerWidth > MOBILE_BREAKPOINT;
  navigation.classList.toggle("hidden", isDesktop);
}

export function initMobileBottomNavigation() {
  scheduleBuild();
  window.addEventListener("resize", syncVisibility, { passive: true });
  window.addEventListener("orientationchange", syncVisibility, {
    passive: true,
  });
}
