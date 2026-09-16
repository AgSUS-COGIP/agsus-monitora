import { expect, it, vi } from "vitest";

const flushMutations = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

it("libera os KPIs após a consulta e mantém os controles de filtros independentes", async () => {
  document.body.innerHTML = `
    <div id="loading" class="show"></div>
    <section id="authWarning" hidden></section>
    <button id="refreshBtn"></button>
    <button id="exportBtn"></button>
    <button id="applyBtn"></button>
    <button id="clearBtn"></button>
    <button id="scopeGuardLoad"></button>
    <select id="fSituacaoEdital"><option value="inativo" selected>Inativo</option></select>
    <select id="scopeGuardUnits" multiple><option value="CASAI São Paulo" selected>CASAI São Paulo</option></select>
    <select id="scopeGuardEditais" multiple>
      <option value="38/2026" selected>38/2026</option>
      <option value="39/2026">39/2026</option>
    </select>
    <div id="scopeGuardStatus"></div>
    <div id="kTotal">1.422</div>
    <button id="advancedBtn"></button>
    <button id="toggleFiltersBtn"><i></i><span class="toggle-label"></span></button>
    <div id="filtersBody"></div>
    <div id="advancedFilters"></div>
    <main>
      <section class="filter-panel"></section>
      <section id="kpiGrid"></section>
    </main>
  `;

  vi.resetModules();
  await import("../../src/analises/analises-scope-safety.js");
  document.dispatchEvent(new Event("DOMContentLoaded"));

  const advancedBtn = document.getElementById("advancedBtn");
  const toggleBtn = document.getElementById("toggleFiltersBtn");
  const filtersBody = document.getElementById("filtersBody");
  const advancedFilters = document.getElementById("advancedFilters");

  expect(advancedBtn.textContent).toContain("Filtros avançados");
  expect(toggleBtn.textContent).toContain("Ocultar filtros");

  advancedBtn.click();
  expect(advancedFilters.classList.contains("show")).toBe(true);
  expect(advancedBtn.textContent).toContain("Ocultar avançados");

  toggleBtn.click();
  expect(filtersBody.hidden).toBe(true);
  expect(advancedBtn.hidden).toBe(true);
  expect(advancedFilters.classList.contains("show")).toBe(false);
  expect(toggleBtn.textContent).toContain("Mostrar filtros");

  toggleBtn.click();
  expect(filtersBody.hidden).toBe(false);
  expect(advancedBtn.hidden).toBe(false);
  expect(toggleBtn.textContent).toContain("Ocultar filtros");

  document.getElementById("scopeGuardLoad").click();
  document
    .getElementById("fSituacaoEdital")
    .dispatchEvent(new Event("change", { bubbles: true }));
  expect(document.body.classList.contains("historical-scope-pending")).toBe(
    true,
  );
  expect(document.getElementById("exportBtn").disabled).toBe(true);

  document.getElementById("loading").classList.remove("show");
  await flushMutations();

  expect(document.body.classList.contains("historical-scope-pending")).toBe(
    false,
  );
  expect(document.getElementById("exportBtn").disabled).toBe(false);
  expect(document.getElementById("scopeGuardStatus").textContent).toContain(
    "Consulta concluída: 1.422",
  );

  const editalSelect = document.getElementById("scopeGuardEditais");
  editalSelect.options[0].selected = false;
  editalSelect.options[1].selected = true;
  editalSelect.dispatchEvent(new Event("change", { bubbles: true }));
  expect(document.body.classList.contains("historical-scope-pending")).toBe(
    true,
  );

  document.getElementById("loading").classList.add("show");
  document.getElementById("scopeGuardLoad").click();
  document
    .getElementById("fSituacaoEdital")
    .dispatchEvent(new Event("change", { bubbles: true }));
  const authWarning = document.getElementById("authWarning");
  authWarning.hidden = false;
  authWarning.textContent = "Falha ao carregar o painel";
  document.getElementById("loading").classList.remove("show");
  await flushMutations();

  expect(document.body.classList.contains("historical-scope-pending")).toBe(
    true,
  );
  expect(document.getElementById("scopeGuardStatus").textContent).toContain(
    "não foi concluída",
  );
});
