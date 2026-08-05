import { expect, it, vi } from "vitest";

const flushLoadingState = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 300));
};

it("ativa e remove o feedback de carregamento", async () => {
  document.body.innerHTML = `
    <div id="loading" class="loading show">
      <div class="loading-card">
        <div id="loadingTitle">Carregando painel</div>
        <small id="loadingText">Preparando dados...</small>
        <div id="progressBar" style="width: 10%"></div>
      </div>
    </div>
    <main class="content"></main>
    <button id="refreshBtn"></button>
    <button id="applyBtn"></button>
    <button id="scopeGuardLoad"></button>
    <section id="kpiGrid"><article class="kpi"><b>100</b></article></section>
  `;

  vi.resetModules();
  await import("../../src/analises/analises-loading-feedback.js");
  document.dispatchEvent(new Event("DOMContentLoaded"));

  const loading = document.getElementById("loading");
  const refreshButton = document.getElementById("refreshBtn");

  expect(document.body.classList.contains("analises-is-loading")).toBe(true);
  expect(loading.getAttribute("role")).toBe("status");
  expect(document.querySelector("main").getAttribute("aria-busy")).toBe(
    "true",
  );
  expect(refreshButton.getAttribute("aria-busy")).toBe("true");
  expect(refreshButton.disabled).toBe(true);
  expect(document.getElementById("loadingTitle").textContent).toBe(
    "Preparando o painel de análises",
  );
  expect(document.getElementById("analisesLoadingMeta").textContent).toContain(
    "Etapa 1",
  );

  loading.classList.remove("show");
  await flushLoadingState();

  expect(document.body.classList.contains("analises-is-loading")).toBe(false);
  expect(document.querySelector("main").getAttribute("aria-busy")).toBe(
    "false",
  );
  expect(refreshButton.disabled).toBe(false);
});
