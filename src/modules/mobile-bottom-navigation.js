import { criarIcone } from "./icones.js";
import {
  avisar,
  EVENTO_BARRA_ALTERNADA,
  EVENTO_MENU_ATUALIZADO,
} from "../lib/eventos-da-barra-lateral.js";

/*
  Menu inferior do celular: as quatro primeiras páginas do menu lateral e um
  "Mais", que abre a gaveta com tudo.

  As páginas saem do `data-view` (cabeçalho de área não navega, então não
  entra), sem filtrar pelo que está visível: as páginas de uma área fechada
  estão ocultas e continuam valendo. Rótulo e ícone vêm de `data-rotulo` e
  `data-icone`, que o menu lateral escreve. Uma entrada por página: as sete
  seções de Configurações contam como uma.

  Quando o menu lateral (React) é remontado ou troca de página, ele avisa
  (`agsus:menu-lateral-atualizado`), já com o DOM atualizado. Aqui isso basta
  para remontar, se as origens saíram do DOM, e para acompanhar o item ativo
  pelo `aria-current`.
*/

const MOBILE_BREAKPOINT = 900;
const MAX_PRIMARY_ITEMS = 4;
const NAV_ITEM_SELECTOR = "#nav [data-view]";

function getLabel(element) {
  return (
    element.dataset.rotulo ||
    element.getAttribute("aria-label") ||
    element.textContent?.replace(/\s+/g, " ").trim() ||
    "Acessar"
  );
}

export function collectPrimaryItems(documento = document) {
  const seen = new Set();
  return Array.from(documento.querySelectorAll(NAV_ITEM_SELECTOR))
    .filter((element) => {
      const view = element.dataset.view;
      if (!view || seen.has(view)) return false;
      seen.add(view);
      return true;
    })
    .slice(0, MAX_PRIMARY_ITEMS);
}

function fillItem(button, iconName, label) {
  const text = document.createElement("span");
  text.textContent = label;
  button.replaceChildren(criarIcone(iconName, { tamanho: 20 }), text);
}

function createNavigationItem(source, index) {
  if (!source.id) source.id = `mobileNavSource${index}`;

  const label = getLabel(source);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mobile-bottom-nav__item";
  button.dataset.sourceId = source.id;
  button.dataset.view = source.dataset.view;
  button.setAttribute("aria-label", label);
  fillItem(button, source.dataset.icone, label);
  button.addEventListener("click", () => source.click());
  return button;
}

function createMoreButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mobile-bottom-nav__item";
  button.setAttribute("aria-label", "Abrir menu completo");
  fillItem(button, "menu", "Mais");
  button.addEventListener("click", () => {
    document.body.classList.remove("sidebar-collapsed");
    document.body.classList.add("sidebar-open");
    document.getElementById("sidebarOverlay")?.classList.remove("hidden");
    avisar(EVENTO_BARRA_ALTERNADA);
  });
  return button;
}

export function syncActiveItem(navigation, documento = document) {
  const current = documento.querySelector('#nav [aria-current="page"]');
  const activeView = current?.dataset.view;
  navigation
    .querySelectorAll(".mobile-bottom-nav__item[data-view]")
    .forEach((item) => {
      const active = Boolean(activeView) && item.dataset.view === activeView;
      item.classList.toggle("is-active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
}

function sourcesConnected(navigation) {
  return Array.from(navigation.querySelectorAll("[data-source-id]")).every(
    (item) => document.getElementById(item.dataset.sourceId)?.isConnected,
  );
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
    navigation.appendChild(createNavigationItem(source, index));
  });
  navigation.appendChild(createMoreButton());
  document.body.appendChild(navigation);
  syncActiveItem(navigation);
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

function refreshFromMenu() {
  const navigation = document.getElementById("mobileBottomNav");
  if (navigation && sourcesConnected(navigation)) {
    syncActiveItem(navigation);
    return;
  }
  navigation?.remove();
  buildBottomNavigation();
}

export function initMobileBottomNavigation() {
  scheduleBuild();
  document.addEventListener(EVENTO_MENU_ATUALIZADO, refreshFromMenu);
  window.addEventListener("resize", syncVisibility, { passive: true });
  window.addEventListener("orientationchange", syncVisibility, {
    passive: true,
  });
}
