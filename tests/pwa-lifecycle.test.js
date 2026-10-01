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

describe("versão nova espera a troca de página", () => {
  it("sem versão nova esperando, não recarrega", async () => {
    const { aplicarAtualizacaoPendente, marcarAtualizacaoPendenteParaTeste } =
      await import("../src/modules/pwa-lifecycle.js");
    marcarAtualizacaoPendenteParaTeste(false);
    let recargas = 0;
    expect(aplicarAtualizacaoPendente(() => (recargas += 1))).toBe(false);
    expect(recargas).toBe(0);
  });

  it("com versão nova esperando, recarrega uma vez só", async () => {
    const { aplicarAtualizacaoPendente, marcarAtualizacaoPendenteParaTeste } =
      await import("../src/modules/pwa-lifecycle.js");
    marcarAtualizacaoPendenteParaTeste(true);
    let recargas = 0;
    expect(aplicarAtualizacaoPendente(() => (recargas += 1))).toBe(true);
    expect(aplicarAtualizacaoPendente(() => (recargas += 1))).toBe(false);
    expect(recargas).toBe(1);
  });

  it("a troca de controlador não recarrega na hora (quem digita não perde o texto)", () => {
    const trecho = lifecycleSource.slice(
      lifecycleSource.indexOf('addEventListener("controllerchange"'),
    );
    const handler = trecho.slice(
      0,
      trecho.indexOf("export function aplicarAtualizacaoPendente"),
    );
    expect(handler).not.toContain("location.reload");
    expect(handler).toContain("atualizacaoPendente = true");
  });

  it("o navigate aplica a versão nova depois da guarda de alterações não salvas", () => {
    const legado = readFileSync("src/modules/legacy-app.js", "utf8").replace(
      /\r\n/g,
      "\n",
    );
    const corpo = legado.slice(legado.indexOf("function navigate(view)"));
    const guarda = corpo.indexOf("estadoDasConfiguracoes.confirmarSaida()");
    const aplica = corpo.indexOf("aplicarAtualizacaoPendente(");
    expect(guarda).toBeGreaterThan(-1);
    expect(aplica).toBeGreaterThan(guarda);
    expect(aplica).toBeLessThan(
      corpo.indexOf("rememberView(requestedView)") + 1,
    );
  });
});
