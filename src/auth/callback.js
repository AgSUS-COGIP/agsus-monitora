import { SUPABASE_AUTH_STORAGE_KEY, SUPABASE_KEY, SUPABASE_URL } from "../lib/env.js";

function redirectHome(params = "") {
  window.location.replace(`/${params}`);
}

async function finishOAuth() {
  const search = new URLSearchParams(window.location.search || "");
  const code = search.get("code");

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    redirectHome("?auth_error=missing_env");
    return;
  }

  if (!code) {
    redirectHome("?auth_error=missing_code");
    return;
  }

  if (!window.supabase) {
    redirectHome("?auth_error=supabase_unavailable");
    return;
  }

  try {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    try { sessionStorage.setItem("agsus_oauth_callback_ok", String(Date.now())); } catch (_) {}
    redirectHome("?auth=google");
  } catch (error) {
    console.error("Falha ao finalizar OAuth:", error);
    redirectHome("?auth_error=oauth_callback");
  }
}

finishOAuth();
