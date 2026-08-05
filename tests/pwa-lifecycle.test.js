import { describe, expect, it } from "vitest";

import {
  isIosLike,
  isStandaloneDisplayMode,
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
});
