import { beforeEach, describe, expect, it } from "vitest";
import { createSafeAuthStorage } from "../src/modules/auth-storage.js";

function createMemoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function createBrokenStorage() {
  return {
    getItem() {
      throw new Error("storage indisponivel");
    },
    setItem() {
      throw new Error("storage indisponivel");
    },
    removeItem() {
      throw new Error("storage indisponivel");
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
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
    expect(localStorage.getItem("sb-outro-sistema-auth-token")).toBe(
      "preservar",
    );
    expect(localStorage.getItem("outro-supabase-app")).toBe("preservar");
  });

  it("usa sessionStorage quando localStorage esta indisponivel no mobile", () => {
    const storageKey = "agsus-monitora-auth";
    const sessionFallback = createMemoryStorage();
    const storage = createSafeAuthStorage(storageKey, {
      localStorageRef: createBrokenStorage(),
      sessionStorageRef: sessionFallback,
    });

    storage.setItem(`${storageKey}-code-verifier`, "pkce-mobile");
    storage.setItem(storageKey, "sessao-mobile");

    expect(sessionFallback.getItem(`${storageKey}-code-verifier`)).toBe(
      "pkce-mobile",
    );
    expect(storage.getItem(`${storageKey}-code-verifier`)).toBe("pkce-mobile");
    expect(storage.getItem(storageKey)).toBe("sessao-mobile");
  });

  it("mantem copia do verificador PKCE em sessionStorage quando disponivel", () => {
    const storageKey = "agsus-monitora-auth";
    const local = createMemoryStorage();
    const session = createMemoryStorage();
    const storage = createSafeAuthStorage(storageKey, {
      localStorageRef: local,
      sessionStorageRef: session,
    });

    storage.setItem(`${storageKey}-code-verifier`, "verificador");

    expect(local.getItem(`${storageKey}-code-verifier`)).toBe("verificador");
    expect(session.getItem(`${storageKey}-code-verifier`)).toBe("verificador");

    storage.removeItem(`${storageKey}-code-verifier`);
    expect(local.getItem(`${storageKey}-code-verifier`)).toBeNull();
    expect(session.getItem(`${storageKey}-code-verifier`)).toBeNull();
  });

  it("nao quebra quando o navegador bloqueia o acesso as propriedades de storage", () => {
    const storageKey = "agsus-monitora-auth";
    const restrictedWindow = {};

    Object.defineProperties(restrictedWindow, {
      localStorage: {
        get() {
          throw new DOMException("Bloqueado", "SecurityError");
        },
      },
      sessionStorage: {
        get() {
          throw new DOMException("Bloqueado", "SecurityError");
        },
      },
    });

    expect(() =>
      createSafeAuthStorage(storageKey, { windowRef: restrictedWindow }),
    ).not.toThrow();

    const storage = createSafeAuthStorage(storageKey, {
      windowRef: restrictedWindow,
    });
    storage.setItem(storageKey, "sessao-em-memoria");
    expect(storage.getItem(storageKey)).toBe("sessao-em-memoria");
  });
});
