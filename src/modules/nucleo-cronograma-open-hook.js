let initialized = false;

export function initNucleoCronogramaOpenHook() {
  if (initialized) return;
  initialized = true;

  const original = window.openEditModal;
  if (typeof original !== "function" || original.__cronogramaToolsOpenHook)
    return;

  const wrapped = (...args) => {
    const result = original(...args);
    const id = String(
      args[0] || document.getElementById("mId")?.value || "",
    ).trim();
    document.dispatchEvent(
      new CustomEvent("agsus:nucleo-cronograma-loaded", {
        detail: { id, source: "open-hook" },
      }),
    );
    return result;
  };

  wrapped.__cronogramaToolsOpenHook = true;
  wrapped.__original = original;
  window.openEditModal = wrapped;
}
