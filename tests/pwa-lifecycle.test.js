import { describe, expect, it } from "vitest";

import {
  isIosLike,
  isStandaloneDisplayMode,
  shouldCheckForUpdate,
  shouldShowIosInstallGuidance,
} from "../src/modules/pwa-lifecycle.js";

describe("pwa lifecycle helpers", () => {
  it("detecta iPhone pelo user agent", () => {
    expect(
      isIosLike({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        platform: "iPhone",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it("detecta iPad em modo desktop", () => {
    expect(
      isIosLike({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it("não classifica Android como iOS", () => {
    expect(
      isIosLike({
        userAgent:
          "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36",
        platform: "Linux armv8l",
        maxTouchPoints: 5,
      }),
    ).toBe(false);
  });

  it("reconhece execução standalone", () => {
    expect(isStandaloneDisplayMode({ standalone: true, matches: false })).toBe(
      true,
    );
    expect(isStandaloneDisplayMode({ standalone: false, matches: true })).toBe(
      true,
    );
  });

  it("exibe orientação somente em iOS não instalado e não dispensado", () => {
    expect(
      shouldShowIosInstallGuidance({
        iosLike: true,
        standalone: false,
        dismissed: false,
      }),
    ).toBe(true);
    expect(
      shouldShowIosInstallGuidance({
        iosLike: true,
        standalone: true,
        dismissed: false,
      }),
    ).toBe(false);
    expect(
      shouldShowIosInstallGuidance({
        iosLike: true,
        standalone: false,
        dismissed: true,
      }),
    ).toBe(false);
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
});
