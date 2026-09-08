import { describe, expect, it } from "vitest";
import {
  ACCESS_BACKGROUND_MAX_BYTES,
  createAccessBackgroundPath,
  validateAccessBackgroundFile,
} from "../src/lib/access-background-storage.js";

describe("access background storage", () => {
  it("accepts supported images up to the bucket limit", () => {
    expect(
      validateAccessBackgroundFile({
        type: "image/webp",
        size: ACCESS_BACKGROUND_MAX_BYTES,
      }),
    ).toBe("");
  });

  it("rejects unsupported or oversized files", () => {
    expect(
      validateAccessBackgroundFile({ type: "image/svg+xml", size: 10 }),
    ).toContain("JPG");
    expect(
      validateAccessBackgroundFile({
        type: "image/png",
        size: ACCESS_BACKGROUND_MAX_BYTES + 1,
      }),
    ).toContain("2 MB");
  });

  it("creates immutable branding paths to avoid stale CDN content", () => {
    expect(
      createAccessBackgroundPath(
        { type: "image/png" },
        () => "123e4567-e89b-12d3-a456-426614174000",
      ),
    ).toBe("branding/acesso-123e4567-e89b-12d3-a456-426614174000.png");
  });
});
