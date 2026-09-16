import { beforeEach, afterEach, expect, it, vi } from "vitest";

const instances = vi.hoisted(() => []);

vi.mock("tom-select", () => ({
  default: class TomSelectMock {
    constructor(select) {
      this.input = select;
      this.options = [];
      instances.push(this);
    }
    clear() {
      [...this.input.options].forEach((option) => {
        option.selected = false;
      });
    }
    clearOptions() {
      this.options = [];
    }
    addOptions(options) {
      this.options = options;
    }
    setValue(values) {
      const selected = new Set(Array.isArray(values) ? values : [values]);
      [...this.input.options].forEach((option) => {
        option.selected = selected.has(option.value);
      });
    }
    refreshOptions() {}
    close() {}
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  instances.length = 0;
  document.body.innerHTML = `
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
      </select>
    </div>
  `;
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

it("oferece seleção em massa e sincroniza opções somente por evento explícito", async () => {
  vi.resetModules();
  await import("../../src/analises/analises-modern-selects.js");
  document.dispatchEvent(new Event("DOMContentLoaded"));
  await vi.runOnlyPendingTimersAsync();

  expect(instances).toHaveLength(2);

  const unitField = document
    .getElementById("scopeGuardUnits")
    .closest(".scope-guard-field");
  const selectAll = [...unitField.querySelectorAll("button")].find(
    (button) => button.textContent === "Selecionar tudo",
  );
  const clear = [...unitField.querySelectorAll("button")].find(
    (button) => button.textContent === "Limpar",
  );

  selectAll.click();
  expect(
    [...document.getElementById("scopeGuardUnits").selectedOptions].map(
      (option) => option.value,
    ),
  ).toEqual(["DSEI  Parintins", "DSEI Pernambuco"]);

  clear.click();
  expect(
    document.getElementById("scopeGuardUnits").selectedOptions,
  ).toHaveLength(0);

  const editalSelect = document.getElementById("scopeGuardEditais");
  editalSelect.innerHTML = `
    <option value="22/2026">22/2026</option>
    <option value="23/2026" selected>23/2026</option>
  `;

  expect(instances[1].options).toEqual([]);
  editalSelect.dispatchEvent(new CustomEvent("agsus:options-updated"));

  expect(instances[1].options.map((option) => option.value)).toEqual([
    "22/2026",
    "23/2026",
  ]);
  expect(
    [...editalSelect.selectedOptions].map((option) => option.value),
  ).toEqual(["23/2026"]);
});
