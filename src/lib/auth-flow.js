export function getOAuthCallbackUrl(locationLike) {
  const origin = String(locationLike?.origin || "").trim();
  if (origin && origin !== "null") {
    return new URL("/auth/callback.html", origin).toString();
  }

  const href = String(locationLike?.href || "").trim();
  return href ? href.split("#")[0].split("?")[0] : "";
}

export function isUsableSession(session, expectedUserId = "") {
  if (!session?.access_token || !session?.user?.id) return false;
  return !expectedUserId || session.user.id === expectedUserId;
}

export const LOGIN_POPUP_MESSAGE = "agsus-monitora:login-concluido";

export function supportsLoginPopup(windowRef = globalThis.window) {
  return Boolean(windowRef?.open && Number(windowRef.innerWidth || 0) >= 768);
}

export function openLoginPopup(windowRef = globalThis.window) {
  if (!supportsLoginPopup(windowRef)) return null;
  const width = 520;
  const height = 680;
  const left = Math.max(
    0,
    Number(windowRef.screenX || 0) +
      (Number(windowRef.outerWidth || width) - width) / 2,
  );
  const top = Math.max(
    0,
    Number(windowRef.screenY || 0) +
      (Number(windowRef.outerHeight || height) - height) / 3,
  );
  return windowRef.open(
    "about:blank",
    "agsus-monitora-login",
    `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)}`,
  );
}

/*
  Login Google no celular e no iPad: redirecionamento de página inteira, sem
  popup e sem `signOut` antes (só o estado guardado é limpo). Quem chama é a
  sessão (src/app/sessao.js) ao clicar em "Entrar".
*/
const TEMPO_PARA_INICIAR_OAUTH_MS = 8000;

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

function esgotarEm(ms) {
  return new Promise((_, rejeitar) => {
    setTimeout(() => {
      rejeitar(
        new Error("O login Google demorou para iniciar. Tente novamente."),
      );
    }, ms);
  });
}

export async function startMobileGoogleOAuth({
  client,
  authStorage,
  locationRef = typeof window !== "undefined" ? window.location : null,
  sessionStorageRef = null,
  timeoutMs = TEMPO_PARA_INICIAR_OAUTH_MS,
} = {}) {
  if (!client?.auth?.signInWithOAuth) {
    throw new Error("Autenticação Google indisponível.");
  }

  try {
    authStorage?.clearAuthState?.();
  } catch (_) {
    // Sem acesso ao armazenamento: o login segue e o Supabase grava o estado novo.
  }
  try {
    sessionStorageRef?.removeItem?.("agsus_oauth_callback_ok");
  } catch (_) {
    // Armazenamento bloqueado (aba privada): não há marcador para limpar.
  }

  const { error } = await Promise.race([
    client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getOAuthCallbackUrl(locationRef),
        queryParams: {
          prompt: "select_account consent",
          max_age: "0",
        },
      },
    }),
    esgotarEm(Math.max(1000, Number(timeoutMs) || TEMPO_PARA_INICIAR_OAUTH_MS)),
  ]);

  if (error) throw error;
  return true;
}
