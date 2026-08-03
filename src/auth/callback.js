import { hasSupabaseEnv } from "../lib/env.js";
import { isUsableSession } from "../lib/auth-flow.js";
import { getSupabaseClient } from "../lib/supabaseClient.js";

export function callbackResultUrl(result) {
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

function redirectHome(result) {
  window.location.replace(callbackResultUrl(result));
}

export async function finishOAuth({
  locationRef = window.location,
  sessionStorageRef = window.sessionStorage,
  resolveClient = getSupabaseClient,
  redirect = redirectHome,
} = {}) {
  const search = new URLSearchParams(locationRef.search || "");
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
    } catch (_) {}
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
