import { describe, expect, it, vi } from "vitest";
import {
  isMobileOAuthContext,
  startMobileGoogleOAuth,
} from "../src/lib/auth-flow.js";

/*
  O clique no celular (redirecionamento, sem popup) é decidido pela sessão do
  app: tests/app/sessao.test.js cobre o botão e a mensagem de erro.
*/

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
});
