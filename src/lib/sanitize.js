import DOMPurify from "dompurify";

const ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#039;"
};

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}

export function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

export function sanitizeHtml(value, config = {}) {
  return DOMPurify.sanitize(String(value ?? ""), config);
}

export function safeHttpUrl(value, baseUrl = globalThis.location?.origin) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, baseUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch (_) {
    return "";
  }
}
