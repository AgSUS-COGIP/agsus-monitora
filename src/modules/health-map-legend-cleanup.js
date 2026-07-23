let initialized = false;

function removeDuplicateLegend() {
  const legacyLegend = document.getElementById("mapLegendDsei");
  const wrapper = legacyLegend?.parentElement;
  if (wrapper && wrapper.closest("#page-dashboard .map-card")) wrapper.remove();
}

export function initHealthMapLegendCleanup() {
  if (initialized) return;
  initialized = true;
  removeDuplicateLegend();
  document.addEventListener("agsus:health-map-rendered", removeDuplicateLegend);
}
