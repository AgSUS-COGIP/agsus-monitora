import type { SupabaseClient, Subscription } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabaseClient";

/** O usuário da sessão, no que a foto lê. */
type UsuarioComFoto =
  | { user_metadata?: { avatar_url?: unknown; picture?: unknown } | null }
  | null
  | undefined;

/** O cliente do Supabase, no que a foto usa (a sessão e a troca dela). */
type ClienteDaFoto = Pick<SupabaseClient, "auth"> | null | undefined;

const PHOTO_ID = "googleProfilePhoto";

function safeText(value: unknown): string {
  return String(value ?? "").trim();
}

export function getGoogleProfilePhotoUrl(user: UsuarioComFoto): string {
  return (
    safeText(user?.user_metadata?.avatar_url) ||
    safeText(user?.user_metadata?.picture)
  );
}

export function renderGoogleProfilePhoto(
  user: UsuarioComFoto,
  root: Document = document,
): HTMLImageElement | null {
  const existing =
    (root.getElementById?.(PHOTO_ID) as HTMLImageElement | null) || null;
  const container = root.getElementById?.("topUserAvatar") || null;
  const photoUrl = getGoogleProfilePhotoUrl(user);

  if (!container || !photoUrl) {
    existing?.remove();
    return null;
  }

  const image = existing || root.createElement("img");
  image.id = PHOTO_ID;
  image.className = "google-profile-photo";
  image.alt = "Foto da conta Google";
  image.referrerPolicy = "no-referrer";
  image.loading = "lazy";
  image.decoding = "async";
  image.src = photoUrl;

  if (!existing) {
    container.replaceChildren(image);
  }
  return image;
}

export async function syncGoogleProfilePhoto(
  client: ClienteDaFoto,
  root: Document = document,
): Promise<HTMLImageElement | null> {
  if (!client?.auth) return null;

  try {
    const { data } = await client.auth.getSession();
    return renderGoogleProfilePhoto(data?.session?.user || null, root);
  } catch (_) {
    return renderGoogleProfilePhoto(null, root);
  }
}

export function initGoogleProfilePhoto(
  client: ClienteDaFoto = getSupabaseClient(),
  root: Document = document,
): Subscription | null {
  if (!client?.auth) return null;

  void syncGoogleProfilePhoto(client, root);
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    renderGoogleProfilePhoto(session?.user || null, root);
  });

  return data?.subscription || null;
}
