import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACCESS_BRANDING,
  needsLightForeground,
  normalizeAccessBackgroundUrl,
  normalizeAccessLogoUrl,
  normalizeAccessPanelColor,
} from "../src/lib/access-branding.js";

describe("access branding", () => {
  it("accepts secure and local background URLs", () => {
    expect(
      normalizeAccessBackgroundUrl("https://example.org/campaign.png"),
    ).toBe("https://example.org/campaign.png");
    expect(normalizeAccessBackgroundUrl("/assets/campaign.png")).toBe(
      "/assets/campaign.png",
    );
  });

  it("rejects unsafe background URLs", () => {
    expect(normalizeAccessBackgroundUrl("javascript:alert(1)")).toBe(
      DEFAULT_ACCESS_BRANDING.backgroundUrl,
    );
  });

  it("uses the official local AgSUS logo by default", () => {
    expect(normalizeAccessLogoUrl("")).toBe("/assets/agsus-logo.webp");
    expect(normalizeAccessLogoUrl("https://example.org/agsus.svg")).toBe(
      "https://example.org/agsus.svg",
    );
    expect(normalizeAccessLogoUrl("data:image/svg+xml,unsafe")).toBe(
      "/assets/agsus-logo.webp",
    );
  });

  it("normalizes panel color and contrast", () => {
    expect(normalizeAccessPanelColor("#C296EB")).toBe("#c296eb");
    expect(normalizeAccessPanelColor("purple")).toBe(
      DEFAULT_ACCESS_BRANDING.panelColor,
    );
    expect(needsLightForeground("#101c2a")).toBe(true);
    expect(needsLightForeground("#ffffff")).toBe(false);
  });
});
