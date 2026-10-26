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

it("mantem o login inicial sem overlay de carregamento", async () => {
  vi.resetModules();
  const { initLoadingExperience } =
    await import("../src/modules/loading-experience.js");

  initLoadingExperience();

  const loader = document.getElementById("loader");
  expect(loader.classList.contains("show")).toBe(false);
  expect(loader.getAttribute("role")).toBe("status");
  expect(loader.getAttribute("aria-hidden")).toBe("true");
  expect(document.body.getAttribute("aria-busy")).toBe("false");
  expect(document.getElementById("loaderMeta")).toBeNull();
});

it("melhora o carregamento quando ele for ativado apos o login", async () => {
  vi.setSystemTime(new Date("2026-08-05T13:00:00Z"));
  vi.resetModules();
  const { initLoadingExperience } =
    await import("../src/modules/loading-experience.js");

  const { mostrarCarregamento } = await import("../src/app/avisos.ts");

  initLoadingExperience();
  document.body.classList.remove("config-loading");
  mostrarCarregamento(true);

  expect(document.body.getAttribute("aria-busy")).toBe("true");
  expect(document.getElementById("loaderTitle").textContent).toBe(
    "Preparando o AgSUS Monitora",
  );
  expect(document.getElementById("loaderMeta").textContent).toContain(
    "Etapa 1",
  );

  vi.advanceTimersByTime(25_000);

  expect(document.getElementById("loaderRetry").hidden).toBe(false);
  expect(document.getElementById("loaderMeta").textContent).toContain(
    "demorando mais que o normal",
  );
});

/*
  22/10: um setInterval de 250 ms conferia o #loader para sempre, mesmo sem
  carregamento. Agora quem mostra ou esconde avisa, e o relógio só corre
  com o carregamento à vista.
*/
it("sem carregamento, nenhum relógio fica rodando", async () => {
  vi.resetModules();
  const { initLoadingExperience } =
    await import("../src/modules/loading-experience.js");
  const { mostrarCarregamento } = await import("../src/app/avisos.ts");
  document.body.classList.remove("config-loading");

  initLoadingExperience();
  expect(vi.getTimerCount()).toBe(0);

  mostrarCarregamento(true, "Editais", "Salvando…", 70);
  expect(document.body.getAttribute("aria-busy")).toBe("true");
  expect(vi.getTimerCount()).toBe(1);

  mostrarCarregamento(false);
  expect(document.body.getAttribute("aria-busy")).toBe("false");
  expect(vi.getTimerCount()).toBe(0);
});
