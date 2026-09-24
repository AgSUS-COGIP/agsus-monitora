import { getSupabaseClient } from "./supabaseClient.js";

const APP_VERSION = "csp-report-monitor-v1";
const REPORT_EVENT = "csp_report_only_violation";
const MAX_REPORTS_PER_SESSION = 20;
const SESSION_COUNT_KEY = "agsus_csp_report_count_v1";

let installed = false;
const reportedSignatures = new Set();

export function sanitizeBlockedUri(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (["inline", "eval", "data", "blob"].includes(raw)) return raw;

  try {
    const url = new URL(raw, window.location.origin);
    if (["http:", "https:", "ws:", "wss:"].includes(url.protocol)) {
      return url.origin;
    }
    return url.protocol;
  } catch {
    return raw.slice(0, 80);
  }
}

export function buildCspViolationDetails(event = {}) {
  return {
    effective_directive: String(event.effectiveDirective || ""),
    violated_directive: String(event.violatedDirective || ""),
    blocked_uri: sanitizeBlockedUri(event.blockedURI),
    disposition: String(event.disposition || "report"),
    source_file_origin: sanitizeBlockedUri(event.sourceFile),
    line_number: Number(event.lineNumber || 0),
    column_number: Number(event.columnNumber || 0),
    document_path: window.location.pathname || "/",
  };
}

function getReportCount() {
  try {
    return Number(window.sessionStorage.getItem(SESSION_COUNT_KEY) || 0);
  } catch {
    return 0;
  }
}

function incrementReportCount() {
  const next = getReportCount() + 1;
  try {
    window.sessionStorage.setItem(SESSION_COUNT_KEY, String(next));
  } catch {
    // O limite em memória continua válido mesmo sem sessionStorage.
  }
  return next;
}

function buildSignature(details) {
  return [
    details.effective_directive,
    details.blocked_uri,
    details.source_file_origin,
    details.document_path,
  ].join("|");
}

async function reportViolation(event) {
  if (getReportCount() >= MAX_REPORTS_PER_SESSION) return;

  const details = buildCspViolationDetails(event);
  const signature = buildSignature(details);
  if (reportedSignatures.has(signature)) return;
  reportedSignatures.add(signature);
  incrementReportCount();

  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { data } = await client.auth.getSession();
    if (!data?.session?.user?.id) return;

    await client.rpc("registrar_evento_acesso", {
      p_evento: REPORT_EVENT,
      p_tela: window.location.pathname.includes("analises")
        ? "analises"
        : "monitora",
      p_origem: "frontend-security",
      p_detalhes: details,
      p_client_session_id: "csp-report-monitor",
      p_user_agent: navigator.userAgent || "",
      p_app_version: APP_VERSION,
    });
  } catch (error) {
    console.warn("Falha ao registrar violação CSP:", error);
  }
}

export function installCspReportMonitor() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  document.addEventListener("securitypolicyviolation", (event) => {
    void reportViolation(event);
  });
}
