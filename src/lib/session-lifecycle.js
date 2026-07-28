import { getSupabaseClient } from "./supabaseClient.js";

export const SESSION_IDLE_LIMIT_MS = 60 * 60 * 1000;
export const SESSION_WARNING_MS = 10 * 60 * 1000;
export const SESSION_CRITICAL_MS = 60 * 1000;

const ACTIVITY_STORAGE_KEY = "agsus_session_last_activity_v1";
const LOGOUT_STORAGE_KEY = "agsus_session_logout_v1";
const BROADCAST_CHANNEL_NAME = "agsus-session-lifecycle";
const ACTIVITY_SYNC_THROTTLE_MS = 5 * 1000;
const TICK_INTERVAL_MS = 1000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "input", "touchstart"];
const EXPIRED_MESSAGE = "Sua sessão foi encerrada após 1 hora de inatividade.";

let installed = false;
let activeUserId = "";
let lastActivityAt = 0;
let lastPersistedActivityAt = 0;
let tickHandle = null;
let authSubscription = null;
let broadcastChannel = null;
let expirationInProgress = false;
let warnedTenMinutes = false;
let warnedOneMinute = false;
let currentIdleLimitMs = SESSION_IDLE_LIMIT_MS;

export function formatSessionRemaining(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(Number(milliseconds || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function getRemainingSessionMs(
  activityAt,
  now = Date.now(),
  idleLimitMs = SESSION_IDLE_LIMIT_MS,
) {
  const activity = Number(activityAt || 0);
  if (!Number.isFinite(activity) || activity <= 0) return 0;
  return Math.max(0, idleLimitMs - Math.max(0, Number(now) - activity));
}

export function parseSessionActivityRecord(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    const userId = String(parsed?.userId || "").trim();
    const at = Number(parsed?.at || 0);
    if (!userId || !Number.isFinite(at) || at <= 0) return null;
    return { userId, at };
  } catch {
    return null;
  }
}

function storageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // O temporizador continua funcional mesmo sem armazenamento persistente.
  }
}

function storageRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Sem ação: a sessão já será removida pelo Supabase Auth.
  }
}

