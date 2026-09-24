const MOBILE_BREAKPOINT = 900;
const MAX_PRIMARY_ITEMS = 4;
// Só destinos: o cabeçalho dos grupos da barra lateral também é um <button>.
const NAV_ITEM_SELECTOR = "#nav a, #nav button[data-view]";
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
  // Grupo recolhido na barra lateral continua sendo destino válido aqui.
  if (element.closest('.nav-grupo[data-aberto="false"]')) return true;

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;

  const label = getLabel(element).toLowerCase();
  return !label.includes("sair") && !label.includes("logout");
}

function ehPainelExterno(element) {
  return String(element.dataset?.view || "").startsWith("panel:") ? 1 : 0;
}

function collectPrimaryItems() {
  const seen = new Set();

  return Array.from(document.querySelectorAll(NAV_ITEM_SELECTOR))
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
    // Telas do próprio MONITORA antes dos painéis externos: com a barra lateral
    // agrupada por área, os painéis da Saúde Indígena vinham antes de Editais,
    // Cronograma e Aprovados e ocupavam os quatro atalhos. `sort` é estável.
    .sort((a, b) => ehPainelExterno(a) - ehPainelExterno(b))
    .slice(0, MAX_PRIMARY_ITEMS);
}

function setActiveItem(source, navigation) {
  let matched = false;

  navigation.querySelectorAll(".mobile-bottom-nav__item").forEach((item) => {
    const active = Boolean(source.id) && item.dataset.sourceId === source.id;
    item.classList.toggle("is-active", active);

    if (active) {
      item.setAttribute("aria-current", "page");
      matched = true;
    } else {
      item.removeAttribute("aria-current");
    }
  });

  return matched;
}

function createNavigationItem(source, navigation, index) {
  if (!source.id) source.id = `mobileNavSource${index}`;

  const label = getLabel(source);
  // A barra lateral usa SVG (Lucide); a barra de baixo copia o mesmo desenho.
  const svg = source.querySelector("svg")?.outerHTML;
  const iconClass = getIconClass(source);
  const button = document.createElement("button");

  button.type = "button";
  button.className = "mobile-bottom-nav__item";
  button.dataset.sourceId = source.id;
  button.setAttribute("aria-label", label);
  button.innerHTML = `${svg || `<i class="${iconClass}" aria-hidden="true"></i>`}<span>${label}</span>`;
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

function syncActiveStateFromSidebarClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const source = target.closest(NAV_ITEM_SELECTOR);
  if (!(source instanceof HTMLElement)) return;

  const navigation = document.getElementById("mobileBottomNav");
  if (!navigation) return;

  setActiveItem(source, navigation);
}

export function initMobileBottomNavigation() {
  scheduleBuild();
  document.addEventListener("click", syncActiveStateFromSidebarClick);
  window.addEventListener("resize", syncVisibility, { passive: true });
  window.addEventListener("orientationchange", syncVisibility, {
    passive: true,
  });
}
