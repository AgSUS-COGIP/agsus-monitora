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
