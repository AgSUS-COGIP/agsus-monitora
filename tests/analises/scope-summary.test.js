import { expect, it, vi } from "vitest";

const flushMutations = async () => {
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
};

it("recolhe o recorte após sucesso e reabre para alteração", async () => {
  document.body.innerHTML = `
    <select id="fSituacaoEdital"><option selected value="inativo">Inativo</option></select>
    <div id="kTotal">10.743</div>
    <div id="scopeGuard" class="scope-guard">
      <div class="scope-guard-head"></div>
      <div class="scope-guard-grid">
        <select id="scopeGuardUnits" multiple>
          <option selected>DSEI Parintins</option>
          <option selected>DSEI Pernambuco</option>
        </select>
        <select id="scopeGuardEditais" multiple>
          <option selected>22/2026</option>
          <option selected>23/2026</option>
        </select>
      </div>
      <div id="scopeGuardStatus" class="scope-guard-status">Carregando...</div>
    </div>
  `;

  vi.resetModules();
  await import("../../src/analises/analises-scope-summary.js");
  document.dispatchEvent(new Event("DOMContentLoaded"));

  const guard = document.getElementById("scopeGuard");
  const status = document.getElementById("scopeGuardStatus");
  const summary = document.getElementById("scopeGuardSummary");

  expect(summary.hidden).toBe(true);
  status.textContent = "Consulta concluída: 10.743 registro(s) no recorte.";
  await flushMutations();

  expect(guard.classList.contains("scope-guard--collapsed")).toBe(true);
  expect(summary.hidden).toBe(false);
  expect(summary.textContent).toContain("Inativo · 2 unidade(s) · 2 edital(is) · 10.743 registro(s)");

  document.getElementById("scopeGuardChange").click();
  expect(guard.classList.contains("scope-guard--collapsed")).toBe(false);
  expect(summary.hidden).toBe(true);

  status.textContent = "Consulta concluída: 10.743 registro(s) no recorte.";
  await flushMutations();
  document.getElementById("scopeGuardUnits").dispatchEvent(new Event("change", { bubbles:true }));
  expect(guard.classList.contains("scope-guard--collapsed")).toBe(false);

  status.classList.add("is-warning");
  status.textContent = "Não foi possível concluir a consulta.";
  await flushMutations();
  expect(guard.classList.contains("scope-guard--collapsed")).toBe(false);
});
