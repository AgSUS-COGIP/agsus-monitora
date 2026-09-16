import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  shouldCheckForUpdate,
  shouldReloadAfterControllerChange,
} from "../src/modules/pwa-lifecycle.js";

const lifecycleSource = readFileSync("src/modules/pwa-lifecycle.js", "utf8");
const mobileSource = readFileSync(
  "src/modules/mobile-app-experience.js",
  "utf8",
);

describe("ciclo web sem oferta de instalação", () => {
  it("não registra prompt nem orientação de instalação", () => {
    expect(lifecycleSource).not.toContain("beforeinstallprompt");
    expect(lifecycleSource).not.toContain("appinstalled");
    expect(lifecycleSource).not.toContain("Instalar AgSUS Monitora");
    expect(lifecycleSource).not.toContain("Instalar no iPhone ou iPad");
    expect(lifecycleSource).not.toContain("Adicionar à Tela de Início");
  });

  it("não injeta manifest nem meta tags de app instalável", () => {
    expect(mobileSource).not.toContain("manifest.webmanifest");
    expect(mobileSource).not.toContain("mobile-web-app-capable");
    expect(mobileSource).not.toContain("apple-mobile-web-app-capable");
  });

  it("preserva o service worker para atualização e operação offline", () => {
    expect(mobileSource).toContain(
      'navigator.serviceWorker.register("/sw.js")',
    );
    expect(lifecycleSource).toContain("navigator.serviceWorker.ready");
    expect(lifecycleSource).toContain("SKIP_WAITING");
  });

  it("verifica atualização somente online, visível e após o intervalo", () => {
    const base = {
      now: 1_000_000,
      lastCheckedAt: 100_000,
      online: true,
      visible: true,
      minimumInterval: 900_000,
    };

    expect(shouldCheckForUpdate(base)).toBe(true);
    expect(shouldCheckForUpdate({ ...base, online: false })).toBe(false);
    expect(shouldCheckForUpdate({ ...base, visible: false })).toBe(false);
    expect(shouldCheckForUpdate({ ...base, lastCheckedAt: 200_000 })).toBe(
      false,
    );
  });

  it("permite a primeira verificação sem histórico", () => {
    expect(
      shouldCheckForUpdate({
        now: 100,
        lastCheckedAt: 0,
        online: true,
        visible: true,
        minimumInterval: 900_000,
      }),
    ).toBe(true);
  });

  it("não recarrega em controllerchange não solicitado", () => {
    expect(
      shouldReloadAfterControllerChange({
        updateRequested: false,
        alreadyReloading: false,
      }),
    ).toBe(false);
  });

  it("recarrega uma única vez após atualização solicitada", () => {
    expect(
      shouldReloadAfterControllerChange({
        updateRequested: true,
        alreadyReloading: false,
      }),
    ).toBe(true);
    expect(
      shouldReloadAfterControllerChange({
        updateRequested: true,
        alreadyReloading: true,
      }),
    ).toBe(false);
  });
});
