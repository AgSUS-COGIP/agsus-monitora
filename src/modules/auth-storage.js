function canUseStorage(storage, probeKey) {
  if (!storage) return false;
  try {
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return true;
  } catch (_) {
    return false;
  }
}

// prettier-ignore
export function createSafeAuthStorage(
  storageKey,
  {
    localStorageRef =
      typeof window !== "undefined" ? window.localStorage : null,
    sessionStorageRef =
      typeof window !== "undefined" ? window.sessionStorage : null,
  } = {},
) {
  const probeKey = `__agsus_probe_${storageKey}__`;
  const localAvailable = canUseStorage(localStorageRef, probeKey);
  const sessionAvailable = canUseStorage(sessionStorageRef, probeKey);
  const primary = localAvailable
    ? localStorageRef
    : sessionAvailable
      ? sessionStorageRef
      : null;
  const fallback =
    localAvailable && sessionAvailable ? sessionStorageRef : null;
  const mem = new Map();
  const ownedKeys = new Set([
    storageKey,
    `${storageKey}-code-verifier`,
    `${storageKey}-user`,
    `${storageKey}-session`,
  ]);

  function read(storage, key) {
    if (!storage) return null;
    try {
      return storage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function write(storage, key, value) {
    if (!storage) return false;
    try {
      storage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }

  function remove(storage, key) {
    if (!storage) return;
    try {
      storage.removeItem(key);
    } catch (_) {}
  }

  return {
    getItem(key) {
      const primaryValue = read(primary, key);
      if (primaryValue !== null) return primaryValue;

      const fallbackValue = read(fallback, key);
      if (fallbackValue !== null) return fallbackValue;

      return mem.has(key) ? mem.get(key) : null;
    },
    setItem(key, value) {
      const persisted = write(primary, key, value);

      // O verificador PKCE precisa sobreviver ao redirecionamento OAuth.
      // Em navegadores mobile com localStorage instável, mantemos também uma
      // cópia em sessionStorage, que permanece disponível ao voltar na mesma aba.
      if (key === `${storageKey}-code-verifier`) {
        write(fallback, key, value);
      }

      if (!persisted) mem.set(key, value);
    },
    removeItem(key) {
      remove(primary, key);
      remove(fallback, key);
      mem.delete(key);
    },
    clearAuthState() {
      mem.clear();
      ownedKeys.forEach((key) => {
        remove(primary, key);
        remove(fallback, key);
      });
    },
  };
}
