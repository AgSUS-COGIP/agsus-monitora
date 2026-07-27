const SUPABASE_CDN_PATTERN = /\s*<script\b[^>]*\bsrc=(['"])https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^'"]*\1[^>]*>\s*<\/script>\s*/gi;
const ANALYTICS_FULL_URL_PATTERN = /page_location\s*:\s*window\.location\.href/g;
const ANALYTICS_SAFE_LOCATION = "page_location: window.location.origin + window.location.pathname";

export function stripSupabaseCdnScripts(html) {
  return String(html ?? "").replace(SUPABASE_CDN_PATTERN, "\n");
}

export function sanitizeAnalyticsPageLocation(html) {
  return String(html ?? "").replace(ANALYTICS_FULL_URL_PATTERN, ANALYTICS_SAFE_LOCATION);
}

export function secureHtmlDocument(html) {
  return sanitizeAnalyticsPageLocation(stripSupabaseCdnScripts(html));
}

export function createHtmlSecurityPlugin() {
  return {
    name: "agsus-html-security",
    enforce: "pre",
    transformIndexHtml(html) {
      return secureHtmlDocument(html);
    }
  };
}
