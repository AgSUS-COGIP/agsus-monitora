import { beforeEach, describe, expect, it } from "vitest";
import { createSafeAuthStorage } from "../src/modules/auth-storage.js";

beforeEach(() => {
  localStorage.clear();
});

describe("auth-storage", () => {
  it("remove somente as chaves pertencentes ao AgSUS Monitora", () => {
    const storageKey = "agsus-monitora-auth";
    const storage = createSafeAuthStorage(storageKey);

    localStorage.setItem(storageKey, "sessao");
    localStorage.setItem(`${storageKey}-code-verifier`, "verificador");
    localStorage.setItem("sb-outro-sistema-auth-token", "preservar");
    localStorage.setItem("outro-supabase-app", "preservar");

    storage.clearAuthState();

    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(localStorage.getItem(`${storageKey}-code-verifier`)).toBeNull();
    expect(localStorage.getItem("sb-outro-sistema-auth-token")).toBe("preservar");
    expect(localStorage.getItem("outro-supabase-app")).toBe("preservar");
  });
});
