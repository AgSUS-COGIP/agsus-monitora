import { hasSupabaseEnv } from "../lib/env";
import { isUsableSession, LOGIN_POPUP_MESSAGE } from "../lib/auth-flow";
import { getSupabaseClient } from "../lib/supabaseClient";
import type { SessaoConferida } from "../lib/auth-flow";

/** Resultado do retorno do OAuth, levado à página principal. */
export type ResultadoDoCallback =
  | "success"
  | "missing_env"
  | "missing_code"
  | "supabase_unavailable"
  | "oauth_callback";

/** A parte do cliente do Supabase que o retorno do OAuth usa. */
export type ClienteDoCallback = {
  auth?: {
    exchangeCodeForSession?: (code: string) => Promise<{
      data: { session?: SessaoConferida | null } | null;
      error: unknown;
    }>;
  };
};

export type OpcoesDoCallback = {
  locationRef?: Pick<Location, "search"> | null;
  sessionStorageRef?: Pick<Storage, "setItem"> | null;
  resolveClient?: () => ClienteDoCallback | null;
  redirect?: (result: ResultadoDoCallback) => void;
};

export function callbackResultUrl(result: string): string {
  switch (result) {
    case "success":
      return "/?auth=google";
    case "missing_env":
      return "/?auth_error=missing_env";
    case "missing_code":
      return "/?auth_error=missing_code";
    case "supabase_unavailable":
      return "/?auth_error=supabase_unavailable";
    default:
      return "/?auth_error=oauth_callback";
  }
}

function redirectHome(result: ResultadoDoCallback): void {
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(
        { type: LOGIN_POPUP_MESSAGE, result },
        window.location.origin,
      );
      window.close();
      return;
    } catch (_) {
      // Se o navegador bloquear a comunicação, preserva o retorno tradicional.
    }
  }
  window.location.replace(callbackResultUrl(result));
}

function safeWindowValue<K extends "location" | "sessionStorage">(
  name: K,
): Window[K] | null {
  if (typeof window === "undefined") return null;
  try {
    return window[name] || null;
  } catch (_) {
    return null;
  }
}

export async function finishOAuth(
  options: OpcoesDoCallback = {},
): Promise<boolean> {
  const locationRef = Object.prototype.hasOwnProperty.call(
    options,
    "locationRef",
  )
    ? options.locationRef
    : safeWindowValue("location");
  const sessionStorageRef = Object.prototype.hasOwnProperty.call(
    options,
    "sessionStorageRef",
  )
    ? options.sessionStorageRef
    : safeWindowValue("sessionStorage");
  const resolveClient = options.resolveClient || getSupabaseClient;
  const redirect = options.redirect || redirectHome;
  const search = new URLSearchParams(locationRef?.search || "");
  const code = search.get("code");

  if (!hasSupabaseEnv()) {
    redirect("missing_env");
    return false;
  }

  if (!code) {
    redirect("missing_code");
    return false;
  }

  const client = resolveClient();
  if (!client?.auth?.exchangeCodeForSession) {
    redirect("supabase_unavailable");
    return false;
  }

  try {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    if (!isUsableSession(data?.session)) {
      throw new Error("Sessão OAuth sem token de acesso utilizável.");
    }
    try {
      sessionStorageRef?.setItem?.(
        "agsus_oauth_callback_ok",
        String(Date.now()),
      );
    } catch (_) {
      // Armazenamento bloqueado (aba privada): o marcador é só uma conveniência.
    }
    redirect("success");
    return true;
  } catch (error) {
    console.error("Falha ao finalizar OAuth:", error);
    redirect("oauth_callback");
    return false;
  }
}

if (typeof window !== "undefined") {
  finishOAuth();
}
