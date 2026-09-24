const MOBILE_BREAKPOINT = 900;
const SIDEBAR_SELECTOR =
  "#sidebar a, #sidebar button, .sidebar a, .sidebar button";
const SERVICE_WORKER_WARNING =
  "Service worker do AgSUS Monitora não foi registrado:";

function closeMobileSidebar() {
  document.body.classList.add("sidebar-collapsed");
  document.body.classList.remove("sidebar-open");

  const overlay = document.getElementById("sidebarOverlay");
  overlay?.classList.add("hidden");
}

function ensureSidebarOverlay() {
  if (document.getElementById("sidebarOverlay")) return;

  const overlay = document.createElement("button");
  overlay.id = "sidebarOverlay";
  overlay.className = "sidebar-overlay hidden";
  overlay.type = "button";
  overlay.setAttribute("aria-label", "Fechar menu");
  overlay.addEventListener("click", closeMobileSidebar);
  document.body.appendChild(overlay);
}

export function syncMobileState() {
  const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
  const body = document.body;
  const root = document.documentElement;

  root.classList.toggle("is-mobile-app", isMobile);
  body.classList.toggle("mobile-app", isMobile);

  const overlay = document.getElementById("sidebarOverlay");
  if (!overlay) return;

  const collapsed = body.classList.contains("sidebar-collapsed");
  const explicitlyOpen = body.classList.contains("sidebar-open");
  const sidebarOpen = isMobile && (!collapsed || explicitlyOpen);

  overlay.classList.toggle("hidden", !sidebarOpen);
}

function bindMobileInteractions() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const selectedSidebarItem = target.closest(SIDEBAR_SELECTOR);
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;

    if (selectedSidebarItem && isMobile) closeMobileSidebar();

    window.requestAnimationFrame(syncMobileState);
  });

  document.addEventListener("keydown", (event) => {
    const isEscape = event.key === "Escape";
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;

    if (isEscape && isMobile) closeMobileSidebar();
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  // No `npm run dev:frontend` o Vite serve módulos soltos que mudam a cada
  // edição. Um service worker guardava versões velhas e a tela de login ficava
  // carregando pela metade, sem CSS. Em dev, desfaz o que houver registrado.
  if (import.meta.env?.DEV && import.meta.env?.MODE !== "test") {
    navigator.serviceWorker
      .getRegistrations()
      .then((registros) => registros.forEach((r) => r.unregister()))
      .catch(() => {});
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn(SERVICE_WORKER_WARNING, error);
    });
  });
}

export function initMobileAppExperience() {
  ensureSidebarOverlay();
  syncMobileState();
  bindMobileInteractions();
  registerServiceWorker();

  window.addEventListener("resize", syncMobileState, { passive: true });
  window.addEventListener("orientationchange", syncMobileState, {
    passive: true,
  });
}
