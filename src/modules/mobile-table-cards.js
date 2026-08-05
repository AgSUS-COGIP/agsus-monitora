const MOBILE_BREAKPOINT = 900;
const TABLE_SELECTOR = "table:not([data-mobile-table='scroll'])";
const EXCLUDED_TABLE_SELECTOR =
  "[role='grid'], .calendar, .timeline, .matrix, [data-mobile-table='off']";

export function normalizeTableHeader(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getTableHeaders(table) {
  const headerCells = table.querySelectorAll("thead th");
  return Array.from(headerCells).map((cell, index) => {
    return normalizeTableHeader(cell.textContent) || `Campo ${index + 1}`;
  });
}

export function shouldEnhanceTable(table) {
  if (!(table instanceof HTMLTableElement)) return false;
  if (table.matches(EXCLUDED_TABLE_SELECTOR)) return false;
  if (!table.tHead || !table.tBodies.length) return false;

  const headers = getTableHeaders(table);
  return headers.length > 0;
}

export function enhanceTableForMobile(table) {
  if (!shouldEnhanceTable(table)) return false;

  const headers = getTableHeaders(table);
  const rows = table.querySelectorAll("tbody tr");

  rows.forEach((row) => {
    Array.from(row.cells).forEach((cell, index) => {
      const label = headers[index] || `Campo ${index + 1}`;
      cell.dataset.mobileLabel = label;
    });
  });

  table.classList.add("mobile-card-table");
  table.dataset.mobileEnhanced = "true";
  return true;
}

export function enhanceVisibleTables(root = document) {
  if (window.innerWidth > MOBILE_BREAKPOINT) return 0;

  return Array.from(root.querySelectorAll(TABLE_SELECTOR)).reduce(
    (count, table) => count + Number(enhanceTableForMobile(table)),
    0,
  );
}

function scheduleEnhancement() {
  window.requestAnimationFrame(() => enhanceVisibleTables());
}

export function initMobileTableCards() {
  scheduleEnhancement();

  document.addEventListener("click", scheduleEnhancement);
  document.addEventListener("change", scheduleEnhancement);
  document.addEventListener("agsus:content-updated", scheduleEnhancement);
  window.addEventListener("resize", scheduleEnhancement, { passive: true });
  window.addEventListener("orientationchange", scheduleEnhancement, {
    passive: true,
  });
}
