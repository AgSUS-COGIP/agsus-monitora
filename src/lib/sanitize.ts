import DOMPurify, { type Config } from "dompurify";

const ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ESCAPE_MAP[char as keyof typeof ESCAPE_MAP],
  );
}

export function sanitizeHtml(value: unknown, config: Config = {}) {
  return DOMPurify.sanitize(String(value ?? ""), config);
}

export function safeHttpUrl(
  value: unknown,
  baseUrl: string | URL | undefined = globalThis.location?.origin,
): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, baseUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch (_) {
    return "";
  }
}
