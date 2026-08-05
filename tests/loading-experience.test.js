import { beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.useFakeTimers();
  document.body.className = "config-loading";
  document.body.innerHTML = `
    <div id="loader" class="loader">
      <div class="loader-card">
        <div class="loader-spin"></div>
        <div>
          <div id="loaderTitle" class="loader-title"></div>
          <div id="loaderSub" class="loader-sub"></div>
        </div>
        <div id="loaderPct" class="loader-pct">0%</div>
        <div class="loader-bar"><span id="loaderBar"></span></div>
      </div>
    </div>
  `;
});

it("exibe o carregamento inicial com mensagem acessível", async () => {
  vi.resetModules();
  const { initLoadingExperience } = await import(
    "../src/modules/loading-experience.js"
  );

  initLoadingExperience();

  const loader = document.getElementById("loader");
  expect(loader.classList.contains("show")).toBe(true);
  expect(loader.getAttribute("role")).toBe("status");
  expect(document.body.getAttribute("aria-busy")).toBe("true");
  expect(document.getElementById("loaderTitle").textContent).toBe(
    "Preparando o AgSUS Monitora",
  );
  expect(document.getElementById("loaderMeta").textContent).toContain(
    "Etapa 1",
  );
});

it("oferece nova tentativa após uma espera prolongada", async () => {
  vi.setSystemTime(new Date("2026-08-05T13:00:00Z"));
  vi.resetModules();
  const { initLoadingExperience } = await import(
    "../src/modules/loading-experience.js"
  );

  initLoadingExperience();
  vi.advanceTimersByTime(25_000);

  expect(document.getElementById("loaderRetry").hidden).toBe(false);
  expect(document.getElementById("loaderMeta").textContent).toContain(
    "demorando mais que o normal",
  );
});
