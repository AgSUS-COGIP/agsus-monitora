import { getOAuthCallbackUrl } from "../lib/auth-flow.js";
import {
  getSupabaseAuthStorage,
  getSupabaseClient,
} from "../lib/supabaseClient.js";

const DEFAULT_OAUTH_TIMEOUT_MS = 8000;

export function isMobileOAuthContext({
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
  platform = typeof navigator !== "undefined" ? navigator.platform : "",
  maxTouchPoints = typeof navigator !== "undefined"
    ? navigator.maxTouchPoints || 0
    : 0,
} = {}) {
  if (/Android|iPhone|iPad|iPod/i.test(userAgent)) return true;
  return platform === "MacIntel" && maxTouchPoints > 1;
}

function safeSessionMarkerClear(sessionStorageRef) {
  try {
    sessionStorageRef?.removeItem?.("agsus_oauth_callback_ok");
  } catch (_) {}
}

function timeoutAfter(timeoutMs) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(
        new Error("O login Google demorou para iniciar. Tente novamente."),
      );
    }, timeoutMs);
  });
}

export async function startMobileGoogleOAuth({
  client = getSupabaseClient(),
  authStorage = getSupabaseAuthStorage(),
  locationRef = typeof window !== "undefined" ? window.location : null,
  sessionStorageRef = typeof window !== "undefined"
    ? (() => {
        try {
          return window.sessionStorage;
        } catch (_) {
          return null;
        }
      })()
    : null,
  timeoutMs = DEFAULT_OAUTH_TIMEOUT_MS,
} = {}) {
  if (!client?.auth?.signInWithOAuth) {
    throw new Error("Autenticação Google indisponível.");
  }

  try {
    authStorage?.clearAuthState?.();
  } catch (_) {}
  safeSessionMarkerClear(sessionStorageRef);

  const redirectTo = getOAuthCallbackUrl(locationRef);
  const oauthPromise = client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        prompt: "select_account consent",
        max_age: "0",
      },
    },
  });

  const { error } = await Promise.race([
    oauthPromise,
    timeoutAfter(Math.max(1000, Number(timeoutMs) || DEFAULT_OAUTH_TIMEOUT_MS)),
  ]);

  if (error) throw error;
  return true;
}

function showLoginError(root, message) {
  const target = root?.getElementById?.("loginMsg");
  if (!target) return;
  target.textContent = message;
  target.classList.remove("ok", "warn", "error");
  target.classList.add("error");
  target.classList.remove("hidden");
}

export function initMobileGoogleOAuth({
  root = typeof document !== "undefined" ? document : null,
  mobile = isMobileOAuthContext(),
  startOAuth = startMobileGoogleOAuth,
} = {}) {
  if (!root || !mobile) return false;

  const button = root.getElementById?.("googleLoginBtn");
  if (!button || button.dataset.mobileOauthSafe === "1") return Boolean(button);

  button.dataset.mobileOauthSafe = "1";
  button.addEventListener(
    "click",
    async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (button.disabled) return;

      button.disabled = true;
      try {
        await startOAuth();
      } catch (error) {
        button.disabled = false;
        showLoginError(
          root,
          error?.message ||
            "Não foi possível abrir o login Google. Tente novamente.",
        );
      }
    },
    true,
  );

  return true;
}
