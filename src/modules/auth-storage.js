export function createSafeAuthStorage(storageKey) {
  let backing = null;
  try {
    const probe = "__agsus_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    backing = window.localStorage;
  } catch (_) {
    backing = null;
  }

  const mem = new Map();
  return {
    getItem(key) {
      try {
        return backing ? backing.getItem(key) : (mem.has(key) ? mem.get(key) : null);
      } catch (_) {
        return mem.has(key) ? mem.get(key) : null;
      }
    },
    setItem(key, value) {
      try {
        backing ? backing.setItem(key, value) : mem.set(key, value);
      } catch (_) {
        mem.set(key, value);
      }
    },
    removeItem(key) {
      try {
        backing ? backing.removeItem(key) : mem.delete(key);
      } catch (_) {
        mem.delete(key);
      }
    },
    clearAuthState() {
      mem.clear();
      if (!backing) return;
      try {
        backing.removeItem(storageKey);
        Object.keys(backing)
          .filter((key) => key.startsWith("sb-") || key.includes("supabase") || key.includes("agsus-monitora-auth"))
          .forEach((key) => backing.removeItem(key));
      } catch (_) {}
    }
  };
}
