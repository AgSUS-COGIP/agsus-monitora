import { expect, it } from "vitest";
import { renderNucleoTable } from "../src/lib/nucleo-table-render.js";

it("preserva decoração e foco quando os registros não mudam", () => {
  document.body.innerHTML = "<table><tbody></tbody></table>";
  const body = document.querySelector("tbody");
  const markup = "<tr><td>01</td></tr>";
  expect(renderNucleoTable(body, markup)).toBe(true);
  const button = document.createElement("button");
  body.querySelector("td").append(button);
  button.focus();
  expect(renderNucleoTable(body, markup)).toBe(false);
  expect(document.activeElement).toBe(button);
  expect(renderNucleoTable(body, "<tr><td>02</td></tr>")).toBe(true);
  expect(body.textContent).toBe("02");
});

it("repara linhas removidas ou substituídas externamente", () => {
  const body = document.createElement("tbody");
  const markup = "<tr><td>01</td></tr>";
  renderNucleoTable(body, markup);
  body.innerHTML = "";
  expect(renderNucleoTable(body, markup)).toBe(true);
  body.innerHTML = "<tr><td>outro</td></tr>";
  expect(renderNucleoTable(body, markup)).toBe(true);
  expect(body.textContent).toBe("01");
});
