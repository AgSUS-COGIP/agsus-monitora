import { expect, it, vi } from "vitest";

it("seleciona e limpa todas as unidades e editais", async () => {
  document.body.innerHTML = `
    <div id="scopeGuard">
      <div class="scope-guard-field">
        <label for="scopeGuardUnits">Unidades</label>
        <select id="scopeGuardUnits" multiple>
          <option value="DSEI  Parintins">DSEI  Parintins</option>
          <option value="DSEI Pernambuco">DSEI Pernambuco</option>
        </select>
      </div>
      <div class="scope-guard-field">
        <label for="scopeGuardEditais">Editais</label>
        <select id="scopeGuardEditais" multiple>
          <option value="22/2026">22/2026</option>
          <option value="23/2026">23/2026</option>
        </select>
      </div>
    </div>
  `;

  const units = document.getElementById("scopeGuardUnits");
  const changeSpy = vi.fn();
  units.addEventListener("change", changeSpy);

  vi.resetModules();
  await import("../../src/analises/analises-selection-tools.js");
  document.dispatchEvent(new Event("DOMContentLoaded"));

  const unitActions = units
    .closest(".scope-guard-field")
    .querySelectorAll(".scope-guard-link");
  expect(unitActions).toHaveLength(2);
  expect(units.options[0].textContent).toBe("DSEI Parintins");

  unitActions[0].click();
  expect([...units.options].every((option) => option.selected)).toBe(true);
  expect(changeSpy).toHaveBeenCalledTimes(1);

  unitActions[1].click();
  expect([...units.options].every((option) => !option.selected)).toBe(true);
  expect(changeSpy).toHaveBeenCalledTimes(2);
});
