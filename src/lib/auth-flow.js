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