function ensureSessionUi() {
  if (!document.getElementById("agsus-session-lifecycle-style")) {
    const style = document.createElement("style");
    style.id = "agsus-session-lifecycle-style";
    style.textContent = `
      #agsusSessionTimer {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 9996;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 8px 11px;
        border: 1px solid rgba(15, 23, 42, .16);
        border-radius: 999px;
        background: rgba(255, 255, 255, .96);
        color: #0f172a;
        box-shadow: 0 8px 24px rgba(15, 23, 42, .14);
        font: 700 12px/1.2 Inter, system-ui, sans-serif;
        backdrop-filter: blur(10px);
      }
      #agsusSessionTimer[hidden] { display: none !important; }
      #agsusSessionTimer[data-level="warning"] {
        border-color: #d97706;
        color: #92400e;
        background: rgba(255, 251, 235, .98);
      }
      #agsusSessionTimer[data-level="critical"] {
        border-color: #dc2626;
        color: #991b1b;
        background: rgba(254, 242, 242, .98);
      }
      #agsusSessionNotice {
        position: fixed;
        top: 16px;
        left: 50%;
        z-index: 10001;
        width: min(92vw, 620px);
        transform: translateX(-50%);
        padding: 12px 16px;
        border-radius: 12px;
        background: #fffbeb;
        color: #78350f;
        border: 1px solid #f59e0b;
        box-shadow: 0 12px 32px rgba(15, 23, 42, .2);
        font: 700 14px/1.4 Inter, system-ui, sans-serif;
        text-align: center;
      }
      #agsusSessionNotice[data-level="critical"] {
        background: #fef2f2;
        color: #991b1b;
        border-color: #ef4444;
      }
      #agsusSessionNotice[hidden] { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  if (!document.getElementById("agsusSessionTimer")) {
    const timer = document.createElement("div");
    timer.id = "agsusSessionTimer";
    timer.hidden = true;
    timer.setAttribute("role", "timer");
    timer.setAttribute("aria-live", "off");
    timer.innerHTML =
      '<span aria-hidden="true">⏱</span><span id="agsusSessionTimerText"></span>';
    document.body.appendChild(timer);
  }

  if (!document.getElementById("agsusSessionNotice")) {
    const notice = document.createElement("div");
    notice.id = "agsusSessionNotice";
    notice.hidden = true;
    notice.setAttribute("role", "alert");
    notice.setAttribute("aria-live", "assertive");
    document.body.appendChild(notice);
  }
}

function updateTimerUi(remainingMs) {
  ensureSessionUi();
  const timer = document.getElementById("agsusSessionTimer");
  const text = document.getElementById("agsusSessionTimerText");
  if (!timer || !text) return;

  timer.hidden = !activeUserId;
  if (!activeUserId) return;

  text.textContent = `Sessão: ${formatSessionRemaining(remainingMs)}`;
  timer.dataset.level =
    remainingMs <= SESSION_CRITICAL_MS
      ? "critical"
      : remainingMs <= SESSION_WARNING_MS
        ? "warning"
        : "normal";
  timer.title = "O tempo é reiniciado quando você interage com o sistema.";
}

function showNotice(message, level = "warning", durationMs = 12000) {
  ensureSessionUi();
  const notice = document.getElementById("agsusSessionNotice");
  if (!notice) return;
  notice.textContent = message;
  notice.dataset.level = level;
  notice.hidden = false;
  window.clearTimeout(showNotice.hideHandle);
  if (durationMs > 0) {
    showNotice.hideHandle = window.setTimeout(() => {
      notice.hidden = true;
    }, durationMs);
  }
}

function hideSessionUi() {
  const timer = document.getElementById("agsusSessionTimer");
  if (timer) timer.hidden = true;
}

function renderExpiredMessage() {
  showNotice(EXPIRED_MESSAGE, "critical", 0);

  const loginMessage = document.getElementById("loginMsg");
  if (loginMessage) {
    loginMessage.textContent = EXPIRED_MESSAGE;
    loginMessage.className = "alert warn";
    loginMessage.classList.remove("hidden");
  }

  const authWarning = document.getElementById("authWarning");
  if (authWarning) {
    authWarning.textContent = EXPIRED_MESSAGE;
    authWarning.hidden = false;
  }
}

function readSharedActivity(userId) {
  const record = parseSessionActivityRecord(storageGet(ACTIVITY_STORAGE_KEY));
  return record?.userId === userId ? record : null;
}

function persistActivity(at) {
  if (!activeUserId) return;
  const record = { userId: activeUserId, at };
  storageSet(ACTIVITY_STORAGE_KEY, JSON.stringify(record));
  lastPersistedActivityAt = at;
  broadcastChannel?.postMessage({ type: "activity", ...record });
}

function registerActivity(at = Date.now(), forcePersist = false) {
  if (!activeUserId || expirationInProgress) return;
  lastActivityAt = Number(at) || Date.now();
  warnedTenMinutes = false;
  warnedOneMinute = false;

  if (
    forcePersist ||
    lastActivityAt - lastPersistedActivityAt >= ACTIVITY_SYNC_THROTTLE_MS
  ) {
    persistActivity(lastActivityAt);
  }
}

function handleUserActivity(event) {
  if (event && "isTrusted" in event && !event.isTrusted) return;
  registerActivity();
}

function createClientSessionId() {
  const key = "agsus_session_lifecycle_client_id";
  try {
    let value = window.sessionStorage.getItem(key);
    if (!value) {
      value = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(key, value);
    }
    return value;
  } catch {
    return `${Date.now()}-fallback`;
  }
}

async function auditExpiration(client) {
  try {
    const request = client.rpc("registrar_evento_acesso", {
      p_evento: "sessao_expirada_inatividade",
      p_tela: window.location.pathname || "/",
      p_origem: window.location.pathname.includes("analises")
        ? "analises"
        : "index",
      p_detalhes: { idle_limit_minutes: currentIdleLimitMs / 60000 },
      p_client_session_id: createClientSessionId(),
      p_user_agent: navigator.userAgent || "",
      p_app_version: "session-lifecycle-v1",
    });
    await Promise.race([
      request,
      new Promise((resolve) => window.setTimeout(resolve, 1500)),
    ]);
  } catch {
    // Auditoria não deve impedir o encerramento da sessão.
  }
}

function broadcastLogout() {
  if (!activeUserId) return;
  const message = {
    type: "logout",
    userId: activeUserId,
    at: Date.now(),
    reason: "idle_timeout",
  };
  storageSet(LOGOUT_STORAGE_KEY, JSON.stringify(message));
  broadcastChannel?.postMessage(message);
}

async function expireSession({ broadcast = true } = {}) {
  if (!activeUserId || expirationInProgress) return;
  expirationInProgress = true;
  const client = getSupabaseClient();

  if (broadcast) broadcastLogout();
  window.dispatchEvent(
    new CustomEvent("agsus:session-expired", {
      detail: { reason: "idle_timeout", idleLimitMs: currentIdleLimitMs },
    }),
  );

  if (client) {
    await auditExpiration(client);
    try {
      await client.removeAllChannels();
    } catch {
      // O logout continuará mesmo se não houver canais realtime ativos.
    }
    try {
      await client.auth.signOut({ scope: "local" });
    } catch {
      // A interface ainda será bloqueada localmente pelo encerramento abaixo.
    }
  }

  stopActiveSession({ clearActivity: true });
  renderExpiredMessage();
  window.setTimeout(renderExpiredMessage, 80);
  expirationInProgress = false;
}

function warnWhenNeeded(remainingMs) {
  if (remainingMs <= SESSION_CRITICAL_MS && !warnedOneMinute) {
    warnedOneMinute = true;
    showNotice(
      "Sua sessão será encerrada por inatividade em menos de 1 minuto. Interaja com o sistema para continuar.",
      "critical",
      0,
    );
    return;
  }

  if (remainingMs <= SESSION_WARNING_MS && !warnedTenMinutes) {
    warnedTenMinutes = true;
    showNotice(
      "Sua sessão será encerrada por inatividade em 10 minutos. Interaja com o sistema para continuar.",
      "warning",
    );
  }
}

function tickSession() {
  if (!activeUserId || expirationInProgress) return;

  const shared = readSharedActivity(activeUserId);
  if (shared && shared.at > lastActivityAt) {
    lastActivityAt = shared.at;
    warnedTenMinutes = false;
    warnedOneMinute = false;
  }

  const remainingMs = getRemainingSessionMs(
    lastActivityAt,
    Date.now(),
    currentIdleLimitMs,
  );
  updateTimerUi(remainingMs);
  warnWhenNeeded(remainingMs);

  if (remainingMs <= 0) {
    void expireSession();
  }
}

function startActiveSession(session) {
  const userId = String(session?.user?.id || "").trim();
  if (!userId) return;

  activeUserId = userId;
  expirationInProgress = false;
  const now = Date.now();
  const signedInAt = Date.parse(session?.user?.last_sign_in_at || "");
  const shared = readSharedActivity(userId);
  const sharedBelongsToCurrentLogin =
    shared && (!Number.isFinite(signedInAt) || shared.at >= signedInAt - 5000);

  lastActivityAt = sharedBelongsToCurrentLogin ? shared.at : now;
  lastPersistedActivityAt = sharedBelongsToCurrentLogin ? shared.at : 0;
  warnedTenMinutes = false;
  warnedOneMinute = false;

  if (!sharedBelongsToCurrentLogin) persistActivity(lastActivityAt);
  if (!tickHandle)
    tickHandle = window.setInterval(tickSession, TICK_INTERVAL_MS);
  tickSession();
}

function stopActiveSession({ clearActivity = true } = {}) {
  const userId = activeUserId;
  activeUserId = "";
  lastActivityAt = 0;
  lastPersistedActivityAt = 0;
  warnedTenMinutes = false;
  warnedOneMinute = false;
  hideSessionUi();

  if (tickHandle) {
    window.clearInterval(tickHandle);
    tickHandle = null;
  }

  if (clearActivity) {
    const record = parseSessionActivityRecord(storageGet(ACTIVITY_STORAGE_KEY));
    if (!record || !userId || record.userId === userId) {
      storageRemove(ACTIVITY_STORAGE_KEY);
    }
  }
}

function handleBroadcastMessage(message) {
  if (!message || message.userId !== activeUserId) return;
  if (message.type === "activity" && Number(message.at) > lastActivityAt) {
    lastActivityAt = Number(message.at);
    warnedTenMinutes = false;
    warnedOneMinute = false;
  }
  if (message.type === "logout") {
    void expireSession({ broadcast: false });
  }
}

function handleStorageEvent(event) {
  if (event.key === ACTIVITY_STORAGE_KEY) {
    const record = parseSessionActivityRecord(event.newValue);
    if (record?.userId === activeUserId && record.at > lastActivityAt) {
      lastActivityAt = record.at;
      warnedTenMinutes = false;
      warnedOneMinute = false;
    }
  }

  if (event.key === LOGOUT_STORAGE_KEY) {
    const message = parseSessionActivityRecord(event.newValue);
    if (message?.userId === activeUserId) {
      void expireSession({ broadcast: false });
    }
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible") tickSession();
}

export function installSessionLifecycle({
  idleLimitMs = SESSION_IDLE_LIMIT_MS,
} = {}) {
  if (installed || typeof window === "undefined") return;
  installed = true;
  currentIdleLimitMs = Math.max(60 * 1000, Number(idleLimitMs));
  ensureSessionUi();

  for (const eventName of ACTIVITY_EVENTS) {
    document.addEventListener(eventName, handleUserActivity, {
      capture: true,
      passive: eventName !== "keydown" && eventName !== "input",
    });
  }
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("storage", handleStorageEvent);

  if ("BroadcastChannel" in window) {
    broadcastChannel = new window.BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannel.addEventListener("message", (event) => {
      handleBroadcastMessage(event.data);
    });
  }

  const client = getSupabaseClient();
  if (!client) return;

  const { data } = client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      stopActiveSession({ clearActivity: true });
      return;
    }
    if (event === "SIGNED_IN" && session?.user) {
      startActiveSession(session);
    }
  });
  authSubscription = data?.subscription || null;

  void client.auth.getSession().then(({ data: sessionData }) => {
    if (sessionData?.session?.user) startActiveSession(sessionData.session);
  });
}

export function resetSessionLifecycleForTests() {
  stopActiveSession({ clearActivity: false });
  authSubscription?.unsubscribe?.();
  authSubscription = null;
  broadcastChannel?.close?.();
  broadcastChannel = null;
  installed = false;
  expirationInProgress = false;
}
