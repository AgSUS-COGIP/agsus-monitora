import { getSupabaseClient } from "../lib/supabaseClient.js";

const PHOTO_ID = "googleProfilePhoto";

function safeText(value) {
  return String(value ?? "").trim();
}

export function getGoogleProfilePhotoUrl(user) {
  return (
    safeText(user?.user_metadata?.avatar_url) ||
    safeText(user?.user_metadata?.picture)
  );
}

export function renderGoogleProfilePhoto(user, root = document) {
  const existing = root.getElementById?.(PHOTO_ID) || null;
  const container = root.querySelector?.(".side-user") || null;
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

  if (!existing) container.prepend(image);
  return image;
}

export async function syncGoogleProfilePhoto(client, root = document) {
  if (!client?.auth) return null;

  try {
    const { data } = await client.auth.getSession();
    return renderGoogleProfilePhoto(data?.session?.user || null, root);
  } catch (_) {
    return renderGoogleProfilePhoto(null, root);
  }
}

export function initGoogleProfilePhoto(
  client = getSupabaseClient(),
  root = document,
) {
  if (!client?.auth) return null;

  void syncGoogleProfilePhoto(client, root);
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    renderGoogleProfilePhoto(session?.user || null, root);
  });

  return data?.subscription || null;
}
