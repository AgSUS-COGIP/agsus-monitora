import { expect, it, vi } from "vitest";

const flush = async () => {
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
};

it("ativa e remove o feedback de carregamento", async () => {
  document.body.innerHTML = `
    <div id="loading" class="loading show"></div>
    <main class="content"></main>
    <button id="refreshBtn"></button>
    <button id="applyBtn"></button>
    <button id="scopeGuardLoad"></button>
    <section id="kpiGrid"><article class="kpi"><b>100</b></article></section>
  `;

  vi.resetModules();
  await import("../../src/analises/analises-loading-feedback.js");
  document.dispatchEvent(new Event("DOMContentLoaded"));

  expect(document.body.classList.contains("analises-is-loading")).toBe(true);
  expect(document.querySelector("main").getAttribute("aria-busy")).toBe("true");
  expect(document.getElementById("refreshBtn").getAttribute("aria-busy")).toBe("true");

  document.getElementById("loading").classList.remove("show");
  await flush();

  expect(document.body.classList.contains("analises-is-loading")).toBe(false);
  expect(document.querySelector("main").getAttribute("aria-busy")).toBe("false");
});
