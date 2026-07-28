export const BACKGROUND_SUSPEND_DELAY_MS = 2 * 60 * 1000;

let installed = false;
let suspendHandle = null;
let suspended = false;

export function shouldSuspendBackgroundResources(visibilityState) {
  return visibilityState === "hidden";
}

function dispatch(name) {
  window.dispatchEvent(new CustomEvent(name));
}

function suspend() {
  suspendHandle = null;
  if (suspended || document.visibilityState !== "hidden") return;
  suspended = true;
  dispatch("agsus:background-suspend");
}

function resume() {
  if (suspendHandle) {
    window.clearTimeout(suspendHandle);
    suspendHandle = null;
  }
  if (!suspended) return;
  suspended = false;
  dispatch("agsus:background-resume");
}

function handleVisibilityChange() {
  if (shouldSuspendBackgroundResources(document.visibilityState)) {
    if (!suspendHandle && !suspended) {
      suspendHandle = window.setTimeout(suspend, BACKGROUND_SUSPEND_DELAY_MS);
    }
    return;
  }
  resume();
}

export function installBackgroundResourceLifecycle() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  document.addEventListener("visibilitychange", handleVisibilityChange);
  handleVisibilityChange();
}
