const SUPABASE_CDN_PATTERN = /\s*<script\b[^>]*\bsrc=(['"])https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^'"]*\1[^>]*>\s*<\/script>\s*/gi;

export function stripSupabaseCdnScripts(html) {
  return String(html ?? "").replace(SUPABASE_CDN_PATTERN, "\n");
}

export function createHtmlSecurityPlugin() {
  return {
    name: "agsus-html-security",
    enforce: "pre",
    transformIndexHtml(html) {
      return stripSupabaseCdnScripts(html);
    }
  };
}
