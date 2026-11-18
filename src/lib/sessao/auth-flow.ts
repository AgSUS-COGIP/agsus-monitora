import type { SupabaseClient } from "@supabase/supabase-js";

/** Onde a página está (`window.location` ou um substituto no teste). */
export type LocalDaPagina = { origin?: string; href?: string };

/** A parte da sessão do Supabase que esta conferência lê. */
export type SessaoConferida = {
  access_token?: string;
  user?: { id?: string } | null;
};

export function getOAuthCallbackUrl(
  locationLike: LocalDaPagina | null | undefined,
): string {
  const origin = String(locationLike?.origin || "").trim();
  if (origin && origin !== "null") {
    return new URL("/auth/callback.html", origin).toString();
  }

  const href = String(locationLike?.href || "").trim();
  return href ? ((href.split("#")[0] as string).split("?")[0] as string) : "";
}

export function isUsableSession(
  session: SessaoConferida | null | undefined,
  expectedUserId = "",
): boolean {
  if (!session?.access_token || !session?.user?.id) return false;
  return !expectedUserId || session.user.id === expectedUserId;
}

export const LOGIN_POPUP_MESSAGE = "agsus-monitora:login-concluido";

export function supportsLoginPopup(
  windowRef: Window | null | undefined = globalThis.window,
): windowRef is Window {
  return Boolean(windowRef?.open && Number(windowRef.innerWidth || 0) >= 768);
}

export function openLoginPopup(
  windowRef: Window | null | undefined = globalThis.window,
): Window | null {
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
  sessão (src/app/sessao.ts) ao clicar em "Entrar".
*/
const TEMPO_PARA_INICIAR_OAUTH_MS = 8000;

export function isMobileOAuthContext({
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
  platform = typeof navigator !== "undefined" ? navigator.platform : "",
  maxTouchPoints = typeof navigator !== "undefined"
    ? navigator.maxTouchPoints || 0
    : 0,
}: {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
} = {}): boolean {
  if (/Android|iPhone|iPad|iPod/i.test(userAgent)) return true;
  return platform === "MacIntel" && maxTouchPoints > 1;
}

function esgotarEm(ms: number) {
  return new Promise<never>((_, rejeitar) => {
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
}: {
  client?: Pick<SupabaseClient, "auth"> | null;
  authStorage?: { clearAuthState?: () => void } | null;
  locationRef?: LocalDaPagina | null;
  sessionStorageRef?: Pick<Storage, "removeItem"> | null;
  timeoutMs?: number;
} = {}): Promise<true> {
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
