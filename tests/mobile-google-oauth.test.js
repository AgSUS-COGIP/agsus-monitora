import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  initMobileGoogleOAuth,
  isMobileOAuthContext,
  startMobileGoogleOAuth,
} from "../src/modules/mobile-google-oauth.js";

beforeEach(() => {
  document.body.innerHTML = `
    <button id="googleLoginBtn" type="button" onclick="window.__legacyLogin?.()">Entrar</button>
    <div id="loginMsg" class="hidden"></div>
  `;
  delete window.__legacyLogin;
});

describe("mobile Google OAuth", () => {
  it("detecta navegadores mobile e iPad com user agent de desktop", () => {
    expect(
      isMobileOAuthContext({
        userAgent: "Mozilla/5.0 (iPhone)",
        platform: "iPhone",
      }),
    ).toBe(true);
    expect(
      isMobileOAuthContext({
        userAgent: "Mozilla/5.0 (Macintosh)",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
    expect(
      isMobileOAuthContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0)",
        platform: "Win32",
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });

  it("inicia OAuth sem executar signOut antes do redirecionamento", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ error: null });
    const clearAuthState = vi.fn();
    const removeItem = vi.fn();

    await startMobileGoogleOAuth({
      client: { auth: { signInWithOAuth } },
      authStorage: { clearAuthState },
      locationRef: new URL("https://agsus-monitora.vercel.app/"),
      sessionStorageRef: { removeItem },
      timeoutMs: 1000,
    });

    expect(clearAuthState).toHaveBeenCalledTimes(1);
    expect(removeItem).toHaveBeenCalledWith("agsus_oauth_callback_ok");
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google" }),
    );
  });

  it("intercepta o clique mobile antes do onclick legado", async () => {
    const legacyLogin = vi.fn();
    const startOAuth = vi.fn().mockResolvedValue(true);
    window.__legacyLogin = legacyLogin;

    expect(
      initMobileGoogleOAuth({ root: document, mobile: true, startOAuth }),
    ).toBe(true);

    document
      .getElementById("googleLoginBtn")
      .dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    await Promise.resolve();

    expect(startOAuth).toHaveBeenCalledTimes(1);
    expect(legacyLogin).not.toHaveBeenCalled();
  });

  it("reativa o botão e informa erro quando OAuth não inicia", async () => {
    const startOAuth = vi
      .fn()
      .mockRejectedValue(new Error("OAuth indisponível"));
    initMobileGoogleOAuth({ root: document, mobile: true, startOAuth });

    const button = document.getElementById("googleLoginBtn");
    button.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(button.disabled).toBe(false);
    expect(document.getElementById("loginMsg").textContent).toBe(
      "OAuth indisponível",
    );
  });
});
