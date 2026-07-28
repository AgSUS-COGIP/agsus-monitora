import { describe, expect, it } from "vitest";
import {
  BACKGROUND_SUSPEND_DELAY_MS,
  shouldSuspendBackgroundResources,
} from "../src/lib/background-resource-lifecycle.js";

describe("background resource lifecycle", () => {
  it("usa atraso de dois minutos antes de suspender recursos", () => {
    expect(BACKGROUND_SUSPEND_DELAY_MS).toBe(120000);
  });

  it("suspende somente quando a aba está oculta", () => {
    expect(shouldSuspendBackgroundResources("hidden")).toBe(true);
    expect(shouldSuspendBackgroundResources("visible")).toBe(false);
    expect(shouldSuspendBackgroundResources("prerender")).toBe(false);
  });
});
