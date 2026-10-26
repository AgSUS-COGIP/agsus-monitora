/** O armazenamento do navegador, no que a sessão usa. */
type ArmazenamentoWeb = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type NomeDoArmazenamento = "localStorage" | "sessionStorage";

/** A janela (ou o que faz as vezes dela nos testes). */
type JanelaDoArmazenamento = Partial<
  Record<NomeDoArmazenamento, ArmazenamentoWeb | null | undefined>
>;

export interface OpcoesDoArmazenamentoSeguro {
  windowRef?: JanelaDoArmazenamento | null;
  localStorageRef?: ArmazenamentoWeb | null;
  sessionStorageRef?: ArmazenamentoWeb | null;
}

/** O armazenamento que o cliente do Supabase recebe, com a limpeza da sessão. */
export interface ArmazenamentoSeguroDaSessao {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clearAuthState(): void;
}

function canUseStorage(
  storage: ArmazenamentoWeb | null | undefined,
  probeKey: string,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return true;
  } catch (_) {
    return false;
  }
}

function getWindowStorage(
  windowRef: JanelaDoArmazenamento | null | undefined,
  name: NomeDoArmazenamento,
): ArmazenamentoWeb | null {
  if (!windowRef) return null;
  try {
    return windowRef[name] || null;
  } catch (_) {
    return null;
  }
}

function resolveStorageOption(
  options: OpcoesDoArmazenamentoSeguro,
  optionName: "localStorageRef" | "sessionStorageRef",
  windowRef: JanelaDoArmazenamento | null | undefined,
  storageName: NomeDoArmazenamento,
): ArmazenamentoWeb | null | undefined {
  if (Object.prototype.hasOwnProperty.call(options, optionName)) {
    return options[optionName];
  }
  return getWindowStorage(windowRef, storageName);
}

export function createSafeAuthStorage(
  storageKey: string,
  options: OpcoesDoArmazenamentoSeguro = {},
): ArmazenamentoSeguroDaSessao {
  const windowRef = Object.prototype.hasOwnProperty.call(options, "windowRef")
    ? options.windowRef
    : typeof window !== "undefined"
      ? window
      : null;
  const localStorageRef = resolveStorageOption(
    options,
    "localStorageRef",
    windowRef,
    "localStorage",
  );
  const sessionStorageRef = resolveStorageOption(
    options,
    "sessionStorageRef",
    windowRef,
    "sessionStorage",
  );
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
  const mem = new Map<string, string>();
  const ownedKeys = new Set([
    storageKey,
    `${storageKey}-code-verifier`,
    `${storageKey}-user`,
    `${storageKey}-session`,
  ]);

  function read(
    storage: ArmazenamentoWeb | null | undefined,
    key: string,
  ): string | null {
    if (!storage) return null;
    try {
      return storage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function write(
    storage: ArmazenamentoWeb | null | undefined,
    key: string,
    value: string,
  ): boolean {
    if (!storage) return false;
    try {
      storage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }

  function remove(storage: ArmazenamentoWeb | null | undefined, key: string) {
    if (!storage) return;
    try {
      storage.removeItem(key);
    } catch {
      // Armazenamento bloqueado ou cota estourada: a limpeza é melhor
      // esforço e não deve derrubar quem chamou.
    }
  }

  return {
    getItem(key) {
      const primaryValue = read(primary, key);
      if (primaryValue !== null) return primaryValue;

      const fallbackValue = read(fallback, key);
      if (fallbackValue !== null) return fallbackValue;

      return mem.has(key) ? mem.get(key)! : null;
    },
    setItem(key, value) {
      const persisted = write(primary, key, value);

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
